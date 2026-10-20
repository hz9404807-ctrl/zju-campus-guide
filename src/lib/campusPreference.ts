export const campusPreferenceKey = 'zju-campus-guide:preferred-campus'
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

export function readCampusPreference(storage: PreferenceStorage | null, allowed: string[], fallback: string) {
  try {
    const saved = storage?.getItem(campusPreferenceKey)
    return saved === '' || (saved != null && allowed.includes(saved)) ? saved : fallback
  } catch { return fallback }
}

export function saveCampusPreference(storage: PreferenceStorage | null, campus: string) {
  try {
    if (!storage) return false
    storage.setItem(campusPreferenceKey, campus)
    return true
  } catch { return false }
}

// Shared links take precedence over this browser's optional preference. A stale
// link or a campus with no window for this route falls back to an actual window.
export function resolveGuideCampus(value: string | null, available: string[], preferred: string) {
  if (value && available.includes(value)) return value
  return available.includes(preferred) ? preferred : available[0] ?? ''
}
