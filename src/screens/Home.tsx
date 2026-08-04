import { useMemo, useState, useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Play,
  ArrowDown,
  ArrowUUpLeft,
  CheckCircle,
  Leaf,
  BookOpen,
  CalendarCheck,
  Plus,
  PencilSimple,
  X,
} from '@phosphor-icons/react'
import { useStore, type Course, type Task } from '../store'
import { buildSchedule, unscheduled, overdue } from '../schedule'
import {
  todayIso,
  toIso,
  relativeDaysHe,
  monthShortHe,
  dayOfMonth,
  startOfWeekIso,
  formatDuration,
  monthLabel,
  examLabel,
  monthCells,
  formatHeShort,
  DURATION_OPTIONS_MIN,
} from '../utils'
import { TaskRow, TaskDetailSheet, EditTaskSheet, LeafBurst, Card, Checkbox, inputClass, Sheet, PrimaryButton } from '../ui'
import { useFocus, FOCUS_MINUTES, DEFAULT_FOCUS_MINUTES } from '../focus'
import { CanopyScene } from '../CanopyScene'
import { FocusDial } from '../FocusDial'
import { InstallHint } from '../InstallHint'
import { onboardingStepsDone } from '../onboarding'
import { useCourseColor } from '../theme'
import { toast } from '../toast'
import { auth } from '../firebase'
import { goTo } from '../nav'

export default function Home() {
  const { tasks, exams, courses, toggleTask, updateTask } = useStore()
  const [viewing, setViewing] = useState<Task | null>(null)
  const [editing, setEditing] = useState<Task | null>(null)
  const today = todayIso()
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])

  const schedule = useMemo(() => buildSchedule(tasks), [tasks])
  const pendingToday = schedule[today] ?? []
  const doneToday = tasks.filter((t) => t.done && t.completedAt === today)
  const total = pendingToday.length + doneToday.length

  // Tasks whose day has passed without being ticked off. They are deliberately
  // not mixed into today's list: nothing lands on today's plate unless the user
  // put it there.
  const overdueTasks = useMemo(() => overdue(tasks, today), [tasks, today])
  const [taskTab, setTaskTab] = useState<'today' | 'overdue'>('today')
  // Derived, not stored: finishing the last overdue task must not leave the
  // card sitting on an empty tab.
  const activeTab = overdueTasks.length === 0 ? 'today' : taskTab

  const upcomingExams = useMemo(
    () => [...exams].filter((e) => e.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 2),
    [exams, today],
  )

  const allDone = total > 0 && pendingToday.length === 0
  const [burst, setBurst] = useState(false)
  useEffect(() => {
    if (!allDone) return
    setBurst(true)
    const t = setTimeout(() => setBurst(false), 1300)
    return () => clearTimeout(t)
  }, [allDone])

  const firstName = (auth.currentUser?.displayName ?? '').split(' ')[0]

  return (
    <div className="space-y-5">
      <LeafBurst show={burst} />

      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-ink lg:text-3xl">
            {greetingHe()}
            {firstName ? `, ${firstName}` : ''}
            <Leaf weight="fill" size={22} className="shrink-0 -scale-x-100 text-primary" />
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {total === 0 ? 'אין משימות מתוכננות להיום.' : allDone ? 'סיימת את הכול להיום.' : 'בוא נשמור על המומנטום.'}
          </p>
        </div>
        {/* Focus launch and "add task" anchored together as one matched-shape
            cluster in the header's empty corner — not two unrelated controls
            that happen to be nearby. Focus used to be its own card taking a
            full slot in Row 1; it's reachable from here on Home specifically
            (this is where "add a task" already lives too), always visible
            without scrolling past today's list first. */}
        <div className="flex shrink-0 items-stretch gap-2.5">
          <FocusHeaderBar />
          <QuickAddTask />
        </div>
      </header>

      <InstallHint />
      <OnboardingChecklist />

      {/* Row 1. Today's tasks come first in DOM order, so in RTL they sit on
          the right, where reading starts and attention lands. The scene is the
          reward for doing them, not the thing to look at first. Just the two
          of them now — focus mode moved up into the header (see
          FocusHeaderBar), so this row went back to its original 2-column
          shape on its own, no layout customization feature needed for that. */}
      <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:items-stretch lg:gap-5 lg:space-y-0">
        <Card className="p-4 lg:h-full">
          {/* Two lists, one card. The overdue tab only appears when something
              is actually overdue, so an ordinary day stays a single list. */}
          <div className="mb-1 flex items-baseline justify-between gap-2">
            {overdueTasks.length === 0 ? (
              <h2 className="font-bold text-ink">המשימות להיום</h2>
            ) : (
              <div className="flex items-center gap-1">
                <TabButton on={activeTab === 'today'} onClick={() => setTaskTab('today')}>
                  היום
                </TabButton>
                <TabButton on={activeTab === 'overdue'} onClick={() => setTaskTab('overdue')}>
                  לא הושלמו
                  <span className="mr-1.5 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white tabular-nums">
                    {overdueTasks.length}
                  </span>
                </TabButton>
              </div>
            )}
            {activeTab === 'today' && total > 0 && (
              <span className="shrink-0 text-sm text-muted">
                {doneToday.length} מתוך {total}
              </span>
            )}
          </div>

          {activeTab === 'overdue' ? (
            <OverdueList
              tasks={overdueTasks}
              courseById={courseById}
              today={today}
              onView={setViewing}
              onEdit={setEditing}
            />
          ) : (
            <div className="divide-y divide-line/70">
              <AnimatePresence mode="popLayout">
                {pendingToday.map((t) => (
                  <TaskRow
                    key={t.id}
                    flat
                    task={t}
                    course={courseById.get(t.courseId)}
                    onToggle={() => toggleTask(t.id)}
                    onView={() => setViewing(t)}
                    onEdit={() => setEditing(t)}
                  />
                ))}
              </AnimatePresence>

              {allDone && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl bg-primary-soft px-4 py-6 text-center"
                >
                  <CheckCircle weight="fill" size={32} className="mx-auto text-primary" />
                  <p className="mt-2 font-semibold text-ink">סיימת את כל המשימות של היום.</p>
                  <p className="text-sm text-muted">המסלול שלך התקדם ב-{doneToday.length}.</p>
                </motion.div>
              )}

              {/* An empty day means different things depending on how far along
                  the setup is, so it points at the step that is actually next. */}
              {total === 0 && <EmptyToday />}

              {/* Shown whenever anything was completed today, including after
                  the last one — otherwise a mistaken tick could only be undone
                  from the courses screen. */}
              {doneToday.length > 0 && (
                <div className="pt-2">
                  <p className="pt-2 text-xs font-medium text-muted">הושלמו היום</p>
                  {doneToday.map((t) => (
                    <TaskRow
                      key={t.id}
                      flat
                      task={t}
                      course={courseById.get(t.courseId)}
                      onToggle={() => toggleTask(t.id)}
                      onView={() => setViewing(t)}
                      onEdit={() => setEditing(t)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden lg:flex lg:h-full lg:flex-col lg:justify-center">
          {/* One checkpoint per task planned for today — the route is the
              day, not the whole semester. Both counts come from the same
              state the list above renders, so it tracks every tick live. */}
          <CanopyScene done={doneToday.length} remaining={pendingToday.length} />
          <p className="px-4 py-3 text-center text-sm text-muted">
            {total === 0
              ? 'שבץ משימות ליום כדי למתוח את המסלול.'
              : allDone
                ? 'הגעת לקצה המסלול של היום.'
                : `${doneToday.length} מתוך ${total} תחנות היום.`}
          </p>
        </Card>
      </div>

      <QuickTasks />

      {/* Row 2: supporting cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-4">
          <h2 className="mb-3 font-bold text-ink">מבחנים קרובים</h2>
          {upcomingExams.length === 0 ? (
            <p className="text-sm text-muted">לא הוזנו מבחנים.</p>
          ) : (
            <ul className="space-y-3">
              {upcomingExams.map((e) => (
                <li key={e.id} className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-soft leading-none">
                    <span className="text-[10px] font-medium text-primary">{monthShortHe(e.date)}</span>
                    <span className="text-lg font-bold text-ink">{dayOfMonth(e.date)}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">
                      {examLabel(e.title, courseById.get(e.courseId)?.name)}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {courseById.get(e.courseId)?.name} · {relativeDaysHe(today, e.date)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <WeeklySummary />

        <MiniMonth schedule={schedule} today={today} />
      </div>

      <TaskDetailSheet task={viewing} course={viewing ? courseById.get(viewing.courseId) : undefined} onClose={() => setViewing(null)} />
      <EditTaskSheet
        task={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) updateTask(editing.id, patch)
          setEditing(null)
        }}
      />
    </div>
  )
}

function TabButton({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center rounded-lg px-2.5 py-1 text-sm font-bold transition-colors ${
        on ? 'bg-primary-soft text-primary' : 'text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Tasks whose day passed without being ticked off.
 *
 * Every row can be completed here, and its menu offers the two ways out that
 * don't need the planner: pull it onto today, or send it back to the pool.
 * Moving it to some other specific day is a drag away in the week planner.
 */
function OverdueList({
  tasks,
  courseById,
  today,
  onView,
  onEdit,
}: {
  tasks: Task[]
  courseById: Map<string, Course>
  today: string
  onView: (t: Task) => void
  onEdit: (t: Task) => void
}) {
  const { toggleTask, setTaskDay } = useStore()
  return (
    <div className="divide-y divide-line/70">
      <p className="pb-1 text-xs text-muted">
        משימות שתכננת ולא סימנת. הן לא נספרות בעומס של היום. אתה מחליט מה לעשות איתן.
      </p>
      <AnimatePresence mode="popLayout">
        {tasks.map((t) => (
          <TaskRow
            key={t.id}
            flat
            task={t}
            course={courseById.get(t.courseId)}
            note={`תוכננה ל${formatHeShort(t.dueDate!)}`}
            onToggle={() => toggleTask(t.id)}
            onView={() => onView(t)}
            menu={[
              { label: 'העבר להיום', Icon: ArrowDown, onClick: () => setTaskDay(t.id, today) },
              { label: 'החזר למאגר', Icon: ArrowUUpLeft, onClick: () => setTaskDay(t.id, undefined) },
              { label: 'עריכה', Icon: PencilSimple, onClick: () => onEdit(t) },
            ]}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

/**
 * First-run checklist: the four steps between a fresh account and a working
 * plan (see onboardingStepsDone for what "done" means for each). Nothing here
 * is stored state or a dismiss flag — it hides once all four are true, and
 * reappears if one later stops being true (e.g. deleting your only course),
 * since it's a live reflection of setup, not a one-time "seen it" checklist.
 */
function OnboardingChecklist() {
  const { courses, exams, tasks } = useStore()
  const [courseDone, examDone, taskDone, scheduledDone] = onboardingStepsDone(courses, exams, tasks)
  const steps = [
    { done: courseDone, label: 'צור קורס ראשון', tab: 'courses' as const },
    { done: examDone, label: 'הוסף מבחן או יעד לימודי', tab: 'plan' as const },
    { done: taskDone, label: 'הוסף משימות לקורס', tab: 'courses' as const },
    { done: scheduledDone, label: 'שבץ משימה ליום בתכנון השבוע', tab: 'plan' as const },
  ]
  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null
  const next = steps.find((s) => !s.done)!

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-bold text-ink">בואו נתחיל</h2>
        <span className="text-sm text-muted">
          {doneCount} מתוך {steps.length} הושלמו
        </span>
      </div>
      <ul className="mb-3 space-y-2">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5 text-sm">
            <CheckCircle
              weight={s.done ? 'fill' : 'regular'}
              size={18}
              className={`shrink-0 ${s.done ? 'text-primary' : 'text-muted/50'}`}
            />
            <span className={s.done ? 'text-muted line-through' : 'text-ink'}>{s.label}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={() => goTo(next.tab)}
        className="w-full rounded-xl bg-primary-soft px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-on-primary"
      >
        {next.label}
      </button>
    </Card>
  )
}

/**
 * Adding a task used to mean leaving Home for the courses tab. This puts the
 * same action a tap away from the list it's going to land in — the new task
 * goes straight to the unscheduled pool, exactly like one added from Courses.
 */
function QuickAddTask() {
  const { courses, addTask } = useStore()
  const courseColor = useCourseColor()
  const [open, setOpen] = useState(false)

  if (courses.length === 0) return null // nothing yet to attach a task to

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen(true)}
        className="flex h-[50px] shrink-0 items-center gap-1 rounded-2xl bg-primary px-4 text-sm font-semibold text-on-primary shadow-card"
      >
        <Plus weight="bold" size={16} /> משימה
      </motion.button>
      <Sheet open={open} onClose={() => setOpen(false)} title="משימה חדשה">
        {open && (
          <QuickAddTaskForm
            courses={courses}
            courseColor={courseColor}
            onSubmit={(fields) => {
              addTask(fields)
              toast(`"${fields.title}" נוספה למאגר.`)
              setOpen(false)
            }}
          />
        )}
      </Sheet>
    </>
  )
}

function QuickAddTaskForm({
  courses,
  courseColor,
  onSubmit,
}: {
  courses: Course[]
  courseColor: (stored?: string) => string
  onSubmit: (fields: { courseId: string; title: string; minutes: number }) => void
}) {
  const [courseId, setCourseId] = useState(courses[0].id)
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState(60)

  const submit = () => {
    if (!title.trim()) return
    onSubmit({ courseId, title: title.trim(), minutes })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-sm font-medium text-muted">קורס</p>
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {courses.map((c) => {
            const on = c.id === courseId
            return (
              <button
                key={c.id}
                onClick={() => setCourseId(c.id)}
                aria-pressed={on}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-line transition-colors"
                style={{ backgroundColor: on ? courseColor(c.color) + '1f' : 'transparent' }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: courseColor(c.color) }} />
                {c.emoji} {c.name}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-muted">שם המשימה</p>
        <input
          autoFocus
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="למשל: לפתור תרגיל 5"
        />
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-muted">כמה זמן?</p>
        <div className="flex flex-wrap gap-1.5">
          {DURATION_OPTIONS_MIN.map((m) => {
            const on = m === minutes
            return (
              <button
                key={m}
                onClick={() => setMinutes(m)}
                aria-pressed={on}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums transition-colors ${
                  on ? 'bg-primary text-on-primary' : 'bg-primary-soft text-primary'
                }`}
              >
                {formatDuration(m)}
              </button>
            )
          })}
        </div>
      </div>

      <PrimaryButton onClick={submit}>הוסף משימה</PrimaryButton>
      <p className="-mt-2 text-center text-xs text-muted">המשימה תיכנס למאגר בטאב &quot;תכנון&quot;, שם תוכל לגרור אותה ליום.</p>
    </div>
  )
}

/**
 * The empty day, phrased for wherever the user actually is.
 *
 * "No tasks planned for today" is true in four very different situations, and
 * the useful thing to say — and to offer a way to — differs in each.
 */
function EmptyToday() {
  const { courses, tasks } = useStore()
  const waiting = unscheduled(tasks).length

  const state =
    courses.length === 0
      ? {
          title: 'נתחיל מקורס אחד.',
          note: 'כל משימה שייכת לקורס, אז זה הצעד הראשון.',
          action: 'צור קורס' as const,
          tab: 'courses' as const,
        }
      : tasks.length === 0
        ? {
            title: 'יש קורסים, אין עדיין משימות.',
            note: 'הוסף את כל המשימות של הקורס בבת אחת. השיבוץ מגיע אחר כך.',
            action: 'הוסף משימות',
            tab: 'courses' as const,
          }
        : waiting > 0
          ? {
              title: `${waiting === 1 ? 'משימה אחת ממתינה' : `${waiting} משימות ממתינות`} לשיבוץ.`,
              note: 'מה שתשבץ להיום יופיע כאן.',
              action: 'תכנן את השבוע',
              tab: 'plan' as const,
            }
          : {
              title: 'אין משימות להיום.',
              note: 'הכול משובץ לימים אחרים. יום פנוי הוא תוצאה תקינה.',
              action: 'לתכנון השבוע',
              tab: 'plan' as const,
            }

  return (
    <div className="px-4 py-8 text-center">
      <p className="text-ink">{state.title}</p>
      <p className="mt-1 text-sm text-muted">{state.note}</p>
      <button
        onClick={() => goTo(state.tab)}
        className="mt-3 rounded-xl bg-primary-soft px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-on-primary"
      >
        {state.action}
      </button>
    </div>
  )
}

function greetingHe() {
  const h = new Date().getHours()
  if (h < 5) return 'לילה טוב'
  if (h < 12) return 'בוקר טוב'
  if (h < 17) return 'צהריים טובים'
  if (h < 21) return 'ערב טוב'
  return 'לילה טוב'
}

/**
 * Loose reminders that don't belong to any course or day — "לשלוח הודעה
 * ליובל", "לקבוע תור לרופא עור." A plain running checklist, not a scheduled
 * task: nothing here ever competes with today's plan or the week planner.
 */
function QuickTasks() {
  const { quickTasks, addQuickTask, toggleQuickTask, removeQuickTask } = useStore()
  const [title, setTitle] = useState('')

  const submit = () => {
    const t = title.trim()
    if (!t) return
    addQuickTask(t)
    setTitle('')
  }

  return (
    <Card className="p-4">
      <h2 className="mb-3 font-bold text-ink">משימות שוטפות</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="mb-3 flex gap-2"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="לשלוח הודעה, לקבוע תור..."
          className={`${inputClass} py-1.5 text-sm`}
        />
        <button
          type="submit"
          aria-label="הוסף משימה"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary transition-colors hover:bg-primary/15"
        >
          <Plus weight="bold" size={18} />
        </button>
      </form>

      {quickTasks.length === 0 ? (
        <p className="text-sm text-muted">אין משימות שוטפות כרגע.</p>
      ) : (
        <ul className="divide-y divide-line/70">
          <AnimatePresence mode="popLayout">
            {quickTasks.map((t) => (
              <motion.li
                key={t.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="flex items-center gap-3 py-2.5"
              >
                <button onClick={() => toggleQuickTask(t.id)} aria-label={t.done ? 'בטל סימון' : 'סמן כהושלם'}>
                  <Checkbox done={t.done} />
                </button>
                <button onClick={() => toggleQuickTask(t.id)} className="min-w-0 flex-1 text-right">
                  <span className={`truncate text-sm ${t.done ? 'text-muted line-through' : 'text-ink'}`}>
                    {t.title}
                  </span>
                </button>
                <button
                  onClick={() => removeQuickTask(t.id)}
                  aria-label="מחק משימה"
                  className="relative shrink-0 rounded-full p-1 text-muted transition-colors hover:text-accent-text"
                >
                  <span className="absolute -inset-2" />
                  <X size={15} />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  )
}

/** Honest weekly numbers only: hours studied, tasks finished, active days.
 *  Deliberately no streaks and no invented goal percentages. */
function WeeklySummary() {
  const { tasks } = useStore()
  const today = todayIso()
  const weekStart = startOfWeekIso(today)

  const doneThisWeek = tasks.filter((t) => t.done && t.completedAt && t.completedAt >= weekStart)
  const minutes = doneThisWeek.reduce((s, t) => s + t.minutes, 0)
  const activeDays = new Set(doneThisWeek.map((t) => t.completedAt)).size

  const rows = [
    // Not measured time: this is the planned length of the tasks that were
    // ticked off. Calling it "study time" overstated what the number knows.
    { Icon: BookOpen, value: minutes > 0 ? formatDuration(minutes) : '0', label: 'זמן מתוכנן שהושלם' },
    { Icon: CheckCircle, value: String(doneThisWeek.length), label: 'משימות הושלמו' },
    { Icon: CalendarCheck, value: String(activeDays), label: 'ימים פעילים' },
  ]

  return (
    <Card className="p-4">
      <h2 className="mb-3 font-bold text-ink">סיכום שבועי</h2>
      <ul className="space-y-3">
        {rows.map(({ Icon, value, label }) => (
          <li key={label} className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft">
              <Icon size={20} className="text-accent-text" />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-bold tabular-nums leading-tight text-ink">{value}</span>
              <span className="block truncate text-xs text-muted">{label}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

const WEEKDAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

/** Read-only mini month: today highlighted, dots for days that carry exams or
 *  scheduled tasks. The full calendar lives in its own tab. Desktop-only. */
function MiniMonth({ schedule, today }: { schedule: Record<string, unknown[]>; today: string }) {
  const { exams } = useStore()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const examDays = useMemo(() => new Set(exams.map((e) => e.date)), [exams])
  const cells = useMemo(() => monthCells(year, month), [year, month])

  return (
    <Card className="hidden p-4 lg:block">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-bold text-ink">לוח זמנים</h2>
        <span className="text-xs text-muted">{monthLabel(year, month)}</span>
      </div>

      <div className="grid grid-cols-7 text-center text-[10px] text-muted">
        {WEEKDAY_LETTERS.map((w) => (
          <div key={w} className="py-0.5">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center text-xs">
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} />
          const isToday = iso === today
          const hasExam = examDays.has(iso)
          const hasTasks = (schedule[iso]?.length ?? 0) > 0
          return (
            <div key={iso} className="relative py-1">
              <span
                className={`mx-auto grid h-6 w-6 place-items-center rounded-full tabular-nums ${
                  isToday ? 'bg-primary font-bold text-on-primary' : 'text-ink'
                }`}
              >
                {dayOfMonth(iso)}
              </span>
              <span className="absolute inset-x-0 -bottom-0.5 flex justify-center gap-0.5">
                {hasExam && <span className="h-1 w-1 rounded-full bg-accent" />}
                {hasTasks && !isToday && <span className="h-1 w-1 rounded-full bg-primary" />}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/**
 * Focus launch, anchored in the header next to "add task" instead of taking
 * a full card in Row 1 — the running session still lives in the focus store
 * (timestamp-based), so this holds no timer state of its own beyond the
 * chosen length. The watchface thumbnail is the same per-theme illustration
 * FocusDial uses, just cropped to a wide strip (zoomed background-image, not
 * a redrawn asset) so it stays recognizable at this size. Tapping it opens
 * the full dial for precise selection; the ± steps through the same presets
 * for a quick adjustment without leaving the header.
 */
const QUICK_STEP_MIN = 15
const QUICK_STEP_MAX_MIN = 180

/** formatDuration is built around the app's existing 30-minute-multiple
 *  presets (half hour, hour and a half, ...) — quarter-hour values like 45 or
 *  75 fall through its fallback to a raw decimal ("0.8 שעות"), which nobody
 *  reads as a duration. This covers any whole number of minutes in plain
 *  Hebrew instead, for this one quarter-hour-granularity control. */
function formatFocusMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} דקות`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const hoursWord = hours === 1 ? 'שעה' : hours === 2 ? 'שעתיים' : `${hours} שעות`
  if (rest === 0) return hoursWord
  if (rest === 30) return `${hoursWord} וחצי`
  return `${hoursWord} ו-${rest} דקות`
}

function FocusHeaderBar() {
  const start = useFocus((s) => s.start)
  const theme = useStore((s) => s.theme)
  const [minutes, setMinutes] = useState(DEFAULT_FOCUS_MINUTES)
  const [pickerOpen, setPickerOpen] = useState(false)
  // Quarter-hour jumps, snapped to the nearest quarter-hour mark in the
  // pressed direction — not a step through FOCUS_MINUTES's dial presets,
  // which are deliberately uneven (15/25/40/50/60/90) for that component and
  // would make this quick stepper jump by irregular amounts.
  const step = (dir: number) =>
    setMinutes((m) => {
      const next = dir > 0 ? Math.floor(m / QUICK_STEP_MIN) * QUICK_STEP_MIN + QUICK_STEP_MIN : Math.ceil(m / QUICK_STEP_MIN) * QUICK_STEP_MIN - QUICK_STEP_MIN
      return Math.max(QUICK_STEP_MIN, Math.min(QUICK_STEP_MAX_MIN, next))
    })

  return (
    <>
      {/* items-stretch (not items-center) + overflow-hidden on the rounded
          container itself is what makes the watchface a real full-bleed
          edge, clipped by the container's own corner radius — no separate
          rounding or fixed height math on the image needed. */}
      <div className="flex h-[50px] shrink-0 items-stretch overflow-hidden rounded-2xl bg-surface shadow-card">
        <button
          onClick={() => setPickerOpen(true)}
          aria-label="פתיחת בורר זמן המיקוד המלא"
          className="relative w-24 shrink-0 bg-primary-soft"
        >
          {/* A real <img> cropped with object-fit, not a CSS background-image
              guess at size/position — that silently rendered blank in
              production. */}
          <img
            src={`/dial-${theme}.png`}
            alt=""
            className="absolute left-1/2 top-1/2 h-[145px] w-[145px] -translate-x-1/2 -translate-y-1/2 object-cover"
          />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
          <div className="min-w-0">
            <div className="text-[10px] text-muted">זמן מיקוד</div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-ink">{formatFocusMinutes(minutes)}</span>
              <div className="flex gap-0.5">
                <button
                  onClick={() => step(-1)}
                  disabled={minutes <= QUICK_STEP_MIN}
                  aria-label="פחות זמן"
                  className="grid h-[18px] w-[18px] place-items-center rounded-full bg-primary-soft text-xs font-bold leading-none text-primary disabled:opacity-30"
                >
                  −
                </button>
                <button
                  onClick={() => step(1)}
                  disabled={minutes >= QUICK_STEP_MAX_MIN}
                  aria-label="יותר זמן"
                  className="grid h-[18px] w-[18px] place-items-center rounded-full bg-primary-soft text-xs font-bold leading-none text-primary disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => start({ minutes }, Date.now())}
            aria-label="כניסה למצב מיקוד"
            className="mr-auto grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-on-primary"
          >
            <Play weight="fill" size={14} />
          </motion.button>
        </div>
      </div>

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="זמן מיקוד">
        <div className="flex justify-center pb-2">
          <FocusDial theme={theme} presets={FOCUS_MINUTES} value={minutes} onChange={setMinutes} />
        </div>
      </Sheet>
    </>
  )
}
