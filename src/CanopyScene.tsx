import { useEffect, useMemo, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useStore, type SceneKey } from './store'

// Illustration coordinate space (matches scene-bg-min.png at 1400x700).
const W = 1400
const H = 700
const MAX_NODES = 7

/**
 * Backgrounds are data, not code. Each scene carries its own rope anchors,
 * because the overlay is drawn in the illustration's coordinate space — art
 * with a different composition needs its own a/b/c or the rope misses the
 * trees. Adding a background = drop a PNG in /public, add a row here.
 */
type Scene = {
  label: string
  src: string
  /** Rope anchors: the two tree platforms + the sag control point between them. */
  a: { x: number; y: number }
  b: { x: number; y: number }
  c: { x: number; y: number }
  rope: string
  /** Applied to the background image only, never to the overlay. */
  filter?: string
  dark?: boolean
}

// Calibrated against scene-bg-min.png. If that art changes, re-tune these three.
const FOREST_ANCHORS = {
  a: { x: 133, y: 430 },
  b: { x: 1313, y: 494 },
  c: { x: 700, y: 560 },
}

export const SCENES: Record<'forest' | 'night', Scene> = {
  forest: { label: 'יער · יום', src: '/scene-bg-min.png', ...FOREST_ANCHORS, rope: '#a07b3f' },
  // Night reuses the daytime art through a filter instead of a second asset:
  // same composition, so the anchors carry over untouched and there's nothing
  // extra to download. A dedicated night illustration can replace `src` later.
  night: {
    label: 'יער · לילה',
    src: '/scene-bg-min.png',
    ...FOREST_ANCHORS,
    rope: '#d8b981',
    filter: 'saturate(0.5) brightness(0.55) hue-rotate(185deg) contrast(1.08)',
    dark: true,
  },
}

/** 'auto' follows the clock; anything else is the user's explicit pick. */
export const resolveScene = (pref: SceneKey, hour: number): Scene =>
  pref === 'forest' || pref === 'night' ? SCENES[pref] : hour >= 20 || hour < 6 ? SCENES.night : SCENES.forest

/** Short hop between neighbouring checkpoints, slow victory glide when the
 *  day's route is finished — the completion moment should be watchable. */
const glideDuration = (distance: number, finishing: boolean) =>
  distance < 0.001 ? 0 : finishing ? 1.9 : Math.min(1.2, 0.45 + distance * 2)

const makeRopePoint = (s: Scene) => (t: number) => {
  const u = 1 - t
  return {
    x: u * u * s.a.x + 2 * u * t * s.c.x + t * t * s.b.x,
    y: u * u * s.a.y + 2 * u * t * s.c.y + t * t * s.b.y,
  }
}

/** Fixed positions, not random: a re-render must not reshuffle the sky. */
const STAR_POS = [
  [8, 12], [17, 26], [26, 8], [35, 19], [44, 30], [52, 11],
  [61, 22], [70, 9], [78, 27], [86, 15], [93, 31], [12, 38],
] as const

function Stars() {
  const reduce = useReducedMotion()
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {STAR_POS.map(([x, y], i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ left: `${x}%`, top: `${y}%`, width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2 }}
          animate={reduce ? { opacity: 0.7 } : { opacity: [0.35, 0.9, 0.35] }}
          transition={{ duration: 2.6 + (i % 4) * 0.7, repeat: reduce ? 0 : Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

/**
 * The progress metaphor, mockup-grade: an illustrated forest background
 * (generated art) with a live SVG overlay for the parts that change - the
 * rope checkpoints and the rider, who hangs at the first unfinished task.
 */
export function CanopyScene({ done, remaining }: { done: number; remaining: number }) {
  const reduce = useReducedMotion()
  const pref = useStore((s) => s.scene)
  const scene = resolveScene(pref, new Date().getHours())
  const ropePoint = useMemo(() => makeRopePoint(scene), [scene])
  const total = Math.min(done + remaining, MAX_NODES)
  const doneShown = total === 0 ? 0 : Math.min(done, total)

  const nodeT = (i: number) =>
    0.16 + (0.68 * (i + (total === 1 ? 0.5 : 0))) / Math.max(total - 1, 1)

  const nodes = Array.from({ length: total }, (_, i) => ({
    ...ropePoint(nodeT(i)),
    state: i < doneShown ? 'done' : i === doneShown ? 'current' : 'todo',
  }))

  // Where the rider hangs, as a position along the rope (0 = near tree, 1 = far).
  const riderT =
    total === 0
      ? 0.5
      : doneShown >= total
        ? 0.92 // route finished: rider glides off toward the far tree
        : nodeT(doneShown)

  // The rider PNG is trimmed so the pulley wheel sits at its very top center.
  const riderW = 8.5 // % of scene width

  // Travel along the *curve* rather than straight between checkpoints: sample
  // the rope between the last position and the new one and hand the samples to
  // Motion as keyframes. Finishing the day is a longer, more deliberate glide.
  const prevT = useRef(riderT)
  const from = prevT.current
  const distance = Math.abs(riderT - from)
  const finishing = doneShown >= total && total > 0
  useEffect(() => {
    prevT.current = riderT
  }, [riderT])

  const path = useMemo(() => {
    const steps = distance < 0.001 ? 1 : Math.max(2, Math.round(distance * 40))
    const pts = Array.from({ length: steps + 1 }, (_, i) => ropePoint(from + ((riderT - from) * i) / steps))
    return {
      left: pts.map((p) => (p.x / W) * 100 - riderW / 2),
      top: pts.map((p) => (p.y / H) * 100 - 1.5),
    }
    // `from` is a ref read: intentionally not a dependency, riderT drives it.
  }, [riderT, distance, from, ropePoint])

  return (
    <div className="relative w-full overflow-hidden" role="img" aria-label="מסלול ההתקדמות">
      <img
        src={scene.src}
        alt=""
        className="block w-full transition-[filter] duration-700"
        style={{ filter: scene.filter }}
      />
      {scene.dark && <Stars />}

      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
        <path
          d={`M ${scene.a.x} ${scene.a.y} Q ${scene.c.x} ${scene.c.y} ${scene.b.x} ${scene.b.y}`}
          stroke={scene.rope}
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />
        {nodes.map((n, i) => (
          <motion.g
            key={i}
            initial={reduce ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: reduce ? 0 : i * 0.05 }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
          >
            {n.state === 'current' && <circle cx={n.x} cy={n.y} r="52" fill="var(--accent)" opacity="0.25" />}
            {n.state !== 'current' && (
              <circle
                cx={n.x}
                cy={n.y}
                r={n.state === 'done' ? 34 : 30}
                fill={n.state === 'done' ? '#4c7b39' : '#fdfdf9'}
                stroke={n.state === 'done' ? 'none' : '#d9d5c0'}
                strokeWidth="3"
                strokeDasharray={n.state === 'todo' ? '8 8' : undefined}
              />
            )}
            {n.state === 'done' && (
              <path
                d={`M ${n.x - 14} ${n.y} L ${n.x - 3} ${n.y + 11} L ${n.x + 15} ${n.y - 13}`}
                stroke="#fff"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            )}
          </motion.g>
        ))}
      </svg>

      {total > 0 && (
        <motion.img
          src="/rider-clean.png"
          alt=""
          className="absolute"
          style={{ width: `${riderW}%` }}
          initial={false}
          animate={{
            left: reduce ? `${path.left[path.left.length - 1]}%` : path.left.map((v) => `${v}%`),
            top: reduce ? `${path.top[path.top.length - 1]}%` : path.top.map((v) => `${v}%`),
            y: reduce ? 0 : [0, -4, 0],
          }}
          transition={{
            left: { duration: reduce ? 0 : glideDuration(distance, finishing), ease: 'easeInOut' },
            top: { duration: reduce ? 0 : glideDuration(distance, finishing), ease: 'easeInOut' },
            y: { duration: 3, repeat: reduce ? 0 : Infinity, ease: 'easeInOut' },
          }}
        />
      )}
    </div>
  )
}
