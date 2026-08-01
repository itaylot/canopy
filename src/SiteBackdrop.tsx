import type { ThemeKey } from './store'

/**
 * A faint repeating pattern behind everything, built from the theme's own
 * motif (the same leaf / wave / snowflake / board drawn on the focus dial's
 * rim) instead of a generic dot grid — empty canvas echoes the app's own
 * visual language instead of a stock texture.
 *
 * An SVG <pattern> tile, not a CSS background-image data URI: a data URI is
 * rendered in an isolated context that can't see this document's CSS
 * variables, so --muted would have to be baked in as eight separate
 * hardcoded hex fallbacks (one per theme x mode). A live <pattern> in the DOM
 * reads currentColor normally, one path.
 *
 * Static, not animated — this sits behind every screen at all times, not
 * just the focus overlay, so constant motion here would work against the
 * calm the rest of the app is built around.
 */
const TILE = 140

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
    <svg
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full text-muted opacity-[0.16]"
      aria-hidden
    >
      <defs>
        <pattern id="site-backdrop" width={TILE} height={TILE} patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
          <g transform={`translate(${TILE / 2 - 8} ${TILE / 2 - 8})`} fill="currentColor">
            <Motif />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#site-backdrop)" />
    </svg>
  )
}
