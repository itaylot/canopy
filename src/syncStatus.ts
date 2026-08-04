import { create } from 'zustand'

export type SyncStatus = 'saved' | 'saving' | 'offline' | 'error'

type SyncStatusState = { status: SyncStatus; set: (s: SyncStatus) => void }

// Its own tiny store, not part of the app state in store.ts: this is a live
// read of the sync mechanism's own condition, not data that itself gets
// synced. cloud.ts is the only writer; Profile.tsx just reads it.
export const useSyncStatus = create<SyncStatusState>()((set) => ({
  status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'saved',
  set: (status) => set({ status }),
}))
