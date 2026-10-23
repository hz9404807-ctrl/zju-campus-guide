// Complete service replacement activated only by this local browser harness.
// No Supabase client, network credentials, localStorage or production writes.
import type { Food, FoodPublishInput } from '../../../src/types/food'
import type { FoodUser } from '../../../src/lib/foodAuth'

export const isFoodBackendConfigured = true
export const isFoodExampleMode = false
export const isFoodProfilesReady = false
export const isFoodEmailAuthReady = true
type Identity = 'a' | 'b' | 'guest'
type ReadMode = 'normal' | 'empty' | 'failure' | 'missing'
let identity: Identity = 'a'
let readMode: ReadMode = 'normal'
let mutationFailure = false
let delay = 100
const watchers = new Set<(event: string, userId: string | null) => void>()
const ids = { a: '11111111-1111-4111-8111-111111111111', b: '22222222-2222-4222-8222-222222222222' }
const copy = <T,>(value: T): T => structuredClone(value)
const wait = () => new Promise((resolve) => setTimeout(resolve, delay))
function requireUser() { if (identity === 'guest') throw new Error('本地测试：请先选择测试账号。'); return ids[identity] }
async function read<T>(value: T) { await wait(); if (readMode === 'failure') throw new Error('本地测试：模拟读取失败，请重试。'); return copy(value) }
async function write() { await wait(); if (mutationFailure) throw new Error('本地测试：模拟保存失败，内容尚未保存。') }
const initial = '2026-10-22T08:00:00Z'
const rows: Food[] = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', created_by: ids.a, name: 'A的本地测试菜品（有图片）', image_url: '/__fixture/food.svg', deleted_at: null },
  { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', created_by: ids.a, name: 'A的本地测试菜品（无图片）', image_url: null, deleted_at: null },
  { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', created_by: ids.a, name: 'A已撤下的本地测试菜品', image_url: '/__fixture/food.svg', deleted_at: initial },
  { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', created_by: ids.a, name: 'A的本地测试菜品（图片失败）', image_url: '/__fixture/not-found.jpg', deleted_at: null },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', created_by: ids.b, name: 'B的本地测试菜品', image_url: '/__fixture/food.svg', deleted_at: null },
].map((row) => ({ location: '本地测试 · 紫蓝色长地点长地点长地点名称', area: 'campus', category: '测试', price: 12, description: '仅供浏览器隔离测试，内容不对应真实菜品。', tags: [], average_rating: 4, rating_count: 1, updated_at: initial, isExample: false, ...row }))

export function fixtureState() { return { identity, readMode, mutationFailure, delay } }
export function setFixtureState(next: Partial<ReturnType<typeof fixtureState>>, notify = true) {
  const previous = identity
  const previousReadMode = readMode
  if (next.identity) identity = next.identity
  if (next.readMode) readMode = next.readMode
  if (next.mutationFailure !== undefined) mutationFailure = next.mutationFailure
  if (next.delay !== undefined) delay = next.delay
  const event = previous !== identity ? identity === 'guest' ? 'SIGNED_OUT' : 'SIGNED_IN' : previousReadMode !== readMode ? 'USER_UPDATED' : 'TOKEN_REFRESHED'
  if (notify) for (const callback of watchers) callback(event, identity === 'guest' ? null : ids[identity])
}
export async function initializeFoodIdentity() {}
export async function currentFoodUser(): Promise<FoodUser | null> { const owner = identity; await wait(); return owner === 'guest' ? null : { id: ids[owner], email: `fixture-${owner}@zju.edu.cn`, verifiedCampus: true, anonymous: false } }
export function watchFoodUser(callback: (event: string, userId: string | null) => void) { watchers.add(callback); return () => { watchers.delete(callback) } }
export async function signOutFood() { await write(); setFixtureState({ identity: 'guest' }) }
export async function sendFoodCode() { await write(); return 'email' as const }
export async function verifyFoodCode(email: string) { await write(); setFixtureState({ identity: email.includes('fixture-b') ? 'b' : 'a' }) }
export async function listFoods() { return read(rows.filter((row) => !row.deleted_at)) }
export async function getFood(id: string) { return read(rows.find((row) => row.id === id && !row.deleted_at) ?? null) }
export async function myFoods() { const owner = requireUser(); return read(readMode === 'empty' ? [] : rows.filter((row) => row.created_by === owner)) }
export async function myRatings() { const owner = requireUser(); return read(readMode === 'empty' ? [] : rows.filter((row) => row.created_by === owner).map((row) => ({ food_id: row.id, rating: 4, created_at: initial, food: row.deleted_at ? null : { id: row.id, name: row.name, location: row.location, image_url: row.image_url } }))) }
export async function getMyRating() { return read(identity === 'guest' ? null : 4) }
export async function rateFood() { requireUser(); await write() }
export async function setFoodDeleted(id: string, _updatedAt: string, deleted: boolean) { const owner = requireUser(); await write(); const row = rows.find((row) => row.id === id && row.created_by === owner); if (!row) throw new Error('无权管理该本地测试条目'); row.deleted_at = deleted ? initial : null; row.updated_at = new Date().toISOString() }
export async function updateFood(id: string, _updatedAt: string, input: FoodPublishInput) { const owner = requireUser(); await write(); const row = rows.find((row) => row.id === id && row.created_by === owner); if (!row) throw new Error('无权管理该本地测试条目'); Object.assign(row, input); row.updated_at = new Date().toISOString() }
export async function publishFood() { requireUser(); await write(); throw new Error('本轮本地夹具不测试新增菜品') }
export async function loadFoodProfiles() { throw new Error('本地测试保持五档案关闭') }
export async function createFoodProfile() { throw new Error('本地测试保持五档案关闭') }

type DetailsInput = { gender: 'undisclosed' | 'female' | 'male' | 'other'; signature: string; campus: '' | '紫金港' | '玉泉' | '西溪' | '华家池' | '之江' | '舟山' | '海宁' }
type Details = DetailsInput & { user_id: string; updated_at: string }
const details = new Map<string, Details>([[ids.a, { user_id: ids.a, gender: 'undisclosed', signature: 'A 的本地测试签名', campus: '紫金港', updated_at: initial }]])
export async function loadCampusAccountDetails(userId: string): Promise<Details | null> { const owner = requireUser(); if (userId !== owner) throw new Error('本地测试：账号已切换'); if (readMode === 'missing') { await wait(); throw new Error('个人资料尚待共享服务接入，当前无法读取或保存。请稍后重试或联系项目维护者。') }; return read(details.get(owner) ?? null) }
export async function saveCampusAccountDetails(input: DetailsInput, updatedAt: string | null, userId: string): Promise<Details> {
  const owner = requireUser()
  if (userId !== owner) throw new Error('本地测试：账号已切换')
  await write()
  if (requireUser() !== owner) throw new Error('本地测试：账号已切换，本次保存已取消。')
  if ((details.get(owner)?.updated_at ?? null) !== updatedAt) throw new Error('本地测试：资料已更新，请重新加载。')
  const saved = { ...input, user_id: owner, updated_at: new Date().toISOString() }
  details.set(owner, copy(saved))
  return copy(saved)
}
