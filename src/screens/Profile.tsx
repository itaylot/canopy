import { useMemo } from 'react'
import { motion } from 'motion/react'
import { SignOut, CloudCheck, Sun, Moon, Sparkle, DownloadSimple } from '@phosphor-icons/react'
import { useStore, type ThemeKey, type ModeKey } from '../store'
import { THEME_META, THEME_KEYS } from '../theme'
import { auth, logOut } from '../firebase'
import { formatDuration, todayIso, DAILY_CAP_OPTIONS_MIN } from '../utils'
import { buildSchedule } from '../schedule'
import { buildIcs, downloadIcs } from '../ics'
import { Card, Field, inputClass } from '../ui'

const MODE_CHOICES: { key: ModeKey; label: string; Icon: typeof Sun }[] = [
  { key: 'auto', label: 'אוטומטי', Icon: Sparkle },
  { key: 'light', label: 'בהיר', Icon: Sun },
  { key: 'dark', label: 'כהה', Icon: Moon },
]

// A dab of each theme's primary + accent, so the swatch previews the palette.
const THEME_SWATCH: Record<ThemeKey, React.CSSProperties> = {
  forest: { background: 'linear-gradient(135deg, #4c7b39 60%, #b88a3e 60%)' },
  sea: { background: 'linear-gradient(135deg, #14746c 60%, #d97e46 60%)' },
  snow: { background: 'linear-gradient(135deg, #2f6a99 60%, #cf7f3c 60%)' },
  snowpark: { background: 'linear-gradient(135deg, #4a51c9 60%, #ec5c33 60%)' },
}

export default function Profile() {
  const { tasks, courses, exams, dailyCap, setDailyCap, theme, setTheme, mode, setMode } = useStore()
  const user = auth.currentUser

  const exportCalendar = () => {
    const today = todayIso()
    const schedule = buildSchedule(tasks)
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
        <Field label="כמה זמן ללמוד ביום">
          <select
            className={inputClass}
            value={dailyCap}
            onChange={(e) => setDailyCap(Number(e.target.value))}
          >
            {DAILY_CAP_OPTIONS_MIN.map((m) => (
              <option key={m} value={m}>
                {formatDuration(m)}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-muted">
          בתכנון השבוע, יום שחורג מהמכסה הזו יסומן כעמוס. השיבוץ עצמו תמיד שלך — שום משימה לא
          משובצת אוטומטית.
        </p>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-bold text-ink">ערכת נושא</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {THEME_KEYS.map((key) => {
            const on = theme === key
            return (
              <button
                key={key}
                onClick={() => setTheme(key)}
                aria-pressed={on}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  on ? 'bg-primary-soft text-primary ring-1 ring-primary/40' : 'text-muted hover:bg-primary-soft/50'
                }`}
              >
                <span className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10" style={THEME_SWATCH[key]} />
                {THEME_META[key].label}
              </button>
            )
          })}
        </div>

        <h2 className="mb-2 mt-4 font-bold text-ink">מצב תצוגה</h2>
        <div className="grid grid-cols-3 gap-2">
          {MODE_CHOICES.map(({ key, label, Icon }) => {
            const on = mode === key
            return (
              <button
                key={key}
                onClick={() => setMode(key)}
                aria-pressed={on}
                className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-medium transition-colors ${
                  on ? 'bg-primary-soft text-primary ring-1 ring-primary/40' : 'text-muted hover:bg-primary-soft/50'
                }`}
              >
                <Icon size={19} weight={on ? 'fill' : 'regular'} />
                {label}
              </button>
            )
          })}
        </div>
        <p className="mt-2.5 text-xs text-muted">
          במצב אוטומטי התצוגה עוקבת אחרי הגדרת המכשיר (בהיר/כהה).
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
