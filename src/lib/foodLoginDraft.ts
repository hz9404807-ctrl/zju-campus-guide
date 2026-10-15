import { campusEmail } from './foodAuth.ts'
export interface FoodLoginDraft {
  email: string
  type: 'email_change' | 'email'
  delivery: 'accepted' | 'unknown'
  mode: 'bind' | 'login'
  ownerId: string | null
  sentAt: number
}
type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
const KEY = 'campus-guide:food-login-pending'
const MAX_AGE = 30 * 60 * 1000
export function foodLoginStorage(): DraftStorage { try { return window.localStorage } catch { return null } }
export function clearFoodLoginDraft(storage: DraftStorage) { try { storage?.removeItem(KEY) } catch { /* Recovery is optional. */ } }
export function saveFoodLoginDraft(storage: DraftStorage, draft: FoodLoginDraft) {
  // Persist only request metadata, never the entered OTP or an auth session.
  const {email,type,delivery,mode,ownerId,sentAt} = draft
  try { storage?.setItem(KEY, JSON.stringify({email,type,delivery,mode,ownerId,sentAt})) } catch { /* Manual recovery remains available. */ }
}
export function readFoodLoginDraft(storage: DraftStorage, ownerId: string | null, now = Date.now()): FoodLoginDraft | null {
  try {
    const raw = storage?.getItem(KEY)
    if (!raw) return null
    const draft = JSON.parse(raw)
    if (!draft || campusEmail(draft.email ?? '') !== draft.email || !['email','email_change'].includes(draft.type)
      || !['accepted','unknown'].includes(draft.delivery) || !['bind','login'].includes(draft.mode)
      || draft.ownerId !== ownerId || (draft.type === 'email_change' && (!ownerId || draft.mode !== 'bind'))
      || !Number.isFinite(draft.sentAt) || draft.sentAt > now || now - draft.sentAt >= MAX_AGE) {
      clearFoodLoginDraft(storage); return null
    }
    return { email:draft.email,type:draft.type,delivery:draft.delivery,mode:draft.mode,ownerId:draft.ownerId,sentAt:draft.sentAt }
  } catch { clearFoodLoginDraft(storage); return null }
}
export function loginDraftCooldown(sentAt: number, now = Date.now()) { return Math.max(0, Math.min(60, Math.ceil((sentAt + 60000 - now) / 1000))) }
