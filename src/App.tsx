import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { House, CalendarBlank, BookOpen, User, Kanban } from '@phosphor-icons/react'
import type { User as FirebaseUser } from 'firebase/auth'
import Home from './screens/Home'
import WeekPlanner from './screens/WeekPlanner'
import CalendarScreen from './screens/CalendarScreen'
import Courses from './screens/Courses'
import Profile from './screens/Profile'
import Login from './screens/Login'
import { CanopyMark, Toaster } from './ui'
import { isConfigured } from './firebaseConfig'
import { useAuth, useCloudSync } from './cloud'
import { registerSW, applyUpdate } from './registerSW'
import { toast } from './toast'

// `short` is the mobile dock label — five tabs leave little room on a phone.
const TABS = [
  { key: 'home', label: 'בית', short: 'בית', Icon: House, Screen: Home },
  { key: 'plan', label: 'תכנון שבוע', short: 'תכנון', Icon: Kanban, Screen: WeekPlanner },
  { key: 'schedule', label: 'לוח זמנים', short: 'לו״ז', Icon: CalendarBlank, Screen: CalendarScreen },
  { key: 'courses', label: 'קורסים', short: 'קורסים', Icon: BookOpen, Screen: Courses },
  { key: 'profile', label: 'פרופיל', short: 'פרופיל', Icon: User, Screen: Profile },
] as const

export default function App() {
  const { user, loading } = useAuth()
  useCloudSync(user)

  useEffect(() => {
    registerSW(() =>
      toast('גרסה חדשה זמינה.', { actionLabel: 'רענן', onAction: applyUpdate, duration: 0 }),
    )
  }, [])

  return (
    <>
      {!isConfigured ? (
        <ConfigNeeded />
      ) : loading ? (
        <Splash />
      ) : !user ? (
        <Login />
      ) : (
        <MainApp user={user} />
      )}
      {/* Outside the auth branches: a sync failure has to be visible on every screen. */}
      <Toaster />
    </>
  )
}

function MainApp({ user }: { user: FirebaseUser }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('home')
  const active = TABS.find((t) => t.key === tab)!

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-bg md:max-w-2xl lg:grid lg:max-w-7xl lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-6 lg:px-6">
      {/* Desktop sidebar - first grid column, which in RTL is the right side */}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:py-6">
        <div className="flex flex-1 flex-col overflow-hidden rounded-3xl bg-surface bg-[url('/sidebar-bg.png')] bg-cover bg-bottom shadow-card dark:bg-none">
          <div className="flex items-center gap-2 px-5 pb-2 pt-6 text-lg font-bold tracking-wide text-ink">
            <CanopyMark size={30} /> CANOPY
          </div>

          <nav className="mt-4 flex flex-col gap-1 px-3">
            {TABS.map(({ key, label, Icon }) => {
              const on = key === tab
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  aria-current={on ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors ${
                    on ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface/70 hover:text-ink'
                  }`}
                >
                  <Icon weight={on ? 'fill' : 'regular'} size={20} />
                  {label}
                </button>
              )
            })}
          </nav>

          {/* signed-in user, inside the menu (frees the whole top strip of the page) */}
          <button
            onClick={() => setTab('profile')}
            className="mx-3 mb-3 mt-auto flex items-center gap-2.5 rounded-xl bg-surface/80 px-3 py-3 text-right backdrop-blur-sm transition-colors hover:bg-surface"
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="h-8 w-8 shrink-0 rounded-full" />
            ) : (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                {(user.displayName ?? user.email ?? '?').slice(0, 1)}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{user.displayName ?? 'משתמש'}</span>
              <span className="block truncate text-[11px] text-muted">{user.email}</span>
            </span>
          </button>
        </div>
      </aside>

      <div className="flex min-h-[100dvh] flex-col lg:py-6">
        {/* Mobile header */}
        <header className="flex items-center justify-between px-4 pt-4 lg:hidden">
          <span className="flex items-center gap-2 text-lg font-bold tracking-wide text-ink">
            <CanopyMark size={26} /> CANOPY
          </span>
        </header>

        <main className="flex-1 px-4 pb-32 pt-4 lg:p-0">
          {/* Screen swap is instant (never gated on an animation); a transform-only
              slide keeps a hint of motion while leaving content visible if the
              animation loop is paused (e.g. a backgrounded tab). */}
          <motion.div key={tab} initial={{ y: 8 }} animate={{ y: 0 }} transition={{ duration: 0.22 }}>
            <active.Screen />
          </motion.div>
        </main>
      </div>

      {/* Mobile floating dock */}
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:max-w-2xl lg:hidden">
        <div className="grid grid-cols-5 rounded-2xl bg-surface/95 p-1 shadow-card backdrop-blur-lg">
          {TABS.map(({ key, short, Icon }) => {
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
                  size={21}
                  className={`relative z-10 transition-colors ${on ? 'text-primary' : 'text-muted'}`}
                />
                <span
                  className={`relative z-10 text-[10px] transition-colors ${
                    on ? 'font-semibold text-primary' : 'text-muted'
                  }`}
                >
                  {short}
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
