import { create } from 'zustand'

export type Toast = {
  id: number
  message: string
  /** Optional action, e.g. "ביטול" on a delete or "רענן" on an update. */
  actionLabel?: string
  onAction?: () => void
  /** ms until it disappears; 0 keeps it until dismissed. */
  duration: number
}

type ToastState = {
  toasts: Toast[]
  show: (t: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => number
  dismiss: (id: number) => void
}

let nextId = 1

// Deliberately its own store, not part of the app state in store.ts: toasts are
// throwaway UI, and anything that lands in that store gets written to Firestore
// and synced to every device.
export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  show: ({ duration = 5000, ...rest }) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { ...rest, id, duration }] }))
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = (
  message: string,
  opts: { actionLabel?: string; onAction?: () => void; duration?: number } = {},
) => useToasts.getState().show({ message, ...opts })
