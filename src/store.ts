import { create } from 'zustand'
// Explicit .ts extension so plain Node can import this for the self-check.
import { todayIso } from './utils.ts'

export type Course = { id: string; name: string; emoji: string; color: string }
export type Task = {
  id: string
  courseId: string
  title: string
  minutes: number
  dueDate?: string
  done: boolean
  completedAt?: string
}
export type Exam = { id: string; courseId: string; title: string; date: string }

// Course identity colors drawn from the locked brand palette (Fern, Olive
// Bark, Golden Earth, Camel, Lime Moss 2, lightened Prussian). The goldenrod
// --accent stays reserved for "what's next", never a course identity.
export const COURSE_COLORS = ['#4C7B39', '#714F21', '#8A5D1F', '#CA9D59', '#88A431', '#2E4A68']
export const COURSE_EMOJIS = ['📐', '🧠', '📖', '⚗️', '💻', '🎨', '🧬', '📊', '🗺️', '🎵']

/** The place: drives the palette, the home-screen scene and the sidebar art. */
export type ThemeKey = 'forest' | 'sea' | 'snow' | 'snowpark'
/** Light/dark. 'auto' follows the device; the others force it. */
export type ModeKey = 'auto' | 'light' | 'dark'

export const THEME_KEYS: ThemeKey[] = ['forest', 'sea', 'snow', 'snowpark']
const MODE_KEYS: ModeKey[] = ['auto', 'light', 'dark']

/** Pure resolution of the light/dark choice; 'auto' defers to the device. */
export const isDark = (mode: ModeKey, systemDark: boolean): boolean =>
  mode === 'dark' || (mode === 'auto' && systemDark)

/**
 * Normalizes theme+mode out of a persisted doc, migrating the old single
 * `scene` field: 'night' forced a dark look, 'forest'/'auto' followed the
 * device. Legacy data has no place, so it becomes forest. Unknown values fall
 * back safely rather than throwing.
 */
export function normalizeThemeMode(d: {
  theme?: unknown
  mode?: unknown
  scene?: unknown
}): { theme: ThemeKey; mode: ModeKey } {
  const theme = THEME_KEYS.includes(d.theme as ThemeKey) ? (d.theme as ThemeKey) : 'forest'
  const mode = MODE_KEYS.includes(d.mode as ModeKey)
    ? (d.mode as ModeKey)
    : d.scene === 'night'
      ? 'dark'
      : 'auto'
  return { theme, mode }
}

type State = {
  courses: Course[]
  tasks: Task[]
  exams: Exam[]
  dailyCap: number
  theme: ThemeKey
  mode: ModeKey
  setTheme: (t: ThemeKey) => void
  setMode: (m: ModeKey) => void
  addCourse: (c: Omit<Course, 'id'>) => void
  updateCourse: (id: string, patch: Partial<Course>) => void
  removeCourse: (id: string) => void
  addTask: (t: Omit<Task, 'id' | 'done' | 'completedAt'>) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  /** Pin a task to a day, or pass undefined to hand it back to auto-scheduling. */
  setTaskDay: (id: string, day: string | undefined) => void
  toggleTask: (id: string) => void
  removeTask: (id: string) => void
  addExam: (e: Omit<Exam, 'id'>) => void
  updateExam: (id: string, patch: Partial<Exam>) => void
  removeExam: (id: string) => void
  setDailyCap: (n: number) => void
  /** Puts deleted rows back — see captureCourse and the undo toasts. */
  restore: (payload: Restorable) => void
  replaceAll: (s: Pick<State, 'courses' | 'tasks' | 'exams' | 'dailyCap' | 'theme' | 'mode'>) => void
}

export type Restorable = { courses?: Course[]; tasks?: Task[]; exams?: Exam[] }

/**
 * Everything that deleting this course would take with it.
 *
 * Deleting a course cascades to its tasks and its exams, so undo has to put all
 * three back. Capture this BEFORE calling removeCourse — afterwards it's gone.
 * Only the removed rows are captured, not a whole-state snapshot, so undoing a
 * delete can't also revert edits made while the toast was on screen.
 */
export function captureCourse(id: string): Restorable {
  const s = useStore.getState()
  return {
    courses: s.courses.filter((c) => c.id === id),
    tasks: s.tasks.filter((t) => t.courseId === id),
    exams: s.exams.filter((e) => e.courseId === id),
  }
}

const uid = () => crypto.randomUUID()

// Starts empty; the cloud sync layer (cloud.ts) hydrates it after sign-in.
export const useStore = create<State>()((set) => ({
  courses: [],
  tasks: [],
  exams: [],
  dailyCap: 180,
  theme: 'forest',
  mode: 'auto',
  setTheme: (theme) => set({ theme }),
  setMode: (mode) => set({ mode }),
  addCourse: (c) => set((s) => ({ courses: [...s.courses, { ...c, id: uid() }] })),
  updateCourse: (id, patch) =>
    set((s) => ({ courses: s.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
  removeCourse: (id) =>
    set((s) => ({
      courses: s.courses.filter((c) => c.id !== id),
      tasks: s.tasks.filter((t) => t.courseId !== id),
      exams: s.exams.filter((e) => e.courseId !== id),
    })),
  addTask: (t) => set((s) => ({ tasks: [...s.tasks, { ...t, id: uid(), done: false }] })),
  updateTask: (id, patch) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  setTaskDay: (id, day) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, dueDate: day } : t)) })),
  toggleTask: (id) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, done: !t.done, completedAt: !t.done ? todayIso() : undefined } : t,
      ),
    })),
  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
  addExam: (e) => set((s) => ({ exams: [...s.exams, { ...e, id: uid() }] })),
  updateExam: (id, patch) =>
    set((s) => ({ exams: s.exams.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
  removeExam: (id) => set((s) => ({ exams: s.exams.filter((e) => e.id !== id) })),
  setDailyCap: (n) => set({ dailyCap: n }),
  // Skips rows that already exist, so a double-tap on "ביטול" can't duplicate them.
  restore: ({ courses = [], tasks = [], exams = [] }) =>
    set((s) => {
      const missing = <T extends { id: string }>(existing: T[], incoming: T[]) => {
        const have = new Set(existing.map((x) => x.id))
        return incoming.filter((x) => !have.has(x.id))
      }
      return {
        courses: [...s.courses, ...missing(s.courses, courses)],
        tasks: [...s.tasks, ...missing(s.tasks, tasks)],
        exams: [...s.exams, ...missing(s.exams, exams)],
      }
    }),
  replaceAll: (s) => set(s),
}))
