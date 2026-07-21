import type { Course, Exam, Task } from './store'
import type { DaySchedule } from './schedule'
import { addDaysIso, examLabel, formatDuration } from './utils'

// A one-way snapshot export: exams and scheduled tasks as all-day events, in
// the iCalendar format every calendar app can import. Deliberately not a live
// two-way Google Calendar sync — that needs OAuth scopes, token refresh and
// conflict resolution, which is more machinery than this app earns today.

const stamp = (iso: string) => iso.replace(/-/g, '')

/** RFC 5545 §3.3.11: backslash, semicolon, comma and newlines are escaped. */
const esc = (s: string) => s.replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n')

/** Lines must be CRLF-terminated and folded at 75 octets.
 *  ponytail: folds by JS string length, not octets — Hebrew is 2 bytes in
 *  UTF-8, so lines can run to ~150 octets. Google/Apple/Outlook all accept
 *  this; switch to a byte-aware fold (without splitting a code point) only if
 *  some stricter parser ever rejects the file. */
const fold = (line: string) => {
  if (line.length <= 75) return line
  const parts = [line.slice(0, 75)]
  for (let i = 75; i < line.length; i += 74) parts.push(' ' + line.slice(i, i + 74))
  return parts.join('\r\n')
}

function event(uid: string, day: string, summary: string, description: string, now: string) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@canopy.app`,
    `DTSTAMP:${now}`,
    // All-day event: DTEND is exclusive, so it is the following day.
    `DTSTART;VALUE=DATE:${stamp(day)}`,
    `DTEND;VALUE=DATE:${stamp(addDaysIso(day, 1))}`,
    `SUMMARY:${esc(summary)}`,
    ...(description ? [`DESCRIPTION:${esc(description)}`] : []),
    'END:VEVENT',
  ]
}

export function buildIcs(
  exams: Exam[],
  schedule: DaySchedule,
  courses: Course[],
  now: string,
): string {
  const nameOf = (id: string) => courses.find((c) => c.id === id)?.name
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Canopy//Study Planner//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Canopy',
  ]

  for (const e of exams) {
    lines.push(...event(`exam-${e.id}`, e.date, `📌 ${examLabel(e.title, nameOf(e.courseId))}`, nameOf(e.courseId) ?? '', now))
  }

  for (const [day, tasks] of Object.entries(schedule)) {
    for (const t of tasks as Task[]) {
      const course = nameOf(t.courseId)
      lines.push(
        ...event(
          `task-${t.id}`,
          day,
          `🌿 ${t.title}`,
          [course, formatDuration(t.minutes)].filter(Boolean).join(' · '),
          now,
        ),
      )
    }
  }

  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** Hands the file to the browser's normal download flow. */
export function downloadIcs(content: string, filename = 'canopy.ics') {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
