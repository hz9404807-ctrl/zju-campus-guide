import type { Guide, ServiceWindow } from '../types/guide'

export function normalizeSearch(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().trim()
}

function matches(query: string, fields: (string | null | undefined)[]) {
  const text = normalizeSearch(fields.filter(Boolean).join(' '))
  return normalizeSearch(query).split(/\s+/).filter(Boolean).every((term) => text.includes(term))
}

export function filterGuides(guides: Guide[], query: string, category = '', windows: ServiceWindow[] = []) {
  return guides.filter((guide) => (!category || guide.category === category) && matches(query, [
    guide.title, guide.category, guide.summary, ...guide.keywords, ...guide.steps,
    ...guide.materials, ...guide.notes, ...(guide.troubleshooting ?? []), guide.completionNote, guide.location, guide.openingHours, guide.contact, ...guide.sourceQuestions,
    ...windows.filter((window) => guide.serviceWindowIds?.includes(window.id)).flatMap((window) => [window.campus, window.name, window.location, window.openingHours, window.notice, ...window.contacts.map((contact) => contact.number)]),
    ...guide.references.map((reference) => reference.label),
  ]))
}

export interface CampusAccount {
  id: string
  name: string
  category: string
  topic: string
  organization: string | null
  summary: string | null
  image: string
  notes: string | null
  source: string
  sourceRow: number
  importedAt: string
}

export interface CampusWebsite {
  id: string
  name: string
  url: string
  category: string
  summary: string
  scope: string
  guideIds: string[]
  sourceRows: number[]
  verifiedAt: string | null
}

export function filterAccounts(accounts: CampusAccount[], query: string, category = '') {
  return accounts.filter((account) => (!category || account.category === category) && matches(query, [
    account.name, account.category, account.topic, account.organization, account.summary, account.notes,
  ]))
}

export function filterWebsites(websites: CampusWebsite[], query: string, category = '') {
  return websites.filter((site) => (!category || site.category === category) && matches(query, [site.name, site.category, site.summary, site.url, site.scope]))
}
