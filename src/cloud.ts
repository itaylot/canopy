import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './firebase'
import { useStore } from './store'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u)
        setLoading(false)
      }),
    [],
  )
  return { user, loading }
}

const dataOf = (s: ReturnType<typeof useStore.getState>) => ({
  courses: s.courses,
  tasks: s.tasks,
  exams: s.exams,
  dailyCap: s.dailyCap,
  scene: s.scene,
})

const localState = () => dataOf(useStore.getState())

const snapshotOf = (s: ReturnType<typeof useStore.getState>) => ({
  ...dataOf(s),
  updatedAt: serverTimestamp(),
})

// Two-way sync between the Zustand store and the user's single Firestore doc.
// The whole app state lives in one document (users/{uid}) as JSON — no per-entity
// schema, no migrations. Live snapshots keep phone + desktop in step.
export function useCloudSync(user: User | null) {
  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'users', user.uid)
    let applyingRemote = false
    // True from the moment a local edit happens until its write is acknowledged.
    // Without this, a snapshot that lands inside the debounce window overwrites
    // the edit the user just made (it reverts on screen), and the queued write
    // then re-applies it a moment later — the "reset, then delayed response" bug.
    let dirty = false

    const unsubDoc = onSnapshot(ref, (snap) => {
      if (snap.metadata.hasPendingWrites) return // ignore the echo of our own write
      if (dirty) return // a local edit is in flight; it wins
      if (snap.exists()) {
        const d = snap.data()
        const next = {
          courses: d.courses ?? [],
          tasks: d.tasks ?? [],
          exams: d.exams ?? [],
          dailyCap: d.dailyCap ?? 180,
          scene: d.scene ?? 'auto',
        }
        // Skip no-op snapshots. replaceAll hands every row a new object identity,
        // which re-runs every layout animation in the list for no visible reason.
        if (JSON.stringify(next) === JSON.stringify(localState())) return
        applyingRemote = true
        useStore.getState().replaceAll(next)
        applyingRemote = false
      } else {
        // First sign-in: seed the cloud doc from whatever is in memory.
        void setDoc(ref, snapshotOf(useStore.getState())).catch((e) =>
          console.error('cloud sync (initial seed) failed:', e),
        )
      }
    })

    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubStore = useStore.subscribe(() => {
      if (applyingRemote) return // don't push a change we just pulled
      dirty = true
      clearTimeout(timer)
      timer = setTimeout(() => {
        // Send the state as of *now*, not as of the edit that queued this timer —
        // later edits inside the window would otherwise be dropped.
        void setDoc(ref, snapshotOf(useStore.getState()), { merge: true })
          .catch((e) => console.error('cloud sync failed:', e))
          .finally(() => {
            // Only stop ignoring remote snapshots once nothing newer is queued.
            if (!timer) dirty = false
          })
        timer = undefined
      }, 700)
    })

    return () => {
      unsubDoc()
      unsubStore()
      clearTimeout(timer)
    }
  }, [user])
}
