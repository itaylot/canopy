import type { Task, Exam } from './store'
import { addDaysIso, isoLt, isoLte } from './utils'

export type DaySchedule = Record<string, Task[]> // isoDate -> tasks planned that day

// Pure. Given the pending tasks + exams, decides which day each task lands on.
//   - task.dueDate set   -> fixed assignment: always that day (pulled to today if it's
//                           already past), exactly like putting an event on a calendar.
//   - task.dueDate unset -> auto-distributed: greedily filled from today, spilling to
//                           the next day once `dailyCap` minutes are used, clamped to a
//                           buffer day before the course's next exam if it has one.
export function buildSchedule(
  tasks: Task[],
  exams: Exam[],
  today: string,
  dailyCap: number,
): DaySchedule {
  const pending = tasks.filter((t) => !t.done)
  const byDay: DaySchedule = {}
  const load: Record<string, number> = {}

  const assign = (day: string, task: Task) => {
    load[day] = (load[day] ?? 0) + task.minutes
    ;(byDay[day] ??= []).push(task)
  }

  const fixed = pending.filter((t) => t.dueDate)
  const auto = pending.filter((t) => !t.dueDate)

  for (const task of fixed) {
    assign(isoLt(task.dueDate!, today) ? today : task.dueDate!, task)
  }

  const nextExamDate = (courseId: string): string | null => {
    const upcoming = exams
      .filter((e) => e.courseId === courseId && isoLte(today, e.date))
      .map((e) => e.date)
      .sort()
    return upcoming[0] ?? null
  }

  const items = auto.map((task) => {
    const exam = nextExamDate(task.courseId)
    let deadline: string | null = null
    if (exam) {
      deadline = addDaysIso(exam, -1)
      if (isoLt(deadline, today)) deadline = today
    }
    return { task, deadline }
  })

  // Earliest deadline first (no-deadline last); tie-break longer tasks first.
  items.sort((a, b) => {
    if (a.deadline && b.deadline) {
      if (a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1
      return b.task.minutes - a.task.minutes
    }
    if (a.deadline) return -1
    if (b.deadline) return 1
    return b.task.minutes - a.task.minutes
  })

  for (const { task, deadline } of items) {
    let day = today
    while ((load[day] ?? 0) + task.minutes > dailyCap && (!deadline || isoLt(day, deadline))) {
      day = addDaysIso(day, 1)
    }
    if (deadline && isoLt(deadline, day)) day = deadline
    assign(day, task)
  }

  return byDay
}
