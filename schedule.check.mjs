// Runnable self-check for the app's pure logic.  `npm run check`
//
// These import the REAL modules from src/ (Node strips the TypeScript types on
// the fly). An earlier version re-implemented the algorithm here to avoid a
// build step, which meant src/schedule.ts could break while every check still
// passed — the checks were testing their own copy. Import only from modules
// with no JSX and no browser APIs.
import assert from 'node:assert/strict'
import { buildSchedule, unscheduled, scheduled, overdue, dayLoad } from './src/schedule.ts'
import { addDaysIso, examLabel } from './src/utils.ts'
import { zoneAt, tapGuard } from './src/planner.ts'
import { buildIcs } from './src/ics.ts'

const T = '2026-07-19'
const task = (id, courseId, minutes, extra = {}) => ({ id, courseId, title: id, minutes, done: false, ...extra })

// 1. A task placed on a day lands on that day.
let s = buildSchedule([task('a', 'c1', 30, { dueDate: T })])
assert.deepEqual(s[T].map((t) => t.id), ['a'])

// 2. Done tasks are ignored.
s = buildSchedule([task('a', 'c1', 30, { done: true, dueDate: T })])
assert.equal(Object.keys(s).length, 0)

// 3. A day holds however much the user put there — no cap moves anything.
s = buildSchedule([task('a', 'c1', 120, { dueDate: T }), task('b', 'c1', 120, { dueDate: T })])
assert.deepEqual(s[T].map((t) => t.id).sort(), ['a', 'b'])

// 4. NOTHING is scheduled automatically. A task with no day is not placed on
//    any day — it waits in the pool. This is what makes "drag back to the pool"
//    possible at all: the scheduler used to put such a task straight back onto
//    a day, so returning one to the pool looked like the drag had failed.
s = buildSchedule([task('a', 'c1', 120), task('b', 'c1', 120)])
assert.deepEqual(s, {}, 'undated tasks are not placed anywhere')

// 5. Those same tasks are exactly what the pool shows, and completed ones are
//    not offered for scheduling.
const waiting = unscheduled([
  task('a', 'c1', 60),
  task('b', 'c1', 60, { dueDate: T }),
  task('c', 'c1', 60, { done: true }),
])
assert.deepEqual(waiting.map((t) => t.id), ['a'])

// 6. A missed task is NEVER relocated. It stays on the day it was planned for
//    — it used to be moved onto today, which silently inflated today's load and
//    made the task vanish from the day the user had actually chosen.
const past = addDaysIso(T, -5)
s = buildSchedule([task('a', 'c1', 30, { dueDate: past })])
assert.deepEqual(s[past].map((t) => t.id), ['a'], 'stays on its own day')
assert.equal(s[T], undefined, 'today is left alone')

// 6b. The three pending states are mutually exclusive and cover everything
//     that is not done — that is what lets each screen ask for exactly one of
//     them without a task showing up twice or falling through the cracks.
const ALL = [
  task('pool', 'c1', 60),
  task('future', 'c1', 60, { dueDate: addDaysIso(T, 2) }),
  task('todayTask', 'c1', 60, { dueDate: T }),
  task('missed', 'c1', 60, { dueDate: past }),
  task('finished', 'c1', 60, { done: true, dueDate: past }),
]
const ids = (list) => list.map((t) => t.id).sort()
assert.deepEqual(ids(unscheduled(ALL)), ['pool'])
assert.deepEqual(ids(scheduled(ALL, T)), ['future', 'todayTask'], 'today counts as scheduled')
assert.deepEqual(ids(overdue(ALL, T)), ['missed'])
assert.equal(
  unscheduled(ALL).length + scheduled(ALL, T).length + overdue(ALL, T).length,
  ALL.filter((t) => !t.done).length,
  'every pending task lands in exactly one bucket',
)

// 6c. Overdue is oldest first, so the longest-neglected task is at the top.
const older = addDaysIso(T, -9)
assert.deepEqual(
  overdue([task('b', 'c1', 30, { dueDate: past }), task('a', 'c1', 30, { dueDate: older })], T).map(
    (t) => t.id,
  ),
  ['a', 'b'],
)

// 6d. Day load drives the "overloaded" badge.
assert.equal(dayLoad([task('a', 'c1', 90), task('b', 'c1', 60)]), 150)
assert.equal(dayLoad([]), 0)


/* ---------------------------------------------------------------------------
 * Exam label
 * ------------------------------------------------------------------------- */

// 7. A blank title, or the old literal default, falls back to the course name.
assert.equal(examLabel('', 'כימיה'), 'מבחן בכימיה')
assert.equal(examLabel('מבחן', 'כימיה'), 'מבחן בכימיה')  // legacy rows
assert.equal(examLabel('  ', 'כימיה'), 'מבחן בכימיה')
assert.equal(examLabel('מועד ב', 'כימיה'), 'מועד ב')      // a real title wins
assert.equal(examLabel('', undefined), 'מבחן')            // course deleted

/* ---------------------------------------------------------------------------
 * Calendar export — exercised through the real buildIcs
 * ------------------------------------------------------------------------- */
const COURSES = [{ id: 'c1', name: 'כימיה', emoji: '⚗️', color: '#4C7B39' }]
const NOW = '20260721T120000Z'

// 8. A well-formed calendar: CRLF line endings, balanced envelope, all-day
//    events whose exclusive DTEND is the following day.
const ics = buildIcs(
  [{ id: 'e1', courseId: 'c1', title: '', date: '2026-07-27' }],
  { '2026-07-21': [{ id: 't1', courseId: 'c1', title: 'תרגול', minutes: 90, done: false }] },
  COURSES,
  NOW,
)
assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'), 'CRLF envelope')
assert.ok(ics.trimEnd().endsWith('END:VCALENDAR'), 'envelope closed')
assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2, 'one exam + one task')
assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, (ics.match(/END:VEVENT/g) ?? []).length)
assert.ok(ics.includes('DTSTART;VALUE=DATE:20260727'), 'exam start')
assert.ok(ics.includes('DTEND;VALUE=DATE:20260728'), 'DTEND is exclusive')
assert.ok(ics.includes('מבחן בכימיה'), 'untitled exam gets the derived label')

// 9. Fields that contain RFC 5545 delimiters are escaped rather than breaking
//    the file structure.
const nasty = buildIcs(
  [],
  { '2026-07-21': [{ id: 't2', courseId: 'c1', title: 'א,ב;ג\\ד', minutes: 60, done: false }] },
  COURSES,
  NOW,
)
assert.ok(nasty.includes('א\\,ב\\;ג\\\\ד'), 'comma, semicolon and backslash escaped')
assert.equal((nasty.match(/BEGIN:VEVENT/g) ?? []).length, 1, 'still one event')

// 10. Long values fold, and every continuation line starts with a space so the
//     file unfolds back to the original.
const long = buildIcs(
  [],
  { '2026-07-21': [{ id: 't3', courseId: 'c1', title: 'x'.repeat(200), minutes: 60, done: false }] },
  COURSES,
  NOW,
)
const summaryLines = long.split('\r\n')
const startIdx = summaryLines.findIndex((l) => l.startsWith('SUMMARY:'))
assert.ok(summaryLines[startIdx].length <= 75, 'first segment within 75 chars')
assert.ok(summaryLines[startIdx + 1].startsWith(' '), 'continuation is space-prefixed')

/* ---------------------------------------------------------------------------
 * Cloud sync race (mirrors the dirty-flag logic in src/cloud.ts)
 *
 * The bug: a snapshot landing inside the 700ms debounce window overwrote the
 * edit the user had just made, which then reappeared once the queued write
 * completed — on screen, a reset followed by a delayed response.
 * ------------------------------------------------------------------------- */
function makeSync() {
  let local = 'server'
  let dirty = false
  let queued = false
  return {
    read: () => local,
    edit(v) { local = v; dirty = true; queued = true },
    /** A snapshot arriving from the server. */
    remote(v) { if (dirty) return; local = v },
    /** The debounced write firing, then being acknowledged. */
    flush() { queued = false; if (!queued) dirty = false; return local },
  }
}

// 11. A remote snapshot mid-edit does NOT clobber the local edit.
let sync = makeSync()
sync.edit('mine')
sync.remote('stale')                       // this used to win, causing the flicker
assert.equal(sync.read(), 'mine', 'local edit survives a snapshot in the window')
assert.equal(sync.flush(), 'mine', 'the value written is the one on screen')

// 12. Once the write is acknowledged, remote snapshots apply again.
sync.remote('from-other-device')
assert.equal(sync.read(), 'from-other-device', 'sync resumes after the write settles')

// 13. Without an edit in flight, a snapshot applies immediately.
sync = makeSync()
sync.remote('from-phone')
assert.equal(sync.read(), 'from-phone')

/* ---------------------------------------------------------------------------
 * Week-planner drop hit test
 *
 * Motion reports the pointer in page coordinates while getBoundingClientRect
 * is viewport-relative, so the caller adds scroll offset when building zones.
 * These checks pin the boundary behaviour that decides which day a drop lands on.
 * ------------------------------------------------------------------------- */

// Two side-by-side day columns and a pool strip underneath.
const ZONES = [
  { key: '2026-07-20', left: 0, top: 0, right: 99, bottom: 199 },
  { key: '2026-07-21', left: 100, top: 0, right: 199, bottom: 199 },
  { key: 'pool', left: 0, top: 300, right: 199, bottom: 399 },
]

// 14. A drop inside a column resolves to that day.
assert.equal(zoneAt(50, 100, ZONES), '2026-07-20')
assert.equal(zoneAt(150, 100, ZONES), '2026-07-21')

// 15. Edges are inclusive, and neighbouring columns do not overlap: a point
//     belongs to exactly one day.
assert.equal(zoneAt(99, 0, ZONES), '2026-07-20')
assert.equal(zoneAt(100, 0, ZONES), '2026-07-21')

// 16. Released in open space -> null, so the caller leaves the task untouched
//     rather than silently assigning it somewhere.
assert.equal(zoneAt(50, 250, ZONES), null, 'gap between columns and pool')
assert.equal(zoneAt(-5, 100, ZONES), null, 'left of everything')
assert.equal(zoneAt(50, 500, ZONES), null, 'below everything')

// 17. The pool is a normal zone; the caller maps it to "no day".
assert.equal(zoneAt(100, 350, ZONES), 'pool')

// 18. Scrolled page: zones are built in page coordinates, so a pointer at
//     pageY 1100 hits a column whose viewport top was 100 under 1000px scroll.
const SCROLLED = [{ key: '2026-07-22', left: 0, top: 1100, right: 99, bottom: 1299 }]
assert.equal(zoneAt(50, 1150, SCROLLED), '2026-07-22')
assert.equal(zoneAt(50, 150, SCROLLED), null, 'viewport coords must not match')

/* ---------------------------------------------------------------------------
 * Click-after-drag guard
 *
 * Releasing a drag over a button makes the browser fire a click on it, which
 * popped the day picker open after every single drop — the dialog dragging
 * exists to avoid.
 * ------------------------------------------------------------------------- */

// 19. A plain tap (down, then click, no drag) goes through.
let g = tapGuard()
g.down()
assert.equal(g.shouldIgnoreClick(), false, 'a tap is not swallowed')

// 20. A click that follows a drag is swallowed.
g = tapGuard()
g.down()
g.dragStart()
assert.equal(g.shouldIgnoreClick(), true, 'the stray post-drag click is ignored')

// 21. And the very next tap works again — the flag must not stick, or the chip
//     would stop responding to taps after its first drag.
g.down()
assert.equal(g.shouldIgnoreClick(), false, 'the guard resets for the next interaction')

// 22. Even if no click arrives after a drag, the next pointerdown clears it.
g = tapGuard()
g.down()
g.dragStart()
g.down()
assert.equal(g.shouldIgnoreClick(), false, 'a fresh interaction is never blocked')

/* ---------------------------------------------------------------------------
 * Undo after delete (the real store)
 *
 * Deleting a course cascades to its tasks and exams, so undo has to bring all
 * three back — and must not duplicate rows if it runs twice.
 * ------------------------------------------------------------------------- */
const { useStore, captureCourse } = await import('./src/store.ts')

const seed = () =>
  useStore.setState({
    courses: [
      { id: 'c1', name: 'כימיה', emoji: '⚗️', color: '#4C7B39' },
      { id: 'c2', name: 'פיזיקה', emoji: '📐', color: '#714F21' },
    ],
    tasks: [
      { id: 't1', courseId: 'c1', title: 'a', minutes: 60, done: false },
      { id: 't2', courseId: 'c1', title: 'b', minutes: 60, done: false },
      { id: 't3', courseId: 'c2', title: 'c', minutes: 60, done: false },
    ],
    exams: [
      { id: 'e1', courseId: 'c1', title: '', date: '2026-08-01' },
      { id: 'e2', courseId: 'c2', title: '', date: '2026-08-02' },
    ],
  })

// 23. Deleting a course takes its tasks and exams with it, and leaves the
//     other course untouched.
seed()
const undo = captureCourse('c1')
useStore.getState().removeCourse('c1')
let st = useStore.getState()
assert.deepEqual(st.courses.map((c) => c.id), ['c2'])
assert.deepEqual(st.tasks.map((t) => t.id), ['t3'], 'c1 tasks removed')
assert.deepEqual(st.exams.map((e) => e.id), ['e2'], 'c1 exams removed')

// 24. Undo restores every cascaded row.
useStore.getState().restore(undo)
st = useStore.getState()
assert.deepEqual(st.courses.map((c) => c.id).sort(), ['c1', 'c2'])
assert.deepEqual(st.tasks.map((t) => t.id).sort(), ['t1', 't2', 't3'], 'tasks came back')
assert.deepEqual(st.exams.map((e) => e.id).sort(), ['e1', 'e2'], 'exams came back')

// 25. Undo twice must not duplicate anything.
useStore.getState().restore(undo)
st = useStore.getState()
assert.equal(st.tasks.length, 3, 'no duplicate tasks')
assert.equal(st.courses.length, 2, 'no duplicate courses')

// 26. Undoing a delete must not revert edits made while the toast was up:
//     only the captured rows come back.
seed()
const undoC1 = captureCourse('c1')
useStore.getState().removeCourse('c1')
useStore.getState().updateCourse('c2', { name: 'פיזיקה 2' })
useStore.getState().restore(undoC1)
assert.equal(
  useStore.getState().courses.find((c) => c.id === 'c2').name,
  'פיזיקה 2',
  'unrelated edit survives the undo',
)

console.log('schedule.check.mjs: all 30 checks passed ✓')
