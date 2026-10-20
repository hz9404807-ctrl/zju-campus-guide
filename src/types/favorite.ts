export type FavoriteKind = 'guide' | 'food' | 'website'

// Identifiers only. Search terms, return URLs and credentials never belong here.
export interface FavoriteContext {
  route?: string
  campus?: string
}

export interface Favorite {
  target_kind: FavoriteKind
  target_id: string
  context: FavoriteContext
  created_at: string
}
