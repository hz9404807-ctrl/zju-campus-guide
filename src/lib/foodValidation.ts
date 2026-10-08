import type { Food, FoodArea, FoodPublishInput } from '../types/food'

export const FOOD_CATEGORIES = ['饭类', '面类', '面食', '甜品', '饮品', '其他'] as const
export const FOOD_IMAGE_MAX_BYTES = 5 * 1024 * 1024

export interface FoodPublishDraft {
  name: string
  location: string
  area: FoodArea
  category: string
  price: string
  description: string
  tags: string
  rating: number
}

export type FoodPublishField = keyof FoodPublishDraft | 'image'
export type FoodPublishErrors = Partial<Record<FoodPublishField, string>>

function textLength(value: string) {
  return Array.from(value).length
}

export function parseFoodTags(value: string): string[] {
  return [...new Set(value.split(/[,，、\n]/).map((tag) => tag.trim()).filter(Boolean))]
}

export function validateFoodImage(file: Pick<File, 'type' | 'size'> | null): string | undefined {
  if (!file) return undefined
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return '请选择 JPG、PNG 或 WEBP 图片。'
  if (file.size > FOOD_IMAGE_MAX_BYTES) return '图片不能超过 5 MB，请换一张较小的图片。'
  if (file.size === 0) return '这张图片是空文件，请重新选择。'
  return undefined
}

export function validateFoodPublishDraft(draft: FoodPublishDraft, image: Pick<File, 'type' | 'size'> | null): FoodPublishErrors {
  const errors: FoodPublishErrors = {}
  const name = draft.name.trim()
  const location = draft.location.trim()
  const price = draft.price.trim()
  const tags = parseFoodTags(draft.tags)

  if (!name) errors.name = '请填写菜品名称。'
  else if (textLength(name) > 80) errors.name = '菜品名称不能超过 80 个字。'
  if (!location) errors.location = '请填写食堂窗口或店铺地点。'
  else if (textLength(location) > 120) errors.location = '地点不能超过 120 个字。'
  if (!['campus', 'off_campus'].includes(draft.area)) errors.area = '请选择校内食堂或校外美食。'
  if (draft.category && (!FOOD_CATEGORIES.includes(draft.category as typeof FOOD_CATEGORIES[number]) || textLength(draft.category) > 30)) errors.category = '请从列表中选择菜品分类。'
  if (price && (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(price) || !Number.isFinite(Number(price)) || Number(price) > 99999.99)) errors.price = '价格须为 0 至 99999.99 元，最多保留两位小数。'
  if (textLength(draft.description.trim()) > 200) errors.description = '菜品介绍不能超过 200 个字。'
  if (tags.length > 5) errors.tags = '短评标签最多填写 5 个。'
  else if (tags.some((tag) => textLength(tag) > 12)) errors.tags = '每个短评标签不能超过 12 个字。'
  if (!Number.isInteger(draft.rating) || draft.rating < 1 || draft.rating > 5) errors.rating = '请先选择 1 至 5 星，作为你的第一次评分。'
  const imageError = validateFoodImage(image)
  if (imageError) errors.image = imageError
  return errors
}

export function toFoodPublishInput(draft: FoodPublishDraft): FoodPublishInput {
  return {
    name: draft.name.trim(),
    location: draft.location.trim(),
    area: draft.area,
    category: draft.category || '其他',
    price: draft.price.trim() ? Number(draft.price.trim()) : null,
    description: draft.description.trim(),
    tags: parseFoodTags(draft.tags),
    rating: draft.rating,
  }
}

function normalize(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[\s·,，。\-_/\\()（）]/g, '')
}

export function findSimilarFoods(foods: Food[], name: string, location: string): Food[] {
  const normalizedName = normalize(name)
  const normalizedLocation = normalize(location)
  if (normalizedName.length < 2) return []
  return foods.filter((food) => {
    const existingName = normalize(food.name)
    const existingLocation = normalize(food.location)
    const nameMatches = existingName.includes(normalizedName) || normalizedName.includes(existingName)
    const locationMatches = !normalizedLocation || existingLocation.includes(normalizedLocation) || normalizedLocation.includes(existingLocation)
    return nameMatches && locationMatches
  }).slice(0, 3)
}
