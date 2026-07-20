import { motion, useReducedMotion } from 'motion/react'

const W = 400
const H = 210
const MAX_NODES = 7

// Rope anchors sit on the tree platforms; P1 is the sag control point.
const P0 = { x: 86, y: 116 }
const P1 = { x: 200, y: 164 }
const P2 = { x: 320, y: 128 }

// Point on the quadratic bezier the rope is drawn with, so nodes and the
// rider sit exactly on the visible curve.
function ropePoint(t: number) {
  const u = 1 - t
  return {
    x: u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x,
    y: u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y,
  }
}

/**
 * Storybook-style tree built from overlapping canopy circles, mimicking the
 * brand illustration: two greens, a tapered trunk, and the wooden platform
 * band the rope ties into. Origin = base of the trunk.
 */
function Tree({ x, baseY, scale = 1 }: { x: number; baseY: number; scale?: number }) {
  return (
    <g transform={`translate(${x}, ${baseY}) scale(${scale})`}>
      {/* trunk, slightly tapered, with two stub branches reaching into the canopy */}
      <path d="M-7 0 L-5 -88 L5 -88 L7 0 Z" fill="var(--bark)" />
      <path d="M-4 -62 L-16 -74" stroke="var(--bark)" strokeWidth="5" strokeLinecap="round" />
      <path d="M4 -54 L15 -64" stroke="var(--bark)" strokeWidth="5" strokeLinecap="round" />
      {/* canopy: back layer in the lighter green, front in the deeper green */}
      <circle cx="-24" cy="-92" r="20" fill="var(--tree-2)" />
      <circle cx="24" cy="-94" r="19" fill="var(--tree-2)" />
      <circle cx="-10" cy="-112" r="18" fill="var(--tree-2)" />
      <circle cx="12" cy="-113" r="17" fill="var(--tree-2)" />
      <circle cx="0" cy="-96" r="24" fill="var(--primary)" />
      <circle cx="-17" cy="-102" r="15" fill="var(--primary)" />
      <circle cx="18" cy="-100" r="14" fill="var(--primary)" />
      {/* wooden platform band the rope anchors to */}
      <rect x="-14" y="-70" width="28" height="9" rx="3" fill="#c0925f" />
      <rect x="-14" y="-59" width="28" height="6" rx="2.4" fill="#a87c4d" />
    </g>
  )
}

/** Rider hanging from a pulley trolley, drawn below the rope point. */
function Rider() {
  return (
    <g>
      <circle cx="0" cy="0" r="3.4" fill="none" stroke="#5b6b73" strokeWidth="2" />
      <path d="M0 3 L0 9" stroke="#5b6b73" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="0" cy="13.5" r="4.6" fill="var(--primary)" />
      <path d="M-2 12 A 4.6 4.6 0 0 1 2 12" stroke="#3c6b41" strokeWidth="1.2" fill="none" />
      <rect x="-4" y="17" width="8" height="9" rx="2.6" fill="#e8a33d" />
      <path d="M-1 26 L-3 33" stroke="#26405c" strokeWidth="3" strokeLinecap="round" />
      <path d="M2 26 L7 31" stroke="#26405c" strokeWidth="3" strokeLinecap="round" />
      <path d="M2 18 L1 9" stroke="#e8a33d" strokeWidth="2.4" strokeLinecap="round" />
    </g>
  )
}

/**
 * The progress metaphor: a zipline strung between two trees. Every completed
 * task is a checkpoint already passed; the rider hangs at the current spot.
 */
export function CanopyScene({ done, remaining }: { done: number; remaining: number }) {
  const reduce = useReducedMotion()
  const total = Math.min(done + remaining, MAX_NODES)
  const doneShown = total === 0 ? 0 : Math.min(done, total)

  const nodes = Array.from({ length: total }, (_, i) => {
    const t = (i + 1) / (total + 1)
    return { ...ropePoint(t), state: i < doneShown ? 'done' : i === doneShown ? 'current' : 'todo' }
  })
  const riderAt = nodes[Math.min(doneShown, Math.max(total - 1, 0))] ?? ropePoint(0.5)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="mx-auto block max-w-xl" role="img" aria-label="מסלול ההתקדמות">
      {/* rolling hills, two soft layers */}
      <path d="M0 176 Q 100 148 200 170 T 400 162 L400 210 L0 210 Z" fill="var(--tree-2)" opacity="0.3" />
      <path d="M0 190 Q 130 164 260 188 T 400 182 L400 210 L0 210 Z" fill="var(--primary)" opacity="0.18" />

      <Tree x={72} baseY={190} />
      <Tree x={330} baseY={192} scale={0.82} />

      <path
        d={`M ${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}`}
        stroke="var(--bark)"
        strokeWidth="3"
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
          {n.state === 'current' && <circle cx={n.x} cy={n.y} r="15" fill="var(--accent)" opacity="0.22" />}
          <circle
            cx={n.x}
            cy={n.y}
            r={n.state === 'todo' ? 9 : 11}
            fill={n.state === 'done' ? 'var(--primary)' : n.state === 'current' ? 'var(--accent)' : 'var(--surface)'}
            stroke={n.state === 'todo' ? 'var(--line)' : 'none'}
            strokeWidth="2"
            strokeDasharray={n.state === 'todo' ? '3 3' : undefined}
          />
          {n.state === 'done' && (
            <path
              d={`M ${n.x - 4.5} ${n.y} L ${n.x - 1} ${n.y + 3.6} L ${n.x + 4.8} ${n.y - 4}`}
              stroke="#fff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}
        </motion.g>
      ))}

      {total > 0 && (
        <g transform={`translate(${riderAt.x}, ${riderAt.y})`}>
          <motion.g
            animate={reduce ? {} : { y: [0, -2.5, 0] }}
            transition={{ duration: 3, repeat: reduce ? 0 : Infinity, ease: 'easeInOut' }}
          >
            <Rider />
          </motion.g>
        </g>
      )}
    </svg>
  )
}
