/** Read-only samples for the explicitly selected course demonstration. */
export type RatingSimulation = {
  initialRating: number
  average: number
  count: number
  /** Counts for 1, 2, 3, 4 and 5 stars, respectively. */
  histogram: number[]
}

export function simulateRating(foodId: string, initialRating: number, seed = 'campus-rating-v1'): RatingSimulation {
  if (!Number.isInteger(initialRating) || initialRating < 1 || initialRating > 5) {
    throw new RangeError('初始评分必须是 1～5 的整数。')
  }

  // Seeded draws keep list, detail, sorting and refresh consistent.
  let state = 2166136261
  const key = JSON.stringify([seed, foodId, initialRating])
  for (let index = 0; index < key.length; index += 1) {
    state = Math.imul(state ^ key.charCodeAt(index), 16777619) >>> 0
  }
  function nextUint32() {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return (value ^ (value >>> 14)) >>> 0
  }
  function draw(size: number) {
    // Reject the short final interval rather than biasing a modulo draw.
    const limit = Math.floor(0x100000000 / size) * size
    let value = nextUint32()
    while (value >= limit) value = nextUint32()
    return value % size
  }

  const count = 15 + draw(86)
  const minimum = Math.max(1, initialRating - 1)
  const maximum = Math.min(5, initialRating + 1)
  const histogram = [0, 0, 0, 0, 0]
  let sum = 0
  for (let index = 0; index < count; index += 1) {
    const rating = minimum + draw(maximum - minimum + 1)
    histogram[rating - 1] += 1
    sum += rating
  }
  return { initialRating, average: Number((sum / count).toFixed(1)), count, histogram }
}
