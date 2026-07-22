import { useMemo, useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Timer,
  Play,
  Pause,
  ArrowCounterClockwise,
  CheckCircle,
  Leaf,
  BookOpen,
  CalendarCheck,
} from '@phosphor-icons/react'
import { useStore } from '../store'
import { buildSchedule } from '../schedule'
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
} from '../utils'
import { TaskRow, LeafBurst, Card } from '../ui'
import { CanopyScene } from '../CanopyScene'
import { auth } from '../firebase'

export default function Home() {
  const { tasks, exams, courses, toggleTask } = useStore()
  const today = todayIso()
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])

  const schedule = useMemo(
    () => buildSchedule(tasks, today),
    [tasks, today],
  )
  const pendingToday = schedule[today] ?? []
  const doneToday = tasks.filter((t) => t.done && t.completedAt === today)
  const total = pendingToday.length + doneToday.length

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
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="font-bold text-ink">המשימות להיום</h2>
            {total > 0 && (
              <span className="text-sm text-muted">
                {doneToday.length} מתוך {total}
              </span>
            )}
          </div>

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

            {total === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-ink">אין משימות מתוכננות להיום.</p>
                <p className="mt-1 text-sm text-muted">הוסף משימות בטאב הקורסים והן ישובצו לכאן.</p>
              </div>
            )}

            {doneToday.length > 0 && pendingToday.length > 0 && (
              <div className="pt-2">
                <p className="pt-2 text-xs font-medium text-muted">הושלמו היום</p>
                {doneToday.map((t) => (
                  <TaskRow key={t.id} flat task={t} course={courseById.get(t.courseId)} onToggle={() => toggleTask(t.id)} />
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* The scene is much shorter than the task list, so the timer sits
            under it and absorbs the leftover height instead of leaving a hole
            beside the tasks. */}
        <div className="space-y-5 lg:flex lg:h-full lg:flex-col lg:space-y-0 lg:gap-5">
          <Card className="overflow-hidden">
            {/* the illustration's own cream sky is the card surface */}
            <CanopyScene done={tasks.filter((t) => t.done).length} remaining={tasks.filter((t) => !t.done).length} />
            <p className="px-4 py-3 text-center text-sm text-muted">
              {tasks.length === 0
                ? 'הוסף משימות כדי למתוח את המסלול.'
                : 'השלם משימות כדי להאריך את המסלול.'}
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
    { Icon: BookOpen, value: minutes > 0 ? formatDuration(minutes) : '0', label: 'זמן למידה השבוע' },
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
  const cells = useMemo(() => {
    const first = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const out: (string | null)[] = []
    for (let i = 0; i < first.getDay(); i++) out.push(null)
    for (let d = 1; d <= daysInMonth; d++) out.push(toIso(new Date(year, month, d)))
    return out
  }, [year, month])

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
