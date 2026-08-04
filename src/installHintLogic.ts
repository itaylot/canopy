// Explicit .ts extension so plain Node can import the pure parts for the
// self-check (schedule.check.mjs) without a build step.

export const INSTALL_HINT_STORAGE_KEY = 'canopy-install-hint-dismissed-at'
/** How long a dismissal is honored before the hint can appear again. */
export const INSTALL_HINT_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000

/** Pure: given when (if ever) the hint was last dismissed, should it show now? */
export function shouldShowInstallHint(dismissedAt: number | null, now: number): boolean {
  if (dismissedAt === null) return true
  return now - dismissedAt > INSTALL_HINT_SNOOZE_MS
}

/** Pure UA check, split out from isIOS() so it can be unit-tested against
 *  fixed strings — the iPad-as-Mac branch below needs live navigator.platform
 *  / maxTouchPoints, which a plain string can't stand in for. */
export function isIOSUserAgent(ua: string): boolean {
  return /iPhone|iPod|iPad/.test(ua)
}

/** iPhone/iPod, or an iPad — including iPadOS 13+, which identifies itself as
 *  a Mac but is still touch-only (a real Mac never reports touch points). */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  if (isIOSUserAgent(navigator.userAgent)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

/** Already installed and running from the home screen, standard + iOS-specific check. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

export type IOSBrowserKind = 'safari' | 'in-app' | 'other'

// Known in-app webview signatures (social apps embedding their own browser).
// Not exhaustive — there is no complete list, and new apps appear constantly.
const IN_APP_UA_TOKENS = [
  'FBAN',
  'FBAV', // Facebook / Messenger
  'FB_IAB',
  'Instagram',
  'Line/',
  'MicroMessenger', // WeChat
  'Twitter',
  'TikTok',
  'GSA/', // Google app
  'Pinterest',
]

// Other real iOS browsers. All are WebKit under Apple's rules, but historically
// only Safari's own share sheet exposes "Add to Home Screen" — so these get
// the same "open in Safari" treatment as an in-app browser, per instruction.
const OTHER_IOS_BROWSER_UA_TOKENS = ['CriOS', 'FxiOS', 'EdgiOS', 'OPiOS', 'YaBrowser']

/**
 * Best-effort classification of which iOS browser a UA string belongs to.
 *
 * There is no reliable, spec'd way to detect "is this an in-app webview" —
 * this is a known, documented limitation. The approach: check known app
 * signatures first, then known non-Safari browser signatures, then fall back
 * to Safari's own tell (both "Safari/" and "Version/" tokens — Android Chrome
 * and most in-app webviews carry "Safari/" for legacy compatibility but never
 * "Version/", which is WebKit/Safari-specific). Anything that matches neither
 * a known app nor genuine Safari is treated as an in-app browser, since that's
 * the safer assumption — showing "open in Safari" to an actual Safari user
 * would be a false negative bug, while showing it to an edge-case browser we
 * don't recognize is just an unnecessary extra tap.
 */
export function classifyIOSBrowser(ua: string): IOSBrowserKind {
  if (IN_APP_UA_TOKENS.some((t) => ua.includes(t))) return 'in-app'
  if (OTHER_IOS_BROWSER_UA_TOKENS.some((t) => ua.includes(t))) return 'other'
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'safari'
  return 'in-app'
}

/** Only meaningful when isIOS() is already true. */
export function iosBrowserKind(): IOSBrowserKind {
  return classifyIOSBrowser(typeof navigator === 'undefined' ? '' : navigator.userAgent)
}
