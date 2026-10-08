import { createClient } from '@supabase/supabase-js'
import exampleFoods from '../data/foods.example.json'
import type { Food, FoodPublishInput } from '../types/food'
import { createFoodApi, FoodServiceError } from './foodApi'

const projectUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()
const hasAnyConfiguration = Boolean(projectUrl || publishableKey)
export const isFoodBackendConfigured = Boolean(projectUrl && publishableKey)
export const isFoodExampleMode = !hasAnyConfiguration

function configurationError(): FoodServiceError {
  return new FoodServiceError('NOT_CONFIGURED', '共享服务尚未连接，这次操作没有提交。')
}

let api: ReturnType<typeof createFoodApi> | null = null

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
      api = createFoodApi(client)
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
