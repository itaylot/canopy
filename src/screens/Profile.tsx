import { useMemo } from 'react'
import { motion } from 'motion/react'
import { SignOut, CloudCheck } from '@phosphor-icons/react'
import { useStore } from '../store'
import { auth, logOut } from '../firebase'
import { formatDuration, DURATION_OPTIONS_MIN } from '../utils'
import { Card, Field, inputClass } from '../ui'

export default function Profile() {
  const { tasks, courses, exams, dailyCap, setDailyCap } = useStore()
  const user = auth.currentUser

  const totals = useMemo(
    () => ({
      done: tasks.filter((t) => t.done).length,
      remaining: tasks.filter((t) => !t.done).length,
    }),
    [tasks],
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-ink">הפרופיל שלי</h1>

      <Card className="flex items-center gap-3 p-4">
        {user?.photoURL ? (
          <img src={user.photoURL} alt="" className="h-14 w-14 rounded-full" />
        ) : (
          <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-xl font-bold text-primary">
            {(user?.displayName ?? user?.email ?? '?').slice(0, 1)}
          </span>
        )}
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{user?.displayName ?? 'משתמש'}</div>
          <div className="truncate text-sm text-muted">{user?.email}</div>
        </div>
      </Card>

      <Card className="grid grid-cols-4 divide-x divide-x-reverse divide-line p-4 text-center">
        <Stat value={courses.length} label="קורסים" />
        <Stat value={exams.length} label="מבחנים" />
        <Stat value={totals.done} label="הושלמו" />
        <Stat value={totals.remaining} label="נשארו" />
      </Card>

      <Card className="p-4">
        <Field label="כמה זמן ללמוד ביום (משמש לשיבוץ האוטומטי)">
          <select
            className={inputClass}
            value={dailyCap}
            onChange={(e) => setDailyCap(Number(e.target.value))}
          >
            {DURATION_OPTIONS_MIN.filter((m) => m >= 60).map((m) => (
              <option key={m} value={m}>
                {formatDuration(m)}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-muted">
          משימות בלי יום מוגדר יתפרסו על הימים שלפני המבחן, עד למכסה הזו בכל יום.
        </p>
      </Card>

      <Card className="flex items-center gap-2.5 p-4 text-sm text-ink">
        <CloudCheck weight="fill" size={20} className="shrink-0 text-primary" />
        הנתונים נשמרים בענן ומסתנכרנים בין כל המכשירים.
      </Card>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={logOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line py-3.5 font-semibold text-muted transition-colors hover:text-ink"
      >
        <SignOut size={18} /> התנתקות
      </motion.button>
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="text-lg font-bold tabular-nums text-ink">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}
