/**
 * Pure geometry for FocusDial's 270° radial picker — a full 360° circle has
 * no obvious start/end, so it opens a 90° gap at the bottom, same idea as a
 * speedometer. Split out of FocusDial.tsx (no JSX, no browser APIs) so the
 * self-check can import the real math instead of a copy that could drift
 * from it — same reason planner.ts's zoneAt/tapGuard live outside WeekPlanner.
 */
export const CX = 110
export const CY = 110
export const VIEWBOX = 220
export const R_ARC = 95
export const R_TICK = 100
export const R_HANDLE = 95
/** Hit-test radius, bigger than the visible ring so the whole disc is
 *  draggable, not just the thin arc stroke. */
export const R_HIT = 108
export const START = -135
export const SWEEP = 270

/** The angle (0 = top, clockwise+) of preset index `i` out of `n` presets,
 *  evenly spaced across the sweep. */
export const angleFor = (i: number, n: number) => START + (i / (n - 1)) * SWEEP

/** A point at the given angle and radius from the dial's center. */
export function pt(angleDeg: number, r: number) {
  const a = (angleDeg * Math.PI) / 180
  return { x: CX + r * Math.sin(a), y: CY - r * Math.cos(a) }
}

/** SVG arc path between two angles at a fixed radius. */
export function arcPath(a0: number, a1: number, r: number) {
  const p0 = pt(a0, r)
  const p1 = pt(a1, r)
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`
}

/** Which of `n` preset positions a raw angle is closest to. */
export function nearestIndex(deg: number, n: number): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < n; i++) {
    const d = Math.abs(angleFor(i, n) - deg)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

/** Clamps a raw pointer angle into the dial's sweep. A pointer in the 90°
 *  gap snaps to whichever edge (START or START+SWEEP) is angularly nearer —
 *  a naive fold-then-clamp instead sometimes jumped to the FAR edge for a
 *  pointer just past one boundary, teleporting the handle 270° across the
 *  dial for a few degrees of pointer movement. */
export function clampAngle(deg: number): number {
  const d = (((deg + 180) % 360) + 360) % 360 - 180 // normalize to (-180, 180]
  const end = START + SWEEP
  if (d >= START && d <= end) return d
  const circularDist = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
  return circularDist(d, START) <= circularDist(d, end) ? START : end
}
