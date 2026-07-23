import { useMemo, useState, useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Timer,
  Play,
  Pause,
  ArrowCounterClockwise,
  ArrowDown,
  ArrowUUpLeft,
  CheckCircle,
  Leaf,
  BookOpen,
  CalendarCheck,
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
} from '../utils'
import { TaskRow, LeafBurst, Card } from '../ui'
import { CanopyScene } from '../CanopyScene'
import { auth } from '../firebase'
import { goTo } from '../nav'

export default function Home() {
  const { tasks, exams, courses, toggleTask } = useStore()
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

      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink lg:text-3xl">
          {greetingHe()}
          {firstName ? `, ${firstName}` : ''}
          <Leaf weight="fill" size={22} className="shrink-0 -scale-x-100 text-primary" />
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          {total === 0 ? 'אין משימות מתוכננות להיום.' : allDone ? 'סיימת את הכול להיום.' : 'בוא נשמור על המומנטום.'}
        </p>
      </header>

      {/* Row 1. Today's tasks come first in DOM order, so in RTL they sit on
          the right, where reading starts and attention lands. The scene is the
          reward for doing them, not the thing to look at first. */}
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
            <OverdueList tasks={overdueTasks} courseById={courseById} today={today} />
          ) : (
            <div className="divide-y divide-line/70">
              <AnimatePresence mode="popLayout">
                {pendingToday.map((t) => (
                  <TaskRow key={t.id} flat task={t} course={courseById.get(t.courseId)} onToggle={() => toggleTask(t.id)} />
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
                    <TaskRow key={t.id} flat task={t} course={courseById.get(t.courseId)} onToggle={() => toggleTask(t.id)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* The scene is much shorter than the task list, so the timer sits
            under it and absorbs the leftover height instead of leaving a hole
            beside the tasks. */}
        <div className="space-y-5 lg:flex lg:h-full lg:flex-col lg:space-y-0 lg:gap-5">
          <Card className="overflow-hidden">
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

          <FocusTimer className="lg:min-h-0 lg:flex-1" />
        </div>
      </div>

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
}: {
  tasks: Task[]
  courseById: Map<string, Course>
  today: string
}) {
  const { toggleTask, setTaskDay } = useStore()
  return (
    <div className="divide-y divide-line/70">
      <p className="pb-1 text-xs text-muted">
        משימות שתכננת ולא סימנת. הן לא נספרות בעומס של היום — אתה מחליט מה לעשות איתן.
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
            menu={[
              { label: 'העבר להיום', Icon: ArrowDown, onClick: () => setTaskDay(t.id, today) },
              { label: 'החזר למאגר', Icon: ArrowUUpLeft, onClick: () => setTaskDay(t.id, undefined) },
            ]}
          />
        ))}
      </AnimatePresence>
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
            note: 'הוסף את כל המשימות של הקורס בבת אחת — השיבוץ מגיע אחר כך.',
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
              note: 'הכול משובץ לימים אחרים — יום פנוי הוא תוצאה תקינה.',
              action: 'לתכנון השבוע',
              tab: 'plan' as const,
            }

  return (
    <div className="px-4 py-8 text-center">
      <p className="text-ink">{state.title}</p>
      <p className="mt-1 text-sm text-muted">{state.note}</p>
      <button
        onClick={() => goTo(state.tab)}
        className="mt-3 rounded-xl bg-primary-soft px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
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
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft">
              <Icon size={20} className="text-accent" />
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
                  isToday ? 'bg-primary font-bold text-white' : 'text-ink'
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

const FOCUS_MINUTES = 25

/** A plain countdown for a focus session. Session-scoped on purpose: nothing
 *  is written to the cloud, so a half-finished timer can't pollute the data. */
function FocusTimer({ className = '' }: { className?: string }) {
  const [left, setLeft] = useState(FOCUS_MINUTES * 60)
  const [running, setRunning] = useState(false)
  const [donePings, setDonePings] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          setRunning(false)
          setDonePings((n) => n + 1)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [running])

  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  const pct = 1 - left / (FOCUS_MINUTES * 60)

  const reset = () => {
    setRunning(false)
    setLeft(FOCUS_MINUTES * 60)
  }

  return (
    <Card className={`flex flex-col p-4 ${className}`}>
      <h2 className="mb-3 flex items-center gap-1.5 font-bold text-ink">
        <Timer size={18} className="text-primary" /> זמן מיקוד
      </h2>

      <div className="flex flex-1 items-center justify-center gap-5">
        <div className="relative grid h-20 w-20 shrink-0 place-items-center">
          <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
            <circle cx="20" cy="20" r="17" fill="none" stroke="var(--line)" strokeWidth="4" />
            <circle
              cx="20"
              cy="20"
              r="17"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 17}
              strokeDashoffset={2 * Math.PI * 17 * (1 - pct)}
            />
          </svg>
          <span className="text-lg font-bold tabular-nums text-ink">
            {mm}:{ss}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => setRunning((r) => !r)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            {running ? <Pause weight="fill" size={16} /> : <Play weight="fill" size={16} />}
            {running ? 'עצור' : left === FOCUS_MINUTES * 60 ? 'התחל' : 'המשך'}
          </motion.button>
          <button
            onClick={reset}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm text-muted transition-colors hover:text-ink"
          >
            <ArrowCounterClockwise size={15} /> אפס
          </button>
        </div>
      </div>

      {donePings > 0 && (
        <p className="mt-3 text-xs text-muted">
          {donePings === 1 ? 'סשן מיקוד אחד הושלם היום.' : `${donePings} סשני מיקוד הושלמו היום.`}
        </p>
      )}
    </Card>
  )
}
