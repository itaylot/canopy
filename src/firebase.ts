import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore'
import { firebaseConfig } from './firebaseConfig'

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const provider = new GoogleAuthProvider()

// Offline cache: data reads/writes work offline and sync when back online.
// ignoreUndefinedProperties: task.dueDate is `undefined` for auto-scheduled
// tasks (the common case) — Firestore rejects `undefined` fields outright,
// which was silently failing every task write that had no explicit day.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
  ignoreUndefinedProperties: true,
})

// Popup first: it stays on one page, so it isn't exposed to Safari's ITP
// storage-partitioning across the redirect chain (site -> Google -> auth
// handler -> site), which is what causes signInWithRedirect to silently loop
// on iOS. Redirect is only the fallback for browsers that can't do popups.
export async function signIn() {
  try {
    await signInWithPopup(auth, provider)
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code ?? ''
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider)
      return
    }
    throw e
  }
}

export const logOut = () => signOut(auth)
