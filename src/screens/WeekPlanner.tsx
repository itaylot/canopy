import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CaretRight, CaretLeft, Sparkle } from '@phosphor-icons/react'
import { useStore, type Course, type Exam, type Task } from '../store'
import type { DaySchedule } from '../schedule'
import { addDaysIso, formatHe, weekRangeLabel, examLabel, formatDuration, dayOfMonth } from '../utils'
import { Sheet } from '../ui'

const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

/**
 * The week as an editable board.
 *
 * There is no new data model here: a task pinned to a day is just `dueDate`
 * set, and `buildSchedule` already treats that as a fixed assignment. Dropping
 * a task on a day sets it; dropping it back in the pool clears it and hands
 * the task back to the auto-scheduler. That keeps the schedule fully derived —
 * nothing about the layout is ever persisted.
 *
 * Desktop uses native HTML5 drag and drop (no dependency). Touch drag is
 * genuinely bad and needs a library to fake, so mobile gets the same operation
 * as a tap-then-pick-a-day sheet instead.
 */
export function WeekPlanner({
  weekStart,
  onStep,
  onJumpToday,
  today,
  schedule,
  hidden,
  courseById,
  examsByDay,
}: {
  weekStart: string
  onStep: (delta: number) => void
  onJumpToday: () => void
  today: string
  schedule: DaySchedule
  hidden: Set<string>
  courseById: Map<string, Course>
  examsByDay: Map<string, Exam[]>
}) {
  const { tasks, toggleTask, setTaskDay } = useStore()
  const [dragging, setDragging] = useState<string | null>(null)
  const [picking, setPicking] = useState<Task | null>(null)

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)),
    [weekStart],
  )
  const visible = (list: Task[]) => list.filter((t) => !hidden.has(t.courseId))

  // The pool is everything still pending that the scheduler placed outside the
  // week on screen — the tasks you'd want to pull in. Tasks already inside the
  // week are shown in their day, not duplicated here.
  const pool = useMemo(() => {
    const insideWeek = new Set<string>()
    for (const d of days) for (const t of schedule[d] ?? []) insideWeek.add(t.id)
    return tasks.filter((t) => !t.done && !insideWeek.has(t.id) && !hidden.has(t.courseId))
  }, [tasks, schedule, days, hidden])

  const drop = (day: string | undefined) => (e: React.DragEvent) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/task-id')
    if (id) setTaskDay(id, day)
    setDragging(null)
  }
  const allowDrop = (e: React.DragEvent) => e.preventDefault()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl bg-surface p-3 shadow-card">
        <button onClick={() => onStep(-1)} className="rounded-full p-1.5 text-muted hover:bg-primary-soft" aria-label="שבוע קודם">
          <CaretRight size={20} />
        </button>
        <button onClick={onJumpToday} className="text-sm font-semibold text-ink">
          {weekRangeLabel(weekStart)}
        </button>
        <button onClick={() => onStep(1)} className="rounded-full p-1.5 text-muted hover:bg-primary-soft" aria-label="שבוע הבא">
          <CaretLeft size={20} />
        </button>
      </div>

      <p className="px-1 text-xs text-muted">
        <span className="hidden lg:inline">גרור משימה ליום אחר כדי לשבץ אותה מחדש.</span>
        <span className="lg:hidden">הקש על משימה כדי לשבץ אותה ליום אחר.</span>
      </p>

      {/* Seven day columns on desktop, a stack on mobile */}
      <div className="grid gap-2.5 lg:grid-cols-7 lg:items-start">
        {days.map((iso, dayIndex) => {
          const dayTasks = visible(schedule[iso] ?? [])
          const dayExams = (examsByDay.get(iso) ?? []).filter((e) => !hidden.has(e.courseId))
          const isToday = iso === today
          const isPast = iso < today
          return (
            <div
              key={iso}
              onDragOver={allowDrop}
              onDrop={drop(iso)}
              className={`min-h-24 rounded-2xl p-2.5 transition-colors ${
                isToday ? 'bg-primary-soft ring-1 ring-primary/40' : 'bg-surface shadow-card'
              } ${dragging ? 'ring-2 ring-dashed ring-primary/50' : ''} ${isPast ? 'opacity-60' : ''}`}
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-1">
                <span className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-ink'}`}>
                  <span className="lg:hidden">{formatHe(iso)}</span>
                  <span className="hidden lg:inline">{WEEKDAYS[dayIndex]}</span>
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
                      onDragEnd={() => setDragging(null)}
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

      {/* Pool: pending tasks the scheduler put beyond this week */}
      <div
        onDragOver={allowDrop}
        onDrop={drop(undefined)}
        className={`rounded-2xl bg-surface p-3 shadow-card transition-colors ${
          dragging ? 'ring-2 ring-dashed ring-primary/50' : ''
        }`}
      >
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-bold text-ink">מאגר משימות</h3>
          <span className="text-[11px] text-muted">מעבר ל-{weekRangeLabel(weekStart)}</span>
        </div>
        {pool.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted">
            כל המשימות הממתינות משובצות בשבוע הזה.
          </p>
        ) : (
          <>
            <p className="mb-2 text-[11px] text-muted">
              גרור לכאן כדי לבטל שיבוץ ולהחזיר לשיבוץ אוטומטי.
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
              {pool.map((t) => (
                <PlannerChip
                  key={t.id}
                  task={t}
                  course={courseById.get(t.courseId)}
                  onDragStart={() => setDragging(t.id)}
                  onDragEnd={() => setDragging(null)}
                  onPick={() => setPicking(t)}
                  onToggle={() => toggleTask(t.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

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

      <p className="px-1 text-[11px] text-muted">
        מסגרת מקווקוות = שובצה אוטומטית. שיבוץ ידני מקבע אותה ליום שבחרת.
      </p>
    </div>
  )
}

/** A compact task card: drag handle on desktop, tap-to-reschedule on mobile. */
function PlannerChip({
  task,
  course,
  onDragStart,
  onDragEnd,
  onPick,
  onToggle,
}: {
  task: Task
  course?: Course
  onDragStart: () => void
  onDragEnd: () => void
  onPick: () => void
  onToggle: () => void
}) {
  const pinned = !!task.dueDate
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      draggable
      onDragStart={(e) => {
        ;(e as unknown as DragEvent).dataTransfer?.setData('text/task-id', task.id)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-right lg:cursor-grab lg:active:cursor-grabbing ${
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
      <button onClick={onPick} className="min-w-0 flex-1 text-right">
        <span className="block truncate text-[11px] font-semibold leading-tight text-ink">{task.title}</span>
        <span className="block truncate text-[10px] text-muted">
          {course?.emoji} {formatDuration(task.minutes)}
        </span>
      </button>
    </motion.div>
  )
}

/** Mobile equivalent of dragging: pick the target day from a list. */
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
