import type { Guide } from '../types/guide'

export function guideTaskSummary(guide: Guide, overview: boolean, serviceWindowCount: number) {
  if (overview) return [{ label: '办理方式', text: `${guide.routes?.length ?? 0}种，先选择适用方式`, anchor: 'guide-methods-heading' }]
  const stepsLabel = guide.kind === 'procedure' ? '办理步骤' : guide.kind === 'options' ? '可选方式' : '事项说明'
  const hasPlace = serviceWindowCount > 0 || Boolean(guide.location || guide.openingHours || guide.contact)
  return [
    { label: '准备材料', text: guide.materials.length ? `${guide.materials.length}项` : '本条未列明', anchor: guide.materials.length ? 'guide-materials-heading' : null },
    { label: stepsLabel, text: guide.steps.length ? `${guide.steps.length}项` : '本条未列明', anchor: guide.steps.length ? 'guide-steps-heading' : null },
    { label: '地点与时间', text: serviceWindowCount > 0 ? `${serviceWindowCount}个已收录服务点` : hasPlace ? '查看本事项说明' : '本条未列明', anchor: hasPlace ? 'guide-windows-heading' : null },
  ]
}
