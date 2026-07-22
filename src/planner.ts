/** A drop target: the day it stands for, plus where it sits on the page. */
export type Zone = { key: string; left: number; top: number; right: number; bottom: number }

/** The pool zone's key — dropping there clears the day and hands the task back
 *  to the auto-scheduler. */
export const POOL = 'pool'

/**
 * Which drop zone a released chip landed on, or null if it was dropped in open
 * space (the chip then springs back and nothing changes).
 *
 * Pure, and in page coordinates on purpose: Motion reports the pointer as
 * pageX/pageY while getBoundingClientRect() is viewport-relative, so the caller
 * adds the scroll offset once, when building zones, rather than everywhere.
 * Lives outside the component so the self-check can import the real function
 * instead of a copy that could drift from it.
 */
export function zoneAt(x: number, y: number, zones: Zone[]): string | null {
  for (const z of zones) {
    if (x >= z.left && x <= z.right && y >= z.top && y <= z.bottom) return z.key
  }
  return null
}
