import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { CaretRight, CaretLeft, Plus, PencilSimple, Trash } from '@phosphor-icons/react'
import { useStore, type Course, type Exam, type Task } from '../store'
import { buildSchedule } from '../schedule'
import { todayIso, monthLabel, formatHe, examLabel, monthCells } from '../utils'
import { toast } from '../toast'
import { Sheet, TaskRow, Field, inputClass, PrimaryButton, RowMenu, CourseFilter } from '../ui'

const WEEKDAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

export default function CalendarScreen() {
  const { tasks, exams, courses, toggleTask, addExam, updateExam, removeExam, restore } = useStore()
  const today = todayIso()
  const now = new Date()
  const [editingExam, setEditingExam] = useState<Exam | null>(null)
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState<string | null>(null)
  const [addingExam, setAddingExam] = useState(false)
  // Display filter only — the schedule is always computed from every task, so
  // hiding a course never changes where anything is scheduled.
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])
  const schedule = useMemo(() => buildSchedule(tasks), [tasks])
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

  const cells = useMemo(() => monthCells(year, month), [year, month])

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

      <CourseFilter courses={courses} hidden={hidden} onToggle={setHidden} />

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
                title={
                  dayExams
                    .map((e) => examLabel(e.title, courseById.get(e.courseId)?.name))
                    .join(', ') || undefined
                }
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
                    {examLabel(dayExams[0].title, courseById.get(dayExams[0].courseId)?.name)}
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

      <DaySheet
        iso={selected}
        onClose={() => setSelected(null)}
        tasks={selected ? visibleTasksOf(selected) : []}
        exams={selected ? visibleExamsOf(selected) : []}
        onToggle={toggleTask}
        onEditExam={(e) => {
          setSelected(null)
          setEditingExam(e)
        }}
        onDeleteExam={(e) => {
          removeExam(e.id)
          toast(`המבחן "${examLabel(e.title, courseById.get(e.courseId)?.name)}" נמחק.`, {
            actionLabel: 'ביטול',
            onAction: () => restore({ exams: [e] }),
          })
        }}
        courseById={courseById}
      />
      <ExamForm open={addingExam} onClose={() => setAddingExam(false)} onSubmit={addExam} />
      <ExamForm
        open={!!editingExam}
        editing={editingExam}
        onClose={() => setEditingExam(null)}
        onSubmit={(e) => editingExam && updateExam(editingExam.id, e)}
      />
    </div>
  )
}

function DaySheet({
  iso,
  onClose,
  tasks,
  exams,
  onToggle,
  onEditExam,
  onDeleteExam,
  courseById,
}: {
  iso: string | null
  onClose: () => void
  tasks: Task[]
  exams: Exam[]
  onToggle: (id: string) => void
  onEditExam: (e: Exam) => void
  onDeleteExam: (e: Exam) => void
  courseById: Map<string, Course>
}) {
  return (
    <Sheet open={!!iso} onClose={onClose} title={iso ? formatHe(iso) : ''}>
      <div className="space-y-3">
        {exams.map((e) => {
          const c = courseById.get(e.courseId)
          return (
            <div key={e.id} className="flex items-center gap-2 rounded-2xl bg-accent-soft px-4 py-3 font-medium text-ink">
              <span className="min-w-0 flex-1">
                📌 {examLabel(e.title, c?.name)}
                <span className="text-sm text-muted">
                  {' '}
                  · {c?.emoji} {c?.name}
                </span>
              </span>
              <RowMenu
                items={[
                  { label: 'עריכה', Icon: PencilSimple, onClick: () => onEditExam(e) },
                  { label: 'מחיקה', Icon: Trash, onClick: () => onDeleteExam(e), danger: true },
                ]}
              />
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

function ExamForm({
  open,
  onClose,
  onSubmit,
  editing,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (e: Omit<Exam, 'id'>) => void
  editing?: Exam | null
}) {
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    if (open) setNonce((n) => n + 1)
  }, [open])

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'עריכת מבחן' : 'הוספת מבחן'}>
      <ExamFormBody key={`${editing?.id ?? 'new'}-${nonce}`} onClose={onClose} onSubmit={onSubmit} editing={editing} />
    </Sheet>
  )
}

function ExamFormBody({
  onClose,
  onSubmit,
  editing,
}: {
  onClose: () => void
  onSubmit: (e: Omit<Exam, 'id'>) => void
  editing?: Exam | null
}) {
  const { courses } = useStore()
  const [courseId, setCourseId] = useState(editing?.courseId ?? courses[0]?.id ?? '')
  // Blank by default. This field used to be seeded with the literal "מבחן",
  // which is why saved exams showed no hint of which exam they were.
  const [title, setTitle] = useState(editing && editing.title !== 'מבחן' ? editing.title : '')
  const [date, setDate] = useState(editing?.date ?? '')

  const courseName = courses.find((c) => c.id === courseId)?.name

  const submit = () => {
    if (!courseId || !date) return
    onSubmit({ courseId, title: title.trim(), date })
    onClose()
  }

  return (
    <>
      <Field label="קורס">
        <select className={inputClass} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="כותרת (רשות)">
        <input
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={examLabel('', courseName)}
        />
      </Field>
      <Field label="תאריך">
        <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <p className="mb-3 -mt-1 text-xs text-muted">
        בלי כותרת, המבחן יופיע כ"{examLabel('', courseName)}".
      </p>
      <div className="mt-2">
        <PrimaryButton onClick={submit}>{editing ? 'שמור שינויים' : 'הוסף מבחן'}</PrimaryButton>
      </div>
    </>
  )
}
