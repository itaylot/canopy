import { useState } from 'react'
import { motion } from 'motion/react'
import { GoogleLogo } from '@phosphor-icons/react'
import { signIn } from '../firebase'

export default function Login() {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const go = async () => {
    setBusy(true)
    setErr('')
    try {
      await signIn()
    } catch {
      setErr('ההתחברות נכשלה. נסה שוב.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-primary-soft to-bg px-6 text-center">
      <motion.img
        src="/canopy-hero-min.png"
        alt="איור של רוכב אומגה גולש על חבל בין שני עצים"
        initial={{ scale: 0.94, y: 8, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 20 }}
        className="w-full max-w-xs rounded-3xl shadow-card"
      />

      <h1 className="mt-6 text-3xl font-bold text-ink">Canopy</h1>
      <p className="mt-2 max-w-xs text-muted">
        המסלול שלך דרך תקופת המבחנים. הנתונים נשמרים בענן ומסתנכרנים בין כל המכשירים.
      </p>

      <motion.button
        whileTap={{ scale: 0.97, y: 1 }}
        onClick={go}
        disabled={busy}
        className="mt-8 flex w-full max-w-xs items-center justify-center gap-3 rounded-2xl bg-surface py-3.5 font-semibold text-ink shadow-card transition-shadow hover:shadow-lg disabled:opacity-60"
      >
        <GoogleLogo weight="bold" size={22} className="text-primary" />
        {busy ? 'מתחבר…' : 'התחברות עם Google'}
      </motion.button>

      {err && <p className="mt-3 text-sm text-accent">{err}</p>}

      <p className="mt-6 text-xs text-muted">התחברות בהקשה אחת. בלי סיסמאות.</p>
    </div>
  )
}
