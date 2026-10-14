import { createContext, useContext } from 'react'
import type { FoodProfile } from '../lib/foodProfiles'
export interface FoodProfilesState {
  enabled: boolean; items: FoodProfile[]; active: FoodProfile | null
  loading: boolean; creating: boolean; error: string
  select(id: string): void; create(name: string): Promise<void>; reload(): void
}
export const FoodProfilesContext = createContext<FoodProfilesState | null>(null)
export function useFoodProfiles() {
  const profiles = useContext(FoodProfilesContext)
  if (!profiles) throw new Error('Food account provider is missing.')
  return profiles
}
