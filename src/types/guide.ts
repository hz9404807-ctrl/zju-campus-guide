export type GuideStepAction = { stepIndex: number } & (
  | { kind: 'reference' | 'service'; label: string; url: string; campus?: string }
  | { kind: 'windows'; label: string }
)

export interface GuideReference {
  label: string
  url: string
}

export interface GuideTimetable {
  directions: { id: string; label: string }[]
  source: GuideReference
  notices: string[]
  trips: {
    id: string
    label: string
    direction: string
    day: string | null
    stops: { name: string; time: string | null }[]
  }[]
}

export interface GuideRoute {
  id: string
  label: string
  audienceNote?: string
  intentTerms: string[]
  excludedTerms?: string[]
  excludedAudiences?: string[]
  summary: string
  materials: string[]
  steps: string[]
  stepActions: GuideStepAction[]
  troubleshooting: string[]
  completionNote: string
  serviceWindowIds: string[]
  timetable?: GuideTimetable
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
  stepActions?: GuideStepAction[]
  aliases?: string[]
  routes?: GuideRoute[]
  routeChoiceLabel?: string
  timetable?: GuideTimetable
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
