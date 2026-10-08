export type FoodArea = 'campus' | 'off_campus'

export interface Food {
  id: string
  name: string
  location: string
  area: FoodArea
  category: string
  price: number | null
  image_url: string | null
  description: string
  tags: string[]
  average_rating: number | null
  rating_count: number
  isExample: boolean
}

export interface FoodPublishInput {
  name: string
  location: string
  area: FoodArea
  category: string
  price: number | null
  description: string
  tags: string[]
  rating: number
}
