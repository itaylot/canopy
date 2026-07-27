import type { ThemeKey } from './store'

/**
 * A calm ambient bed, synthesized in the browser — no audio file, no licensing.
 *
 * Brown noise (a soft, low, rushing sound — the classic focus texture) through a
 * gentle low-pass, with a slow LFO breathing the volume so it feels like wind or
 * a swelling sea rather than static hiss. Each theme nudges the filter and the
 * breath rate. If a real lo-fi track is wanted later, swap this for an <audio>.
 *
 * The AudioContext is created lazily on start(), which is always a user gesture
 * (the Focus button), so autoplay policies are satisfied.
 */
type Voice = { ctx: AudioContext; master: GainNode; lfo: OscillatorNode; nodes: AudioNode[] }

const FLAVORS: Record<ThemeKey, { cutoff: number; breath: number; depth: number }> = {
  forest: { cutoff: 620, breath: 0.14, depth: 0.35 }, // airy wind through leaves
  sea: { cutoff: 480, breath: 0.08, depth: 0.6 }, //     slow, deep swell
  snow: { cutoff: 540, breath: 0.11, depth: 0.45 }, //   steady alpine wind
  snowpark: { cutoff: 560, breath: 0.1, depth: 0.5 },
}

let voice: Voice | null = null

function brownNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 4 // 4s loop
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.5
  }
  return buf
}

export function startAmbient(theme: ThemeKey) {
  stopAmbient()
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return
  const ctx = new Ctor()
  const f = FLAVORS[theme]

  const src = ctx.createBufferSource()
  src.buffer = brownNoiseBuffer(ctx)
  src.loop = true

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = f.cutoff

  const master = ctx.createGain()
  master.gain.value = 0
  master.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 2) // fade in

  // slow volume "breath"
  const lfo = ctx.createOscillator()
  lfo.frequency.value = f.breath
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = f.depth * 0.09
  lfo.connect(lfoGain).connect(master.gain)

  src.connect(filter).connect(master).connect(ctx.destination)
  src.start()
  lfo.start()
  void ctx.resume()

  voice = { ctx, master, lfo, nodes: [src, filter] }
}

export function stopAmbient() {
  if (!voice) return
  const { ctx, master } = voice
  try {
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime)
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6)
    setTimeout(() => ctx.close().catch(() => {}), 700)
  } catch {
    ctx.close().catch(() => {})
  }
  voice = null
}
