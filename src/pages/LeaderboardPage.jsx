import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { BADGES, getLevelProgress } from '../lib/gamification'

export default function LeaderboardPage() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const [usersSnap, resultsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'results')),
      ])

      const userMap = {}
      usersSnap.docs.forEach((d) => {
        userMap[d.id] = { uid: d.id, ...d.data() }
      })

      const allResults = resultsSnap.docs.map((d) => d.data())
      const finalTests = allResults.filter((r) => r.quizType === 'final' || r.testType === 'final' || r.chapter === 'Final Test')

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

      const sorted = Object.values(userBest)
        .map((entry) => ({
          ...entry,
          level: userMap[entry.userId]?.level || 1,
          xp: userMap[entry.userId]?.xp || 0,
          streak: userMap[entry.userId]?.streak || 0,
          badges: userMap[entry.userId]?.badges || [],
        }))
        .sort((a, b) => b.score - a.score)

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

      <div className="space-y-3">
        {entries.map((entry, i) => (
          <div
            key={entry.userId}
            className={`bg-surface border rounded-xl p-4 shadow-sm ${
              i < 3 ? 'border-yellow-300' : 'border-outline-variant'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 flex justify-center shrink-0">
                {getMedal(i + 1)}
              </div>
              <div className="relative shrink-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                  i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-500' : 'bg-primary'
                }`}>
                  {entry.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="absolute -bottom-1 -right-1 bg-warning text-white text-[8px] font-bold px-1 py-0.5 rounded-full leading-none border border-white">
                  Lv{entry.level}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">{entry.displayName}</p>
                <p className="text-[10px] text-on-surface-variant truncate">{entry.userEmail}</p>
                {/* XP Bar */}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-warning font-semibold">{entry.xp} XP</span>
                  <div className="flex-1 h-1.5 bg-surface-container-low rounded-full overflow-hidden max-w-[100px]">
                    <div className="h-full bg-secondary rounded-full" style={{ width: `${getLevelProgress(entry.xp)}%` }} />
                  </div>
                  {entry.streak > 0 && (
                    <div className="flex items-center gap-0.5 text-orange-500">
                      <span className="material-symbols-outlined text-[12px]" style={{fontVariationSettings: "'FILL' 1"}}>local_fire_department</span>
                      <span className="text-[10px] font-bold">{entry.streak}</span>
                    </div>
                  )}
                </div>
                {/* Badges */}
                {entry.badges?.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    {BADGES.filter(b => entry.badges.includes(b.id)).slice(0, 5).map((b) => (
                      <span key={b.id} className="material-symbols-outlined text-primary text-[14px]" style={{fontVariationSettings: "'FILL' 1"}} title={b.name}>{b.icon}</span>
                    ))}
                    {entry.badges.length > 5 && (
                      <span className="text-[9px] text-on-surface-variant font-medium">+{entry.badges.length - 5}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0 ml-2">
                <p className="text-lg font-bold text-primary">{entry.score}<span className="text-xs text-on-surface-variant font-normal">/{entry.totalQuestions}</span></p>
                <p className={`text-xs font-semibold ${entry.percentage >= 80 ? 'text-success' : entry.percentage >= 60 ? 'text-warning' : 'text-error'}`}>
                  {entry.percentage}%
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
