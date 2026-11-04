from __future__ import annotations

import os
import platform
import secrets
import shutil
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .generation import MODEL_ID, MODEL_REPO, MODEL_REVISION, ModelNotInstalled, QwenGenerator
from .jobs import JobStore
from .model_install import ModelInstallCancelled, ModelInstaller
from .security import PairingManager
from .paths import default_data_dir
from .system_info import memory_available_gib, memory_total_gib
from .storage import LocalOutputStore, LocalRecordingStore, RecordingError


class PairRequest(BaseModel):
    code: str | None = Field(default=None, min_length=8, max_length=64)


class GenerationRequest(BaseModel):
    recording_id: str = Field(min_length=36, max_length=36)
    text: str = Field(min_length=1, max_length=1_000)
    model_id: str = MODEL_ID


class InstallModelRequest(BaseModel):
    accept_license: bool


def _model_cache_dir() -> Path:
    return Path(os.environ.get("HF_HOME", Path.home() / ".cache/huggingface"))


def create_app() -> FastAPI:
    port = int(os.environ.get("LOCAL_VOICE_PORT", "8765"))
    allowed_origins = tuple(
        origin.strip().rstrip("/")
        for origin in os.environ.get(
            "LOCAL_VOICE_ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
        ).split(",")
        if origin.strip()
    )
    pairing_code = os.environ.get("LOCAL_VOICE_PAIRING_CODE") or secrets.token_urlsafe(9)
    auto_pair_enabled = os.environ.get("LOCAL_VOICE_AUTO_PAIR") == "1"
    pairing = PairingManager(pairing_code)
    data_dir = Path(os.environ.get("LOCAL_VOICE_DATA_DIR") or default_data_dir())
    recordings = LocalRecordingStore(data_dir)
    outputs = LocalOutputStore(data_dir)
    jobs = JobStore(data_dir)
    generator = QwenGenerator()
    installer = ModelInstaller()
    install_cancellations: dict[str, threading.Event] = {}
    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="voice-generation")

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        jobs.recover_interrupted()
        if not os.environ.get("LOCAL_VOICE_PAIRING_CODE") and not auto_pair_enabled:
            print(f"Voice Studio one-time pairing code: {pairing_code}", file=sys.stderr, flush=True)
        yield
        executor.shutdown(wait=False, cancel_futures=True)

    app = FastAPI(title="Voice Studio Local Runtime", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(allowed_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Local-Request"],
        max_age=300,
    )

    @app.middleware("http")
    async def validate_local_request(request: Request, call_next):
        host = request.headers.get("host", "").lower()
        if host not in {f"127.0.0.1:{port}", f"localhost:{port}"}:
            return _error(400, "invalid_host")
        origin = request.headers.get("origin")
        if origin is not None and origin.rstrip("/") not in allowed_origins:
            return _error(403, "origin_not_allowed")
        return await call_next(request)

    def require_session(authorization: str | None, local_request: str | None) -> None:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail={"code": "pairing_required"})
        if local_request != "1":
            raise HTTPException(status_code=403, detail={"code": "local_request_header_required"})
        if not pairing.is_authorized(authorization.removeprefix("Bearer ")):
            raise HTTPException(status_code=401, detail={"code": "session_expired"})

    @app.get("/api/v1/health")
    async def health():
        return {"status": "ok", "version": app.version, "api_version": "v1", "os": platform.system()}

    @app.post("/api/v1/pair")
    async def pair(payload: PairRequest, request: Request, x_local_request: str | None = Header(default=None)):
        if payload.code:
            session = pairing.exchange(payload.code)
        elif auto_pair_enabled:
            origin = request.headers.get("origin")
            if not origin or origin.rstrip("/") not in allowed_origins:
                raise HTTPException(status_code=403, detail={"code": "origin_not_allowed"})
            if x_local_request != "1":
                raise HTTPException(status_code=403, detail={"code": "local_request_header_required"})
            session = pairing.create_session()
        else:
            session = None
        if session is None:
            raise HTTPException(status_code=401, detail={"code": "invalid_or_expired_pairing_code"})
        if not auto_pair_enabled:
            next_code = pairing.rotate_code()
            print(f"Voice Studio next one-time pairing code: {next_code}", file=sys.stderr, flush=True)
        return {"access_token": session.token, "expires_in": 43_200, "token_type": "Bearer"}

    @app.get("/api/v1/system")
    async def system(authorization: str | None = Header(default=None), x_local_request: str | None = Header(default=None)):
        require_session(authorization, x_local_request)
        return {
            "os": platform.system(),
            "architecture": platform.machine(),
            "cpu_logical_count": os.cpu_count(),
            "memory_total_gib": memory_total_gib(),
            "memory_available_gib": memory_available_gib(),
            "model_cache_disk_free_gib": round(shutil.disk_usage(_model_cache_dir() if _model_cache_dir().exists() else _model_cache_dir().parent).free / (1024**3), 2),
        }

    @app.post("/api/v1/recordings", status_code=201)
    async def save_recording(
        file: UploadFile = File(...),
        transcript: str = Form(...),
        authorization: str | None = Header(default=None),
        x_local_request: str | None = Header(default=None),
    ):
        require_session(authorization, x_local_request)
        if file.content_type not in {"audio/wav", "audio/x-wav", "application/octet-stream"}:
            raise HTTPException(status_code=415, detail={"code": "unsupported_audio_type"})
        audio = await file.read(24 * 1024 * 1024 + 1)
        if len(audio) > 24 * 1024 * 1024:
            raise HTTPException(status_code=413, detail={"code": "recording_too_large"})
        try:
            return recordings.save(audio, transcript)
        except RecordingError as error:
            raise HTTPException(status_code=400, detail={"code": str(error)}) from error

    @app.get("/api/v1/recordings")
    async def list_recordings(
        authorization: str | None = Header(default=None),
        x_local_request: str | None = Header(default=None),
    ):
        require_session(authorization, x_local_request)
        return {"items": recordings.list()}

    @app.get("/api/v1/recordings/{recording_id}/audio")
    async def get_recording_audio(
        recording_id: str,
        authorization: str | None = Header(default=None),
        x_local_request: str | None = Header(default=None),
    ):
        require_session(authorization, x_local_request)
        try:
            path = recordings.audio_path(recording_id)
        except RecordingError as error:
            raise HTTPException(status_code=400, detail={"code": str(error)}) from error
        if recordings.get(recording_id) is None:
            raise HTTPException(status_code=404, detail={"code": "recording_not_found"})
        return FileResponse(path, media_type="audio/wav", filename=f"{recording_id}.wav")

    @app.delete("/api/v1/recordings/{recording_id}", status_code=204)
    async def delete_recording(
        recording_id: str,
        authorization: str | None = Header(default=None),
        x_local_request: str | None = Header(default=None),
    ):
        require_session(authorization, x_local_request)
        try:
            deleted = recordings.delete(recording_id)
        except RecordingError as error:
            raise HTTPException(status_code=400, detail={"code": str(error)}) from error
        if not deleted:
            raise HTTPException(status_code=404, detail={"code": "recording_not_found"})
        return None

    @app.get("/api/v1/models")
    async def list_models(
        authorization: str | None = Header(default=None),
        x_local_request: str | None = Header(default=None),
    ):
        require_session(authorization, x_local_request)
        model_installed = generator.is_installed()
        is_installing = any(job.get("kind") == "model_install" and job.get("status") == "downloading" for job in jobs.list())
        cache_disk_free = round(shutil.disk_usage(_model_cache_dir() if _model_cache_dir().exists() else _model_cache_dir().parent).free / (1024**3), 2)
        return {"items": [{"id": MODEL_ID, "repository": MODEL_REPO, "revision": MODEL_REVISION, "status": "installed" if model_installed else "installing" if is_installing else "not_installed", "language": "Korean", "license": "Apache-2.0", "download_size_bytes": 2_520_000_000, "disk_free_gib": cache_disk_free, "memory_available_gib": memory_available_gib(), "memory_recommended_free_gib": 5.7}]}

    def run_model_install(job_id: str, cancel_event: threading.Event) -> None:
        try:
            jobs.update(job_id, status="downloading", downloaded_bytes=0, total_bytes=None, progress_percent=None)
            installer.download(
                cancel_event=cancel_event,
                on_progress=lambda downloaded, total: jobs.update(
                    job_id,
                    status="downloading",
                    downloaded_bytes=downloaded,
                    total_bytes=total,
                    progress_percent=round(downloaded * 100 / total, 1) if total else None,
                ),
            )
            if cancel_event.is_set():
                raise ModelInstallCancelled("download_cancelled")
            if not generator.is_installed():
                raise RuntimeError("downloaded_snapshot_incomplete")
            jobs.update(job_id, status="completed", downloaded_bytes=2_520_000_000, progress_percent=100)
        except ModelInstallCancelled:
            jobs.update(job_id, status="cancelled", error_code="download_cancelled")
        except Exception as error:
            jobs.update(job_id, status="failed", error_code="download_failed", error_type=type(error).__name__)
        finally:
            install_cancellations.pop(job_id, None)

    @app.post("/api/v1/models/{model_id}/install", status_code=202)
    async def install_model(
        model_id: str,
        payload: InstallModelRequest,
        authorization: str | None = Header(default=None),
        x_local_request: str | None = Header(default=None),
    ):
        require_session(authorization, x_local_request)
        if model_id != MODEL_ID:
            raise HTTPException(status_code=404, detail={"code": "unsupported_model"})
        if not payload.accept_license:
            raise HTTPException(status_code=400, detail={"code": "license_confirmation_required"})
        if generator.is_installed():
            raise HTTPException(status_code=409, detail={"code": "model_already_installed"})
        cache_disk_free = shutil.disk_usage(_model_cache_dir() if _model_cache_dir().exists() else _model_cache_dir().parent).free
        if cache_disk_free < 8 * 1024**3:
            raise HTTPException(status_code=409, detail={"code": "disk_space_insufficient"})
        if jobs.active_count() > 0:
            raise HTTPException(status_code=409, detail={"code": "local_job_running"})
        job = jobs.create("model_install", model_id=MODEL_ID)
        cancellation = threading.Event()
        install_cancellations[job["id"]] = cancellation
        executor.submit(run_model_install, job["id"], cancellation)
        return job

    @app.post("/api/v1/jobs/{job_id}/cancel", status_code=202)
    async def cancel_job(
        job_id: str,
        authorization: str | None = Header(default=None),
        x_local_request: str | None = Header(default=None),
    ):
        require_session(authorization, x_local_request)
        job = jobs.get(job_id)
        cancellation = install_cancellations.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail={"code": "job_not_found"})
        if job.get("kind") != "model_install" or cancellation is None or job.get("status") != "downloading":
            raise HTTPException(status_code=409, detail={"code": "job_not_cancellable"})
        cancellation.set()
        return {"status": "cancellation_requested"}

    def run_generation(job_id: str, recording: dict, audio_path: Path, text: str) -> None:
        try:
            audio, metrics = generator.generate(
                audio_path=audio_path,
                transcript=recording["transcript"],
                text=text,
                on_phase=lambda status: jobs.update(job_id, status=status),
            )
            output = outputs.save(audio, {
                "model_id": MODEL_ID,
                "recording_id": recording["id"],
                "text": text,
                **metrics,
            })
            jobs.update(job_id, status="completed", output_id=output["id"], output=output)
        except Exception as error:
            message = str(error).lower()
            code = "memory_insufficient" if isinstance(error, MemoryError) or "out of memory" in message else "model_not_installed" if isinstance(error, ModelNotInstalled) else "generation_failed"
            jobs.update(job_id, status="failed", error_code=code, error_type=type(error).__name__)

    @app.post("/api/v1/generations", status_code=202)
    async def create_generation(
        payload: GenerationRequest,
        authorization: str | None = Header(default=None),
        x_local_request: str | None = Header(default=None),
    ):
        require_session(authorization, x_local_request)
        if payload.model_id != MODEL_ID:
            raise HTTPException(status_code=400, detail={"code": "unsupported_model"})
        if not payload.text.strip():
            raise HTTPException(status_code=400, detail={"code": "text_required"})
        if jobs.active_count() > 0:
            raise HTTPException(status_code=409, detail={"code": "generation_already_running"})
        recording = recordings.get(payload.recording_id)
        if recording is None:
            raise HTTPException(status_code=404, detail={"code": "recording_not_found"})
        audio_path = recordings.audio_path(payload.recording_id)
        if not audio_path.is_file():
            raise HTTPException(status_code=404, detail={"code": "recording_audio_missing"})
        if not generator.is_installed():
            raise HTTPException(status_code=409, detail={"code": "model_not_installed"})
        available_memory_gib = memory_available_gib()
        if not generator.is_loaded and available_memory_gib is not None and available_memory_gib < 5.7:
            raise HTTPException(status_code=409, detail={"code": "memory_insufficient"})
        job = jobs.create("generation", model_id=MODEL_ID, recording_id=recording["id"], text=payload.text.strip())
        executor.submit(run_generation, job["id"], recording, audio_path, payload.text.strip())
        return job

    @app.get("/api/v1/jobs/{job_id}")
    async def get_job(
        job_id: str,
        authorization: str | None = Header(default=None),
        x_local_request: str | None = Header(default=None),
    ):
        require_session(authorization, x_local_request)
        job = jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail={"code": "job_not_found"})
        return job

    @app.get("/api/v1/outputs")
    async def list_outputs(
        authorization: str | None = Header(default=None),
        x_local_request: str | None = Header(default=None),
    ):
        require_session(authorization, x_local_request)
        return {"items": outputs.list()}

    @app.get("/api/v1/outputs/{output_id}/audio")
    async def get_output_audio(
        output_id: str,
        authorization: str | None = Header(default=None),
        x_local_request: str | None = Header(default=None),
    ):
        require_session(authorization, x_local_request)
        try:
            path = outputs.audio_path(output_id)
        except RecordingError as error:
            raise HTTPException(status_code=400, detail={"code": str(error)}) from error
        if outputs.get(output_id) is None:
            raise HTTPException(status_code=404, detail={"code": "output_not_found"})
        return FileResponse(path, media_type="audio/wav", filename=f"{output_id}.wav")

    @app.delete("/api/v1/outputs/{output_id}", status_code=204)
    async def delete_output(
        output_id: str,
        authorization: str | None = Header(default=None),
        x_local_request: str | None = Header(default=None),
    ):
        require_session(authorization, x_local_request)
        try:
            deleted = outputs.delete(output_id)
        except RecordingError as error:
            raise HTTPException(status_code=400, detail={"code": str(error)}) from error
        if not deleted:
            raise HTTPException(status_code=404, detail={"code": "output_not_found"})
        return None

    return app


def _error(status: int, code: str):
    from fastapi.responses import JSONResponse

    return JSONResponse(status_code=status, content={"detail": {"code": code}})


app = create_app()


def main() -> None:
    port = int(os.environ.get("LOCAL_VOICE_PORT", "8765"))
    uvicorn.run("local_runtime.app.main:app", host="127.0.0.1", port=port, access_log=False)
