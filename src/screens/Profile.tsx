import { useMemo } from 'react'
import { motion } from 'motion/react'
import { SignOut, CloudCheck, Sun, Moon, Sparkle, DownloadSimple } from '@phosphor-icons/react'
import { useStore, type SceneKey } from '../store'
import { auth, logOut } from '../firebase'
import { formatDuration, todayIso, DURATION_OPTIONS_MIN } from '../utils'
import { buildSchedule } from '../schedule'
import { buildIcs, downloadIcs } from '../ics'
import { Card, Field, inputClass } from '../ui'

const SCENE_CHOICES: { key: SceneKey; label: string; Icon: typeof Sun }[] = [
  { key: 'auto', label: 'אוטומטי', Icon: Sparkle },
  { key: 'forest', label: 'יום', Icon: Sun },
  { key: 'night', label: 'לילה', Icon: Moon },
]

export default function Profile() {
  const { tasks, courses, exams, dailyCap, setDailyCap, scene, setScene } = useStore()
  const user = auth.currentUser

  const exportCalendar = () => {
    const today = todayIso()
    const schedule = buildSchedule(tasks, exams, today, dailyCap)
    // DTSTAMP must be a UTC timestamp, unlike the all-day dates in the events.
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    downloadIcs(buildIcs(exams, schedule, courses, now))
  }

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

      <Card className="p-4">
        <h2 className="mb-3 font-bold text-ink">הנוף במסך הבית</h2>
        <div className="grid grid-cols-3 gap-2">
          {SCENE_CHOICES.map(({ key, label, Icon }) => {
            const on = scene === key
            return (
              <button
                key={key}
                onClick={() => setScene(key)}
                aria-pressed={on}
                className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition-colors ${
                  on ? 'bg-primary-soft text-primary ring-1 ring-primary/40' : 'text-muted hover:bg-primary-soft/50'
                }`}
              >
                <Icon size={20} weight={on ? 'fill' : 'regular'} />
                {label}
              </button>
            )
          })}
        </div>
        <p className="mt-2.5 text-xs text-muted">
          במצב אוטומטי הנוף עובר ללילה בין 20:00 ל-06:00.
        </p>
      </Card>

      <Card className="p-4">
        <h2 className="mb-1 font-bold text-ink">ייצוא ליומן</h2>
        <p className="mb-3 text-xs text-muted">
          מוריד קובץ <code className="text-ink">.ics</code> עם כל המבחנים והמשימות המשובצות. אפשר לייבא
          אותו ל-Google Calendar, לאאוטלוק או ליומן של האייפון. זו תמונת מצב — שינויים באפליקציה לא
          יתעדכנו ביומן, וצריך לייצא שוב.
        </p>
        <button
          onClick={exportCalendar}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-primary-soft"
        >
          <DownloadSimple size={17} /> הורדת קובץ יומן
        </button>
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
