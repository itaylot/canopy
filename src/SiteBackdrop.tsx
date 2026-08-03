import { Leaf, Waves, Snowflake, PersonSimpleSnowboard } from '@phosphor-icons/react'
import type { ThemeKey } from './store'

/**
 * A faint repeating pattern behind everything, built from the theme's own
 * Phosphor icon (the same family used for every other icon in the app,
 * rather than a hand-drawn shape) instead of a generic dot grid — empty
 * canvas echoes the app's own visual language instead of a stock texture.
 *
 * An SVG <pattern> tile, not a CSS background-image data URI: a data URI is
 * rendered in an isolated context that can't see this document's CSS
 * variables, so --muted would have to be baked in as eight separate
 * hardcoded hex fallbacks (one per theme x mode). A live <pattern> in the DOM
 * (with the icon nested inside it, its own little <svg>) reads currentColor
 * normally, no baked-in color needed.
 *
 * Static, not animated — this sits behind every screen at all times, not
 * just the focus overlay, so constant motion here would work against the
 * calm the rest of the app is built around.
 */
const TILE = 140
const ICON_SIZE = 22

const MOTIF: Record<ThemeKey, typeof Leaf> = {
  forest: Leaf,
  sea: Waves,
  snow: Snowflake,
  snowpark: PersonSimpleSnowboard,
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
          <Motif x={(TILE - ICON_SIZE) / 2} y={(TILE - ICON_SIZE) / 2} size={ICON_SIZE} weight="light" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#site-backdrop)" />
    </svg>
  )
}
