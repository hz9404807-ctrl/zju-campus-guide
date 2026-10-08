import type { SupabaseClient } from '@supabase/supabase-js'
import type { Food, FoodPublishInput } from '../types/food'

export class FoodServiceError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'FoodServiceError'
  }
}

function fail(code: string, message: string): never {
  throw new FoodServiceError(code, message)
}

const imageExtensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export function createFoodApi(client: SupabaseClient) {
  let identityRequest: Promise<string> | null = null

  async function ensureIdentity(): Promise<string> {
    if (!identityRequest) {
      identityRequest = (async () => {
        const { data, error } = await client.auth.getSession()
        if (error) fail('AUTH_FAILED', '加载失败，请检查网络后重试。')
        if (data.session) return data.session.user.id
        const result = await client.auth.signInAnonymously()
        if (result.error || !result.data.user) fail('AUTH_FAILED', '暂时无法连接共享服务，请检查网络后重试。')
        return result.data.user.id
      })().catch((error: unknown) => {
        if (error instanceof FoodServiceError) throw error
        fail('AUTH_FAILED', '加载失败，请检查网络后重试。')
      }).finally(() => { identityRequest = null })
    }
    return identityRequest
  }

  function toFood(row: Record<string, unknown>): Food {
    const price = row.price === null ? null : Number(row.price)
    const count = Number(row.rating_count)
    const average = row.average_rating === null ? null : Number(row.average_rating)
    if (typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.location !== 'string'
      || (row.area !== 'campus' && row.area !== 'off_campus') || typeof row.category !== 'string'
      || (price !== null && (!Number.isFinite(price) || price < 0)) || !Number.isSafeInteger(count) || count < 0
      || (average !== null && (!Number.isFinite(average) || average < 1 || average > 5))) {
      fail('LOAD_FAILED', '加载失败，请检查网络后重试。')
    }
    return {
      id: row.id, name: row.name, location: row.location, area: row.area, category: row.category,
      price, image_url: typeof row.image_url === 'string' ? row.image_url : null,
      description: typeof row.description === 'string' ? row.description : '',
      tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      average_rating: average, rating_count: count, isExample: false,
    }
  }

  async function listFoods(): Promise<Food[]> {
    await ensureIdentity()
    try {
      const { data, error } = await client.from('food_summaries').select('*').order('created_at', { ascending: false })
      if (error || !data) fail('LOAD_FAILED', '加载失败，请检查网络后重试。')
      return data.map((row) => toFood(row))
    } catch (error) {
      if (error instanceof FoodServiceError) throw error
      fail('LOAD_FAILED', '加载失败，请检查网络后重试。')
    }
  }

  async function getFood(id: string): Promise<Food | null> {
    await ensureIdentity()
    try {
      const { data, error } = await client.from('food_summaries').select('*').eq('id', id).maybeSingle()
      if (error) fail('LOAD_FAILED', '加载失败，请检查网络后重试。')
      return data ? toFood(data) : null
    } catch (error) {
      if (error instanceof FoodServiceError) throw error
      fail('LOAD_FAILED', '加载失败，请检查网络后重试。')
    }
  }

  async function getMyRating(foodId: string): Promise<number | null> {
    const userId = await ensureIdentity()
    try {
      const { data, error } = await client.from('ratings').select('rating').eq('food_id', foodId).eq('user_id', userId).maybeSingle()
      if (error) fail('LOAD_FAILED', '暂时无法获取你的评分，请重试。')
      return data?.rating ?? null
    } catch (error) {
      if (error instanceof FoodServiceError) throw error
      fail('LOAD_FAILED', '暂时无法获取你的评分，请重试。')
    }
  }

  async function rateFood(foodId: string, rating: number): Promise<void> {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail('INVALID_RATING', '请选择 1～5 星评分。')
    const userId = await ensureIdentity()
    try {
      const { error } = await client.from('ratings').insert({ food_id: foodId, user_id: userId, rating })
      if (error?.code === '23505') fail('ALREADY_RATED', '你已经评分过该菜品。')
      if (error) fail('RATING_FAILED', '评分提交失败，请检查网络后重试。')
    } catch (error) {
      if (error instanceof FoodServiceError) throw error
      fail('RATING_FAILED', '评分提交失败，请检查网络后重试。')
    }
  }

  async function publishFood(input: FoodPublishInput, image: File | null): Promise<string> {
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) fail('INVALID_RATING', '请选择 1～5 星评分。')
    if (image && (!imageExtensions[image.type] || image.size > 5 * 1024 * 1024 || image.size === 0)) {
      fail('INVALID_IMAGE', '请选择不超过 5 MB 的 JPG、PNG 或 WEBP 图片。')
    }
    const userId = await ensureIdentity()
    let imageUrl: string | null = null
    if (image) {
      const path = `${userId}/${crypto.randomUUID()}.${imageExtensions[image.type]}`
      try {
        const { error } = await client.storage.from('food-images').upload(path, image, { contentType: image.type, upsert: false })
        if (error) fail('UPLOAD_FAILED', '图片上传失败，请重试。你的填写仍然保留。')
        imageUrl = client.storage.from('food-images').getPublicUrl(path).data.publicUrl
      } catch (error) {
        if (error instanceof FoodServiceError) throw error
        fail('UPLOAD_FAILED', '图片上传失败，请重试。你的填写仍然保留。')
      }
    }
    try {
      const { data, error } = await client.rpc('create_food_with_rating', {
        p_name: input.name, p_location: input.location, p_area: input.area, p_category: input.category || '其他',
        p_price: input.price, p_image_url: imageUrl, p_description: input.description, p_tags: input.tags, p_rating: input.rating,
      })
      if (error || typeof data !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data)) fail('PUBLISH_FAILED', '菜品发布失败，请检查网络后重试。你的填写仍然保留。')
      return data
    } catch (error) {
      if (error instanceof FoodServiceError) throw error
      fail('PUBLISH_FAILED', '菜品发布失败，请检查网络后重试。你的填写仍然保留。')
    }
  }

  return { ensureIdentity, listFoods, getFood, getMyRating, rateFood, publishFood }
}
