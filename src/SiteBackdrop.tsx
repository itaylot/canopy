import type { ThemeKey } from './store'

/**
 * A whisper of the theme's own visual language scattered very faintly behind
 * everything — replaces a generic dot grid with the same small motifs already
 * drawn on the focus dial's rim (leaf / wave / snowflake / board), so empty
 * canvas reads as "this app" rather than as a stock texture.
 *
 * Fixed, not animated: this sits behind every screen all the time, not just
 * the immersive focus overlay, so constant motion here would be the opposite
 * of quiet. Positions are a hand-placed table, never Math.random(), so a
 * re-render can't reshuffle them — same reasoning as FocusAmbience/Stars.
 */

/** [xPercent, yPercent, scale, rotateDeg] */
const SPOTS = [
  [6, 12, 1, -8],
  [92, 8, 0.8, 14],
  [14, 88, 1.1, 5],
  [85, 92, 0.9, -12],
  [48, 5, 0.7, 0],
  [4, 50, 0.85, 10],
  [95, 55, 1, -6],
  [30, 96, 0.8, 8],
  [65, 96, 0.9, -4],
  [22, 30, 0.6, 18],
  [78, 34, 0.65, -16],
  [55, 68, 0.75, 6],
] as const

function Leaf() {
  return <path d="M8 1.5C4 2 2 5 2 9c0 2.8 1.9 4.6 4.5 4.9-.4-2-.2-4 .5-5.9.7 1.9.9 3.9.5 5.9C10.1 13.6 12 11.8 12 9c0-4-2-7.5-4-7.5Z" />
}

function Wave() {
  return (
    <>
      <path d="M1 6c1.5-2 3-2 4.5 0S8 8 9.5 6 12.5 4 14 6" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
      <path
        d="M1 10.5c1.5-2 3-2 4.5 0s2.5 2 4 0 3-2 4.5 0"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        opacity={0.55}
      />
    </>
  )
}

function Snowflake() {
  return (
    <g stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
      <line x1="8" y1="1" x2="8" y2="15" />
      <line x1="2.2" y1="4.5" x2="13.8" y2="11.5" />
      <line x1="2.2" y1="11.5" x2="13.8" y2="4.5" />
    </g>
  )
}

function Board() {
  return <rect x="1.5" y="6.7" width="13" height="2.8" rx="1.4" transform="rotate(-18 8 8)" />
}

const MOTIF: Record<ThemeKey, () => React.JSX.Element> = {
  forest: Leaf,
  sea: Wave,
  snow: Snowflake,
  snowpark: Board,
}

export function SiteBackdrop({ theme }: { theme: ThemeKey }) {
  const Motif = MOTIF[theme]
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden text-line" aria-hidden>
      {SPOTS.map(([x, y, scale, rotate], i) => (
        <svg
          key={i}
          viewBox="0 0 16 16"
          width={20 * scale}
          height={20 * scale}
          fill="currentColor"
          className="absolute opacity-60"
          style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) rotate(${rotate}deg)` }}
        >
          <Motif />
        </svg>
      ))}
    </div>
  )
}
