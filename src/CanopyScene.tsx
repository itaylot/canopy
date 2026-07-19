import { motion, useReducedMotion } from 'motion/react'

const W = 400
const H = 190
const MAX_NODES = 7

// Rope anchors (on the tree platforms) and its sag control point.
const P0 = { x: 92, y: 76 }
const P1 = { x: 200, y: 120 }
const P2 = { x: 308, y: 76 }

// Point on the quadratic bezier that the rope is drawn with, so the nodes and
// the rider sit exactly on the visible curve instead of an approximation.
function ropePoint(t: number) {
  const u = 1 - t
  return {
    x: u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x,
    y: u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y,
  }
}

function Tree({ x, scale = 1, flip = false }: { x: number; scale?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x}, 0) scale(${flip ? -scale : scale}, ${scale}) translate(${flip ? -0 : 0}, 0)`}>
      <rect x="-6" y="-16" width="12" height="78" rx="5" fill="var(--bark)" />
      <path d="M0 6 L-13 -6" stroke="var(--bark)" strokeWidth="5" strokeLinecap="round" />
      <path d="M0 12 L12 2" stroke="var(--bark)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="-20" cy="-24" r="19" fill="var(--tree-2)" />
      <circle cx="20" cy="-26" r="18" fill="var(--primary)" />
      <circle cx="0" cy="-44" r="23" fill="var(--tree-2)" />
      <circle cx="0" cy="-22" r="23" fill="var(--primary)" />
      <circle cx="-15" cy="-45" r="15" fill="var(--primary)" />
      <circle cx="16" cy="-46" r="14" fill="var(--tree-2)" />
      {/* platform the rope is tied to */}
      <rect x="-13" y="-8" width="26" height="8" rx="2.5" fill="#c0925f" />
      <rect x="-13" y="2" width="26" height="6" rx="2" fill="#a87c4d" />
    </g>
  )
}

function Rider() {
  return (
    <g>
      {/* trolley + sling */}
      <circle cx="0" cy="0" r="3.4" fill="none" stroke="#5b6b73" strokeWidth="2" />
      <path d="M0 3 L0 9" stroke="#5b6b73" strokeWidth="1.8" strokeLinecap="round" />
      {/* rider: helmet, vest, legs */}
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
 * The progress metaphor: a zipline strung between two trees. Each completed
 * task is a node already passed; the rider sits at the current position.
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
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="block" role="img" aria-label="מסלול ההתקדמות">
      {/* hills */}
      <path d="M0 150 Q 110 118 210 146 T 400 136 L400 190 L0 190 Z" fill="var(--tree-2)" opacity="0.28" />
      <path d="M0 166 Q 130 136 250 164 T 400 158 L400 190 L0 190 Z" fill="var(--primary)" opacity="0.16" />

      <Tree x={92} scale={1} />
      <Tree x={308} scale={0.82} />

      {/* rope */}
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
