// Runnable self-check for the scheduling algorithm.  `node schedule.check.mjs`
// Mirrors src/schedule.ts (kept in sync by hand — it's ~40 lines).
import assert from 'node:assert/strict'

const parseIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDaysIso = (s, n) => { const d = parseIso(s); d.setDate(d.getDate() + n); return toIso(d) }
const isoLt = (a, b) => a < b
const isoLte = (a, b) => a <= b

function buildSchedule(tasks, exams, today, dailyCap) {
  const pending = tasks.filter((t) => !t.done)
  const byDay = {}, load = {}
  const assign = (day, task) => { load[day] = (load[day] ?? 0) + task.minutes; (byDay[day] ??= []).push(task) }

  const fixed = pending.filter((t) => t.dueDate)
  const auto = pending.filter((t) => !t.dueDate)
  for (const task of fixed) assign(isoLt(task.dueDate, today) ? today : task.dueDate, task)

  const nextExamDate = (courseId) => {
    const up = exams.filter((e) => e.courseId === courseId && isoLte(today, e.date)).map((e) => e.date).sort()
    return up[0] ?? null
  }
  const items = auto.map((task) => {
    const exam = nextExamDate(task.courseId)
    let deadline = null
    if (exam) { deadline = addDaysIso(exam, -1); if (isoLt(deadline, today)) deadline = today }
    return { task, deadline }
  })
  items.sort((a, b) => {
    if (a.deadline && b.deadline) return a.deadline !== b.deadline ? (a.deadline < b.deadline ? -1 : 1) : b.task.minutes - a.task.minutes
    if (a.deadline) return -1
    if (b.deadline) return 1
    return b.task.minutes - a.task.minutes
  })
  for (const { task, deadline } of items) {
    let day = today
    while ((load[day] ?? 0) + task.minutes > dailyCap && (!deadline || isoLt(day, deadline))) day = addDaysIso(day, 1)
    if (deadline && isoLt(deadline, day)) day = deadline
    assign(day, task)
  }
  return byDay
}

const T = '2026-07-19'
const task = (id, courseId, minutes, extra = {}) => ({ id, courseId, title: id, minutes, done: false, ...extra })

// 1. A task assigned to today lands on today.
let s = buildSchedule([task('a', 'c1', 30, { dueDate: T })], [], T, 180)
assert.deepEqual(s[T].map((t) => t.id), ['a'])

// 2. Done tasks are ignored.
s = buildSchedule([task('a', 'c1', 30, { done: true, dueDate: T })], [], T, 180)
assert.equal(Object.keys(s).length, 0)

// 3. A fixed day assignment ignores the daily cap entirely (both land on today).
s = buildSchedule([task('a', 'c1', 120, { dueDate: T }), task('b', 'c1', 120, { dueDate: T })], [], T, 180)
assert.deepEqual(s[T].map((t) => t.id).sort(), ['a', 'b'])

// 4. Auto-distributed (no dueDate) tasks spill past the cap to the next day.
s = buildSchedule([task('a', 'c1', 120), task('b', 'c1', 120)], [], T, 180)
assert.equal(s[T].length, 1)
assert.equal(s[addDaysIso(T, 1)].length, 1)

// 5. Auto-distributed tasks never land on/after the exam day (buffer = day before).
const exam = { id: 'e', courseId: 'c1', title: 'x', date: addDaysIso(T, 3) }
s = buildSchedule([task('a', 'c1', 500)], [exam], T, 180) // huge task, must clamp to buffer day
const scheduledDay = Object.keys(s)[0]
assert.ok(isoLt(scheduledDay, exam.date), 'scheduled before exam day')
assert.ok(isoLte(scheduledDay, addDaysIso(exam.date, -1)), 'no later than buffer day')

// 6. A fixed assignment in the past is pulled up to today (missed tasks resurface).
s = buildSchedule([task('a', 'c1', 30, { dueDate: addDaysIso(T, -5) })], [], T, 180)
assert.deepEqual(s[T].map((t) => t.id), ['a'])


/* ---------------------------------------------------------------------------
 * Exam label (mirrors examLabel in src/utils.ts)
 * ------------------------------------------------------------------------- */
const examLabel = (title, courseName) => {
  const t = title.trim()
  if (t && t !== 'מבחן') return t
  return courseName ? `מבחן ב${courseName}` : 'מבחן'
}

// 7. A blank title, or the old literal default, falls back to the course name.
assert.equal(examLabel('', 'כימיה'), 'מבחן בכימיה')
assert.equal(examLabel('מבחן', 'כימיה'), 'מבחן בכימיה')  // legacy rows
assert.equal(examLabel('  ', 'כימיה'), 'מבחן בכימיה')
assert.equal(examLabel('מועד ב', 'כימיה'), 'מועד ב')      // a real title wins
assert.equal(examLabel('', undefined), 'מבחן')            // course deleted

/* ---------------------------------------------------------------------------
 * ICS escaping + folding (mirrors src/ics.ts)
 * ------------------------------------------------------------------------- */
const esc = (s) => s.replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n')
const fold = (line) => {
  if (line.length <= 75) return line
  const parts = [line.slice(0, 75)]
  for (let i = 75; i < line.length; i += 74) parts.push(' ' + line.slice(i, i + 74))
  return parts.join('\r\n')
}

// 8. RFC 5545 special characters are escaped, so one field can't break the file.
assert.equal(esc('a,b;c\\d'), 'a\\,b\\;c\\\\d')
assert.equal(esc('line1\nline2'), 'line1\\nline2')

// 9. Long lines fold, and every continuation line starts with a space.
const folded = fold('SUMMARY:' + 'x'.repeat(200)).split('\r\n')
assert.ok(folded.length > 1, 'long line folds')
assert.ok(folded[0].length <= 75, 'first segment within 75 octets')
assert.ok(folded.slice(1).every((l) => l.startsWith(' ')), 'continuations are space-prefixed')
assert.equal(folded.join('').replace(/ /g, ''), 'SUMMARY:' + 'x'.repeat(200), 'unfolds to the original')

// 10. Short lines are left alone.
assert.equal(fold('SUMMARY:short'), 'SUMMARY:short')

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
 * Week-planner drop hit test (mirrors zoneAt in src/screens/WeekPlanner.tsx)
 *
 * Motion reports the pointer in page coordinates while getBoundingClientRect
 * is viewport-relative, so the caller adds scroll offset when building zones.
 * These checks pin the boundary behaviour that decides which day a drop lands on.
 * ------------------------------------------------------------------------- */
function zoneAt(x, y, zones) {
  for (const z of zones) {
    if (x >= z.left && x <= z.right && y >= z.top && y <= z.bottom) return z.key
  }
  return null
}

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

console.log('schedule.check.mjs: all 18 checks passed ✓')
