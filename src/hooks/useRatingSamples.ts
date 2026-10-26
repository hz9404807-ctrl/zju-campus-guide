import { useCallback, useMemo } from 'react'
import type { Food } from '../types/food'
import { getInitialFoodRatings } from '../lib/foodService'
import { simulateRating, type RatingSimulation } from '../lib/ratingSimulation'
import { useFoodResource } from './useFoodResource'

export type RatingSampleFood = Food & { ratingSample?: RatingSimulation | null }

// This projection belongs only to the browsing view. Service results stay real.
export function useRatingSamples(foods: readonly Food[], enabled: boolean) {
  const ids = foods.filter((food) => !food.isExample).map((food) => food.id).join(',')
  const load = useCallback(() => enabled && ids
    ? getInitialFoodRatings(ids.split(','))
    : Promise.resolve({} as Record<string, number>), [ids, enabled])
  const initial = useFoodResource(load)
  const displayed = useMemo<RatingSampleFood[]>(() => !enabled ? [...foods] : foods.map((food) => {
    const first = initial.data?.[food.id]
    const ratingSample = first === undefined ? null : simulateRating(food.id, first)
    return { ...food, average_rating: ratingSample?.average ?? null, rating_count: ratingSample?.count ?? 0, ratingSample }
  }), [foods, enabled, initial.data])
  return { foods: displayed, loading: enabled && initial.loading, error: enabled ? initial.error : '', retry: initial.refresh }
}
