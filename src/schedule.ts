import type { Task } from './store'
// Explicit .ts extension so plain Node can import this module for the self-check
// (schedule.check.mjs) without a build step. Vite resolves it identically.
import { isoLt } from './utils.ts'

export type DaySchedule = Record<string, Task[]> // isoDate -> tasks planned that day

/**
 * Pure. Groups the pending tasks onto the day the user actually put them on.
 *
 * Scheduling is entirely manual: a task has a day because someone dragged it
 * onto one. Tasks without a day are not placed anywhere — they wait in the
 * planner's pool.
 *
 * Nothing is ever relocated. An earlier version moved a task whose day had
 * passed onto today, which quietly inflated today's load and made the task
 * vanish from the day it had been planned for. A task that was missed is now
 * left on its own day and surfaced by `overdue` instead.
 */
export function buildSchedule(tasks: Task[]): DaySchedule {
  const byDay: DaySchedule = {}
  for (const task of tasks) {
    if (task.done || !task.dueDate) continue
    ;(byDay[task.dueDate] ??= []).push(task)
  }
  return byDay
}

/*
 * The three states a pending task can be in. They are mutually exclusive and
 * together cover every task that is not done, which is what lets each screen
 * ask for exactly one of them without double-counting.
 */

/** No day yet — waiting in the planner's pool. */
export const unscheduled = (tasks: Task[]) => tasks.filter((t) => !t.done && !t.dueDate)

/** Planned for today or later. */
export const scheduled = (tasks: Task[], today: string) =>
  tasks.filter((t) => !t.done && t.dueDate && !isoLt(t.dueDate, today))

/** Its day has passed and it was never ticked off. Oldest first. */
export const overdue = (tasks: Task[], today: string) =>
  tasks
    .filter((t) => !t.done && t.dueDate && isoLt(t.dueDate, today))
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))

/** Total planned minutes for a day, used to flag an overloaded day. */
export const dayLoad = (tasks: Task[]) => tasks.reduce((sum, t) => sum + t.minutes, 0)
