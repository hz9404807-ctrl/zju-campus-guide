import { useMemo } from 'react'
import type { Food } from '../types/food'
import type { RatingSimulation } from '../lib/ratingSimulation'
import { getWorkbookRatingSample } from '../lib/ratingSamples'

export type RatingSampleFood = Food & { ratingSample?: RatingSimulation | null }

// This projection belongs only to the browsing view. Service results stay real.
export function useRatingSamples(foods: readonly Food[], enabled: boolean) {
  const displayed = useMemo<RatingSampleFood[]>(() => !enabled ? [...foods] : foods.map((food) => {
    const ratingSample = getWorkbookRatingSample(food.id)
    return { ...food, average_rating: ratingSample?.average ?? null, rating_count: ratingSample?.count ?? 0, ratingSample }
  }), [foods, enabled])
  return { foods: displayed }
}
