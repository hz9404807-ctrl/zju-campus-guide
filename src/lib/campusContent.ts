import type { Guide, ServiceWindow } from '../types/guide'

export function normalizeSearch(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().trim()
}

function matches(query: string, fields: (string | null | undefined)[]) {
  const terms = queryTerms(query)
  if (normalizeSearch(query) && !terms.length) return false
  const text = fields.map((field) => canonicalSearch(field ?? ''))
  return terms.every((term) => text.some((field) => field.includes(term)))
}

const searchAliases: [string, string[]][] = [
  ['校园卡', ['学生卡', '饭卡', '一卡通']],
  ['补办', ['补卡', '补学生卡', '补饭卡']],
  ['宿舍', ['寝室', '寝房', '公寓']],
  ['故障', ['坏了', '坏掉', '不亮', '用不了']],
  ['报修', ['维修', '修理']],
  ['缴费', ['交费', '缴纳']],
  ['网络', ['校园网', '上网', '网费']],
  ['图书馆', ['图书室']],
  ['预约', ['预订', '预定']],
  ['教室', ['自习室']],
  ['场地', ['场馆']],
  ['成绩单', ['成绩证明']],
  ['在读证明', ['在校证明', '学籍证明']],
  ['缓考', ['延期考试']],
  ['转专业', ['换专业']],
  ['退课', ['退选']],
  ['快递', ['包裹']],
  ['班车', ['校车']],
  ['邮箱', ['邮件']],
  ['软件', ['office', 'matlab']],
  ['vpn', ['校外访问']],
  ['志愿', ['志愿者', '义工']],
  ['二课', ['第二课堂']],
  ['三课', ['第三课堂']],
  ['四课', ['第四课堂']],
  ['校历', ['校历表', '放假时间']],
]
const replacements = new Map(searchAliases.flatMap(([canonical, aliases]) => aliases.map((alias) => [alias, canonical] as const)))
replacements.set('补学生卡', '校园卡 补办')
replacements.set('补饭卡', '校园卡 补办')
replacements.set('交网费', '网络 缴费')
replacements.set('交学费', '学费 缴费')
replacements.set('不见了', '丢了')
replacements.set('遗失了', '丢了')
const aliasPattern = new RegExp([...replacements.keys()].sort((a, b) => b.length - a.length).join('|'), 'g')
const concepts = [...new Set([
  ...searchAliases.map(([canonical]) => canonical),
  '挂失', '充值', '缴费', '选课', '补考', '重修', '学分', '考试', '灯', '水电', '空调',
  '紫金港', '玉泉', '西溪', '华家池', '海宁', '舟山', '之江', '入校', '访客',
  '体育', '球场', '游泳', '学费', '贷款', '科研', '竞赛', '活动', '社团',
  '心理', '咨询', '挂号', '医院', '打印', '下载', '登录', '申请', '取消', '时间',
])].sort((a, b) => b.length - a.length)
const conceptPattern = new RegExp(concepts.join('|'), 'g')

function canonicalSearch(value: string) {
  return normalizeSearch(value).replace(aliasPattern, (alias) => replacements.get(alias)!).replace(/(\d)[-–—](?=\d)/g, '$1')
}

function queryTerms(query: string) {
  const plain = normalizeSearch(query)
  if (/^(怎么办|怎么操作|怎么用|怎么做|如何办理|请问|如何|怎样|怎么|哪里)[?。！!\s]*$/.test(plain)) return []
  const cleaned = canonicalSearch(query)
    .replace(/[，。！？、；"'‘’“”?,!;]/g, ' ')
    .trim()
    .replace(/(怎么办|怎么操作|怎么用|怎么做|如何办理|在哪里|哪里办理|一下|吗|呢|啊)+$/, '')
    .replace(/到哪里|去哪里|在哪里|如何|怎样|怎么/g, ' ')
    .trim()
    .replace(/^(请帮我|我想要|我需要|我想|我要|我的|请问|帮我|想要|请|查一下|查看|查询|我|查|找|在)+/, '')
    .replace(/的/g, ' ')
    .trim()
  if (!cleaned) return []
  const terms: string[] = []
  for (const chunk of cleaned.split(/\s+/).filter(Boolean)) {
    let offset = 0
    for (const match of chunk.matchAll(conceptPattern)) {
      if (match.index > offset) terms.push(chunk.slice(offset, match.index))
      terms.push(match[0])
      offset = match.index + match[0].length
    }
    if (offset < chunk.length) terms.push(chunk.slice(offset))
  }
  return [...new Set(terms)]
}

function guideSearchFields(guide: Guide, windows: ServiceWindow[]) {
  return [
    guide.title, guide.category, guide.summary, ...guide.keywords, ...guide.steps,
    ...guide.materials, ...guide.notes, ...(guide.troubleshooting ?? []), guide.completionNote,
    guide.location, guide.openingHours, guide.contact, ...guide.sourceQuestions,
    ...windows.filter((window) => guide.serviceWindowIds?.includes(window.id)).flatMap((window) => [
      window.campus, window.name, window.location, window.openingHours, window.notice,
      ...window.contacts.map((contact) => contact.number),
    ]),
    ...guide.references.map((reference) => reference.label),
  ]
}

export function filterGuides(guides: Guide[], query: string, category = '', windows: ServiceWindow[] = []) {
  const terms = queryTerms(query)
  if (normalizeSearch(query) && !terms.length) return []
  const literal = normalizeSearch(query)
  return guides
    .filter((guide) => !category || guide.category === category)
    .map((guide, index) => {
      const title = canonicalSearch(guide.title)
      const keywords = canonicalSearch(guide.keywords.join(' '))
      const summary = canonicalSearch(guide.summary)
      const fields = guideSearchFields(guide, windows).map((field) => canonicalSearch(field ?? ''))
      // Match every term within a real field, never across concatenated field boundaries.
      const matched = terms.every((term) => fields.some((field) => field.includes(term)))
      const score = terms.reduce((total, term) =>
        total + (title.includes(term) ? 12 : 0) + (keywords.includes(term) ? 6 : 0) + (summary.includes(term) ? 3 : 0), 0)
        + (literal && normalizeSearch(guide.title).includes(literal) ? 30 : 0)
      return { guide, index, matched, score }
    })
    .filter((result) => result.matched)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((result) => result.guide)
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

export function filterWebsites(websites: CampusWebsite[], query: string, category = '', guides: Guide[] = []) {
  const relatedGuideIds = new Set(filterGuides(guides, query).slice(0, 3).map((guide) => guide.id))
  return websites.filter((site) => (!category || site.category === category) &&
    (matches(query, [site.name, site.category, site.summary, site.url, site.scope]) || site.guideIds.some((id) => relatedGuideIds.has(id))))
}


// Suggestions remain separate from exact results: unknown words are never dropped there.
export function suggestGuides(guides: Guide[], query: string, category = '') {
  const generic = new Set(['申请', '登录', '下载', '打印', '取消', '时间', '咨询'])
  const terms = queryTerms(query).filter((term) => concepts.includes(term) && !generic.has(term))
  if (!terms.length) return []
  return guides.filter((guide) => !category || guide.category === category)
    .map((guide, index) => {
      const title = canonicalSearch(guide.title)
      const keywords = canonicalSearch(guide.keywords.join(' '))
      const score = terms.reduce((total, term) => total + (title.includes(term) ? 8 : 0) + (keywords.includes(term) ? 3 : 0), 0)
      return { guide, score, index }
    }).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3).map((item) => item.guide)
}

export function findRelatedSources(websites: CampusWebsite[], accounts: CampusAccount[], query: string, matchedGuides: Guide[], category = '') {
  if (!normalizeSearch(query) || !queryTerms(query).length) return { websites: [], accounts: [] }
  const leading = matchedGuides.slice(0, 3)
  const guideIds = new Set(leading.map((guide) => guide.id))
  const accountIds = new Set(leading.flatMap((guide) => guide.relatedSourceIds))
  const directSites = new Set(filterWebsites(websites, query, category).map((site) => site.id))
  const directAccounts = new Set(filterAccounts(accounts, query).map((account) => account.id))
  return {
    websites: websites.filter((site) => (!category || site.category === category) &&
      (directSites.has(site.id) || site.guideIds.some((id) => guideIds.has(id))))
      .sort((a, b) => Number(directSites.has(b.id)) - Number(directSites.has(a.id))),
    accounts: accounts.filter((account) => directAccounts.has(account.id) || accountIds.has(account.id))
      .sort((a, b) => Number(directAccounts.has(b.id)) - Number(directAccounts.has(a.id))),
  }
}

export function sourceSearchUrl(query: string, kind: 'websites' | 'accounts') {
  const params = new URLSearchParams()
  if (kind === 'websites') params.set('kind', 'websites')
  if (query) params.set('q', query)
  return `/sources${params.size ? `?${params.toString()}` : ''}`
}


export function guideIdForWebsite(site: CampusWebsite, matchingGuides: Guide[]) {
  return matchingGuides.find((guide) => site.guideIds.includes(guide.id))?.id ?? site.guideIds[0]
}


export function websiteSearchDetails(site: CampusWebsite, matchingGuides: Guide[]) {
  const guideId = guideIdForWebsite(site, matchingGuides)
  const guide = matchingGuides.find((item) => item.id === guideId)
  const reference = guide?.references.find((item) => item.url.replace(/\/$/, '') === site.url.replace(/\/$/, ''))
  return { guideId, name: reference?.label ?? site.name, summary: guide?.summary ?? site.summary }
}
