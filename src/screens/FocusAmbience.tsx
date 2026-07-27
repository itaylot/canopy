import { motion, useReducedMotion } from 'motion/react'
import type { ThemeKey } from '../store'

/**
 * A whisper of movement over the still focus artwork.
 *
 * The brief was "life, but nothing that pulls the eye" — so this is a handful of
 * very small, very slow, very translucent elements, never more than a dozen.
 * Following the Stars pattern in CanopyScene: positions are a fixed table, never
 * Math.random(), so a re-render can't reshuffle them mid-session, and reduced
 * motion stops everything rather than merely slowing it.
 */

/** [xPercent, yPercent, seed] — hand-placed to avoid the timer's corners. */
const DRIFT = [
  [12, 22, 0], [28, 14, 1], [41, 31, 2], [55, 19, 3],
  [67, 27, 4], [79, 12, 5], [88, 24, 6], [34, 8, 7],
] as const

const FALL = [
  [9, 0], [21, 1], [33, 2], [45, 3], [57, 4],
  [69, 5], [81, 6], [93, 7], [15, 8], [63, 9],
] as const

/** Sun glints on water: slow horizontal shimmer, low on the frame. */
function SeaGlints({ reduce }: { reduce: boolean }) {
  return (
    <>
      {DRIFT.map(([x, y, i]) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ left: `${x}%`, top: `${62 + (y % 7) * 4}%`, width: 2 + (i % 3), height: 1.5 }}
          animate={
            reduce
              ? { opacity: 0.25 }
              : { opacity: [0, 0.5, 0], x: [0, 14 + i * 2, 0] }
          }
          transition={{
            duration: 9 + i * 1.4,
            repeat: reduce ? 0 : Infinity,
            ease: 'easeInOut',
            delay: i * 1.1,
          }}
        />
      ))}
    </>
  )
}

/** Snowflakes: a slow, sparse fall with a little sideways wander. */
function Snowfall({ reduce, windy }: { reduce: boolean; windy: boolean }) {
  if (reduce) return null // falling motion has no meaningful still state
  return (
    <>
      {FALL.map(([x, i]) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ left: `${x}%`, top: '-2%', width: 2 + (i % 2), height: 2 + (i % 2) }}
          animate={{
            y: ['0vh', '104vh'],
            x: [0, (windy ? 40 : 18) * (i % 2 ? 1 : -1), 0],
            opacity: [0, 0.55, 0.55, 0],
          }}
          transition={{
            duration: (windy ? 16 : 22) + i * 2,
            repeat: Infinity,
            ease: 'linear',
            delay: i * (windy ? 1.6 : 2.3),
          }}
        />
      ))}
    </>
  )
}

/** Leaves drifting across the canopy — sideways, unhurried, half-transparent. */
function LeafDrift({ reduce }: { reduce: boolean }) {
  if (reduce) return null
  return (
    <>
      {DRIFT.slice(0, 6).map(([x, y, i]) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-[#c9d8a8]"
          style={{ left: `${x}%`, top: `${y + 28}%`, width: 3, height: 2 }}
          animate={{
            x: [0, 60 + i * 12],
            y: [0, 18 + (i % 3) * 10],
            opacity: [0, 0.4, 0],
            rotate: [0, 120],
          }}
          transition={{
            duration: 18 + i * 3,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 2.8,
          }}
        />
      ))}
    </>
  )
}

export function FocusAmbience({ theme }: { theme: ThemeKey }) {
  const reduce = useReducedMotion() ?? false
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {theme === 'sea' && <SeaGlints reduce={reduce} />}
      {theme === 'snow' && <Snowfall reduce={reduce} windy={false} />}
      {theme === 'snowpark' && <Snowfall reduce={reduce} windy />}
      {theme === 'forest' && <LeafDrift reduce={reduce} />}
    </div>
  )
}
