import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import { CaretRight, CaretLeft, Sparkle } from '@phosphor-icons/react'
import { useStore, type Course, type Task } from '../store'
import { buildSchedule } from '../schedule'
import { zoneAt, POOL, type Zone } from '../planner'
import {
  todayIso,
  addDaysIso,
  startOfWeekIso,
  formatHe,
  weekRangeLabel,
  examLabel,
  formatDuration,
  dayOfMonth,
} from '../utils'
import { Sheet, CourseFilter } from '../ui'

const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

/**
 * Week planning: the screen where a task gets its day.
 *
 * Dragging uses Motion's pointer-based drag rather than HTML5 drag-and-drop,
 * which does not exist on touch devices at all — and this app is used on a
 * phone. One mechanism covers mouse and touch, and it survives the chip being
 * covered by buttons, which native dragging does not reliably do.
 */
export default function WeekPlanner() {
  const { tasks, exams, courses, dailyCap, toggleTask, setTaskDay } = useStore()
  const today = todayIso()
  const [weekStart, setWeekStart] = useState(startOfWeekIso(today))
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [dragging, setDragging] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [picking, setPicking] = useState<Task | null>(null)

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])
  const schedule = useMemo(
    () => buildSchedule(tasks, exams, today, dailyCap),
    [tasks, exams, today, dailyCap],
  )
  const examsByDay = useMemo(() => {
    const m = new Map<string, typeof exams>()
    exams.forEach((e) => {
      if (!m.has(e.date)) m.set(e.date, [])
      m.get(e.date)!.push(e)
    })
    return m
  }, [exams])

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)),
    [weekStart],
  )

  // The pool holds pending tasks the scheduler placed outside the week on
  // screen — the ones you'd want to pull in. Tasks already inside the week
  // live in their day column instead of being listed twice.
  const pool = useMemo(() => {
    const insideWeek = new Set<string>()
    for (const d of days) for (const t of schedule[d] ?? []) insideWeek.add(t.id)
    return tasks.filter((t) => !t.done && !insideWeek.has(t.id) && !hidden.has(t.courseId))
  }, [tasks, schedule, days, hidden])

  // Drop targets register themselves so the hit test needs no DOM queries.
  const zoneEls = useRef(new Map<string, HTMLElement>())
  const registerZone = (key: string) => (el: HTMLElement | null) => {
    if (el) zoneEls.current.set(key, el)
    else zoneEls.current.delete(key)
  }
  const zones = (): Zone[] =>
    [...zoneEls.current.entries()].map(([key, el]) => {
      const r = el.getBoundingClientRect()
      // -> page coordinates, to match Motion's pageX/pageY pointer report
      return {
        key,
        left: r.left + window.scrollX,
        top: r.top + window.scrollY,
        right: r.right + window.scrollX,
        bottom: r.bottom + window.scrollY,
      }
    })

  const onDragMove = (_: unknown, info: PanInfo) => {
    setHovered(zoneAt(info.point.x, info.point.y, zones()))
  }

  const onDrop = (task: Task) => (_: unknown, info: PanInfo) => {
    const key = zoneAt(info.point.x, info.point.y, zones())
    setDragging(null)
    setHovered(null)
    if (!key) return // released in open space: leave the task alone
    setTaskDay(task.id, key === POOL ? undefined : key)
  }

  const visible = (list: Task[]) => list.filter((t) => !hidden.has(t.courseId))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">תכנון שבוע</h1>
      </div>

      <CourseFilter courses={courses} hidden={hidden} onToggle={setHidden} />

      <div className="flex items-center justify-between rounded-2xl bg-surface p-3 shadow-card">
        <button
          onClick={() => setWeekStart(addDaysIso(weekStart, -7))}
          className="rounded-full p-1.5 text-muted hover:bg-primary-soft"
          aria-label="שבוע קודם"
        >
          <CaretRight size={20} />
        </button>
        <button onClick={() => setWeekStart(startOfWeekIso(today))} className="text-sm font-semibold text-ink">
          {weekRangeLabel(weekStart)}
        </button>
        <button
          onClick={() => setWeekStart(addDaysIso(weekStart, 7))}
          className="rounded-full p-1.5 text-muted hover:bg-primary-soft"
          aria-label="שבוע הבא"
        >
          <CaretLeft size={20} />
        </button>
      </div>

      <p className="px-1 text-xs text-muted">
        גרור משימה ליום כדי לקבע אותה שם, או הקש עליה כדי לבחור יום מרשימה.
      </p>

      <div className="grid gap-2.5 lg:grid-cols-7 lg:items-start">
        {days.map((iso, i) => {
          const dayTasks = visible(schedule[iso] ?? [])
          const dayExams = (examsByDay.get(iso) ?? []).filter((e) => !hidden.has(e.courseId))
          const isToday = iso === today
          const isPast = iso < today
          const isTarget = hovered === iso
          return (
            <div
              key={iso}
              ref={registerZone(iso)}
              className={`min-h-24 rounded-2xl p-2.5 transition-colors ${
                isToday ? 'bg-primary-soft ring-1 ring-primary/40' : 'bg-surface shadow-card'
              } ${isTarget ? 'ring-2 ring-primary' : dragging ? 'ring-1 ring-dashed ring-primary/40' : ''} ${
                isPast ? 'opacity-60' : ''
              }`}
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-1">
                <span className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-ink'}`}>
                  <span className="lg:hidden">{formatHe(iso)}</span>
                  <span className="hidden lg:inline">{WEEKDAYS[i]}</span>
                </span>
                <span className="hidden text-[11px] tabular-nums text-muted lg:inline">{dayOfMonth(iso)}</span>
              </div>

              {dayExams.map((e) => (
                <div key={e.id} className="mb-1.5 rounded-lg bg-accent-soft px-2 py-1.5 text-[11px] font-medium text-ink">
                  📌 {examLabel(e.title, courseById.get(e.courseId)?.name)}
                </div>
              ))}

              <div className="space-y-1.5">
                <AnimatePresence mode="popLayout">
                  {dayTasks.map((t) => (
                    <PlannerChip
                      key={t.id}
                      task={t}
                      course={courseById.get(t.courseId)}
                      onDragStart={() => setDragging(t.id)}
                      onDragMove={onDragMove}
                      onDrop={onDrop(t)}
                      onPick={() => setPicking(t)}
                      onToggle={() => toggleTask(t.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {dayTasks.length === 0 && dayExams.length === 0 && (
                <p className="py-2 text-center text-[11px] text-muted">—</p>
              )}
            </div>
          )
        })}
      </div>

      <div
        ref={registerZone(POOL)}
        className={`rounded-2xl bg-surface p-3 shadow-card transition-colors ${
          hovered === POOL ? 'ring-2 ring-primary' : dragging ? 'ring-1 ring-dashed ring-primary/40' : ''
        }`}
      >
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-bold text-ink">מאגר משימות</h2>
          <span className="text-[11px] text-muted">מחוץ לשבוע הזה</span>
        </div>
        {pool.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted">כל המשימות הממתינות משובצות בשבוע הזה.</p>
        ) : (
          <>
            <p className="mb-2 text-[11px] text-muted">גרור לכאן כדי לבטל קיבוע ולהחזיר לשיבוץ אוטומטי.</p>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
              {pool.map((t) => (
                <PlannerChip
                  key={t.id}
                  task={t}
                  course={courseById.get(t.courseId)}
                  onDragStart={() => setDragging(t.id)}
                  onDragMove={onDragMove}
                  onDrop={onDrop(t)}
                  onPick={() => setPicking(t)}
                  onToggle={() => toggleTask(t.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <p className="px-1 text-[11px] text-muted">
        מסגרת מקווקוות = שובצה אוטומטית לפי המבחן הקרוב. גרירה מקבעת ליום שבחרת.
      </p>

      <DayPicker
        task={picking}
        days={days}
        today={today}
        onClose={() => setPicking(null)}
        onPick={(day) => {
          if (picking) setTaskDay(picking.id, day)
          setPicking(null)
        }}
      />
    </div>
  )
}

/** A draggable task card. Drag works with mouse and touch alike. */
function PlannerChip({
  task,
  course,
  onDragStart,
  onDragMove,
  onDrop,
  onPick,
  onToggle,
}: {
  task: Task
  course?: Course
  onDragStart: () => void
  onDragMove: (e: unknown, info: PanInfo) => void
  onDrop: (e: unknown, info: PanInfo) => void
  onPick: () => void
  onToggle: () => void
}) {
  const pinned = !!task.dueDate
  return (
    <motion.div
      layout
      drag
      dragSnapToOrigin
      dragMomentum={false}
      dragElastic={0.12}
      onDragStart={onDragStart}
      onDrag={onDragMove}
      onDragEnd={onDrop}
      whileDrag={{ scale: 1.06, zIndex: 50, cursor: 'grabbing' }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={`relative flex touch-none items-center gap-1.5 rounded-lg px-2 py-1.5 text-right shadow-sm ${
        pinned ? 'border' : 'border border-dashed'
      }`}
      style={{
        backgroundColor: (course?.color ?? '#4C7B39') + '14',
        borderColor: (course?.color ?? '#4C7B39') + (pinned ? '66' : '40'),
      }}
    >
      <button
        onClick={onToggle}
        aria-label={task.done ? 'בטל סימון' : 'סמן כהושלם'}
        className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors ${
          task.done ? 'border-primary bg-primary' : 'border-line'
        }`}
      />
      <button onClick={onPick} className="min-w-0 flex-1 cursor-grab text-right active:cursor-grabbing">
        <span className="block truncate text-[11px] font-semibold leading-tight text-ink">{task.title}</span>
        <span className="block truncate text-[10px] text-muted">
          {course?.emoji} {formatDuration(task.minutes)}
        </span>
      </button>
    </motion.div>
  )
}

/** Tap-to-assign: the smaller target on a phone, and the keyboard path. */
function DayPicker({
  task,
  days,
  today,
  onClose,
  onPick,
}: {
  task: Task | null
  days: string[]
  today: string
  onClose: () => void
  onPick: (day: string | undefined) => void
}) {
  return (
    <Sheet open={!!task} onClose={onClose} title={task ? `שיבוץ: ${task.title}` : ''}>
      <div className="space-y-1.5">
        {days.map((iso) => (
          <button
            key={iso}
            onClick={() => onPick(iso)}
            className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-right transition-colors ${
              task?.dueDate === iso ? 'bg-primary-soft text-primary' : 'text-ink hover:bg-primary-soft/60'
            }`}
          >
            <span className="font-medium">{formatHe(iso)}</span>
            {iso === today && <span className="text-xs text-muted">היום</span>}
          </button>
        ))}
        <button
          onClick={() => onPick(undefined)}
          className="mt-2 flex w-full items-center gap-2 rounded-xl border border-line px-4 py-3 text-right text-muted transition-colors hover:text-ink"
        >
          <Sparkle size={16} /> שיבוץ אוטומטי (לפי המבחן הקרוב)
        </button>
      </div>
    </Sheet>
  )
}
