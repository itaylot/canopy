// All dates are handled as local-time "YYYY-MM-DD" strings so they sort
// chronologically as plain strings and never drift by a day via UTC.

export const toIso = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const todayIso = () => toIso(new Date())

export const parseIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDaysIso = (s: string, n: number) => {
  const d = parseIso(s)
  d.setDate(d.getDate() + n)
  return toIso(d)
}

export const daysBetweenIso = (a: string, b: string) =>
  Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86_400_000)

export const isoLt = (a: string, b: string) => a < b
export const isoLte = (a: string, b: string) => a <= b

const heFull = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
const heShort = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long' })

export const formatHe = (iso: string) => heFull.format(parseIso(iso))
export const formatHeShort = (iso: string) => heShort.format(parseIso(iso))
export const monthLabel = (year: number, month: number) =>
  new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1))

/**
 * A month grid, Sunday-first: leading blanks to line the 1st up under its
 * weekday, then every day of the month. Shared by the calendar screen and the
 * mini month on the home screen, which built the identical grid separately.
 */
export function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const out: (string | null)[] = []
  for (let i = 0; i < first.getDay(); i++) out.push(null)
  for (let d = 1; d <= daysInMonth; d++) out.push(toIso(new Date(year, month, d)))
  return out
}

const heMonthShort = new Intl.DateTimeFormat('he-IL', { month: 'short' })
export const monthShortHe = (iso: string) => heMonthShort.format(parseIso(iso))
export const dayOfMonth = (iso: string) => Number(iso.slice(-2))

// Human-readable relative time ("in two days"), never a raw date or "in 48 hours".
export function relativeDaysHe(from: string, to: string): string {
  const d = daysBetweenIso(from, to)
  if (d < 0) return 'עבר'
  if (d === 0) return 'היום'
  if (d === 1) return 'מחר'
  if (d === 2) return 'עוד יומיים'
  return `עוד ${d} ימים`
}

// Weeks are Sunday-first, matching getDay() (0 = Sunday) and the Hebrew week.
export const startOfWeekIso = (iso: string) => {
  const d = parseIso(iso)
  d.setDate(d.getDate() - d.getDay())
  return toIso(d)
}

export const weekRangeLabel = (startIso: string) =>
  `${heShort.format(parseIso(startIso))} – ${heShort.format(parseIso(addDaysIso(startIso, 6)))}`

// An exam with no title of its own is shown as "מבחן ב<קורס>" rather than a
// bare "מבחן", which said nothing about which exam it was. The literal 'מבחן'
// is treated as empty too — it used to be the form's default value, so it sits
// in already-saved exams. Derived at display time, so no data migration.
export const examLabel = (title: string, courseName?: string) => {
  const t = title.trim()
  if (t && t !== 'מבחן') return t
  return courseName ? `מבחן ב${courseName}` : 'מבחן'
}

// Tasks are stored in minutes (that's what the scheduler and daily cap use),
// but people think in hours — these format/pick helpers keep the UI hour-based
// without touching the underlying data model.
/** How long a single task takes. Capped at six hours — beyond that it should
 *  be split into several tasks rather than planned as one block. */
export const DURATION_OPTIONS_MIN = [30, 60, 90, 120, 150, 180, 240, 300, 360]

/** How much to study in a day. A separate list from the task lengths above:
 *  a twelve-hour day is a reasonable target during exam period, but a
 *  twelve-hour single task is not. */
export const DAILY_CAP_OPTIONS_MIN = [60, 90, 120, 150, 180, 240, 300, 360, 420, 480, 540, 600, 720]

export function formatDuration(minutes: number): string {
  const h = minutes / 60
  if (h === 0.5) return 'חצי שעה'
  if (h === 1) return 'שעה'
  if (h === 1.5) return 'שעה וחצי'
  if (h === 2) return 'שעתיים'
  if (h === 2.5) return 'שעתיים וחצי'
  return `${Number.isInteger(h) ? h : h.toFixed(1)} שעות`
}
