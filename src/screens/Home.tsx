import { useMemo, useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Timer, Play, Pause, ArrowCounterClockwise, CheckCircle } from '@phosphor-icons/react'
import { useStore } from '../store'
import { buildSchedule } from '../schedule'
import { todayIso, relativeDaysHe, monthShortHe, dayOfMonth } from '../utils'
import { TaskRow, LeafBurst, Card } from '../ui'
import { CanopyScene } from '../CanopyScene'
import { auth } from '../firebase'

export default function Home() {
  const { tasks, exams, courses, dailyCap, toggleTask } = useStore()
  const today = todayIso()
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])

  const schedule = useMemo(
    () => buildSchedule(tasks, exams, today, dailyCap),
    [tasks, exams, today, dailyCap],
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
        <h1 className="text-2xl font-bold text-ink">
          {greetingHe()}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          {total === 0 ? 'אין משימות מתוכננות להיום.' : allDone ? 'סיימת את הכול להיום.' : 'בוא נשמור על המומנטום.'}
        </p>
      </header>

      <Card className="overflow-hidden">
        {/* the illustration's own cream sky is the card surface, like the mockup */}
        <CanopyScene done={tasks.filter((t) => t.done).length} remaining={tasks.filter((t) => !t.done).length} />
        <p className="px-4 py-3 text-center text-sm text-muted">
          {tasks.length === 0
            ? 'הוסף משימות כדי למתוח את המסלול.'
            : 'השלם משימות כדי להאריך את המסלול.'}
        </p>
      </Card>

      <section>
        <div className="mb-2.5 flex items-baseline justify-between">
          <h2 className="font-bold text-ink">משימות היום</h2>
          {total > 0 && (
            <span className="text-sm text-muted">
              {doneToday.length} מתוך {total}
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          <AnimatePresence mode="popLayout">
            {pendingToday.map((t) => (
              <TaskRow key={t.id} task={t} course={courseById.get(t.courseId)} onToggle={() => toggleTask(t.id)} />
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
            <div className="rounded-2xl border border-dashed border-line px-4 py-10 text-center">
              <p className="text-ink">אין משימות מתוכננות להיום.</p>
              <p className="mt-1 text-sm text-muted">הוסף משימות בטאב הקורסים והן ישובצו לכאן.</p>
            </div>
          )}

          {doneToday.length > 0 && pendingToday.length > 0 && (
            <div className="pt-2">
              <p className="mb-2 text-xs font-medium text-muted">הושלמו היום</p>
              <div className="space-y-2.5">
                {doneToday.map((t) => (
                  <TaskRow key={t.id} task={t} course={courseById.get(t.courseId)} onToggle={() => toggleTask(t.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
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
                    <span className="block truncate font-semibold text-ink">{e.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {courseById.get(e.courseId)?.name} · {relativeDaysHe(today, e.date)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <FocusTimer />
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

const FOCUS_MINUTES = 25

/** A plain countdown for a focus session. Session-scoped on purpose: nothing
 *  is written to the cloud, so a half-finished timer can't pollute the data. */
function FocusTimer() {
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
    <Card className="flex flex-col p-4">
      <h2 className="mb-3 flex items-center gap-1.5 font-bold text-ink">
        <Timer size={18} className="text-primary" /> זמן מיקוד
      </h2>

      <div className="flex flex-1 items-center gap-4">
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
