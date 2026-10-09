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
