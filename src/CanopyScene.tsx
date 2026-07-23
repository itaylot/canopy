import { useEffect, useMemo, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useStore, type ThemeKey } from './store'
import { useResolvedDark } from './theme'

// Illustration coordinate space — every background is normalized to 1400×700.
const W = 1400
const H = 700
const MAX_NODES = 7

/**
 * A scene is an illustrated background with a live overlay (checkpoints + a
 * traveller) drawn in the illustration's coordinate space. Each theme has one.
 *
 * The traveller moves along a Bézier curve set by three anchors (a → c → b).
 * In the forest that curve is a rope the app draws and the rider hangs beneath
 * it; in the other scenes the curve follows a line already painted into the art
 * (a wave, a piste) so the app draws no line and the character sits on top.
 */
type Scene = {
  src: string
  character: string
  a: { x: number; y: number }
  b: { x: number; y: number }
  c: { x: number; y: number }
  /** Rope colour, or null when the path is part of the art (no line drawn). */
  rope: string | null
  /** Traveller width as % of scene width. */
  riderW: number
  /** Vertical nudge of the traveller in %: forest hangs (~-1.5), the others
   *  sit on the line (more negative — the sprite sits above its contact point). */
  riderDy: number
  /** Filter applied to the background image in dark mode. */
  darkFilter: string
  /** Star field in dark mode (forest night keeps its stars). */
  stars?: boolean
}

const NIGHT = 'saturate(0.5) brightness(0.55) hue-rotate(185deg) contrast(1.08)'
const DUSK = 'saturate(0.8) brightness(0.62)'

export const SCENES: Record<ThemeKey, Scene> = {
  forest: {
    src: '/scene-bg-min.png',
    character: '/rider-clean.png',
    a: { x: 133, y: 430 }, c: { x: 700, y: 560 }, b: { x: 1313, y: 494 },
    rope: '#a07b3f',
    riderW: 8.5,
    riderDy: -1.5,
    darkFilter: NIGHT,
    stars: true,
  },
  // The anchors below were calibrated against each illustration so the
  // checkpoints land on the line that is actually painted there — the same way
  // the forest's sit on the rope. riderDy is the sprite's own height as a % of
  // the scene, so its board/skis rest on that line rather than float above it.
  //
  // sea: follows the wave crest.
  sea: {
    src: '/scene-sea.png',
    character: '/rider-surf.png',
    a: { x: 140, y: 544 }, c: { x: 720, y: 371 }, b: { x: 1300, y: 500 },
    rope: null,
    riderW: 9,
    riderDy: -15.5,
    darkFilter: DUSK,
  },
  // snow: follows the piste down the slope, ending before the right-hand trees.
  snow: {
    src: '/scene-snow.png',
    character: '/rider-ski.png',
    a: { x: 140, y: 388 }, c: { x: 645, y: 479 }, b: { x: 1150, y: 639 },
    rope: null,
    riderW: 9,
    riderDy: -15.2,
    darkFilter: DUSK,
  },
  // snowpark: passes over the rail, the box and the kicker in turn.
  snowpark: {
    src: '/scene-snowpark.png',
    character: '/rider-snowboard.png',
    a: { x: 140, y: 381 }, c: { x: 630, y: 523 }, b: { x: 1120, y: 630 },
    rope: null,
    riderW: 9,
    riderDy: -14.7,
    darkFilter: DUSK,
  },
}

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
 * The progress metaphor: an illustrated background with a live overlay for the
 * parts that change — the checkpoints and the traveller, who waits at the first
 * unfinished task and glides forward as tasks are completed.
 */
export function CanopyScene({ done, remaining }: { done: number; remaining: number }) {
  const reduce = useReducedMotion()
  const theme = useStore((s) => s.theme)
  const dark = useResolvedDark()
  const scene = SCENES[theme]
  const ropePoint = useMemo(() => makeRopePoint(scene), [scene])
  const total = Math.min(done + remaining, MAX_NODES)
  const doneShown = total === 0 ? 0 : Math.min(done, total)

  const nodeT = (i: number) =>
    0.16 + (0.68 * (i + (total === 1 ? 0.5 : 0))) / Math.max(total - 1, 1)

  const nodes = Array.from({ length: total }, (_, i) => ({
    ...ropePoint(nodeT(i)),
    state: i < doneShown ? 'done' : i === doneShown ? 'current' : 'todo',
  }))

  // Where the traveller sits, as a position along the curve (0 = near, 1 = far).
  const riderT =
    total === 0 ? 0.5 : doneShown >= total ? 0.92 : nodeT(doneShown)

  const riderW = scene.riderW

  // Travel along the *curve* rather than straight between checkpoints: sample
  // the curve between the last position and the new one and hand the samples to
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
      top: pts.map((p) => (p.y / H) * 100 + scene.riderDy),
    }
    // `from` is a ref read: intentionally not a dependency, riderT drives it.
  }, [riderT, distance, from, ropePoint, riderW, scene.riderDy])

  return (
    <div className="relative w-full overflow-hidden" role="img" aria-label="מסלול ההתקדמות">
      <img
        src={scene.src}
        alt=""
        className="block w-full transition-[filter] duration-700"
        style={{ filter: dark ? scene.darkFilter : undefined }}
      />
      {dark && scene.stars && <Stars />}

      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
        {scene.rope && (
          <path
            d={`M ${scene.a.x} ${scene.a.y} Q ${scene.c.x} ${scene.c.y} ${scene.b.x} ${scene.b.y}`}
            stroke={scene.rope}
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />
        )}
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
                fill={n.state === 'done' ? 'var(--primary)' : 'var(--surface)'}
                stroke={n.state === 'done' ? 'none' : 'var(--line)'}
                strokeWidth="3"
                strokeDasharray={n.state === 'todo' ? '8 8' : undefined}
              />
            )}
            {n.state === 'done' && (
              <path
                d={`M ${n.x - 14} ${n.y} L ${n.x - 3} ${n.y + 11} L ${n.x + 15} ${n.y - 13}`}
                stroke="var(--surface)"
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
          src={scene.character}
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
