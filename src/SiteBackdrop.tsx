import {
  Leaf,
  TreeEvergreen,
  Waves,
  Fish,
  Snowflake,
  Mountains,
  PersonSimpleSnowboard,
  FlagPennant,
} from '@phosphor-icons/react'
import type { ThemeKey } from './store'

/**
 * A faint repeating pattern behind everything, built from two of the theme's
 * own Phosphor icons (the same family used everywhere else in the app,
 * rather than a hand-drawn shape) instead of a generic dot grid — empty
 * canvas echoes the app's own visual language instead of a stock texture.
 *
 * The repeat unit holds four instances (three primary + one secondary icon,
 * at varied size/rotation/opacity) rather than one icon stamped identically
 * — still a true repeating tile, just large enough that it doesn't read as
 * a printed grid.
 *
 * An SVG <pattern>, not a CSS background-image data URI: a data URI is
 * rendered in an isolated context that can't see this document's CSS
 * variables, so --muted would have to be baked in as eight separate
 * hardcoded hex fallbacks (one per theme x mode). A live <pattern> in the DOM
 * (with the icons nested inside it, each its own little <svg>) reads
 * currentColor normally, no baked-in color needed.
 *
 * Static, not animated — this sits behind every screen at all times, not
 * just the focus overlay, so constant motion here would work against the
 * calm the rest of the app is built around.
 */
const UNIT = 280

/** [xOffset, yOffset, size, rotateDeg, opacity], primary icon three times. */
const PRIMARY_SPOTS = [
  [40, 50, 22, 0, 1],
  [190, 34, 15, 24, 0.65],
  [220, 220, 13, -30, 0.55],
] as const

/** One secondary icon per unit, for rhythm. */
const SECONDARY_SPOT = [135, 165, 19, -14, 0.8] as const

const MOTIFS: Record<ThemeKey, { primary: typeof Leaf; secondary: typeof Leaf }> = {
  forest: { primary: Leaf, secondary: TreeEvergreen },
  sea: { primary: Waves, secondary: Fish },
  snow: { primary: Snowflake, secondary: Mountains },
  snowpark: { primary: PersonSimpleSnowboard, secondary: FlagPennant },
}

export function SiteBackdrop({ theme }: { theme: ThemeKey }) {
  const { primary: Primary, secondary: Secondary } = MOTIFS[theme]
  const [sx, sy, ssize, srotate, sopacity] = SECONDARY_SPOT
  return (
    <svg
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full text-muted opacity-[0.18]"
      aria-hidden
    >
      <defs>
        <pattern id="site-backdrop" width={UNIT} height={UNIT} patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
          {PRIMARY_SPOTS.map(([x, y, size, rotate, opacity], i) => (
            <Primary
              key={i}
              x={x}
              y={y}
              size={size}
              weight="light"
              opacity={opacity}
              style={{ transformOrigin: `${x + size / 2}px ${y + size / 2}px`, transform: `rotate(${rotate}deg)` }}
            />
          ))}
          <Secondary
            x={sx}
            y={sy}
            size={ssize}
            weight="light"
            opacity={sopacity}
            style={{ transformOrigin: `${sx + ssize / 2}px ${sy + ssize / 2}px`, transform: `rotate(${srotate}deg)` }}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#site-backdrop)" />
    </svg>
  )
}
