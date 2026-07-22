/* Canopy service worker — makes the app open without a network.
 *
 * Strategy, and why:
 *   navigations      network-first, cached shell as fallback. Being online must
 *                    always give the newest index.html, otherwise a deploy would
 *                    never reach anyone; offline still opens the app.
 *   /assets/*        cache-first. Vite fingerprints these filenames with a
 *                    content hash, so a given URL's bytes never change — there
 *                    is nothing to revalidate, and a new build asks for new URLs.
 *   images, icons    stale-while-revalidate. Shown instantly, refreshed quietly.
 *
 * Deliberately NOT touched: anything cross-origin (Firestore, Google auth,
 * fonts) and the /__/ paths Firebase Hosting reserves for the auth handler.
 * Caching a sign-in flow breaks it in ways that are miserable to debug.
 */
const VERSION = 'v2'
const SHELL = `canopy-shell-${VERSION}`
const ASSETS = `canopy-assets-${VERSION}`
const MEDIA = `canopy-media-${VERSION}`
const KEEP = [SHELL, ASSETS, MEDIA]

const SHELL_URLS = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

/**
 * Precache the shell *and* the JS/CSS it needs to boot.
 *
 * This worker is a plain static file, so it cannot know the content-hashed
 * filenames Vite generates. It reads them out of index.html instead, which
 * keeps it correct across every deploy with no build step. Without this the
 * shell would come back offline and then render nothing, because the scripts
 * it points at were never cached.
 */
async function precache() {
  const shell = await caches.open(SHELL)
  await Promise.allSettled(SHELL_URLS.map((u) => shell.add(u)))
  try {
    const res = await fetch('/', { cache: 'reload' })
    if (!res.ok) return
    const html = await res.text()
    await shell.put('/', new Response(html, { headers: res.headers }))
    const urls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
    const assets = await caches.open(ASSETS)
    await Promise.allSettled(urls.map((u) => assets.add(u)))
  } catch {
    // Installed offline: runtime caching will fill these in on the next visit.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// Let the page trigger activation of a waiting worker (see registerSW).
self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting()
})

const isAsset = (p) => p.startsWith('/assets/')
const isMedia = (p) => /\.(png|jpe?g|svg|webp|ico)$/.test(p)

/**
 * ignoreVary matters more than it looks. A module script is requested with an
 * Origin header, and the host answers "Vary: Origin"; the same file precached
 * via cache.add() was stored under a request without it. With the default
 * matching rules that counts as a miss, so offline the app fetched its own
 * scripts from a network that wasn't there and rendered a blank page.
 */
const match = (request) => caches.match(request, { ignoreVary: true })

async function cacheFirst(request, cacheName) {
  const cached = await match(request)
  if (cached) return cached
  const res = await fetch(request)
  if (res.ok) (await caches.open(cacheName)).put(request, res.clone())
  return res
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await match(request)
  const network = fetch(request)
    .then(async (res) => {
      if (res.ok) (await caches.open(cacheName)).put(request, res.clone())
      return res
    })
    .catch(() => cached)
  return cached || network
}

async function networkFirstShell(request) {
  try {
    const res = await fetch(request)
    if (res.ok) (await caches.open(SHELL)).put('/', res.clone())
    return res
  } catch {
    // Offline: any cached shell will do — the SPA renders the route itself.
    return (await match('/')) || (await match(request)) || Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // Firestore, Google, fonts
  if (url.pathname.startsWith('/__/')) return // Firebase auth handler

  if (request.mode === 'navigate') return event.respondWith(networkFirstShell(request))
  if (isAsset(url.pathname)) return event.respondWith(cacheFirst(request, ASSETS))
  if (isMedia(url.pathname)) return event.respondWith(staleWhileRevalidate(request, MEDIA))
})
