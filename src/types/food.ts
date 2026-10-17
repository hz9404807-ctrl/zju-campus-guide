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
  profile_id?: string | null
  created_by?: string
  updated_at?: string
  deleted_at?: string | null
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

export interface FoodRating {
  food_id: string
  rating: number
  created_at: string
  // Removed foods retain the caller's rating history without exposing their content.
  food: Pick<Food, 'id' | 'name' | 'location' | 'image_url'> | null
}
