import type { Food } from '../types/food'

// Uses the existing comparison branch's URL values and tie-breaking rules.
export type FoodSort = 'latest' | 'price-asc' | 'price-desc' | 'rating-asc' | 'rating-desc'

export function parseFoodSort(raw: string | null | undefined): FoodSort {
  return raw === 'price-asc' || raw === 'price-desc' || raw === 'rating-asc' || raw === 'rating-desc' ? raw : 'latest'
}

export function hasFoodPrice(food: Pick<Food, 'price'>): food is Pick<Food, 'price'> & { price: number } {
  return food.price !== null && Number.isFinite(food.price) && food.price >= 0
}

export function hasFoodRating(food: Pick<Food, 'average_rating' | 'rating_count'>): food is Pick<Food, 'average_rating' | 'rating_count'> & { average_rating: number } {
  return food.average_rating !== null && Number.isFinite(food.average_rating) && food.rating_count > 0
}

type SortableFood = Pick<Food, 'id' | 'price' | 'average_rating' | 'rating_count'>
const stableId = (a: SortableFood, b: SortableFood) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0

/** Sort an already filtered list without mutating the shared service result. */
export function sortFoods<T extends SortableFood>(foods: readonly T[], sort: FoodSort): T[] {
  const result = [...foods]
  if (sort === 'latest') return result
  return result.sort((a, b) => {
    if (sort === 'price-asc' || sort === 'price-desc') {
      const aKnown = hasFoodPrice(a), bKnown = hasFoodPrice(b)
      if (aKnown !== bKnown) return aKnown ? -1 : 1
      if (aKnown && bKnown && a.price !== b.price) return sort === 'price-asc' ? a.price - b.price : b.price - a.price
      return stableId(a, b)
    }
    const aRated = hasFoodRating(a), bRated = hasFoodRating(b)
    if (aRated !== bRated) return aRated ? -1 : 1
    if (aRated && bRated) {
      if (a.average_rating !== b.average_rating) return sort === 'rating-asc' ? a.average_rating - b.average_rating : b.average_rating - a.average_rating
      if (a.rating_count !== b.rating_count) return b.rating_count - a.rating_count
    }
    return stableId(a, b)
  })
}

export function foodSortDescription(sort: FoodSort) {
  if (sort === 'price-asc') return '按参考价格从低到高排列，价格待补充的菜品放在最后。'
  if (sort === 'price-desc') return '按参考价格从高到低排列，价格待补充的菜品放在最后。'
  if (sort === 'rating-asc') return '按平均评分从低到高排列，同分时评分人数多的在前；暂无评分的放在最后。'
  if (sort === 'rating-desc') return '按平均评分从高到低排列，同分时评分人数多的在前；暂无评分的放在最后。'
  return ''
}
