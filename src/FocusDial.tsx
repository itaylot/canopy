import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { ThemeKey } from './store'
import { CX, CY, VIEWBOX, R_ARC, R_TICK, R_HANDLE, R_HIT, START, SWEEP, angleFor, pt, arcPath, nearestIndex, clampAngle } from './dialGeometry'

/**
 * A radial minute picker, one illustrated "watchface" per theme (public/
 * dial-<theme>.png) with a draggable marker running around a 270° rim.
 * Geometry lives in dialGeometry.ts, tested directly by schedule.check.mjs.
 */
export function FocusDial({
  theme,
  presets,
  value,
  onChange,
}: {
  theme: ThemeKey
  presets: readonly number[]
  value: number
  onChange: (minutes: number) => void
}) {
  const index = Math.max(0, presets.indexOf(value))
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const angle = angleFor(index, presets.length)
  const handlePt = pt(angle, R_HANDLE)
  const progressD = arcPath(START, angle, R_ARC)
  const trackD = arcPath(START, START + SWEEP, R_ARC)

  // clientX/Y are real screen pixels; the dial is drawn in a 220x220 viewBox
  // that may render at any CSS size, so map through the wrapper's own
  // bounding box rather than assuming a 1:1 pixel match.
  const angleFromPointer = (clientX: number, clientY: number) => {
    const rect = wrapRef.current!.getBoundingClientRect()
    const cx = rect.left + (CX / VIEWBOX) * rect.width
    const cy = rect.top + (CY / VIEWBOX) * rect.height
    const deg = (Math.atan2(clientX - cx, -(clientY - cy)) * 180) / Math.PI
    return clampAngle(deg)
  }

  const pick = (clientX: number, clientY: number) => {
    const next = presets[nearestIndex(angleFromPointer(clientX, clientY), presets.length)]
    if (next !== value) onChange(next)
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => pick(e.clientX, e.clientY)
    const onUp = () => setDragging(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // pick() closes over `value`/`onChange` freshly each render; re-subscribing
    // per drag-frame would be wasteful, so this intentionally only re-runs
    // when the drag itself starts or stops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging])

  return (
    <div ref={wrapRef} className="relative mx-auto h-[200px] w-[200px] shrink-0">
      <img
        src={`/dial-${theme}.png`}
        alt=""
        className="absolute inset-0 h-full w-full rounded-full object-cover shadow-card ring-1 ring-line"
      />

      {/* Native range: keyboard + screen-reader only, taken out of the pointer
          hit-test chain entirely (pointer-events:none). A fill:none SVG arc
          leaves the disc's empty space unpainted, so pointer drags there used
          to fall through to this input and move the value along a straight
          line instead of the circle — pointer-events:none doesn't affect
          keyboard focus or arrow-key operation, only mouse/touch hit-testing. */}
      <input
        type="range"
        min={0}
        max={presets.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(presets[Number(e.target.value)])}
        aria-label="משך זמן המיקוד, בדקות"
        className="peer pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />

      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        className="absolute inset-0 h-full w-full touch-none cursor-grab rounded-full active:cursor-grabbing peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-primary"
        onPointerDown={(e) => {
          setDragging(true)
          pick(e.clientX, e.clientY)
        }}
      >
        {/* transparent, not none — SVG only hit-tests "painted" areas */}
        <circle cx={CX} cy={CY} r={R_HIT} fill="transparent" />
        <path d={trackD} fill="none" stroke="white" strokeOpacity={0.35} strokeWidth={8} strokeLinecap="round" />
        <path
          d={progressD}
          fill="none"
          stroke="white"
          strokeWidth={8}
          strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.25))' }}
        />
        {presets.map((m, i) => {
          const p = pt(angleFor(i, presets.length), R_TICK)
          return (
            <circle
              key={m}
              cx={p.x}
              cy={p.y}
              r={i === index ? 4 : 3}
              fill="white"
              style={{ filter: 'drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.3))' }}
            />
          )
        })}
        <motion.circle
          r={11}
          fill="white"
          stroke="var(--primary)"
          strokeWidth={4}
          style={{ filter: 'drop-shadow(0 2px 4px rgb(0 0 0 / 0.35))' }}
          initial={false}
          animate={{ cx: handlePt.x, cy: handlePt.y }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        />
      </svg>

      {/* Fixed dark colors, not the --ink/--muted tokens: the watchface image
          bakes in the same pale cream center in every theme AND in dark mode
          (it isn't recolored per mode), so text here needs to stay dark
          regardless of what --ink currently resolves to. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold leading-none tabular-nums" style={{ color: '#1f2a1f' }}>
          {value}
        </span>
        <span className="mt-1 text-xs" style={{ color: '#6b7566' }}>
          דקות
        </span>
      </div>
    </div>
  )
}
