import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { DotsThree, PencilSimple, Trash } from '@phosphor-icons/react'
import type { Course, Task } from './store'
import { formatDuration } from './utils'

/* ---------- Brand mark: two trees, a rope, a rider ---------- */
export function CanopyMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 40 29" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="7" y="14" width="2.4" height="10" rx="1" fill="var(--bark)" />
      <circle cx="8.2" cy="10" r="7.2" fill="var(--primary)" />
      <rect x="30.4" y="17" width="2.2" height="7" rx="1" fill="var(--bark)" />
      <circle cx="31.5" cy="14.4" r="5.4" fill="var(--tree-2)" />
      <path d="M9 11.5 Q20 16 31 15" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <line x1="18.5" y1="13.7" x2="18.5" y2="17" stroke="var(--accent)" strokeWidth="1.1" />
      <circle cx="18.5" cy="18.3" r="1.7" fill="var(--accent)" />
    </svg>
  )
}

/* ---------- Bottom sheet ---------- */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            className="relative z-10 max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-2xl"
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
            {title && <h2 className="mb-4 text-lg font-semibold text-ink">{title}</h2>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ---------- Animated checkbox ---------- */
function Checkbox({ done }: { done: boolean }) {
  return (
    <span
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors ${
        done ? 'border-primary bg-primary' : 'border-line bg-transparent'
      }`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24">
        <motion.path
          d="M5 13 L10 18 L19 7"
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: done ? 1 : 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        />
      </svg>
    </span>
  )
}

/* ---------- Card surface (one radius + one shadow for the whole app) ---------- */
export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl bg-surface shadow-card ${className}`}>{children}</div>
}

/* ---------- Task row ---------- */
export function TaskRow({
  task,
  course,
  onToggle,
  onEdit,
  onDelete,
  flat = false,
  draggable = false,
}: {
  task: Task
  course?: Course
  onToggle: () => void
  onEdit?: () => void
  onDelete?: () => void
  /** Renders as a plain row (for lists inside one Card with dividers) instead of a standalone card. */
  flat?: boolean
  /** Desktop week planner: makes the row a drag source carrying the task id. */
  draggable?: boolean
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      draggable={draggable || undefined}
      onDragStart={
        draggable ? (e) => (e as unknown as DragEvent).dataTransfer?.setData('text/task-id', task.id) : undefined
      }
      className={`${
        flat
          ? 'flex items-center gap-3 px-1 py-3'
          : 'flex items-center gap-3 rounded-2xl bg-surface px-3.5 py-3 shadow-card transition-shadow hover:shadow-lg'
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <span
        aria-hidden
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg"
        style={{ backgroundColor: (course?.color ?? '#4f8a55') + '1f' }}
      >
        {course?.emoji ?? '📘'}
      </span>

      <button onClick={onToggle} className="min-w-0 flex-1 text-right">
        <div className={`truncate font-semibold ${task.done ? 'text-muted line-through' : 'text-ink'}`}>
          {task.title}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted">
          {course ? `${course.name} · ` : ''}
          {formatDuration(task.minutes)}
        </div>
      </button>

      {onEdit && onDelete ? (
        <RowMenu onEdit={onEdit} onDelete={onDelete} />
      ) : (
        onDelete && (
          <button
            onClick={onDelete}
            className="shrink-0 rounded-full px-1.5 text-sm text-muted transition-colors hover:text-accent"
            aria-label="מחק משימה"
          >
            ✕
          </button>
        )
      )}

      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={onToggle}
        aria-label={task.done ? 'בטל סימון' : 'סמן כהושלם'}
        title={task.done ? 'בטל סימון' : 'סמן כהושלם'}
      >
        <Checkbox done={task.done} />
      </motion.button>
    </motion.div>
  )
}

/* ---------- Row overflow menu (edit / delete) ---------- */
/** One menu for every kind of row — task, exam, course. Closes on outside
 *  click via a full-screen transparent backdrop, which also stops the click
 *  from reaching whatever is underneath. */
export function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative shrink-0">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        aria-label="אפשרויות"
        aria-expanded={open}
        className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:bg-primary-soft hover:text-ink"
      >
        <DotsThree weight="bold" size={20} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.14 }}
              className="absolute left-0 top-9 z-50 w-36 overflow-hidden rounded-xl bg-surface py-1 text-right shadow-lg ring-1 ring-line"
            >
              <button
                onClick={() => {
                  setOpen(false)
                  onEdit()
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink transition-colors hover:bg-primary-soft"
              >
                <PencilSimple size={16} /> עריכה
              </button>
              <button
                onClick={() => {
                  setOpen(false)
                  onDelete()
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                <Trash size={16} /> מחיקה
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </span>
  )
}

/* ---------- Leaf burst celebration ---------- */
export function LeafBurst({ show }: { show: boolean }) {
  const reduce = useReducedMotion()
  if (reduce) return null
  return (
    <AnimatePresence>
      {show && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i / 16) * Math.PI * 2
            const dist = 130 + (i % 3) * 45
            return (
              <motion.span
                key={i}
                className="absolute text-2xl"
                initial={{ x: 0, y: 0, opacity: 1, scale: 0.5, rotate: 0 }}
                animate={{
                  x: Math.cos(angle) * dist,
                  y: Math.sin(angle) * dist + 70,
                  opacity: 0,
                  scale: 1.1,
                  rotate: 220,
                }}
                transition={{ duration: 1.15, ease: 'easeOut' }}
              >
                🍃
              </motion.span>
            )
          })}
        </div>
      )}
    </AnimatePresence>
  )
}

/* ---------- Small form primitives ---------- */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-ink outline-none transition-colors focus:border-primary'

export function PrimaryButton({
  children,
  onClick,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      whileTap={{ scale: 0.97, y: 1 }}
      className="w-full rounded-xl bg-primary py-3 font-semibold text-white shadow-card transition-shadow hover:shadow-lg"
    >
      {children}
    </motion.button>
  )
}
