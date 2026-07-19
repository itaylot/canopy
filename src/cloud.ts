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

const snapshotOf = (s: ReturnType<typeof useStore.getState>) => ({
  courses: s.courses,
  tasks: s.tasks,
  exams: s.exams,
  dailyCap: s.dailyCap,
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

    const unsubDoc = onSnapshot(ref, (snap) => {
      if (snap.metadata.hasPendingWrites) return // ignore the echo of our own write
      if (snap.exists()) {
        const d = snap.data()
        applyingRemote = true
        useStore.getState().replaceAll({
          courses: d.courses ?? [],
          tasks: d.tasks ?? [],
          exams: d.exams ?? [],
          dailyCap: d.dailyCap ?? 180,
        })
        applyingRemote = false
      } else {
        // First sign-in: seed the cloud doc from whatever is in memory.
        void setDoc(ref, snapshotOf(useStore.getState())).catch((e) =>
          console.error('cloud sync (initial seed) failed:', e),
        )
      }
    })

    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubStore = useStore.subscribe((s) => {
      if (applyingRemote) return // don't push a change we just pulled
      clearTimeout(timer)
      timer = setTimeout(
        () =>
          void setDoc(ref, snapshotOf(s), { merge: true }).catch((e) =>
            console.error('cloud sync failed:', e),
          ),
        700,
      )
    })

    return () => {
      unsubDoc()
      unsubStore()
      clearTimeout(timer)
    }
  }, [user])
}
