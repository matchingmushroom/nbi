import { useState, useEffect, useRef, useCallback } from 'react'

export default function Timer({ minutes, onTimeUp }) {
  const [timeLeft, setTimeLeft] = useState(minutes * 60)
  const [warning, setWarning] = useState(false)
  const calledRef = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          if (!calledRef.current) {
            calledRef.current = true
            onTimeUp()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [onTimeUp])

  useEffect(() => {
    if (timeLeft <= 300 && timeLeft > 0) setWarning(true)
  }, [timeLeft])

  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const display = `${mins}:${secs < 10 ? '0' : ''}${secs}`
  const critical = timeLeft > 0 && timeLeft <= 60

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
      critical ? 'bg-red-100 text-red-700 animate-timer-pulse' :
      warning ? 'bg-red-50 text-red-700' : 'bg-[#f0f3ff] text-primary'
    }`}>
      <span className="material-symbols-outlined text-[18px]">timer</span>
      <span className="font-bold tabular-nums">{display}</span>
    </div>
  )
}
