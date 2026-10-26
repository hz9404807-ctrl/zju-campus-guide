import workbook from '../data/food-rating-samples.json' with { type: 'json' }
import type { RatingSimulation } from './ratingSimulation'

const samples = new Map(workbook.ratings.map((row) => [row.foodId, row]))

/** A fixed workbook snapshot. Never fills gaps with generated ratings. */
export function getWorkbookRatingSample(foodId: string): RatingSimulation | null {
  const row = samples.get(foodId)
  if (!row) return null
  const histogram = [...row.histogram]
  const count = histogram.reduce((total, amount) => total + amount, 0)
  const sum = histogram.reduce((total, amount, index) => total + amount * (index + 1), 0)
  return { initialRating: row.initialRating, histogram, count, average: Number((sum / count).toFixed(1)) }
}
