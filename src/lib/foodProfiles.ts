import type { SupabaseClient } from '@supabase/supabase-js'
import { foodUser } from './foodAuth.ts'
import { FoodServiceError } from './foodApi.ts'
export interface FoodProfile { id: string; name: string; slot: number }
export const MAX_FOOD_PROFILES = 5
export function validProfileName(value: string) {
  const name = value.trim()
  return Array.from(name).length >= 1 && Array.from(name).length <= 24 && !/[\u0000-\u001f\u007f]/.test(value) ? name : null
}
export function preferredProfile(profiles: FoodProfile[], savedId: string | null) {
  return profiles.find((profile) => profile.id === savedId) ?? profiles.find((profile) => profile.slot === 1) ?? profiles[0] ?? null
}
export function profileStorageKey(userId: string) { return 'food-profile:' + userId }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function createFoodProfilesApi(client: SupabaseClient) {
  async function requireUser(expectedUser?: string) {
    const { data, error } = await client.auth.getUser()
    if (error) throw new FoodServiceError('AUTH_FAILED', '暂时无法检查账号，请重试。')
    if (!data.user || !foodUser(data.user).verifiedCampus) throw new FoodServiceError('LOGIN_REQUIRED', '请先使用已验证的浙大邮箱登录。')
    if (expectedUser && data.user.id !== expectedUser) throw new FoodServiceError('ACCOUNT_CHANGED', '登录账号已变化，请重新检查档案。')
    return data.user.id
  }
  function profileError(error: { code?: string } | null) {
    if (error?.code === 'PGRST202' || error?.code === '42P01') throw new FoodServiceError('NOT_READY', '档案功能暂未开通，请稍后再试。')
    if (error?.code === 'P0001') throw new FoodServiceError('PROFILE_LIMIT', '这个邮箱已有五个档案，不能继续创建。')
    if (error?.code === '23505') throw new FoodServiceError('PROFILE_NAME_EXISTS', '你已有同名档案，请换一个名称。')
    if (error?.code === '42501') throw new FoodServiceError('LOGIN_REQUIRED', '当前账号无法使用这个档案，请重新检查登录状态。')
    if (error) throw new FoodServiceError('PROFILE_FAILED', '档案操作未完成，请检查网络后重试。')
  }
  async function loadProfiles(expectedUser?: string): Promise<FoodProfile[]> {
    const userId = await requireUser(expectedUser)
    const initial = await client.rpc('ensure_default_food_profile')
    profileError(initial.error)
    if (typeof initial.data !== 'string' || !uuid.test(initial.data)) throw new FoodServiceError('PROFILE_FAILED', '默认档案加载失败，请重试。')
    const { data, error } = await client.from('food_profiles').select('id,name,slot').eq('user_id', userId).order('slot', { ascending: true })
    profileError(error)
    if (!data?.length || data.length > MAX_FOOD_PROFILES || data.some((row) => typeof row.id !== 'string' || !uuid.test(row.id) || typeof row.name !== 'string' || !validProfileName(row.name) || !Number.isInteger(row.slot) || row.slot < 1 || row.slot > 5)
      || new Set(data.map((row) => row.id)).size !== data.length || new Set(data.map((row) => row.slot)).size !== data.length || !data.some((row) => row.id === initial.data)) throw new FoodServiceError('PROFILE_FAILED', '档案数据加载异常，请重新加载。')
    return data.map((row) => ({ id: row.id, name: row.name, slot: row.slot }))
  }
  async function createProfile(value: string, expectedUser?: string): Promise<string> {
    const name = validProfileName(value)
    if (!name) throw new FoodServiceError('INVALID_PROFILE_NAME', '档案名称请填写1～24个字，不使用换行或控制字符。')
    const userId = await requireUser(expectedUser)
    const { data, error } = await client.rpc('create_food_profile', { p_name: name, p_expected_user: userId })
    profileError(error)
    if (typeof data !== 'string' || !uuid.test(data)) throw new FoodServiceError('PROFILE_FAILED', '档案创建结果未确认，请先重新加载，避免重复创建。')
    return data
  }
  return { loadProfiles, createProfile }
}
