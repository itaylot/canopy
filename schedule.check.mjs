// Runnable self-check for the app's pure logic.  `npm run check`
//
// These import the REAL modules from src/ (Node strips the TypeScript types on
// the fly). An earlier version re-implemented the algorithm here to avoid a
// build step, which meant src/schedule.ts could break while every check still
// passed — the checks were testing their own copy. Import only from modules
// with no JSX and no browser APIs.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSchedule, unscheduled, scheduled, overdue, dayLoad } from './src/schedule.ts'
import { addDaysIso, examLabel, taskCountLabel, examCountLabel } from './src/utils.ts'
import { zoneAt, tapGuard } from './src/planner.ts'
import { buildIcs } from './src/ics.ts'
import { isDark, normalizeThemeMode, themedCourseColor, COURSE_PALETTES } from './src/store.ts'
import { msLeft, isPaused, isDone } from './src/focus.ts'
import { angleFor, pt, nearestIndex, clampAngle, START, SWEEP } from './src/dialGeometry.ts'
import {
  shouldShowInstallHint,
  INSTALL_HINT_SNOOZE_MS,
  isIOSUserAgent,
  classifyIOSBrowser,
} from './src/installHintLogic.ts'
import { useNav, goTo } from './src/nav.ts'
import { onboardingStepsDone } from './src/onboarding.ts'

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

/* ---------------------------------------------------------------------------
 * Theme + mode resolution and legacy migration (the real store helpers)
 * ------------------------------------------------------------------------- */

// 31. isDark: 'auto' follows the device; light/dark force it either way.
assert.equal(isDark('auto', true), true, 'auto + device dark = dark')
assert.equal(isDark('auto', false), false, 'auto + device light = light')
assert.equal(isDark('dark', false), true, 'forced dark ignores a light device')
assert.equal(isDark('light', true), false, 'forced light ignores a dark device')

// 32. Legacy `scene` migrates without data loss: everything old becomes the
//     forest place, and only 'night' carries over as a forced-dark mode.
assert.deepEqual(normalizeThemeMode({ scene: 'night' }), { theme: 'forest', mode: 'dark' })
assert.deepEqual(normalizeThemeMode({ scene: 'forest' }), { theme: 'forest', mode: 'auto' })
assert.deepEqual(normalizeThemeMode({ scene: 'auto' }), { theme: 'forest', mode: 'auto' })

// 33. New docs pass through; unknown/absent values fall back safely.
assert.deepEqual(normalizeThemeMode({ theme: 'sea', mode: 'dark' }), { theme: 'sea', mode: 'dark' })
assert.deepEqual(normalizeThemeMode({}), { theme: 'forest', mode: 'auto' }, 'empty doc is safe')
assert.deepEqual(
  normalizeThemeMode({ theme: 'bogus', mode: 'bogus' }),
  { theme: 'forest', mode: 'auto' },
  'garbage falls back to defaults',
)


/* ---------------------------------------------------------------------------
 * Palette contrast (parses the real src/index.css)
 *
 * White-on-primary measured 2.5-3.3 in every dark theme before --on-primary
 * existed — a primary action nobody could read. These assertions keep any
 * future palette edit from quietly reintroducing that.
 * ------------------------------------------------------------------------- */
const cssText = readFileSync(new URL('./src/index.css', import.meta.url), 'utf8')

const palettes = {}
for (const m of cssText.matchAll(/:root([^{]*)\{([^}]*)\}/g)) {
  const sel = m[1].trim()
  const theme = (/data-theme=.(\w+)./.exec(sel) || [])[1] || 'forest'
  const key = theme + (/data-mode=.dark./.test(sel) ? '/dark' : '/light')
  palettes[key] = palettes[key] || {}
  for (const v of m[2].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)) palettes[key][v[1]] = v[2]
}

const channel = (c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4)
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// 34. Every theme, in both modes, clears WCAG AA (4.5) on the text pairs that
//     carry the interface — including the label on the primary button.
const AA = 4.5
for (const [name, p] of Object.entries(palettes)) {
  if (!p.ink) continue
  const light = name.endsWith('/light')
  const onPrimary = p['on-primary'] ?? (light ? palettes['forest/light']['on-primary'] : palettes['forest/dark']['on-primary'])
  const pairs = [
    ['body text', p.ink, p.surface],
    ['text on page', p.ink, p.bg],
    ['secondary text', p.muted, p.surface],
    ['active nav item', p.primary, p['primary-soft']],
    ['primary button label', onPrimary, p.primary],
  ]
  for (const [what, fg, bg] of pairs) {
    if (!fg || !bg) continue
    const r = contrast(fg, bg)
    assert.ok(r >= AA, `${name} ${what}: ${r.toFixed(2)} is below AA (${AA})`)
  }
}


/* ---------------------------------------------------------------------------
 * Course colours follow the theme without touching stored data
 * ------------------------------------------------------------------------- */

// 35. A course keeps its slot: the hex it was saved with maps to the same
//     position in whichever theme is active, so identity survives a theme swap.
const slot2 = COURSE_PALETTES.forest[2]
assert.equal(themedCourseColor(slot2, 'forest'), COURSE_PALETTES.forest[2])
assert.equal(themedCourseColor(slot2, 'sea'), COURSE_PALETTES.sea[2])
assert.equal(themedCourseColor(slot2, 'snow'), COURSE_PALETTES.snow[2])

// 36. Case-insensitive (stored hexes have varied in case), and an unrecognised
//     colour is passed straight through rather than being remapped or lost.
assert.equal(themedCourseColor(slot2.toLowerCase(), 'sea'), COURSE_PALETTES.sea[2])
assert.equal(themedCourseColor('#123456', 'sea'), '#123456', 'unknown colour survives')
assert.equal(themedCourseColor(undefined, 'sea'), COURSE_PALETTES.sea[0], 'missing falls back')

// 37. Every theme offers the same number of distinct slots.
for (const [name, list] of Object.entries(COURSE_PALETTES)) {
  assert.equal(list.length, COURSE_PALETTES.forest.length, `${name} palette length`)
  assert.equal(new Set(list.map((c) => c.toLowerCase())).size, list.length, `${name} has no duplicates`)
}

/* ---------------------------------------------------------------------------
 * Focus session clock (src/focus.ts)
 *
 * The whole point is a timer that survives leaving the screen, so the remaining
 * time is derived from an absolute end timestamp, not a counter. These pin that.
 * ------------------------------------------------------------------------- */
const T0 = 1_000_000
const running = (endsAt) => ({ taskId: null, taskTitle: null, totalMs: 25 * 60_000, endsAt, pausedLeftMs: null })
const paused = (leftMs) => ({ taskId: null, taskTitle: null, totalMs: 25 * 60_000, endsAt: null, pausedLeftMs: leftMs })

// 38. Time left is measured from the end timestamp, so re-reading it later (a
//     reload, a backgrounded tab) gives the correct smaller number, not a reset.
const sess = running(T0 + 25 * 60_000)
assert.equal(msLeft(sess, T0), 25 * 60_000, 'full at the start')
assert.equal(msLeft(sess, T0 + 10 * 60_000), 15 * 60_000, '10 minutes later, 15 remain')
assert.equal(msLeft(sess, T0 + 99 * 60_000), 0, 'never goes negative')

// 39. A paused session freezes: time left is fixed regardless of the clock.
const p = paused(12 * 60_000)
assert.equal(msLeft(p, T0), 12 * 60_000)
assert.equal(msLeft(p, T0 + 5 * 60_000), 12 * 60_000, 'paused time does not drain')
assert.ok(isPaused(p) && !isPaused(sess))

// 40. Done is a function of the clock, so completion is detected on the next
//     read even if nothing fired exactly at zero.
assert.ok(!isDone(sess, T0))
assert.ok(isDone(running(T0), T0 + 1), 'past the end time = done')
assert.ok(!isDone(paused(5), T0 + 10_000), 'a paused session is never done')

/* ---------------------------------------------------------------------------
 * FocusDial geometry (src/dialGeometry.ts)
 *
 * A 270° sweep, 0 = top, clockwise+, 90° gap at the bottom. These pin the
 * math a pointer drag depends on — angleFor/pt define where each preset and
 * the handle sit, nearestIndex is what a drag snaps to, and clampAngle is
 * what keeps a drag inside the sweep.
 * ------------------------------------------------------------------------- */

// 41. The sweep's two ends land exactly on START and START+SWEEP.
assert.equal(angleFor(0, 6), START)
assert.equal(angleFor(5, 6), START + SWEEP)

// 42. pt() places angle 0 straight up from center, and 90° directly to the
//     right — the "0 = top, clockwise+" convention every other calculation
//     in this file assumes.
assert.deepEqual(pt(0, 10), { x: 110, y: 100 })
assert.deepEqual(pt(90, 10), { x: 120, y: 110 })

// 43. nearestIndex snaps a pointer angle to the preset it's actually closest
//     to, including landing exactly on the two boundary presets.
assert.equal(nearestIndex(-135, 6), 0)
assert.equal(nearestIndex(135, 6), 5)
assert.equal(nearestIndex(-30, 6), 2, 'closer to preset 2 than its neighbors')

// 44. clampAngle: a pointer inside the sweep passes through unchanged.
assert.equal(clampAngle(0), 0)

// 45. clampAngle: a pointer in the 90° gap snaps to whichever edge is
//     angularly nearer. A naive fold-then-clamp used to send a pointer just
//     past the START+SWEEP edge all the way to the opposite END edge instead
//     — the handle would teleport 270° across the dial for a few degrees of
//     pointer movement right at the seam.
assert.equal(clampAngle(150), START + SWEEP, '15° past the top edge stays near it')
assert.equal(clampAngle(170), START + SWEEP, 'still closer to the top edge than the bottom one')
assert.equal(clampAngle(-160), START, '25° past the bottom edge stays near it')

// 46. Month-grid singular/plural count labels.
assert.equal(taskCountLabel(1), 'משימה אחת')
assert.equal(taskCountLabel(4), '4 משימות')
assert.equal(examCountLabel(1), 'מבחן אחד')
assert.equal(examCountLabel(2), '2 מבחנים')

// 47. Install-hint snooze: never dismissed shows immediately; a fresh
//     dismissal stays quiet; one past the snooze window shows again.
const hintNow = Date.parse(T)
assert.equal(shouldShowInstallHint(null, hintNow), true, 'never dismissed — show it')
assert.equal(shouldShowInstallHint(hintNow, hintNow), false, 'just dismissed — stay quiet')
assert.equal(
  shouldShowInstallHint(hintNow - INSTALL_HINT_SNOOZE_MS - 1, hintNow),
  true,
  'snooze window elapsed — show it again',
)
assert.equal(
  shouldShowInstallHint(hintNow - INSTALL_HINT_SNOOZE_MS + 1, hintNow),
  false,
  'just inside the snooze window — still quiet',
)

// 48. goTo switches the active tab.
assert.equal(useNav.getState().tab, 'home', 'starts on home')
goTo('plan')
assert.equal(useNav.getState().tab, 'plan')

// 49. iOS / browser detection against real-world UA strings. classifyIOSBrowser
//     is only meaningful once isIOSUserAgent (or the live isIOS()) is already
//     true — Android is asserted at that gate, not through classify.
const UA_IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const UA_IPAD_SAFARI =
  'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const UA_DESKTOP_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
const UA_ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36'
const UA_INSTAGRAM_IN_APP =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0.00'
const UA_CHROME_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1'

assert.equal(isIOSUserAgent(UA_IPHONE_SAFARI), true, 'iPhone Safari')
assert.equal(isIOSUserAgent(UA_IPAD_SAFARI), true, 'iPadOS Safari (classic UA)')
assert.equal(isIOSUserAgent(UA_DESKTOP_SAFARI), false, 'desktop Safari is not iOS')
assert.equal(isIOSUserAgent(UA_ANDROID_CHROME), false, 'Android is not iOS')

assert.equal(classifyIOSBrowser(UA_IPHONE_SAFARI), 'safari')
assert.equal(classifyIOSBrowser(UA_IPAD_SAFARI), 'safari')
assert.equal(classifyIOSBrowser(UA_INSTAGRAM_IN_APP), 'in-app', 'a common social-app in-app browser')
assert.equal(classifyIOSBrowser(UA_CHROME_IOS), 'other', 'a real but non-Safari iOS browser')

// 50. Onboarding checklist: appears/disappears strictly from current data, and
//     — since it's a live reflection, not a one-time flag — reappears the
//     moment a completed step becomes undone again (e.g. the last course of
//     its kind gets deleted).
assert.deepEqual(onboardingStepsDone([], [], []), [false, false, false, false], 'brand new account')
const oneCourse = [{ id: 'c1', name: 'Course', emoji: '📘', color: '#000' }]
const oneExam = [{ id: 'e1', courseId: 'c1', title: '', date: '2026-08-01' }]
const unscheduledTask = [task('t1', 'c1', 30)]
const scheduledTask = [task('t2', 'c1', 30, { dueDate: '2026-08-01' })]
assert.deepEqual(onboardingStepsDone(oneCourse, [], []), [true, false, false, false])
assert.deepEqual(onboardingStepsDone(oneCourse, oneExam, unscheduledTask), [true, true, true, false])
assert.deepEqual(onboardingStepsDone(oneCourse, oneExam, scheduledTask), [true, true, true, true], 'all four done')
// The "undo" case: same data as fully-done, minus the one course — the course
// step (and only that one) flips back to not-done, exactly as if a user who
// had everything set up deleted their one course.
assert.deepEqual(
  onboardingStepsDone([], oneExam, scheduledTask),
  [false, true, true, true],
  'deleting the only course un-does step 1, even though steps 2-4 still hold',
)

console.log('schedule.check.mjs: all 50 checks passed ✓')
