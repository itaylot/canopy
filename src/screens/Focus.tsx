import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  Pause,
  Play,
  CaretDown,
  SpeakerHigh,
  SpeakerSlash,
  CheckCircle,
  ArrowClockwise,
  DotsSix,
} from '@phosphor-icons/react'
import { useStore } from '../store'
import { useResolvedDark } from '../theme'
import { useFocus, msLeft, isPaused, isDone, FOCUS_SCENES } from '../focus'
import { startAmbient, stopAmbient } from '../ambient'

const now = () => Date.now()
const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Study-with-me focus mode: the theme's scene fills the screen, the timer is a
 * small quiet corner element, and the chrome fades away. Rendered at the app
 * root so it covers the navigation. The session itself lives in the focus store
 * (timestamp-based), so this component only reads and draws it.
 */
export default function Focus() {
  const session = useFocus((s) => s.session)
  const open = useFocus((s) => s.open)
  const soundOn = useFocus((s) => s.soundOn)
  const { pause, resume, extend, stop, collapse, setSound } = useFocus()
  const theme = useStore((s) => s.theme)
  const dark = useResolvedDark()
  const reduce = useReducedMotion()

  // Re-derive the remaining time each second from the absolute end timestamp.
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500)
    return () => clearInterval(id)
  }, [])

  const containerRef = useRef<HTMLDivElement>(null)
  // Chrome auto-hides after a few still seconds; any pointer move brings it back.
  const [chromeShown, setChromeShown] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const wake = () => {
    setChromeShown(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setChromeShown(false), 4000)
  }
  useEffect(() => {
    wake()
    return () => clearTimeout(hideTimer.current)
  }, [])

  // Ambient audio plays only while the immersive overlay is open.
  useEffect(() => {
    if (open && session && soundOn) startAmbient(theme)
    else stopAmbient()
    return stopAmbient
  }, [open, session, soundOn, theme])

  if (!session || !open) return null

  const scene = FOCUS_SCENES[theme]
  const left = msLeft(session, now())
  const paused = isPaused(session)
  const done = isDone(session, now())
  const progress = 1 - left / session.totalMs

  return (
    <motion.div
      ref={containerRef}
      className="fixed inset-0 z-[60] overflow-hidden bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerMove={wake}
      onClick={wake}
    >
      {/* The scene. A very slow zoom is the only motion — cinematic, not gamified.
          Reduced motion holds it still. */}
      <motion.img
        src={scene.bg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: dark ? 'brightness(0.6) saturate(0.9)' : undefined }}
        initial={reduce ? false : { scale: 1.0 }}
        animate={reduce ? {} : { scale: 1.08 }}
        transition={{ duration: session.totalMs / 1000, ease: 'linear' }}
      />
      {/* Legibility scrims: a soft one at the bottom for the timer, and a fade
          from the top for the controls — the art alone can't guarantee contrast. */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent" />

      {/* Top controls — auto-hide */}
      <AnimatePresence>
        {chromeShown && !done && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute inset-x-0 top-0 flex items-center justify-between p-4 sm:p-6"
          >
            {/* Collapse leaves focus mode with the clock still running (a resume
                bar appears on the normal screens); Stop below ends it. */}
            <button
              onClick={collapse}
              aria-label="מזעור"
              className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-2 text-sm text-white backdrop-blur-md transition-colors hover:bg-black/50"
            >
              <CaretDown size={18} /> מזעור
            </button>
            <button
              onClick={() => setSound(!soundOn)}
              aria-label={soundOn ? 'כבה צליל' : 'הפעל צליל'}
              className="grid h-10 w-10 place-items-center rounded-full bg-black/30 text-white backdrop-blur-md transition-colors hover:bg-black/50"
            >
              {soundOn ? <SpeakerHigh size={20} /> : <SpeakerSlash size={20} />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timer + task — starts in the scene's calm corner, draggable anywhere,
          kept inside the viewport. A grab handle appears with the chrome so the
          pause button underneath stays clickable. */}
      {!done && (
        <motion.div
          drag
          dragConstraints={containerRef}
          dragMomentum={false}
          dragElastic={0.05}
          className={`absolute p-5 text-right text-white sm:p-8 ${
            scene.anchor.y === 'bottom' ? 'bottom-0' : 'top-14'
          } ${scene.anchor.x === 'right' ? 'right-0' : 'left-0'}`}
        >
          <AnimatePresence>
            {chromeShown && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-1 flex cursor-grab items-center gap-1 text-[11px] text-white/50 active:cursor-grabbing"
              >
                <DotsSix size={14} /> גרור
              </motion.div>
            )}
          </AnimatePresence>
          {session.taskTitle && (
            <p className="mb-1 max-w-[70vw] truncate text-sm text-white/80">{session.taskTitle}</p>
          )}
          <div className="flex items-center gap-3">
            <span className="text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">{fmt(left)}</span>
            <AnimatePresence>
              {chromeShown && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => (paused ? resume(now()) : pause(now()))}
                  aria-label={paused ? 'המשך' : 'השהה'}
                  className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-black shadow-lg transition-transform hover:scale-105"
                >
                  {paused ? <Play weight="fill" size={22} /> : <Pause weight="fill" size={22} />}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          {/* a hairline progress bar under the timer — quiet, not a game meter */}
          <div className="mt-3 h-0.5 w-40 overflow-hidden rounded-full bg-white/25 sm:w-56">
            <div className="h-full rounded-full bg-white/80" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
          <AnimatePresence>
            {chromeShown && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={stop}
                className="mt-2 text-xs text-white/70 transition-colors hover:text-white"
              >
                {paused ? 'מושהה · ' : ''}סיום מיקוד
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Completion — a calm end, not a fanfare */}
      <AnimatePresence>
        {done && <Complete taskId={session.taskId} onAgain={(m) => extend(m, now())} onStop={stop} />}
      </AnimatePresence>
    </motion.div>
  )
}

/**
 * The pill shown on the normal screens while a session is minimized, so a
 * running timer is never lost and is one tap from resuming.
 */
export function FocusBar() {
  const session = useFocus((s) => s.session)
  const open = useFocus((s) => s.open)
  const expand = useFocus((s) => s.expand)
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  if (!session || open) return null
  const left = msLeft(session, now())
  const paused = isPaused(session)

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      onClick={expand}
      className="fixed inset-x-0 bottom-0 z-50 mx-auto mb-[max(5.5rem,calc(env(safe-area-inset-bottom)+5rem))] flex max-w-xs items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-on-primary shadow-lg lg:mb-6"
    >
      {paused ? <Play weight="fill" size={18} /> : <Pause weight="fill" size={18} />}
      <span className="min-w-0 flex-1 truncate text-right text-sm font-medium">
        {session.taskTitle ?? 'מיקוד'}
      </span>
      <span className="shrink-0 text-lg font-bold tabular-nums">{fmt(left)}</span>
    </motion.button>
  )
}

function Complete({
  taskId,
  onAgain,
  onStop,
}: {
  taskId: string | null
  onAgain: (minutes: number) => void
  onStop: () => void
}) {
  const toggleTask = useStore((s) => s.toggleTask)
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId))
  const reduce = useReducedMotion()

  useEffect(() => {
    stopAmbient()
  }, [])

  return (
    <motion.div
      className="absolute inset-0 grid place-items-center bg-black/45 p-6 text-center backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={reduce ? false : { scale: 0.94, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-xs"
      >
        <p className="text-xl font-semibold text-white">הסשן הסתיים 🌿</p>
        <p className="mt-1 text-sm text-white/70">קח נשימה. מה הלאה?</p>

        <div className="mt-6 flex flex-col gap-2.5">
          {task && !task.done && (
            <button
              onClick={() => {
                toggleTask(task.id)
                onStop()
              }}
              className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3 font-semibold text-black transition-transform hover:scale-[1.02]"
            >
              <CheckCircle weight="fill" size={20} /> סיימתי את המשימה
            </button>
          )}
          <button
            onClick={() => onAgain(25)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white/15 py-3 font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/25"
          >
            <ArrowClockwise size={19} /> עוד סשן
          </button>
          <button onClick={onStop} className="py-2 text-sm text-white/70 transition-colors hover:text-white">
            חזרה להיום
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
