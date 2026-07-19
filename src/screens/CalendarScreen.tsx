import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { CaretRight, CaretLeft, Plus } from '@phosphor-icons/react'
import { useStore, type Course, type Exam, type Task } from '../store'
import { buildSchedule } from '../schedule'
import {
  todayIso,
  toIso,
  monthLabel,
  formatHe,
  startOfWeekIso,
  addDaysIso,
  weekRangeLabel,
} from '../utils'
import { Sheet, TaskRow, Field, inputClass, PrimaryButton } from '../ui'

const WEEKDAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

export default function CalendarScreen() {
  const { tasks, exams, courses, dailyCap, toggleTask, addExam } = useStore()
  const today = todayIso()
  const now = new Date()
  const [view, setView] = useState<'month' | 'week'>('month')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [weekStart, setWeekStart] = useState(startOfWeekIso(today))
  const [selected, setSelected] = useState<string | null>(null)
  const [addingExam, setAddingExam] = useState(false)
  // Which courses are hidden from the calendar view — mirrors Google Calendar's
  // "which calendars to show" checkbox list. Purely a display filter: the
  // schedule itself is always computed from every task so capacity balancing
  // stays correct regardless of what's currently shown.
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])
  const schedule = useMemo(
    () => buildSchedule(tasks, exams, today, dailyCap),
    [tasks, exams, today, dailyCap],
  )
  const examsByDay = useMemo(() => {
    const m = new Map<string, Exam[]>()
    exams.forEach((e) => {
      if (!m.has(e.date)) m.set(e.date, [])
      m.get(e.date)!.push(e)
    })
    return m
  }, [exams])

  const visibleTasksOf = (iso: string) => (schedule[iso] ?? []).filter((t) => !hidden.has(t.courseId))
  const visibleExamsOf = (iso: string) => (examsByDay.get(iso) ?? []).filter((e) => !hidden.has(e.courseId))

  const toggleCourse = (id: string) =>
    setHidden((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // Build the month grid: leading blanks (Sunday-first week) + all days.
  const cells = useMemo(() => {
    const first = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const out: (string | null)[] = []
    for (let i = 0; i < first.getDay(); i++) out.push(null)
    for (let d = 1; d <= daysInMonth; d++) out.push(toIso(new Date(year, month, d)))
    return out
  }, [year, month])

  const stepMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">לוח זמנים</h1>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setAddingExam(true)}
          className="flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card"
        >
          <Plus weight="bold" size={16} /> מבחן
        </motion.button>
      </div>

      {courses.length > 0 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {courses.map((c) => {
            const on = !hidden.has(c.id)
            return (
              <button
                key={c.id}
                onClick={() => toggleCourse(c.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-all ${
                  on ? 'ring-line' : 'opacity-40 ring-line'
                }`}
                style={{ backgroundColor: on ? c.color + '1a' : 'transparent' }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.emoji} {c.name}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex gap-1 rounded-full bg-primary-soft p-1 text-sm font-semibold">
        {(['month', 'week'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-full py-2 transition-colors ${
              view === v ? 'bg-surface text-primary shadow-card' : 'text-muted'
            }`}
          >
            {v === 'month' ? 'חודש' : 'שבוע'}
          </button>
        ))}
      </div>

      {view === 'month' ? (
        <div className="rounded-2xl bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            {/* In RTL, "previous" sits on the right visually */}
            <button onClick={() => stepMonth(-1)} className="rounded-full p-1.5 text-muted hover:bg-primary-soft" aria-label="חודש קודם">
              <CaretRight size={20} />
            </button>
            <span className="font-semibold text-ink">{monthLabel(year, month)}</span>
            <button onClick={() => stepMonth(1)} className="rounded-full p-1.5 text-muted hover:bg-primary-soft" aria-label="חודש הבא">
              <CaretLeft size={20} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-xs text-muted">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((iso, i) => {
              if (!iso) return <div key={i} />
              const dayNum = Number(iso.slice(-2))
              const hasTasks = visibleTasksOf(iso).length > 0
              const dayExams = visibleExamsOf(iso)
              const isToday = iso === today
              return (
                <motion.button
                  key={iso}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setSelected(iso)}
                  title={dayExams.map((e) => e.title).join(', ') || undefined}
                  className={`relative flex min-h-14 flex-col items-center gap-0.5 rounded-xl px-0.5 pt-1.5 text-sm transition-colors ${
                    isToday ? 'bg-primary font-bold text-white' : 'text-ink hover:bg-primary-soft'
                  }`}
                >
                  <span>{dayNum}</span>
                  {dayExams.length > 0 && (
                    <span
                      className={`w-full truncate rounded px-0.5 text-[8px] font-medium leading-tight ${
                        isToday ? 'bg-white/25 text-white' : 'bg-accent-soft text-ink'
                      }`}
                    >
                      {dayExams[0].title}
                    </span>
                  )}
                  {hasTasks && (
                    <span
                      className={`mt-auto mb-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                        isToday ? 'bg-white' : 'bg-primary'
                      }`}
                    />
                  )}
                </motion.button>
              )
            })}
          </div>

          <div className="mt-3 flex justify-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded bg-accent-soft" /> מבחן
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary" /> משימות
            </span>
          </div>
        </div>
      ) : (
        <WeekView
          weekStart={weekStart}
          onStep={(d) => setWeekStart(addDaysIso(weekStart, d * 7))}
          onJumpToday={() => setWeekStart(startOfWeekIso(today))}
          today={today}
          visibleTasksOf={visibleTasksOf}
          visibleExamsOf={visibleExamsOf}
          courseById={courseById}
          onToggleTask={toggleTask}
        />
      )}

      <DaySheet
        iso={selected}
        onClose={() => setSelected(null)}
        tasks={selected ? visibleTasksOf(selected) : []}
        exams={selected ? visibleExamsOf(selected) : []}
        onToggle={toggleTask}
        courseById={courseById}
      />
      <AddExam open={addingExam} onClose={() => setAddingExam(false)} />
    </div>
  )
}

function WeekView({
  weekStart,
  onStep,
  onJumpToday,
  today,
  visibleTasksOf,
  visibleExamsOf,
  courseById,
  onToggleTask,
}: {
  weekStart: string
  onStep: (delta: number) => void
  onJumpToday: () => void
  today: string
  visibleTasksOf: (iso: string) => Task[]
  visibleExamsOf: (iso: string) => Exam[]
  courseById: Map<string, Course>
  onToggleTask: (id: string) => void
}) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)), [weekStart])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl bg-surface p-3 shadow-card">
        <button onClick={() => onStep(-1)} className="rounded-full p-1.5 text-muted hover:bg-primary-soft">
          <CaretRight size={20} />
        </button>
        <button onClick={onJumpToday} className="text-sm font-semibold text-ink">
          {weekRangeLabel(weekStart)}
        </button>
        <button onClick={() => onStep(1)} className="rounded-full p-1.5 text-muted hover:bg-primary-soft">
          <CaretLeft size={20} />
        </button>
      </div>

      <div className="space-y-2.5">
        {days.map((iso) => {
          const dayTasks = visibleTasksOf(iso)
          const dayExams = visibleExamsOf(iso)
          const isToday = iso === today
          const empty = dayTasks.length === 0 && dayExams.length === 0
          return (
            <div
              key={iso}
              className={`rounded-2xl p-3 ${
                isToday ? 'bg-primary-soft' : 'bg-surface shadow-card'
              }`}
            >
              <p className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-ink'}`}>{formatHe(iso)}</p>
              {empty ? (
                <p className="mt-1 text-xs text-muted">אין כלום מתוכנן</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {dayExams.map((e) => {
                    const c = courseById.get(e.courseId)
                    return (
                      <div key={e.id} className="rounded-xl bg-accent-soft px-3 py-2 text-sm font-medium text-ink">
                        📌 {e.title}
                        <span className="text-xs text-muted">
                          {' '}
                          · {c?.emoji} {c?.name}
                        </span>
                      </div>
                    )
                  })}
                  {dayTasks.map((t) => (
                    <TaskRow key={t.id} task={t} course={courseById.get(t.courseId)} onToggle={() => onToggleTask(t.id)} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DaySheet({
  iso,
  onClose,
  tasks,
  exams,
  onToggle,
  courseById,
}: {
  iso: string | null
  onClose: () => void
  tasks: Task[]
  exams: Exam[]
  onToggle: (id: string) => void
  courseById: Map<string, Course>
}) {
  return (
    <Sheet open={!!iso} onClose={onClose} title={iso ? formatHe(iso) : ''}>
      <div className="space-y-3">
        {exams.map((e) => {
          const c = courseById.get(e.courseId)
          return (
            <div key={e.id} className="rounded-2xl bg-accent-soft px-4 py-3 font-medium text-ink">
              📌 {e.title}
              <span className="text-sm text-muted">
                {' '}
                · {c?.emoji} {c?.name}
              </span>
            </div>
          )
        })}

        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} course={courseById.get(t.courseId)} onToggle={() => onToggle(t.id)} />
        ))}

        {tasks.length === 0 && exams.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">אין כלום מתוכנן ליום הזה 🌤️</p>
        )}
      </div>
    </Sheet>
  )
}

function AddExam({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { courses, addExam } = useStore()
  const [courseId, setCourseId] = useState('')
  const [title, setTitle] = useState('מבחן')
  const [date, setDate] = useState('')

  const submit = () => {
    const cid = courseId || courses[0]?.id
    if (!cid || !date) return
    addExam({ courseId: cid, title: title.trim() || 'מבחן', date })
    setTitle('מבחן')
    setDate('')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="הוספת מבחן">
      <Field label="קורס">
        <select className={inputClass} value={courseId || courses[0]?.id || ''} onChange={(e) => setCourseId(e.target.value)}>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="כותרת">
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="תאריך">
        <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="mt-2">
        <PrimaryButton onClick={submit}>הוסף מבחן</PrimaryButton>
      </div>
    </Sheet>
  )
}
