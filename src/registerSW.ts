/**
 * Service worker registration.
 *
 * Dev is deliberately excluded: a caching worker in front of Vite's HMR makes
 * edits appear not to take effect, which is a miserable thing to debug.
 *
 * `onUpdate` fires when a new build is installed and waiting. The app shows a
 * prompt rather than reloading by itself — a silent reload mid-edit would throw
 * away whatever the user was typing.
 */
export function registerSW(onUpdate: () => void) {
  if (import.meta.env.DEV) return
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const incoming = reg.installing
          if (!incoming) return
          incoming.addEventListener('statechange', () => {
            // A worker that reaches "installed" while another controls the page
            // is a genuinely new build; without a controller it's the first install.
            if (incoming.state === 'installed' && navigator.serviceWorker.controller) onUpdate()
          })
        })
      })
      .catch((e) => console.error('service worker registration failed:', e))
  })
}

/** Activates the waiting worker and reloads onto the new build. */
export function applyUpdate() {
  navigator.serviceWorker.getRegistration().then((reg) => {
    const waiting = reg?.waiting
    if (!waiting) return window.location.reload()
    // Reload once the new worker takes control, not before.
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
      once: true,
    })
    waiting.postMessage('skip-waiting')
  })
}
