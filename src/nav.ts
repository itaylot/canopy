import { create } from 'zustand'

export type TabKey = 'home' | 'plan' | 'schedule' | 'courses' | 'profile'

/**
 * Which tab is open.
 *
 * Its own store rather than component state, so a screen can hand the user to
 * the next step of the flow — "finished adding tasks, go plan the week" — and
 * empty states can point at the action that fills them. Session-only and never
 * written to the cloud: which tab you had open is not part of your data.
 */
export const useNav = create<{ tab: TabKey; setTab: (t: TabKey) => void }>()((set) => ({
  tab: 'home',
  setTab: (tab) => set({ tab }),
}))

export const goTo = (tab: TabKey) => useNav.getState().setTab(tab)
