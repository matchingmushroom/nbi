import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'

export default function LeaderboardPage() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(collection(db, 'results'))
      const allResults = snap.docs.map((d) => d.data())
      const finalTests = allResults.filter((r) => r.testType === 'final' || r.chapter === 'Final Test')

      const userBest = {}
      finalTests.forEach((r) => {
        const uid = r.userId
        if (!userBest[uid] || r.score > userBest[uid].score) {
          userBest[uid] = {
            userId: uid,
            displayName: r.displayName || r.userEmail || 'Unknown',
            userEmail: r.userEmail || '',
            score: r.score,
            totalQuestions: r.totalQuestions || 100,
            percentage: r.percentage || Math.round((r.score / (r.totalQuestions || 100)) * 100),
          }
        }
      })

      const sorted = Object.values(userBest).sort((a, b) => b.score - a.score)
      setEntries(sorted)
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <p className="text-on-surface-variant">Loading...</p>
    </div>
  )

  const getMedal = (rank) => {
    if (rank === 1) return <span className="material-symbols-outlined text-yellow-400 text-[24px]" style={{fontVariationSettings: "'FILL' 1"}}>military_tech</span>
    if (rank === 2) return <span className="material-symbols-outlined text-gray-400 text-[24px]" style={{fontVariationSettings: "'FILL' 1"}}>military_tech</span>
    if (rank === 3) return <span className="material-symbols-outlined text-orange-400 text-[24px]" style={{fontVariationSettings: "'FILL' 1"}}>military_tech</span>
    return <span className="w-6 text-center text-sm font-bold text-on-surface-variant">{rank}</span>
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Leaderboard</h1>
        <p className="text-on-surface-variant text-sm mt-1">Top scores from Final Tests — best attempt per user</p>
      </div>

      {entries.length === 0 && (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-[48px] mb-3">leaderboard</span>
          <p className="text-sm font-medium">No Final Test results yet.</p>
          <p className="text-xs mt-1">Be the first to take the Final Test!</p>
        </div>
      )}

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
        {entries.map((entry, i) => (
          <div
            key={entry.userId}
            className={`flex items-center gap-3 p-4 border-b border-outline-variant last:border-0 ${
              i < 3 ? 'bg-yellow-50/40' : ''
            } hover:bg-surface-container-low transition-colors`}
          >
            <div className="w-10 flex justify-center shrink-0">
              {getMedal(i + 1)}
            </div>
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
              {entry.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface truncate">{entry.displayName}</p>
              <p className="text-xs text-on-surface-variant truncate">{entry.userEmail}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-primary">{entry.score}</p>
              <p className="text-xs text-on-surface-variant">{entry.percentage}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
