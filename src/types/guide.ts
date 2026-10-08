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
  sourceRows: number[]
  sourceQuestions: string[]
  importedAt: string
  verifiedAt: string | null
  verificationScope: string | null
  isExample: boolean
  kind: string
  notes: string[]
  relatedSourceIds: string[]
  aliases?: string[]
}
