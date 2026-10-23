import type { SupabaseClient } from '@supabase/supabase-js'
import { FoodServiceError } from './foodApi.ts'
import { foodUser } from './foodAuth.ts'

export const accountCampuses = ['紫金港', '玉泉', '西溪', '华家池', '之江', '舟山', '海宁'] as const
export const accountGenders = [
  { value: 'undisclosed', label: '不透露' }, { value: 'female', label: '女' },
  { value: 'male', label: '男' }, { value: 'other', label: '其他' },
] as const
export interface CampusAccountInput { gender: string; signature: string; campus: string }
export interface CampusAccountDetails extends CampusAccountInput { user_id: string; updated_at: string }
export const emptyCampusDetails: CampusAccountInput = { gender: 'undisclosed', signature: '', campus: '' }

export function validateCampusDetails(input: CampusAccountInput): CampusAccountInput {
  if (!accountGenders.some(({ value }) => value === input.gender)
    || (input.campus !== '' && !accountCampuses.some((campus) => campus === input.campus))
    || /[\u0000-\u001f\u007f-\u009f]/.test(input.signature) || Array.from(input.signature).length > 120) {
    throw new FoodServiceError('INVALID_DETAILS', '请选择有效的性别、校区；个性签名限120个字，不使用换行或控制字符。')
  }
  return { gender: input.gender, signature: input.signature.trim(), campus: input.campus }
}

export function createCampusAccountApi(client: SupabaseClient) {
  async function requireOwner(expectedUser: string) {
    try {
      const { data, error } = await client.auth.getUser()
      if (error) throw new FoodServiceError('AUTH_FAILED', '暂时无法验证账号，请检查网络后重试。')
      if (!data.user || !foodUser(data.user).verifiedCampus) throw new FoodServiceError('LOGIN_REQUIRED', '请使用已验证的浙大邮箱登录后编辑个人资料。')
      if (!expectedUser || data.user.id !== expectedUser) throw new FoodServiceError('IDENTITY_CHANGED', '登录账号已变化，请重新加载个人中心。')
    } catch (error) {
      if (error instanceof FoodServiceError) throw error
      throw new FoodServiceError('AUTH_FAILED', '暂时无法验证账号，请检查网络后重试。')
    }
  }
  function rpcError(error: { code?: string } | null) {
    if (!error) return
    if (['PGRST202', '42883', '42P01'].includes(error.code ?? '')) throw new FoodServiceError('NOT_READY', '个人资料尚待共享服务接入，当前无法读取或保存。请稍后重试或联系项目维护者。')
    if (error.code === '40001') throw new FoodServiceError('EDIT_CONFLICT', '资料已在其他页面更新，请重新加载资料后再编辑。')
    if (error.code === '42501') throw new FoodServiceError('LOGIN_REQUIRED', '当前账号无法访问这份资料，请重新检查登录状态。')
    if (['23514', '22023'].includes(error.code ?? '')) throw new FoodServiceError('INVALID_DETAILS', '资料未保存，请检查性别、校区及个性签名长度。')
    throw new FoodServiceError('DETAILS_FAILED', '个人资料请求未完成，请检查网络后重试。')
  }
  function readRow(data: unknown, expectedUser: string): CampusAccountDetails | null {
    if (!Array.isArray(data) || data.length > 1) throw new FoodServiceError('DETAILS_FAILED', '个人资料响应异常，请重新加载。')
    if (data.length === 0) return null
    const row = data[0]
    if (!row || row.user_id !== expectedUser || typeof row.signature !== 'string' || typeof row.gender !== 'string' || typeof row.campus !== 'string'
      || typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at))) throw new FoodServiceError('DETAILS_FAILED', '个人资料响应异常，请重新加载。')
    const details = validateCampusDetails(row)
    return { ...details, user_id: row.user_id, updated_at: row.updated_at }
  }
  async function request(name: string, expectedUser: string, params: Record<string, unknown>) {
    await requireOwner(expectedUser)
    try {
      const { data, error } = await client.rpc(name, { p_expected_user_id: expectedUser, ...params })
      rpcError(error)
      const row = readRow(data, expectedUser)
      await requireOwner(expectedUser)
      return row
    } catch (error) {
      if (error instanceof FoodServiceError) throw error
      throw new FoodServiceError('DETAILS_FAILED', '个人资料请求未完成，请检查网络后重试。')
    }
  }
  async function load(expectedUser: string) { return request('get_my_campus_details', expectedUser, {}) }
  async function save(input: CampusAccountInput, expectedUpdatedAt: string | null, expectedUser: string): Promise<CampusAccountDetails> {
    const details = validateCampusDetails(input)
    if (expectedUpdatedAt !== null && !Number.isFinite(Date.parse(expectedUpdatedAt))) throw new FoodServiceError('INVALID_DETAILS', '资料版本异常，请重新加载。')
    const row = await request('save_my_campus_details', expectedUser, {
      p_gender: details.gender, p_signature: details.signature, p_campus: details.campus, p_expected_updated_at: expectedUpdatedAt,
    })
    if (!row) throw new FoodServiceError('DETAILS_FAILED', '尚未确认保存结果，请重新加载资料检查。')
    return row
  }
  return { load, save }
}
