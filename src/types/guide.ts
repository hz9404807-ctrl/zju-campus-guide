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
  serviceWindowIds?: string[]
  troubleshooting?: string[]
  completionNote?: string
  relatedGuideIds?: string[]
  aliases?: string[]
}

export interface ServiceWindow {
  id: string
  campus: string
  name: string
  location: string
  openingHours: string
  contacts: { label: string; number: string }[]
  hoursStatus: 'published' | 'needs_confirmation'
  notice: string | null
  references?: GuideReference[]
}
