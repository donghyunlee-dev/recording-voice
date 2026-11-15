export function measureInput(samples: Uint8Array): { level: number; db: number | null; status: string } {
  let energy = 0
  let peak = 0
  for (const sample of samples) {
    const value = (sample - 128) / 128
    energy += value * value
    peak = Math.max(peak, Math.abs(value))
  }
  const rms = samples.length ? Math.sqrt(energy / samples.length) : 0
  return {
    level: Math.min(1, rms * 3.5),
    db: rms > 0 ? Math.round(20 * Math.log10(rms)) : null,
    status: peak >= 0.98 ? '입력 과다' : rms === 0 ? '입력 없음' : rms < 0.03 ? '입력 작음' : '입력 감지',
  }
}
