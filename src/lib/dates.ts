/** The local calendar date as YYYY-MM-DD (not UTC, unlike toISOString). */
export function localDate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parse(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(date: string, days: number): string {
  const d = parse(date)
  d.setDate(d.getDate() + days)
  return localDate(d)
}

/** "Thu, Oct 1" */
export function formatShortDate(date: string): string {
  return parse(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}
