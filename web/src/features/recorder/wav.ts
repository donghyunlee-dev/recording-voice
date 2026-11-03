export function encodePcm16Wav(samples: Float32Array, sampleRate: number): Blob {
  const dataBytes = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)
  writeText(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeText(view, 8, 'WAVE')
  writeText(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(view, 36, 'data')
  view.setUint32(40, dataBytes, true)

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]))
    view.setInt16(44 + index * 2, sample < 0 ? sample * 32768 : sample * 32767, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

export async function importAudioFile(
  file: File,
  convert: typeof convertRecordingToWav = convertRecordingToWav,
): Promise<Blob> {
  const maxBytes = 24 * 1024 * 1024
  if (file.size === 0) throw new Error('파일이 비어 있습니다.')
  if (file.size > maxBytes) throw new Error('가져올 파일은 24 MB 이하여야 합니다.')
  const wav = await convert(file, 24_000, 300)
  if (wav.size < 44) throw new Error('오디오 데이터를 읽지 못했습니다.')
  if (wav.size > maxBytes) throw new Error('변환된 WAV가 24 MB를 초과합니다.')
  return wav
}

export async function convertRecordingToWav(blob: Blob, targetSampleRate = 24_000, maxDurationSeconds = 300): Promise<Blob> {
  const decodeContext = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await decodeContext.decodeAudioData(await blob.arrayBuffer())
  } finally {
    await decodeContext.close()
  }
  if (decoded.duration > maxDurationSeconds) {
    throw new Error(`오디오 길이는 ${Math.floor(maxDurationSeconds / 60)}분 이하여야 합니다.`)
  }

  const frameCount = Math.ceil(decoded.duration * targetSampleRate)
  const offline = new OfflineAudioContext(1, frameCount, targetSampleRate)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const mono = await offline.startRendering()
  return encodePcm16Wav(mono.getChannelData(0), targetSampleRate)
}

function writeText(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}
