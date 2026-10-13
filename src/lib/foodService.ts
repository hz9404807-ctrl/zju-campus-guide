import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import exampleFoods from '../data/foods.example.json'
import type { Food, FoodPublishInput } from '../types/food'
import { createFoodApi, FoodServiceError } from './foodApi'
import { createFoodAuth } from './foodAuth'

const projectUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()
const hasAnyConfiguration = Boolean(projectUrl || publishableKey)
export const isFoodBackendConfigured = Boolean(projectUrl && publishableKey)
export const isFoodExampleMode = !hasAnyConfiguration

function configurationError(): FoodServiceError {
  return new FoodServiceError('NOT_CONFIGURED', '共享服务尚未连接，这次操作没有提交。')
}

export const isFoodEmailAuthReady = import.meta.env.VITE_FOOD_EMAIL_AUTH_READY === 'true'
let api: ReturnType<typeof createFoodApi> | null = null
let auth: ReturnType<typeof createFoodAuth> | null = null
let clientInstance: SupabaseClient | null = null

function getApi() {
  if (!isFoodBackendConfigured) throw configurationError()
  if (!api) {
    try {
      const parsed = new URL(projectUrl)
      if (parsed.protocol !== 'https:' || !publishableKey.startsWith('sb_publishable_')) throw configurationError()
      const client = createClient(projectUrl, publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        global: {
          fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000) }),
        },
      })
      clientInstance = client
      api = createFoodApi(client)
      auth = createFoodAuth(client)
    } catch {
      throw new FoodServiceError('CONFIGURATION_ERROR', '共享服务的连接配置不完整，请检查项目地址和公开连接密钥。')
    }
  }
  return api
}

export async function initializeFoodIdentity(): Promise<void> {
  if (hasAnyConfiguration) await getApi().ensureIdentity()
}

export async function listFoods(): Promise<Food[]> {
  if (!hasAnyConfiguration) return exampleFoods as Food[]
  return getApi().listFoods()
}

export async function getFood(id: string): Promise<Food | null> {
  if (!hasAnyConfiguration) return (exampleFoods as Food[]).find((food) => food.id === id) ?? null
  return getApi().getFood(id)
}

export async function getMyRating(foodId: string): Promise<number | null> {
  if (!isFoodBackendConfigured) return null
  return getApi().getMyRating(foodId)
}

export async function rateFood(foodId: string, rating: number): Promise<void> {
  await getApi().rateFood(foodId, rating)
}

export async function publishFood(input: FoodPublishInput, image: File | null): Promise<string> {
  return getApi().publishFood(input, image)
}

export async function currentFoodUser() { if (!isFoodBackendConfigured) return null; getApi(); return auth!.currentUser() }
export function watchFoodUser(onChange: () => void) {
  if (!isFoodBackendConfigured) return () => {}
  try {
    getApi()
    const { data } = clientInstance!.auth.onAuthStateChange(() => onChange())
    return () => data.subscription.unsubscribe()
  } catch { return () => {} }
}
export async function sendFoodCode(email: string, mode: 'bind' | 'login') {
  if (!isFoodEmailAuthReady) throw new Error('邮箱登录暂未开放，你仍可浏览美食。')
  getApi(); return auth!.sendCode(email, mode)
}
export async function verifyFoodCode(email: string, token: string, type: 'email_change' | 'email') { getApi(); return auth!.verifyCode(email, token, type) }
export async function signOutFood() { getApi(); return auth!.signOut() }
export async function myFoods() { return getApi().myFoods() }
export async function updateFood(id: string, updatedAt: string, input: FoodPublishInput, image: File | null, removeImage: boolean) { return getApi().updateFood(id, updatedAt, input, image, removeImage) }
export async function setFoodDeleted(id: string, updatedAt: string, deleted: boolean) { return getApi().setFoodDeleted(id, updatedAt, deleted) }
