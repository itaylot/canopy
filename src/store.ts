import { create } from 'zustand'
import { todayIso } from './utils'

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

/** 'auto' follows the clock (night after 20:00); the rest are pinned by the user. */
export type SceneKey = 'auto' | 'forest' | 'night'

type State = {
  courses: Course[]
  tasks: Task[]
  exams: Exam[]
  dailyCap: number
  scene: SceneKey
  setScene: (s: SceneKey) => void
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
  replaceAll: (s: Pick<State, 'courses' | 'tasks' | 'exams' | 'dailyCap' | 'scene'>) => void
}

const uid = () => crypto.randomUUID()

// Starts empty; the cloud sync layer (cloud.ts) hydrates it after sign-in.
export const useStore = create<State>()((set) => ({
  courses: [],
  tasks: [],
  exams: [],
  dailyCap: 180,
  scene: 'auto',
  setScene: (scene) => set({ scene }),
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
  replaceAll: (s) => set(s),
}))
