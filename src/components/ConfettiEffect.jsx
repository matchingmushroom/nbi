import { useEffect, useState } from 'react'

const COLORS = ['#00288e', '#059669', '#D97706', '#DC2626', '#7c3aed', '#0891b2', '#db2777', '#ca8a04']

export default function ConfettiEffect({ active, duration = 3000 }) {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    if (!active) {
      setParticles([])
      return
    }
    const items = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length],
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      size: 5 + Math.random() * 8,
      rotation: Math.random() * 720,
      drift: (Math.random() - 0.5) * 120,
    }))
    setParticles(items)
    const timer = setTimeout(() => setParticles([]), duration)
    return () => clearTimeout(timer)
  }, [active, duration])

  if (particles.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti"
          style={{
            left: `${p.left}%`,
            top: '-10px',
            width: `${p.size}px`,
            height: `${p.size * 0.6}px`,
            backgroundColor: p.color,
            borderRadius: '2px',
            transform: `rotate(${p.rotation}deg)`,
            animationDelay: `${p.delay}s`,
            '--x-drift': `${p.drift}px`,
          }}
        />
      ))}
    </div>
  )
}
