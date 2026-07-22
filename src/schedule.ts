import type { Task } from './store'
// Explicit .ts extension so plain Node can import this module for the self-check
// (schedule.check.mjs) without a build step. Vite resolves it identically.
import { isoLt } from './utils.ts'

export type DaySchedule = Record<string, Task[]> // isoDate -> tasks planned that day

/**
 * Pure. Groups the pending tasks onto the days the user put them on.
 *
 * Scheduling is entirely manual: a task has a day because someone dragged it
 * onto one in the week planner. Tasks without a day are not placed anywhere —
 * they wait in the planner's pool. An earlier version distributed them
 * automatically before the next exam, which meant returning a task to the pool
 * was impossible: the scheduler put it straight back onto a day.
 *
 * The one thing it still decides on its own: a task whose day has already
 * passed and is still not done resurfaces on today, rather than staying in the
 * past where nobody would look at it again.
 */
export function buildSchedule(tasks: Task[], today: string): DaySchedule {
  const byDay: DaySchedule = {}
  for (const task of tasks) {
    if (task.done || !task.dueDate) continue
    const day = isoLt(task.dueDate, today) ? today : task.dueDate
    ;(byDay[day] ??= []).push(task)
  }
  return byDay
}

/** Tasks waiting to be scheduled — the week planner's pool. */
export const unscheduled = (tasks: Task[]) => tasks.filter((t) => !t.done && !t.dueDate)

/** Total planned minutes for a day, used to flag an overloaded day. */
export const dayLoad = (tasks: Task[]) => tasks.reduce((sum, t) => sum + t.minutes, 0)
