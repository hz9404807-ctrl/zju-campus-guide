import { ArrowRight, ExternalLink } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { clearTimetableParams, timetableFilters, timetableOptions, timetableRows, updateTimetableParams, timetableParamKeys } from '../lib/guideTimetable'
import type { GuideTimetable as Timetable } from '../types/guide'
import './guide-timetable.css'

export default function GuideTimetable({ table }: { table: Timetable }) {
  const [params, setParams] = useSearchParams()
  const filters = timetableFilters(table, params)
  const options = timetableOptions(table, filters.direction)
  const rows = timetableRows(table, filters)
  const direction = table.directions.find((item) => item.id === filters.direction)!
  function update(key: typeof timetableParamKeys[number], value: string) {
    setParams(updateTimetableParams(table, params, key, value), { preventScrollReset: true })
  }
  const station = (stop: { name: string; time: string | null }) => <><strong className="timetable-time">{stop.time ?? '时间未公布'}</strong><span>{stop.name}</span></>
  const via = (stops: { name: string; time: string | null }[]) => stops.length ? stops.map((stop) => `${stop.name}（${stop.time ?? '时间未公布'}）`).join(' → ') : '无其他表列站点'
  const dayLabel = (day: string | null) => day ?? '未注明星期'
  return <section className="guide-detail-section guide-timetable" aria-labelledby="guide-timetable-heading">
    <div className="timetable-heading"><div><p className="eyebrow">先选方向，再查站点与时刻</p><h2 id="guide-timetable-heading" tabIndex={-1}>班次与站点</h2></div><a href={table.source.url} target="_blank" rel="noopener noreferrer">查看官方班表 <ExternalLink size={15} aria-hidden="true" /></a></div>
    <div className="timetable-directions" role="group" aria-label="班车方向">{table.directions.map((item) => <button key={item.id} type="button" aria-pressed={filters.direction === item.id} onClick={() => update('busDirection', item.id)}>{item.label}</button>)}</div>
    <div className="timetable-filters">
      <label htmlFor="bus-from">上车站<select id="bus-from" value={filters.from} onChange={(e) => update('busFrom', e.target.value)}><option value="">各班次始发站</option>{options.from.map((name) => <option key={name}>{name}</option>)}</select></label>
      <label htmlFor="bus-to">下车站<select id="bus-to" value={filters.to} onChange={(e) => update('busTo', e.target.value)}><option value="">各班次终点站</option>{options.to.map((name) => <option key={name}>{name}</option>)}</select></label>
      <label htmlFor="bus-day">班表星期标注<select id="bus-day" value={filters.day} onChange={(e) => update('busDay', e.target.value)}><option value="">全部标注</option>{options.days.map((day) => <option key={day} value={day}>{dayLabel(day === 'unspecified' ? null : day)}</option>)}</select></label>
    </div>
    <p className="timetable-status" role="status" aria-live="polite">{direction.label} · {rows.length} 条班表记录{rows.length ? rows.some((row) => row.from.time) ? '；按所选上车站的表定时间排列。' : '；所选上车站的时间未公布，请向服务站确认。' : '；没有符合所选站点顺序和星期标注的记录。'}</p>
    {rows.length ? <>
      <table className="timetable-table"><caption className="sr-only">{direction.label}的官方班表记录，实际开行请查预约系统</caption><thead><tr><th scope="col">班次 / 星期</th><th scope="col">上车站与时刻</th><th scope="col">下车站与时刻</th><th scope="col">所选区间经停</th></tr></thead><tbody>{rows.map((row) => <tr key={row.trip.id}><th scope="row">{row.trip.label}<span>{dayLabel(row.trip.day)}</span></th><td>{station(row.from)}</td><td>{station(row.to)}</td><td className="timetable-via">{via(row.via)}</td></tr>)}</tbody></table>
      <ul className="timetable-cards" aria-label="班表记录">{rows.map((row) => <li key={row.trip.id}><div className="timetable-card-heading"><strong>{row.trip.label}</strong><span>{dayLabel(row.trip.day)}</span></div><div className="timetable-journey"><div>{station(row.from)}</div><ArrowRight size={18} aria-hidden="true" /><div>{station(row.to)}</div></div><p className="timetable-via">区间经停：{via(row.via)}</p></li>)}</ul>
    </> : <div className="timetable-empty"><p>试试更换上下车站或星期标注。本站只有按官方表先后顺序到达的班次记录。</p></div>}
    {(filters.from || filters.to || filters.day || filters.direction !== table.directions[0].id) && <button type="button" className="guide-reset-button" onClick={() => setParams(clearTimetableParams(params), { preventScrollReset: true })}>重置班表筛选</button>}
    <div className="timetable-notices"><p><strong>出发前确认当天开行与乘车资格</strong></p><ul>{table.notices.map((notice) => <li key={notice}>{notice}</li>)}</ul></div>
  </section>
}
