import { useState } from 'react'
import { motion } from 'motion/react'
import { House, CalendarBlank, BookOpen, User } from '@phosphor-icons/react'
import Home from './screens/Home'
import CalendarScreen from './screens/CalendarScreen'
import Courses from './screens/Courses'
import Profile from './screens/Profile'
import Login from './screens/Login'
import { CanopyMark } from './ui'
import { isConfigured } from './firebaseConfig'
import { useAuth, useCloudSync } from './cloud'

const TABS = [
  { key: 'home', label: 'בית', Icon: House, Screen: Home },
  { key: 'schedule', label: 'לוח זמנים', Icon: CalendarBlank, Screen: CalendarScreen },
  { key: 'courses', label: 'קורסים', Icon: BookOpen, Screen: Courses },
  { key: 'profile', label: 'פרופיל', Icon: User, Screen: Profile },
] as const

export default function App() {
  const { user, loading } = useAuth()
  useCloudSync(user)

  if (!isConfigured) return <ConfigNeeded />
  if (loading) return <Splash />
  if (!user) return <Login />
  return <MainApp />
}

function MainApp() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('home')
  const active = TABS.find((t) => t.key === tab)!

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-bg md:max-w-2xl lg:max-w-3xl">
      <header className="flex items-center justify-between px-4 pt-4">
        <span className="flex items-center gap-2 text-lg font-bold tracking-wide text-ink">
          <CanopyMark size={26} /> CANOPY
        </span>
      </header>

      <main className="flex-1 px-4 pb-32 pt-4">
        {/* Screen swap is instant (never gated on an animation); a transform-only
            slide keeps a hint of motion while leaving content visible if the
            animation loop is paused (e.g. a backgrounded tab). */}
        <motion.div key={tab} initial={{ y: 8 }} animate={{ y: 0 }} transition={{ duration: 0.22 }}>
          <active.Screen />
        </motion.div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:max-w-2xl lg:max-w-3xl">
        <div className="grid grid-cols-4 rounded-2xl bg-surface/95 p-1.5 shadow-card backdrop-blur-lg">
          {TABS.map(({ key, label, Icon }) => {
            const on = key === tab
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-current={on ? 'page' : undefined}
                className="relative flex flex-col items-center gap-1 rounded-xl py-2"
              >
                {on && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 -z-0 rounded-xl bg-primary-soft"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon
                  weight={on ? 'fill' : 'regular'}
                  size={22}
                  className={`relative z-10 transition-colors ${on ? 'text-primary' : 'text-muted'}`}
                />
                <span
                  className={`relative z-10 text-[11px] transition-colors ${
                    on ? 'font-semibold text-primary' : 'text-muted'
                  }`}
                >
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function Splash() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-bg">
      <motion.div
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        className="grid h-16 w-16 place-items-center rounded-2xl bg-surface shadow-card"
      >
        <CanopyMark size={36} />
      </motion.div>
    </div>
  )
}

function ConfigNeeded() {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
      <CanopyMark size={44} />
      <h1 className="text-xl font-bold text-ink">כמעט מוכן</h1>
      <p className="text-muted">
        צריך להוסיף את פרטי ה-Firebase בקובץ <code className="text-ink">src/firebaseConfig.ts</code> כדי
        להפעיל שמירה בענן והתחברות.
      </p>
    </div>
  )
}
