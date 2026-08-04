import { useState } from 'react'
import { Share, X } from '@phosphor-icons/react'
import {
  isIOS,
  isStandalone,
  iosBrowserKind,
  shouldShowInstallHint,
  INSTALL_HINT_STORAGE_KEY,
} from './installHintLogic'

function readDismissedAt(): number | null {
  try {
    const raw = localStorage.getItem(INSTALL_HINT_STORAGE_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

/**
 * Shared with the permanent "how to install" entry in Profile, so the
 * one-time banner and the on-demand explanation never say two things.
 *
 * Only genuine Safari exposes "Add to Home Screen" from its own share sheet.
 * A page opened inside an app's in-app browser (Instagram/Facebook/etc.) or a
 * non-Safari iOS browser (Chrome/Firefox/Edge for iOS) doesn't have that
 * button at all — describing it there would just be confusing, so those get
 * a "open this in Safari first" instruction instead. See classifyIOSBrowser
 * for the (best-effort, documented) detection.
 */
export function InstallInstructions() {
  if (iosBrowserKind() !== 'safari') {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-ink">הדפדפן הנוכחי לא מאפשר הוספה למסך הבית ישירות.</p>
        <p className="text-muted">
          פתחו את הכתובת <span className="font-semibold text-ink">canopy-b9c49.web.app</span> ב-Safari (בתפריט &quot;⋯&quot; או
          &quot;פתח בדפדפן&quot; אם יש), ואז חזרו לכאן.
        </p>
      </div>
    )
  }
  return (
    <ol className="list-decimal space-y-2 pr-5 text-sm text-ink">
      <li>
        פתחו את תפריט השיתוף <Share size={15} weight="bold" className="inline-block -translate-y-0.5 text-primary" /> בסרגל
        הכתובת של Safari.
      </li>
      <li>גללו בין הפעולות ובחרו ב&quot;הוספה למסך הבית&quot;.</li>
      <li>אם הפעולה לא מופיעה ברשימה, בחרו ב&quot;עריכת פעולות&quot; והוסיפו אותה, ואז חזרו לשלב הקודם.</li>
    </ol>
  )
}

/**
 * One-time nudge: iOS only, and only while not already running standalone
 * from the home screen — installing it doesn't help someone who already has.
 *
 * Dismissing writes a timestamp rather than a boolean, so the hint can
 * resurface after a reasonable break (see INSTALL_HINT_SNOOZE_MS) instead of
 * being gone for good after one impatient tap — see shouldShowInstallHint.
 */
export function InstallHint() {
  const [dismissedAt, setDismissedAt] = useState(readDismissedAt)
  const [now] = useState(() => Date.now())

  if (!isIOS() || isStandalone()) return null
  if (!shouldShowInstallHint(dismissedAt, now)) return null

  const dismiss = () => {
    const ts = Date.now()
    try {
      localStorage.setItem(INSTALL_HINT_STORAGE_KEY, String(ts))
    } catch {
      // Private mode / storage disabled — the hint just won't remember being dismissed.
    }
    setDismissedAt(ts)
  }

  const isSafari = iosBrowserKind() === 'safari'

  return (
    <div className="relative flex items-start gap-3 rounded-2xl bg-primary-soft p-4 text-sm">
      <Share size={20} weight="bold" className="mt-0.5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">אפשר להתקין את Canopy כאפליקציה במסך הבית</p>
        <p className="mt-1 text-muted">
          {isSafari ? 'תפריט השיתוף ← גלילה לפעולות ← "הוספה למסך הבית".' : 'פתחו את הדף הזה ב-Safari כדי להתקין.'}
        </p>
      </div>
      <button
        onClick={dismiss}
        aria-label="סגור הודעה"
        className="relative shrink-0 rounded-full p-1 text-muted transition-colors hover:text-ink"
      >
        <span className="absolute -inset-2" />
        <X size={15} />
      </button>
    </div>
  )
}
