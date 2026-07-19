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

console.log('schedule.check.mjs: all 6 checks passed ✓')
