import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, Trash } from '@phosphor-icons/react'
import { useStore, COURSE_COLORS, COURSE_EMOJIS, type Course } from '../store'
import {
  todayIso,
  formatHeShort,
  formatDuration,
  relativeDaysHe,
  examLabel,
  DURATION_OPTIONS_MIN,
} from '../utils'
import { Sheet, TaskRow, Field, inputClass, PrimaryButton, Card, RowMenu } from '../ui'

export default function Courses() {
  const { courses, tasks, exams, addCourse, updateCourse, removeCourse } = useStore()
  const today = todayIso()
  const [open, setOpen] = useState<Course | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)

  const statFor = (courseId: string) => {
    const list = tasks.filter((t) => t.courseId === courseId)
    const done = list.filter((t) => t.done).length
    const minutesLeft = list.filter((t) => !t.done).reduce((sum, t) => sum + t.minutes, 0)
    const exam = exams
      .filter((e) => e.courseId === courseId && e.date >= today)
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0]
    return { total: list.length, done, minutesLeft, exam }
  }

  const overall = useMemo(() => {
    const done = tasks.filter((t) => t.done).length
    const left = tasks.filter((t) => !t.done)
    return { done, remaining: left.length, minutesLeft: left.reduce((s, t) => s + t.minutes, 0) }
  }, [tasks])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">הקורסים שלי</h1>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card"
        >
          <Plus weight="bold" size={16} /> קורס
        </motion.button>
      </div>

      {tasks.length > 0 && (
        <Card className="grid grid-cols-3 divide-x divide-x-reverse divide-line p-4 text-center">
          <Summary value={String(overall.done)} label="הושלמו" />
          <Summary value={String(overall.remaining)} label="נשארו" />
          <Summary value={formatDuration(overall.minutesLeft)} label="זמן שנותר" />
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {courses.map((c) => {
          const { total, done, minutesLeft, exam } = statFor(c.id)
          const pct = total ? (done / total) * 100 : 0
          return (
            <motion.div
              key={c.id}
              layout
              className="w-full overflow-hidden rounded-2xl bg-surface text-right shadow-card transition-shadow hover:shadow-lg"
            >
              {/* The card is a div, not a button: the overflow menu is itself a
                  button and nesting buttons is invalid HTML (and breaks clicks). */}
              <div className="flex items-center gap-3 p-4">
                <button onClick={() => setOpen(c)} className="flex min-w-0 flex-1 items-center gap-3 text-right">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl"
                    style={{ backgroundColor: c.color + '1f' }}
                  >
                    {c.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{c.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {done} מתוך {total} משימות
                      {minutesLeft > 0 ? ` · נותרו ${formatDuration(minutesLeft)}` : ''}
                    </span>
                  </span>
                </button>
                {exam && (
                  <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-ink">
                    {relativeDaysHe(today, exam.date)}
                  </span>
                )}
                <RowMenu onEdit={() => setEditingCourse(c)} onDelete={() => removeCourse(c.id)} />
              </div>
              <div className="h-1.5 w-full bg-line/60">
                <motion.div
                  className="h-full rounded-l-full"
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                  style={{ backgroundColor: c.color }}
                />
              </div>
            </motion.div>
          )
        })}

        {courses.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line px-4 py-12 text-center">
            <p className="text-ink">עדיין אין קורסים.</p>
            <p className="mt-1 text-sm text-muted">הוסף את הקורס הראשון כדי להתחיל.</p>
          </div>
        )}
      </div>

      <CourseDetail course={open} onClose={() => setOpen(null)} />
      <CourseForm open={adding} onClose={() => setAdding(false)} onSubmit={addCourse} />
      <CourseForm
        open={!!editingCourse}
        editing={editingCourse}
        onClose={() => setEditingCourse(null)}
        onSubmit={(c) => editingCourse && updateCourse(editingCourse.id, c)}
      />
    </div>
  )
}

function Summary({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-1">
      <div className="truncate text-lg font-bold tabular-nums text-ink">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}

function CourseDetail({ course, onClose }: { course: Course | null; onClose: () => void }) {
  const { tasks, exams, toggleTask, removeTask, addTask, updateTask, removeCourse } = useStore()
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState(60)
  const [dueDate, setDueDate] = useState('')
  // Editing reuses the same inline form rather than opening a second sheet on
  // top of this one — nested bottom sheets are awkward to dismiss on mobile.
  const [editingId, setEditingId] = useState<string | null>(null)

  const list = useMemo(
    () => (course ? tasks.filter((t) => t.courseId === course.id) : []),
    [tasks, course],
  )
  const exam = course
    ? exams.filter((e) => e.courseId === course.id).sort((a, b) => (a.date < b.date ? -1 : 1))[0]
    : undefined

  const reset = () => {
    setEditingId(null)
    setTitle('')
    setDueDate('')
    setMinutes(60)
  }

  const startEdit = (id: string) => {
    const t = list.find((x) => x.id === id)
    if (!t) return
    setEditingId(id)
    setTitle(t.title)
    setMinutes(t.minutes)
    setDueDate(t.dueDate ?? '')
  }

  const submit = () => {
    if (!course || !title.trim()) return
    const fields = { title: title.trim(), minutes, dueDate: dueDate || undefined }
    if (editingId) updateTask(editingId, fields)
    else addTask({ courseId: course.id, ...fields })
    reset()
  }

  return (
    <Sheet open={!!course} onClose={onClose} title={course ? `${course.emoji} ${course.name}` : ''}>
      {course && (
        <div className="space-y-4">
          {exam && (
            <div className="rounded-xl bg-accent-soft px-4 py-2.5 text-sm text-ink">
              📌 {examLabel(exam.title, course.name)} · {formatHeShort(exam.date)}
            </div>
          )}

          <div className="space-y-2.5">
            <AnimatePresence mode="popLayout">
              {list.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onToggle={() => toggleTask(t.id)}
                  onEdit={() => startEdit(t.id)}
                  onDelete={() => {
                    if (editingId === t.id) reset()
                    removeTask(t.id)
                  }}
                />
              ))}
            </AnimatePresence>
            {list.length === 0 && <p className="py-4 text-center text-sm text-muted">אין משימות עדיין.</p>}
          </div>

          <div className={`rounded-2xl border p-3 ${editingId ? 'border-primary bg-primary-soft/30' : 'border-line'}`}>
            <Field label={editingId ? 'עריכת משימה' : 'משימה חדשה'}>
              <input
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="למשל: לפתור תרגיל 5"
              />
            </Field>
            <div className="flex gap-3">
              <Field label="כמה זמן?">
                <select
                  className={inputClass}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                >
                  {DURATION_OPTIONS_MIN.map((m) => (
                    <option key={m} value={m}>
                      {formatDuration(m)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="שיוך ליום (רשות)">
                <input
                  type="date"
                  className={inputClass}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </Field>
            </div>
            <p className="mb-3 -mt-1 text-xs text-muted">
              {dueDate
                ? 'המשימה תופיע ביום שבחרת.'
                : 'בלי יום נבחר, המשימה תשובץ אוטומטית לפני המבחן הקרוב.'}
            </p>
            <PrimaryButton onClick={submit}>{editingId ? 'שמור שינויים' : 'הוסף משימה'}</PrimaryButton>
            {editingId && (
              <button onClick={reset} className="mt-2 w-full py-1.5 text-sm text-muted transition-colors hover:text-ink">
                ביטול
              </button>
            )}
          </div>

          <button
            onClick={() => {
              removeCourse(course.id)
              onClose()
            }}
            className="flex w-full items-center justify-center gap-1.5 py-2 text-sm text-muted transition-colors hover:text-accent"
          >
            <Trash size={16} /> מחק קורס
          </button>
        </div>
      )}
    </Sheet>
  )
}

/** One form, two modes. `editing` present ⇒ prefilled and saves changes;
 *  absent ⇒ blank and creates. The Sheet stays mounted so it keeps its exit
 *  animation; only the body remounts (via the key) so every open starts from
 *  fresh initial state instead of whatever was typed last time. */
function CourseForm({
  open,
  onClose,
  onSubmit,
  editing,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (c: Omit<Course, 'id'>) => void
  editing?: Course | null
}) {
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    if (open) setNonce((n) => n + 1)
  }, [open])

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'עריכת קורס' : 'קורס חדש'}>
      <CourseFormBody key={`${editing?.id ?? 'new'}-${nonce}`} onClose={onClose} onSubmit={onSubmit} editing={editing} />
    </Sheet>
  )
}

function CourseFormBody({
  onClose,
  onSubmit,
  editing,
}: {
  onClose: () => void
  onSubmit: (c: Omit<Course, 'id'>) => void
  editing?: Course | null
}) {
  const [name, setName] = useState(editing?.name ?? '')
  const [emoji, setEmoji] = useState(editing?.emoji ?? COURSE_EMOJIS[0])
  const [color, setColor] = useState(editing?.color ?? COURSE_COLORS[0])

  const submit = () => {
    if (!name.trim()) return
    onSubmit({ name: name.trim(), emoji, color })
    onClose()
  }

  return (
    <>
      <Field label="שם הקורס">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: חשבון אינפיניטסימלי" />
      </Field>
      <Field label="אייקון">
        <div className="flex flex-wrap gap-2">
          {COURSE_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`grid h-10 w-10 place-items-center rounded-xl text-lg transition-transform hover:scale-110 ${
                emoji === e ? 'bg-primary-soft ring-2 ring-primary' : 'bg-bg'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </Field>
      <Field label="צבע">
        <div className="flex gap-2">
          {COURSE_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`h-9 w-9 rounded-full transition-transform hover:scale-110 ${
                color === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </Field>
      <div className="mt-2">
        <PrimaryButton onClick={submit}>{editing ? 'שמור שינויים' : 'הוסף קורס'}</PrimaryButton>
      </div>
    </>
  )
}
