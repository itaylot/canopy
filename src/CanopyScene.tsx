import { motion, useReducedMotion } from 'motion/react'

// Illustration coordinate space (matches scene-bg-min.png at 1400x700).
const W = 1400
const H = 700
const MAX_NODES = 7

// Rope anchors on the two tree platforms + sag control point, calibrated to
// the background art. If the art changes, re-tune these three points only.
const A = { x: 133, y: 430 }
const B = { x: 1313, y: 494 }
const C = { x: 700, y: 560 }

function ropePoint(t: number) {
  const u = 1 - t
  return {
    x: u * u * A.x + 2 * u * t * C.x + t * t * B.x,
    y: u * u * A.y + 2 * u * t * C.y + t * t * B.y,
  }
}

/**
 * The progress metaphor, mockup-grade: an illustrated forest background
 * (generated art) with a live SVG overlay for the parts that change - the
 * rope checkpoints and the rider, who hangs at the first unfinished task.
 */
export function CanopyScene({ done, remaining }: { done: number; remaining: number }) {
  const reduce = useReducedMotion()
  const total = Math.min(done + remaining, MAX_NODES)
  const doneShown = total === 0 ? 0 : Math.min(done, total)

  const nodes = Array.from({ length: total }, (_, i) => {
    const t = 0.16 + (0.68 * (i + (total === 1 ? 0.5 : 0))) / Math.max(total - 1, 1)
    return { ...ropePoint(t), state: i < doneShown ? 'done' : i === doneShown ? 'current' : 'todo' }
  })
  const riderAt =
    total === 0
      ? ropePoint(0.5)
      : doneShown >= total
        ? ropePoint(0.92) // route finished: rider glides off toward the far tree
        : nodes[doneShown]

  // The rider PNG is trimmed so the pulley wheel sits at its very top center.
  const riderW = 8.5 // % of scene width
  const riderH = riderW * (W / H) * 1.18 // aspect of the trimmed sprite

  return (
    <div className="relative w-full overflow-hidden" role="img" aria-label="מסלול ההתקדמות">
      <img src="/scene-bg-min.png" alt="" className="block w-full" />

      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
        <path
          d={`M ${A.x} ${A.y} Q ${C.x} ${C.y} ${B.x} ${B.y}`}
          stroke="#8c6a43"
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
                fill={n.state === 'done' ? 'var(--primary)' : '#fffefa'}
                stroke={n.state === 'done' ? 'none' : '#d8d2c2'}
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
          style={{
            width: `${riderW}%`,
            left: `calc(${(riderAt.x / W) * 100}% - ${riderW / 2}%)`,
            top: `${(riderAt.y / H) * 100 - 1.5}%`,
          }}
          animate={reduce ? {} : { y: [0, -4, 0] }}
          transition={{ duration: 3, repeat: reduce ? 0 : Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  )
}
