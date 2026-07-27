import { create } from 'zustand'
import type { ThemeKey } from './store'

/**
 * The immersive full-screen background per theme (its own painterly art, no
 * character — the calm scene is the point), plus where the timer starts.
 *
 * `anchor` is the timer's default corner, chosen so it sits over each image's
 * calmest, emptiest region; the user can then drag it anywhere. Stored as a
 * corner + insets rather than absolute pixels so it lands right on any screen.
 */
export type FocusScene = {
  bg: string
  anchor: { x: 'left' | 'right'; y: 'top' | 'bottom' }
}

export const FOCUS_SCENES: Record<ThemeKey, FocusScene> = {
  // forest: open sky upper-left; trees fill the right → timer bottom-left
  forest: { bg: '/focus-forest.webp', anchor: { x: 'left', y: 'bottom' } },
  // sea: island sits right; water is clear bottom-left → timer bottom-left
  sea: { bg: '/focus-sea.webp', anchor: { x: 'left', y: 'bottom' } },
  // ski: slope sweeps low; sky is open → timer bottom-right
  snow: { bg: '/focus-ski.webp', anchor: { x: 'right', y: 'bottom' } },
  snowpark: { bg: '/focus-snowpark.webp', anchor: { x: 'right', y: 'bottom' } },
}

/** @deprecated use FOCUS_SCENES[theme].bg */
export const FOCUS_BG: Record<ThemeKey, string> = {
  forest: FOCUS_SCENES.forest.bg,
  sea: FOCUS_SCENES.sea.bg,
  snow: FOCUS_SCENES.snow.bg,
  snowpark: FOCUS_SCENES.snowpark.bg,
}

/**
 * A focus session.
 *
 * The clock is stored as an absolute end timestamp, never a ticking counter, so
 * a session survives leaving the screen, backgrounding the tab or a reload — the
 * UI's interval only re-derives "time left" from `endsAt`, it doesn't hold the
 * truth. When paused, we remember how much was left rather than a moving target.
 *
 * Session state is deliberately NOT in the cloud store: it is ephemeral and must
 * never sync to another device and yank it into focus mode. The sound preference
 * is the one thing worth persisting, so it lives in localStorage.
 */
export type FocusSession = {
  taskId: string | null
  taskTitle: string | null
  totalMs: number
  /** Absolute end time while running; null while paused. */
  endsAt: number | null
  /** Milliseconds left at the moment of pausing; null while running. */
  pausedLeftMs: number | null
}

const SOUND_KEY = 'canopy-focus-sound'
const readSound = () => {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

type FocusState = {
  session: FocusSession | null
  /** Whether the immersive overlay is showing. Distinct from `session`: leaving
   *  focus mode collapses it to a resume bar but keeps the clock running. */
  open: boolean
  soundOn: boolean
  /** now() is injected so the reducer stays pure and testable. */
  start: (opts: { taskId?: string; taskTitle?: string; minutes: number }, now: number) => void
  pause: (now: number) => void
  resume: (now: number) => void
  /** Adds minutes to a running or paused session. */
  extend: (minutes: number, now: number) => void
  /** Leave the overlay without ending the session. */
  collapse: () => void
  expand: () => void
  stop: () => void
  setSound: (on: boolean) => void
  /** Where the user dragged the timer to, as a pixel offset from its scene
   *  anchor. Lives here (not component state) so it survives collapsing and
   *  re-expanding the overlay within the same session; a new session resets it. */
  dragOffset: { x: number; y: number }
  setDragOffset: (pos: { x: number; y: number }) => void
}

export const useFocus = create<FocusState>()((set) => ({
  session: null,
  open: false,
  soundOn: readSound(),
  dragOffset: { x: 0, y: 0 },
  setDragOffset: (dragOffset) => set({ dragOffset }),
  start: ({ taskId, taskTitle, minutes }, now) =>
    set({
      open: true,
      dragOffset: { x: 0, y: 0 },
      session: {
        taskId: taskId ?? null,
        taskTitle: taskTitle ?? null,
        totalMs: minutes * 60_000,
        endsAt: now + minutes * 60_000,
        pausedLeftMs: null,
      },
    }),
  pause: (now) =>
    set((s) =>
      !s.session || s.session.endsAt === null
        ? s
        : { session: { ...s.session, endsAt: null, pausedLeftMs: Math.max(0, s.session.endsAt - now) } },
    ),
  resume: (now) =>
    set((s) =>
      !s.session || s.session.pausedLeftMs === null
        ? s
        : { session: { ...s.session, endsAt: now + s.session.pausedLeftMs, pausedLeftMs: null } },
    ),
  extend: (minutes, now) =>
    set((s) => {
      if (!s.session) return s
      const add = minutes * 60_000
      const { endsAt, pausedLeftMs, totalMs } = s.session
      return {
        session: {
          ...s.session,
          totalMs: totalMs + add,
          endsAt: endsAt === null ? null : Math.max(endsAt, now) + add,
          pausedLeftMs: pausedLeftMs === null ? null : pausedLeftMs + add,
        },
      }
    }),
  collapse: () => set({ open: false }),
  expand: () => set({ open: true }),
  stop: () => set({ session: null, open: false, dragOffset: { x: 0, y: 0 } }),
  setSound: (on) => {
    try {
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
    } catch {
      // storage disabled — the toggle still works for this session
    }
    set({ soundOn: on })
  },
}))

/** Milliseconds left in a session, clamped at zero. Pure. */
export function msLeft(session: FocusSession, now: number): number {
  if (session.pausedLeftMs !== null) return session.pausedLeftMs
  if (session.endsAt !== null) return Math.max(0, session.endsAt - now)
  return 0
}

export const isPaused = (session: FocusSession) => session.pausedLeftMs !== null
export const isDone = (session: FocusSession, now: number) => msLeft(session, now) <= 0

/** Duration choices offered at the start of a session, in minutes. */
export const FOCUS_MINUTES = [15, 25, 40, 50, 60, 90]
export const DEFAULT_FOCUS_MINUTES = 25
