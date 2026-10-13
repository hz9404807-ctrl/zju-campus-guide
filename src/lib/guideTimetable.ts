import type { GuideTimetable } from '../types/guide'

export const timetableParamKeys = ['busDirection', 'busFrom', 'busTo', 'busDay'] as const
export type TimetableFilters = { direction: string; from: string; to: string; day: string }

export function clearTimetableParams(params: URLSearchParams) {
  const next = new URLSearchParams(params)
  for (const key of timetableParamKeys) next.delete(key)
  return next
}

export function timetableOptions(table: GuideTimetable, direction: string) {
  const trips = table.trips.filter((trip) => trip.direction === direction)
  return {
    from: [...new Set(trips.flatMap((trip) => trip.stops.slice(0, -1).map((stop) => stop.name)))],
    to: [...new Set(trips.flatMap((trip) => trip.stops.slice(1).map((stop) => stop.name)))],
    days: [...new Set(trips.map((trip) => trip.day ?? 'unspecified'))],
  }
}

export function timetableFilters(table: GuideTimetable, params: URLSearchParams): TimetableFilters {
  const direction = table.directions.find((item) => item.id === params.get('busDirection'))?.id ?? table.directions[0].id
  const options = timetableOptions(table, direction)
  const from = params.get('busFrom') ?? ''
  const to = params.get('busTo') ?? ''
  const day = params.get('busDay') ?? ''
  return { direction, from: options.from.includes(from) ? from : '', to: options.to.includes(to) ? to : '', day: options.days.includes(day) ? day : '' }
}

export function timetableRows(table: GuideTimetable, filters: TimetableFilters) {
  return table.trips.filter((trip) => trip.direction === filters.direction && (!filters.day || (trip.day ?? 'unspecified') === filters.day))
    .flatMap((trip) => {
      const start = filters.from ? trip.stops.findIndex((stop) => stop.name === filters.from) : 0
      const end = filters.to ? trip.stops.findIndex((stop) => stop.name === filters.to) : trip.stops.length - 1
      if (start < 0 || end < 0 || start >= end) return []
      return [{ trip, from: trip.stops[start], to: trip.stops[end], via: trip.stops.slice(start + 1, end) }]
    }).sort((a, b) => {
      const minutes = (time: string | null) => time ? Number(time.split(':')[0]) * 60 + Number(time.split(':')[1]) : Infinity
      // Never invent departure times for intermediate stops.
      if (!a.from.time && !b.from.time) return 0
      return minutes(a.from.time) - minutes(b.from.time)
    })
}

export function updateTimetableParams(table: GuideTimetable, params: URLSearchParams, key: typeof timetableParamKeys[number], value: string) {
  const next = new URLSearchParams(params)
  if (key === 'busDirection') {
    next.delete('busFrom')
    next.delete('busTo')
    const days = timetableOptions(table, value).days
    if (!days.includes(next.get('busDay') ?? '')) next.delete('busDay')
  }
  if (value) next.set(key, value)
  else next.delete(key)
  return next
}
