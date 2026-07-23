import { useEffect, useState } from 'react'
import { useStore, isDark, themedCourseColor, type ThemeKey } from './store'

/** Label + sidebar-banner art per theme. The scene illustration (background,
 *  character, rope anchors) lives in CanopyScene, keyed by the same ThemeKey. */
export const THEME_META: Record<ThemeKey, { label: string; sidebar: string }> = {
  forest: { label: 'יער', sidebar: '/sidebar-bg.png' },
  sea: { label: 'ים', sidebar: '/sidebar-sea.png' },
  snow: { label: 'סקי', sidebar: '/sidebar-snow.png' },
  snowpark: { label: 'סנואו-פארק', sidebar: '/sidebar-snowpark.png' },
}

export const THEME_KEYS = Object.keys(THEME_META) as ThemeKey[]

const systemDark = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches

/**
 * Stamps `data-theme` / `data-mode` on <html> from the store, and mirrors both
 * to localStorage so the inline boot script in index.html can paint the right
 * palette on the very first frame — before the cloud doc (the source of truth)
 * has loaded. When mode is 'auto', follows the device live.
 */
export function useApplyTheme() {
  const theme = useStore((s) => s.theme)
  const mode = useStore((s) => s.mode)
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      root.dataset.theme = theme
      root.dataset.mode = isDark(mode, systemDark()) ? 'dark' : 'light'
      // The browser chrome / PWA status bar is painted from this meta tag; read
      // the resolved token so it always matches whatever the palette just became.
      const meta = document.querySelector('meta[name="theme-color"]')
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
      if (meta && bg) meta.setAttribute('content', bg)
    }
    apply()
    try {
      localStorage.setItem('canopy-theme', theme)
      localStorage.setItem('canopy-mode', mode)
    } catch {
      // private mode / storage disabled — the cloud is still the source of truth
    }
    if (mode !== 'auto' || typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme, mode])
}

/** Whether the app is currently dark, reacting to store + live OS changes.
 *  Used by the scene to decide the night filter. */
export function useResolvedDark(): boolean {
  const mode = useStore((s) => s.mode)
  const [sys, setSys] = useState(systemDark)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const h = () => setSys(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return isDark(mode, sys)
}

/** Maps a course's stored colour onto the active theme's palette. */
export function useCourseColor() {
  const theme = useStore((s) => s.theme)
  return (stored?: string) => themedCourseColor(stored, theme)
}
