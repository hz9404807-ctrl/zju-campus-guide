import type { Guide, GuideRoute, GuideStepAction, GuideTimetable, ServiceWindow } from '../types/guide'

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
  ['座位', ['自习座位', '自习位置']],
  ['研讨空间', ['研讨室', '讨论室', '研讨间']],
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
replacements.set('没网', '网络 故障')
replacements.set('篮球场', '球场')
replacements.set('取消后钱没退', '取消 退款')
replacements.set('退款没到账', '退款')
const aliasPattern = new RegExp([...replacements.keys()].sort((a, b) => b.length - a.length).join('|'), 'g')
const concepts = [...new Set([
  ...searchAliases.map(([canonical]) => canonical),
  '挂失', '充值', '缴费', '选课', '补考', '重修', '学分', '考试', '灯', '水电', '空调',
  '紫金港', '玉泉', '西溪', '华家池', '海宁', '舟山', '之江', '入校', '访客',
  '体育', '球场', '游泳', '学费', '贷款', '科研', '竞赛', '活动', '社团',
  '心理', '咨询', '挂号', '医院', '打印', '下载', '登录', '申请', '取消', '时间',
  '座位', '研讨空间', '盖章', '密封', '签到',
])].sort((a, b) => b.length - a.length)
const conceptPattern = new RegExp(concepts.join('|'), 'g')

function canonicalSearch(value: string) {
  return normalizeSearch(value).replace(/校园卡(?:里)?(?:没钱了|没钱|余额不够|余额不足)/g, '校园卡 充值').replace(aliasPattern, (alias) => replacements.get(alias)!).replace(/(\d)[-–—](?=\d)/g, '$1')
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
    // Remove quantities only before recognised task objects, retaining unknown conditions.
    .replace(/(?:一个|几个|一间|一份|一张)(?=座位|研讨空间|教室|成绩单|在读证明)/g, '')
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

function timetableSearchFields(table?: GuideTimetable) {
  return table?.trips.map((trip) => `${trip.label} ${trip.day ?? '未注明星期'} ${trip.stops.map((stop) => `${stop.name} ${stop.time ?? '时间未公布'}`).join(' → ')}`) ?? []
}

function guideSearchFields(guide: Guide, windows: ServiceWindow[]) {
  return [
    guide.title, guide.category, guide.summary, ...guide.keywords, ...guide.steps,
    ...timetableSearchFields(guide.timetable), ...guide.materials, ...guide.notes, ...(guide.troubleshooting ?? []), guide.completionNote,
    guide.location, guide.openingHours, guide.contact, ...guide.sourceQuestions,
    ...(guide.routes ?? []).flatMap((route) => [route.label, route.summary, ...route.intentTerms,
      ...timetableSearchFields(route.timetable), ...route.steps, ...route.materials, ...route.troubleshooting, route.completionNote]),
    ...windows.filter((window) => guide.serviceWindowIds?.includes(window.id)).flatMap((window) => [
      window.campus, window.name, window.location, window.openingHours, window.notice,
      ...window.contacts.map((contact) => contact.number),
    ]),
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
        + (literal && guide.keywords.some((keyword) => canonicalSearch(keyword).replace(/\s/g, '') === canonicalSearch(query).replace(/\s/g, '')) ? 20 : 0)
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

function normalizedUrl(url: string) { return url.replace(/\/$/, '') }

function excludedDestinationUrls(guides: Guide[], query: string) {
  return new Set(guides.flatMap((guide) => {
    const route = resolveGuideRoute(guide, query)
    const view = guideRouteView(guide, route, query)
    const allowed = new Set(view.references.map((ref) => normalizedUrl(ref.url)))
    const rejected = route ? guide.references.filter((ref) => !allowed.has(normalizedUrl(ref.url))).map((ref) => ref.url) : []
    const campus = queryCampus(query)
    return [...rejected, ...(guide.stepActions ?? []).flatMap((action) =>
      'url' in action && action.campus && campus && action.campus !== campus ? [action.url] : [])].map(normalizedUrl)
  }))
}

function sourceContextGuides(guides: Guide[], query: string) {
  const focused = guides.filter((guide) => resolveGuideRoute(guide, query))
  return (focused.length ? focused : guides).slice(0, 3)
}

export function filterWebsites(websites: CampusWebsite[], query: string, category = '', guides: Guide[] = [], windows: ServiceWindow[] = []) {
  const relatedGuideIds = new Set(sourceContextGuides(searchGuides(guides, query, '', windows).guides, query).map((guide) => guide.id))
  const excludedUrls = excludedDestinationUrls(guides, query)
  return websites.filter((site) => !excludedUrls.has(normalizedUrl(site.url)) && (!category || site.category === category) &&
    (matches(query, [site.name, site.category, site.summary, site.url, site.scope]) || site.guideIds.some((id) => relatedGuideIds.has(id))))
}

// A recognised question about a condition remains visible as an unanswered condition.
// Arbitrary unknown words still have to match; they are never discarded.
export function searchGuides(guides: Guide[], query: string, category = '', windows: ServiceWindow[] = []) {
  const notices: string[] = []
  let task = normalizeSearch(query)
  if (/多少钱|费用|收费/.test(task)) {
    notices.push('具体费用尚未核实；这里提供相关办理方法，付款前向办理窗口或订单页面确认金额。')
    task = task.replace(/多少钱|费用|收费/g, ' ')
  }
  if (/晚上|夜间/.test(task)) {
    notices.push('夜间能否办理尚未确认；查看对应校区的常规开放时间，临时安排需向窗口确认。')
    task = task.replace(/(?:晚上|夜间)(?:可以)?/g, ' ')
  }
  if (/退款|钱没退|退钱/.test(task)) notices.push('这里提供取消及退款异常的处理方法；是否可退、金额和到账时限需核对该订单规则。')
  const results = normalizeSearch(query) && !task.trim() ? [] : filterGuides(guides, task, category, windows)
  return { guides: results, notice: results.length ? notices.join(' ') : '', taskQuery: task }
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
  const leading = sourceContextGuides(matchedGuides, query)
  const guideIds = new Set(leading.map((guide) => guide.id))
  const accountIds = new Set(leading.flatMap((guide) => guide.relatedSourceIds))
  const excludedUrls = excludedDestinationUrls(leading, query)
  const directSites = new Set(filterWebsites(websites, query, category, leading).map((site) => site.id))
  const directAccounts = new Set(filterAccounts(accounts, query).map((account) => account.id))
  return {
    websites: websites.filter((site) => !excludedUrls.has(normalizedUrl(site.url)) && (!category || site.category === category) &&
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


export function websiteSearchDetails(site: CampusWebsite, matchingGuides: Guide[], query = '') {
  const guideId = guideIdForWebsite(site, matchingGuides)
  const guide = matchingGuides.find((item) => item.id === guideId)
  const route = guide ? resolveGuideRoute(guide, query) : undefined
  const view = guide ? guideRouteView(guide, route, query) : undefined
  const reference = view?.references.find((item) => normalizedUrl(item.url) === normalizedUrl(site.url))
  const action = route?.stepActions.find((item) => 'url' in item && normalizedUrl(item.url) === normalizedUrl(site.url))
  return { guideId, routeId: route?.id, name: action?.label ?? reference?.label ?? site.name, summary: view?.summary ?? site.summary }
}

export function routeMatchesAudience(route: GuideRoute, query: string) {
  const text = normalizeSearch(query)
  return !(route.excludedAudiences ?? []).some((audience) => text.includes(normalizeSearch(audience)))
}

// Search recommends a route; the user can always choose another published workflow.
export function resolveGuideRoute(guide: Guide, query = '', routeId: string | null = null): GuideRoute | undefined {
  if (routeId !== null) {
    return guide.routes?.find((route) => route.id === routeId)
  }
  const text = queryTerms(query).join(' ')
  if (!text) return undefined
  const routes = (guide.routes ?? []).filter((route) => routeMatchesAudience(route, query) &&
    route.intentTerms.some((term) => text.includes(canonicalSearch(term))) &&
    !(route.excludedTerms ?? []).some((term) => text.includes(canonicalSearch(term))))
  return routes.length === 1 ? routes[0] : undefined
}

// Keep return-to-search context without highlighting an unrelated task after a manual switch.
export function guideDetailContext(guide: Guide, query: string, routeId: string | null) {
  const recommended = resolveGuideRoute(guide, query)
  const route = resolveGuideRoute(guide, query, routeId)
  const contentQuery = routeId !== null && route?.id !== recommended?.id ? '' : query
  return { route, contentQuery }
}

const campuses = ['紫金港', '玉泉', '西溪', '华家池', '海宁', '舟山', '之江']
function queryCampus(query: string) {
  const found = campuses.filter((campus) => query.includes(campus))
  return found.length === 1 ? found[0] : undefined
}

export function guideRouteView(guide: Guide, route?: GuideRoute, query = ''): Guide {
  const campus = queryCampus(query)
  const view = route ? { ...guide, summary: route.summary, steps: route.steps, materials: route.materials,
    stepActions: route.stepActions, troubleshooting: route.troubleshooting,
    completionNote: route.completionNote, serviceWindowIds: route.serviceWindowIds, timetable: route.timetable,
    references: guide.references.filter((reference) => route.stepActions.some((action) => 'url' in action && action.url === reference.url)) } : guide
  if (!campus) return view
  const excluded = new Set((view.stepActions ?? []).flatMap((action) =>
    'url' in action && action.campus && action.campus !== campus ? [normalizedUrl(action.url)] : []))
  return { ...view, stepActions: view.stepActions?.filter((action) => !('campus' in action) || !action.campus || action.campus === campus),
    references: view.references.filter((ref) => !excluded.has(normalizedUrl(ref.url))) }
}

export function primaryGuideAction(guide: Guide, query = '') {
  const route = resolveGuideRoute(guide, query)
  if (guide.routes?.length && !route) return undefined
  const actions = (guideRouteView(guide, route, query).stepActions ?? []).filter((action): action is Extract<GuideStepAction, { url: string }> => 'url' in action)
  const campus = queryCampus(query)
  return actions.find((action) => campus && action.campus === campus) ?? actions.find((action) => action.kind === 'service') ?? actions[0]
}


export function searchTextParts(value: string, query: string) {
  const terms = queryTerms(query)
  const needles = [...new Set(terms.flatMap((term) => [term,
    ...(searchAliases.find(([canonical]) => canonical === term)?.[1] ?? []),
  ]))].filter(Boolean).sort((a, b) => b.length - a.length)
  if (!needles.length) return [{ text: value, matched: false }]
  const escape = (text: string) => [...text].map((char) => '.*+?^${}()|[]\\'.includes(char) ? `\\${char}` : char).join('')
  const pattern = new RegExp(needles.map(escape).join('|'), 'giu')
  const parts: { text: string; matched: boolean }[] = []
  let offset = 0
  for (const match of value.matchAll(pattern)) {
    if (match.index > offset) parts.push({ text: value.slice(offset, match.index), matched: false })
    parts.push({ text: match[0], matched: true })
    offset = match.index + match[0].length
  }
  if (offset < value.length) parts.push({ text: value.slice(offset), matched: false })
  return parts
}

export interface GuideSearchMatch { text: string; label: string; anchor: string }

export function guideSearchMatch(guide: Guide, query: string, windows: ServiceWindow[] = []): GuideSearchMatch | undefined {
  const terms = queryTerms(query)
  if (!terms.length) return undefined
  const candidates = [
    ...timetableSearchFields(guide.timetable).map((text) => ({ text, label: '班次与站点', anchor: 'guide-timetable-heading' })),
    ...guide.steps.map((text, i) => ({ text, label: '相关操作', anchor: `guide-step-${i}` })),
    ...(guide.troubleshooting ?? []).map((text, i) => ({ text, label: '遇到问题', anchor: `guide-help-${i}` })),
    ...guide.materials.map((text, i) => ({ text, label: '准备材料', anchor: `guide-material-${i}` })),
    ...windows.filter((window) => guide.serviceWindowIds?.includes(window.id)).map((window) => ({
      text: `${window.campus} · ${window.name}：${window.location}；${window.openingHours}；${window.contacts.map((contact) => contact.number).join('、')}`,
      label: '地点与时间', anchor: 'guide-windows-heading',
    })),
  ]
  const intents = new Set(['取消', '退款', '签到', '盖章', '密封', '打印', '时间'])
  const ranked = candidates.map((item, index) => ({ ...item, index,
    score: terms.reduce((score, term) => score + (canonicalSearch(item.text).includes(term) ? (intents.has(term) ? 4 : 1) : 0), 0)
      + (terms.includes('退款') && /退款状态|钱没退|原付款/.test(item.text) ? 3 : 0)
      + (terms.includes('取消') && /取消(?:功能|入口|操作)|(?:提前|选择|点击|完成)取消/.test(item.text) ? 2 : 0),
  })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index)
  const best = ranked[0]
  if (!best) return undefined
  const parts = searchTextParts(best.text, query)
  const first = parts.findIndex((part) => part.matched)
  const position = first < 0 ? 0 : parts.slice(0, first).reduce((total, part) => total + part.text.length, 0)
  const start = Math.max(0, position - 20)
  const end = Math.min(best.text.length, start + 95)
  return { text: `${start ? '…' : ''}${best.text.slice(start, end)}${end < best.text.length ? '…' : ''}`, label: best.label, anchor: best.anchor }
}
