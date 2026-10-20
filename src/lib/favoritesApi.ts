import type { SupabaseClient } from '@supabase/supabase-js'
import type { Favorite, FavoriteContext, FavoriteKind } from '../types/favorite.ts'
import { foodUser } from './foodAuth.ts'
import { FoodServiceError } from './foodApi.ts'

const identifier = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const route = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/
const campus = /^[A-Za-z0-9_\u4e00-\u9fff -]{1,32}$/

function fail(code: string, message: string): never { throw new FoodServiceError(code, message) }

function validTarget(kind: unknown, id: unknown): kind is FavoriteKind {
  return (kind === 'guide' || kind === 'food' || kind === 'website') && typeof id === 'string'
    && (kind === 'food' ? uuid.test(id) : identifier.test(id))
}

function validContext(value: unknown, kind: FavoriteKind): value is FavoriteContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const entries = Object.entries(value)
  return entries.length <= 2 && entries.every(([key, item]) => typeof item === 'string'
    && (key === 'route' ? kind === 'guide' && route.test(item) : key === 'campus' && campus.test(item)))
}

function normalizeId(kind: FavoriteKind, id: string) { return kind === 'food' ? id.toLowerCase() : id }

export function createFavoritesApi(client: SupabaseClient) {
  async function requireCampusUser(): Promise<string> {
    try {
      // getUser validates the session at Auth. Never trust a cached session alone.
      const { data, error } = await client.auth.getUser()
      if (error) fail('AUTH_FAILED', '暂时无法验证登录状态，请检查网络后重试。')
      if (!data.user || !foodUser(data.user).verifiedCampus) fail('LOGIN_REQUIRED', '请先使用已验证的浙大邮箱登录，再管理收藏。')
      return data.user.id
    } catch (error) {
      if (error instanceof FoodServiceError) throw error
      fail('AUTH_FAILED', '暂时无法验证登录状态，请检查网络后重试。')
    }
  }

  async function confirmCampusUser(expected: string) {
    if (await requireCampusUser() !== expected) fail('IDENTITY_CHANGED', '登录账号已变化，请重新加载当前账号的收藏。')
  }

  function serviceError(error: { code?: string } | null, action: 'load' | 'save') {
    if (error?.code === 'PGRST202' || error?.code === '42883' || error?.code === '42P01') {
      fail('NOT_READY', '收藏尚待共享服务接入，请联系项目维护者完成收藏增量迁移。')
    }
    if (error?.code === '42501') fail('LOGIN_REQUIRED', '请先使用已验证的浙大邮箱登录，再管理收藏。')
    if (error?.code === 'P0002') fail('TARGET_UNAVAILABLE', '该美食已撤下或不存在，未添加收藏。')
    if (error?.code === '23514' || error?.code === '22023') fail('INVALID_FAVORITE', '收藏内容或重访位置无效，请返回原页面重试。')
    if (error) fail(action === 'load' ? 'LOAD_FAILED' : 'SAVE_FAILED', action === 'load' ? '收藏加载失败，请检查网络后重试。' : '收藏操作未完成，请检查网络后重试。')
  }

  async function listFavorites(): Promise<Favorite[]> {
    const userId = await requireCampusUser()
    try {
      // This zero-argument RPC takes its owner exclusively from auth.uid().
      const { data, error } = await client.rpc('list_my_campus_favorites')
      serviceError(error, 'load')
      if (!Array.isArray(data)) fail('LOAD_FAILED', '收藏数据异常，请重试。')
      const favorites: Favorite[] = data.map((row: Record<string, unknown>) => {
        if (!row || !validTarget(row.target_kind, row.target_id)
          || !validContext(row.context, row.target_kind) || typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at))) {
          fail('LOAD_FAILED', '收藏数据异常，请重试。')
        }
        return { target_kind: row.target_kind, target_id: normalizeId(row.target_kind, row.target_id as string), context: row.context, created_at: row.created_at }
      })
      if (new Set(favorites.map((item) => `${item.target_kind}:${item.target_id}`)).size !== favorites.length) fail('LOAD_FAILED', '收藏数据异常，请重试。')
      await confirmCampusUser(userId)
      return favorites
    } catch (error) {
      if (error instanceof FoodServiceError) throw error
      fail('LOAD_FAILED', '收藏加载失败，请检查网络后重试。')
    }
  }

  async function saveFavorite(kind: FavoriteKind, id: string, context: FavoriteContext = {}): Promise<void> {
    if (!validTarget(kind, id) || !validContext(context, kind)) fail('INVALID_FAVORITE', '收藏内容或重访位置无效，请返回原页面重试。')
    const userId = await requireCampusUser()
    try {
      const { error } = await client.rpc('save_my_campus_favorite', { p_target_kind: kind, p_target_id: normalizeId(kind, id), p_context: context })
      serviceError(error, 'save')
      await confirmCampusUser(userId)
    } catch (error) {
      if (error instanceof FoodServiceError) throw error
      fail('SAVE_FAILED', '收藏操作未完成，请检查网络后重试。')
    }
  }

  async function removeFavorite(kind: FavoriteKind, id: string): Promise<void> {
    if (!validTarget(kind, id)) fail('INVALID_FAVORITE', '收藏内容无效，请重新加载收藏。')
    const userId = await requireCampusUser()
    try {
      const { error } = await client.rpc('remove_my_campus_favorite', { p_target_kind: kind, p_target_id: normalizeId(kind, id) })
      serviceError(error, 'save')
      await confirmCampusUser(userId)
    } catch (error) {
      if (error instanceof FoodServiceError) throw error
      fail('SAVE_FAILED', '取消收藏未完成，请检查网络后重试。')
    }
  }

  return { listFavorites, saveFavorite, removeFavorite }
}
