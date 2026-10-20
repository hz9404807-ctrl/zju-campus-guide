import type { Food } from '../types/food'

export type FoodSort = 'latest' | 'price-asc' | 'price-desc' | 'rating-desc'

export interface FoodBudget {
  min: number | null
  max: number | null
  active: boolean
  error: string | null
  minError: boolean
  maxError: boolean
}

function budgetAmount(raw: string): number | null | 'invalid' {
  const text = raw.trim()
  if (!text) return null
  // Match the existing publishing price limits, rather than accepting exponent,
  // hexadecimal, negative or rounded values from a hand-edited shared URL.
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(text)) return 'invalid'
  const amount = Number(text)
  return Number.isFinite(amount) && amount <= 99999.99 ? amount : 'invalid'
}

export function parseFoodBudget(minRaw = '', maxRaw = ''): FoodBudget {
  const min = budgetAmount(minRaw)
  const max = budgetAmount(maxRaw)
  const malformed = min === 'invalid' || max === 'invalid'
  const reversed = !malformed && min !== null && max !== null && min > max
  return {
    min: min === 'invalid' ? null : min,
    max: max === 'invalid' ? null : max,
    active: Boolean(minRaw.trim() || maxRaw.trim()),
    error: malformed ? '预算请输入 0 至 99999.99 元，最多两位小数。' : reversed ? '最低预算不能高于最高预算。' : null,
    minError: min === 'invalid' || reversed,
    maxError: max === 'invalid' || reversed,
  }
}

export function parseFoodSort(raw: string | null | undefined): FoodSort {
  return raw === 'price-asc' || raw === 'price-desc' || raw === 'rating-desc' ? raw : 'latest'
}

export function hasFoodPrice(food: Pick<Food, 'price'>): food is Pick<Food, 'price'> & { price: number } {
  return food.price !== null && Number.isFinite(food.price) && food.price >= 0
}

export function hasFoodRating(food: Pick<Food, 'average_rating' | 'rating_count'>): food is Pick<Food, 'average_rating' | 'rating_count'> & { average_rating: number } {
  return food.average_rating !== null && Number.isFinite(food.average_rating) && food.rating_count > 0
}

function stableId(a: Pick<Food, 'id'>, b: Pick<Food, 'id'>) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Filter the already loaded list. No network request or synthetic score. */
export function compareFoods<T extends Pick<Food, 'id' | 'price' | 'average_rating' | 'rating_count'>>(
  foods: readonly T[], budget: FoodBudget, sort: FoodSort,
): T[] {
  if (budget.error) return []
  const result = foods.filter((food) => {
    if (!budget.active) return true
    return hasFoodPrice(food) && (budget.min === null || food.price >= budget.min) && (budget.max === null || food.price <= budget.max)
  })
  if (sort === 'latest') return result
  return result.sort((a, b) => {
    if (sort === 'price-asc' || sort === 'price-desc') {
      const aKnown = hasFoodPrice(a)
      const bKnown = hasFoodPrice(b)
      if (aKnown !== bKnown) return aKnown ? -1 : 1
      if (aKnown && bKnown && a.price !== b.price) return sort === 'price-asc' ? a.price - b.price : b.price - a.price
      return stableId(a, b)
    }
    const aRated = hasFoodRating(a)
    const bRated = hasFoodRating(b)
    if (aRated !== bRated) return aRated ? -1 : 1
    if (aRated && bRated) {
      if (a.average_rating !== b.average_rating) return b.average_rating - a.average_rating
      if (a.rating_count !== b.rating_count) return b.rating_count - a.rating_count
    }
    return stableId(a, b)
  })
}

export function foodSortDescription(sort: FoodSort): string {
  if (sort === 'price-asc') return '按参考价格从低到高排列，价格待补充的菜品放在最后。'
  if (sort === 'price-desc') return '按参考价格从高到低排列，价格待补充的菜品放在最后。'
  if (sort === 'rating-desc') return '按平均评分从高到低排列，同分时评分人数多的在前；暂无评分的放在最后。'
  return '按最新发布顺序显示。'
}
