export interface GuideReference {
  label: string
  url: string
}

export interface Guide {
  id: string
  title: string
  category: string
  keywords: string[]
  summary: string
  steps: string[]
  materials: string[]
  location: string | null
  openingHours: string | null
  contact: string | null
  references: GuideReference[]
  source: string | null
  verifiedAt: string | null
  isExample: boolean
}
