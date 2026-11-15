const VOICE_NAMES_KEY = 'voice-studio.voice-names'
const OUTPUT_TITLES_KEY = 'voice-studio.output-titles'

type StringMap = Record<string, string>

function readMap(key: string): StringMap {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
  } catch {
    return {}
  }
}

function saveMap(key: string, map: StringMap): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(map))
  } catch {
    // The service can still be used when browser storage is unavailable.
  }
}

export function getVoiceName(id: string, fallback: string): string {
  return readMap(VOICE_NAMES_KEY)[id]?.trim() || fallback
}

export function saveVoiceName(id: string, name: string): void {
  const names = readMap(VOICE_NAMES_KEY)
  names[id] = name.trim()
  saveMap(VOICE_NAMES_KEY, names)
}

export function getOutputTitle(id: string): string | undefined {
  return readMap(OUTPUT_TITLES_KEY)[id]?.trim() || undefined
}

export function saveOutputTitle(id: string, title: string): void {
  const titles = readMap(OUTPUT_TITLES_KEY)
  titles[id] = title.trim()
  saveMap(OUTPUT_TITLES_KEY, titles)
}

export function voiceAvatar(): string {
  return '♡'
}
