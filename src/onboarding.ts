import type { Course, Exam, Task } from './store'

/**
 * The four first-run steps, in order: course created, exam/goal added, tasks
 * added, a task actually scheduled to a day. Purely derived from data that
 * already exists — nothing here is cached or flagged as "seen."
 *
 * That means it's a live reflection of the current state, not a one-time
 * checklist: completing all four hides it (see OnboardingChecklist in
 * Home.tsx), and undoing any one of them later — deleting your only course,
 * unscheduling your only scheduled task — brings it back. That's intentional:
 * the alternative (a "completed setup, never show again" flag) could leave
 * the checklist permanently hidden for a user who is, in fact, back to having
 * nothing set up.
 */
export function onboardingStepsDone(courses: Course[], exams: Exam[], tasks: Task[]): boolean[] {
  return [courses.length > 0, exams.length > 0, tasks.length > 0, tasks.some((t) => !!t.dueDate)]
}
