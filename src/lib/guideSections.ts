import type { Guide } from '../types/guide'

export function guideSections(guide: Guide, overview: boolean, hasServiceInfo: boolean, stepsHeading: string) {
  const sections: { id: string; label: string }[] = []
  if (overview) sections.push({ id: 'guide-methods-heading', label: '全部办理方式' })
  else {
    if (guide.materials.length) sections.push({ id: 'guide-materials-heading', label: '办理前准备' })
    if (guide.steps.length) sections.push({ id: 'guide-steps-heading', label: stepsHeading })
    if (hasServiceInfo) sections.push({ id: 'guide-windows-heading', label: '地点与时间' })
    if (guide.troubleshooting?.length || guide.notes.length) sections.push({
      id: guide.troubleshooting?.length ? 'guide-help-heading' : 'guide-notes-heading',
      label: guide.troubleshooting?.length ? '遇到问题怎么办' : '办理前留意',
    })
  }
  if (guide.references.length) sections.push({ id: 'guide-references-heading', label: '办事入口与参考' })
  return sections
}
