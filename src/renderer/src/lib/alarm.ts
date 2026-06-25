/**
 * A gentle repeating alarm chime via the Web Audio API — no bundled sound file.
 * Reference-counted so multiple ringing timers share one chime loop.
 */
let ctx: AudioContext | null = null
let loop: number | undefined
let refs = 0

function chime(): void {
  if (!ctx) return
  const now = ctx.currentTime
  // a two-note ding, soft attack/release so it isn't harsh on a kitchen wall
  for (const [i, freq] of [880, 1320].entries()) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const t = now + i * 0.18
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.22, t + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.55)
  }
}

export function startAlarm(): void {
  refs += 1
  if (loop !== undefined) return
  try {
    ctx = ctx ?? new AudioContext()
    void ctx.resume()
  } catch {
    return
  }
  chime()
  loop = window.setInterval(chime, 1500)
}

export function stopAlarm(): void {
  refs = Math.max(0, refs - 1)
  if (refs > 0 || loop === undefined) return
  window.clearInterval(loop)
  loop = undefined
}
