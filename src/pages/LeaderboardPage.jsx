import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { FaTrophy, FaMedal } from 'react-icons/fa'

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
            completedAt: r.completedAt,
          }
        }
      })

      const sorted = Object.values(userBest).sort((a, b) => b.score - a.score)
      setEntries(sorted)
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) return <div className="flex justify-center items-center min-h-[60vh] text-xl">Loading...</div>

  const getMedal = (rank) => {
    if (rank === 1) return <FaTrophy className="text-yellow-400" size={24} />
    if (rank === 2) return <FaMedal className="text-gray-400" size={24} />
    if (rank === 3) return <FaMedal className="text-orange-400" size={24} />
    return <span className="w-6 text-center font-bold text-gray-400">{rank}</span>
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Leaderboard</h1>
      <p className="text-gray-500 mb-6">Top scores from Final Tests — best attempt per user</p>

      {entries.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">No Final Test results yet.</p>
          <p className="text-sm mt-1">Be the first to take the Final Test!</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="grid grid-cols-[48px_1fr_80px_80px] gap-2 p-4 bg-gray-50 font-semibold text-sm text-gray-500 border-b">
          <span>#</span>
          <span>User</span>
          <span className="text-right">Score</span>
          <span className="text-right">%</span>
        </div>
        {entries.map((entry, i) => (
          <div key={entry.userId} className={`grid grid-cols-[48px_1fr_80px_80px] gap-2 p-4 items-center border-b last:border-0 hover:bg-gray-50 ${i < 3 ? 'bg-yellow-50/50' : ''}`}>
            <div className="flex justify-center">{getMedal(i + 1)}</div>
            <div>
              <p className="font-medium truncate">{entry.displayName}</p>
              <p className="text-xs text-gray-400 truncate">{entry.userEmail}</p>
            </div>
            <div className="text-right font-bold text-indigo-700">{entry.score}</div>
            <div className="text-right text-gray-500">{entry.percentage}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}
