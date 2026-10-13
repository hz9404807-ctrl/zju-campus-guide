import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { clearTimetableParams, timetableFilters, timetableOptions, timetableRows, updateTimetableParams } from '../src/lib/guideTimetable.ts'
import { filterGuides, guideRouteView, guideSearchMatch, resolveGuideRoute } from '../src/lib/campusContent.ts'
import { guideSections } from '../src/lib/guideSections.ts'
const guides = JSON.parse(readFileSync(new URL('../src/data/guides.json', import.meta.url), 'utf8'))
const shuttle = guides.find((g) => g.id === 'campus-077')
const cross = shuttle.routes.find((r) => r.id === 'haining-intercampus').timetable
const metro = shuttle.routes.find((r) => r.id === 'haining-metro').timetable
const filters = (table, query = '') => timetableFilters(table, new URLSearchParams(query))

// Expected times were checked against the two original PDF pages, not calculated.
test('跨校区11班次与官方PDF的时刻和星期逐项一致', () => {
  const expected = {
    AB10: [null, '06:30', '07:00', '08:30'], AB21: [null, '17:10', '18:40', '19:10'],
    AB30: ['周日', '16:00', '16:30', '18:00'], EB10: [null, '08:20', '09:00', '10:20'],
    EB20: [null, '10:30', '11:00', '12:30'], EB30: [null, '17:30', '18:10', '19:40'],
    EB41: [null, '07:00', '08:30', '09:00'], EB51: [null, '12:40', '14:10', '14:40'],
    EB61: [null, '14:30', '16:00', '16:30'], WB11: ['周六', '08:00', '09:30', '10:00'],
    WB20: ['周六', '16:30', '17:00', '18:30'],
  }
  assert.equal(cross.trips.length, 11)
  for (const trip of cross.trips) {
    assert.deepEqual([trip.day, ...trip.stops.filter((s) => s.time).map((s) => s.time)], expected[trip.id])
    assert.equal(trip.stops.find((s) => s.name === '虾龙圩').time, null)
    const names = trip.stops.map((s) => s.name)
    assert.equal(names.indexOf('虾龙圩') < names.indexOf('紫金港东2门'), trip.direction === 'to-hangzhou')
  }
  assert.equal(cross.trips.find((t) => t.id === 'WB11').stops[0].name, '惟学书院南侧')
  assert.equal(cross.trips.find((t) => t.id === 'WB20').stops.at(-1).name, '惟学书院南侧')
  assert.ok(cross.trips.filter((t) => t.direction === 'to-haining' && t.id !== 'WB20').every((t) => t.stops.at(-1).name === '海宁行政楼西侧'))
})

test('接驳12条时刻、星期与去回程站序独立对应官方PDF', () => {
  assert.equal(metro.trips.length, 12)
  for (const [day, direction, pairs] of [
    ['周五', 'to-metro', ['16:30/16:39', '20:00/20:09', '21:00/21:09']],
    ['周日', 'to-metro', ['19:00/19:09', '20:00/20:09', '21:00/21:09']],
    ['周五', 'to-campus', ['16:40/16:50', '20:10/20:20', '21:10/21:20']],
    ['周日', 'to-campus', ['19:10/19:20', '20:10/20:20', '21:10/21:20']],
  ]) {
    const trips = metro.trips.filter((t) => t.direction === direction && t.day === day)
    assert.deepEqual(trips.map((t) => `${t.stops[0].time}/${t.stops.at(-1).time}`), pairs)
    for (const trip of trips) {
      assert.deepEqual(trip.stops.slice(1, -1).map((s) => s.name), direction === 'to-metro' ? ['文理楼北面', '海宁行政楼西侧', '国际校区南门'] : ['海宁行政楼西侧', '国际校区南门'])
      assert.ok(trip.stops.slice(1, -1).every((s) => s.time === null))
    }
  }
})

test('方向切换分别返回5/6条跨校区、6/6条接驳，已知出发时间递增', () => {
  for (const [table, counts] of [[cross, [5, 6]], [metro, [6, 6]]]) {
    for (const [i, direction] of table.directions.entries()) {
      const rows = timetableRows(table, filters(table, `busDirection=${direction.id}`))
      assert.equal(rows.length, counts[i])
      assert.deepEqual(rows.map((r) => r.from.time), rows.map((r) => r.from.time).toSorted())
      assert.equal(new Set(rows.map((r) => r.trip.id)).size, rows.length)
    }
  }
})

test('选择紫金港上车显示紫金港发车时间，区间末端和途中站不会错用始发时间', () => {
  const selected = filters(cross, 'busDirection=to-haining&busFrom=紫金港东2门&busTo=海宁行政楼西侧')
  const rows = timetableRows(cross, selected)
  assert.equal(rows.length, 5)
  const ab10 = rows.find((r) => r.trip.id === 'AB10')
  assert.equal(ab10.from.time, '07:00')
  assert.equal(ab10.to.time, '08:30')
  assert.deepEqual(ab10.via, [{ name: '虾龙圩', time: null }])
  const reverse = timetableRows(cross, filters(cross, 'busDirection=to-haining&busFrom=虾龙圩&busTo=紫金港东2门'))
  assert.deepEqual(reverse, [])
})

test('日期筛选不将未注明星期的班次推断为周末，也不编造途中时间', () => {
  assert.deepEqual(timetableRows(cross, filters(cross, 'busDay=周六')).map((r) => r.trip.id), ['WB11'])
  assert.equal(timetableRows(cross, filters(cross, 'busDay=unspecified')).length, 4)
  assert.equal(timetableRows(metro, filters(metro, 'busDay=周五')).length, 3)
  assert.equal(timetableRows(metro, filters(metro, 'busFrom=文理楼北面'))[0].from.time, null)
  assert.equal(timetableOptions(metro, 'to-campus').from.includes('文理楼北面'), false)
})

test('无效网址参数安全回到当前班表，清除只影响班表条件并保留搜索与路线', () => {
  assert.deepEqual(filters(cross, 'busDirection=oops&busFrom=车站不存在&busDay=每天'), { direction: 'to-hangzhou', from: '', to: '', day: '' })
  const params = new URLSearchParams('q=海宁班车&category=校园生活&page=2&route=haining-intercampus&busDirection=to-haining&busFrom=紫金港东2门&busTo=虾龙圩&busDay=周六')
  assert.equal(clearTimetableParams(params).toString(), new URLSearchParams('q=海宁班车&category=校园生活&page=2&route=haining-intercampus').toString())
  assert.equal(params.get('busDay'), '周六')
})

test('班次与站点仍可搜索定位，路线切换不会泄漏班表，目录不生成空标题', () => {
  for (const query of ['AB10', 'EB41', '海宁班车 07:00', '海宁班车 虾龙圩']) assert.equal(filterGuides(guides, query)[0]?.id, shuttle.id, query)
  const view = guideRouteView(shuttle, resolveGuideRoute(shuttle, 'AB10'))
  assert.equal(view.timetable, cross)
  assert.equal(guideSearchMatch(view, 'AB10').anchor, 'guide-timetable-heading')
  for (const route of shuttle.routes) {
    const v = guideRouteView(shuttle, route)
    assert.equal(!!v.timetable, route.id !== 'hangzhou-campus')
    assert.equal(guideSections(v, false, false, '具体操作').some((s) => s.id === 'guide-timetable-heading'), !!v.timetable)
  }
  assert.equal(shuttle.timetable, undefined)
  assert.ok(cross.source.url.endsWith('.pdf'))
  assert.ok(cross.notices.some((n) => /未满5人/.test(n)))
})

test('切换方向保留仍适用的星期、清除旧站点，浏览器历史参数可重建原筛选', () => {
  const old = new URLSearchParams('q=海宁地铁接驳&route=haining-metro&busDay=周日&busFrom=文理楼北面')
  const next = updateTimetableParams(metro, old, 'busDirection', 'to-campus')
  assert.equal(next.get('busDay'), '周日')
  assert.equal(next.has('busFrom'), false)
  assert.equal(next.get('q'), old.get('q'))
  assert.equal(timetableRows(metro, timetableFilters(metro, next)).length, 3)
  assert.equal(timetableRows(metro, timetableFilters(metro, old))[0].from.time, null)
  const crossNext = updateTimetableParams(cross, new URLSearchParams('busDirection=to-haining&busDay=周日'), 'busDirection', 'to-hangzhou')
  assert.equal(crossNext.has('busDay'), false)
})
