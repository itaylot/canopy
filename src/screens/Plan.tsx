import { useState } from 'react'
import WeekPlanner from './WeekPlanner'
import CalendarScreen from './CalendarScreen'

/**
 * "תכנון" tab: week and month used to be two separate top-level tabs, which
 * left only four slots for everything else in the mobile dock. Folding them
 * behind one segmented toggle here doesn't lose either screen — both are
 * unchanged — it just moves the switch from the nav bar to the top of the
 * screen. Local, unpersisted state: which one you were looking at isn't data
 * worth remembering across visits.
 */
export default function Plan() {
  const [view, setView] = useState<'week' | 'month'>('week')

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="inline-flex rounded-full bg-surface p-1 shadow-card">
          {(
            [
              ['week', 'שבוע'],
              ['month', 'חודש'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              aria-pressed={view === key}
              className={`rounded-full px-5 py-1.5 text-sm font-semibold transition-colors ${
                view === key ? 'bg-primary text-on-primary' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'week' ? <WeekPlanner /> : <CalendarScreen />}
    </div>
  )
}
