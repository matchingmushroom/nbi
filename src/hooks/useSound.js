import { useCallback, useRef, useState } from 'react'

const STORAGE_KEY = 'nbi_sound'

function getStored() {
  try { return localStorage.getItem(STORAGE_KEY) !== 'false' } catch { return true }
}

export function useSound() {
  const [enabled, setEnabled] = useState(getStored)
  const ctxRef = useRef(null)

  const getCtx = () => {
    if (!ctxRef.current) {
      try { ctxRef.current = new (window.AudioContext || window.webkitAudioContext)() } catch {}
    }
    return ctxRef.current
  }

  const play = useCallback((freqs, durations, type = 'sine', volume = 0.2) => {
    if (!enabled) return
    try {
      const ctx = getCtx()
      if (!ctx) return
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = type
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1)
        gain.gain.setValueAtTime(volume, ctx.currentTime + i * 0.1)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + durations[i])
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + i * 0.1)
        osc.stop(ctx.currentTime + i * 0.1 + durations[i])
      })
    } catch {}
  }, [enabled])

  const playCorrect = useCallback(() => play([523, 659], [0.12, 0.12], 'sine', 0.18), [play])
  const playWrong = useCallback(() => play([330, 262], [0.15, 0.25], 'square', 0.12), [play])
  const playLevelUp = useCallback(() => play([523, 659, 784, 1047], [0.25, 0.25, 0.25, 0.4], 'sine', 0.2), [play])

  const toggle = useCallback(() => {
    setEnabled(p => {
      const next = !p
      try { localStorage.setItem(STORAGE_KEY, next) } catch {}
      return next
    })
  }, [])

  return { enabled, toggle, playCorrect, playWrong, playLevelUp }
}
