import { useState, useEffect, Fragment } from 'react'
import { useAuth } from '../context/AuthContext'
import { BADGES, getLevelProgress, getXPForNextLevel } from '../lib/gamification'
import { formatDate } from '../lib/utils'
import { getAllUsersCached, getAllResultsCached } from '../lib/cache'

export default function LeaderboardPage() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState([])
  const [myStats, setMyStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const [allUsers, allResults] = await Promise.all([
        getAllUsersCached(),
        getAllResultsCached(),
      ])

      const resultsByUser = {}
      allResults.forEach((r) => {
        const uid = r.userId
        if (!resultsByUser[uid]) resultsByUser[uid] = []
        resultsByUser[uid].push(r)
      })

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

      const buildEntry = (uid, entry) => {
        const data = allUsers.find((u) => u.uid === uid) || {}
        const userResults = resultsByUser[uid] || []
        const scores = userResults.map((r) => r.percentage || 0)
        const typeCounts = { chapter: 0, module: 0, mode: 0, final: 0 }
        userResults.forEach((r) => {
          const qt = r.quizType || r.testType || ''
          if (typeCounts[qt] !== undefined) typeCounts[qt]++
        })
        const sortedResults = [...userResults].sort((a, b) =>
          (b.completedAt || '').localeCompare(a.completedAt || '')
        )
        return {
          userId: uid,
          displayName: entry?.displayName || data.displayName || data.email || 'Unknown',
          userEmail: entry?.userEmail || data.email || '',
          score: entry?.score || 0,
          totalQuestions: entry?.totalQuestions || 100,
          percentage: entry?.percentage || 0,
          level: data.level || 1,
          xp: data.xp || 0,
          streak: data.streak || 0,
          badges: data.badges || [],
          totalTests: userResults.length,
          avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
          bestScore: scores.length ? Math.max(...scores) : 0,
          typeCounts,
          recentResults: sortedResults.slice(0, 5),
        }
      }

      const sorted = Object.values(userBest)
        .map((entry) => buildEntry(entry.userId, entry))
        .sort((a, b) => b.score - a.score)

      setEntries(sorted)

      // Build logged-in user's stats
      if (profile?.uid) {
        const uid = profile.uid
        const finalEntry = userBest[uid]
        setMyStats(buildEntry(uid, finalEntry))
      }

      setLoading(false)
    }
    fetch()
  }, [profile])

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

  const myRank = entries.findIndex((e) => e.userId === profile?.uid) + 1

  const AchievementCard = ({ s }) => (
    <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm space-y-5">
      {/* Level & XP */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary-fixed flex items-center justify-center shrink-0">
          <div className="text-center">
            <p className="text-[10px] font-bold text-primary uppercase">Level</p>
            <p className="text-3xl font-extrabold text-primary leading-none mt-0.5">{s.level}</p>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-on-surface">{s.xp} XP</span>
            <span className="text-[10px] text-on-surface-variant">{getXPForNextLevel(s.xp)} XP to next level</span>
          </div>
          <div className="w-full h-2.5 bg-surface-container-low rounded-full overflow-hidden">
            <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${getLevelProgress(s.xp)}%` }} />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-surface-container-low rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-primary">{s.totalTests}</p>
          <p className="text-[9px] text-on-surface-variant font-medium uppercase tracking-wider">Tests</p>
        </div>
        <div className="bg-surface-container-low rounded-lg p-2.5 text-center">
          <p className={`text-lg font-bold ${s.avgScore >= 80 ? 'text-success' : s.avgScore >= 60 ? 'text-warning' : 'text-error'}`}>{s.avgScore}%</p>
          <p className="text-[9px] text-on-surface-variant font-medium uppercase tracking-wider">Average</p>
        </div>
        <div className="bg-surface-container-low rounded-lg p-2.5 text-center">
          <p className={`text-lg font-bold ${s.bestScore >= 80 ? 'text-success' : s.bestScore >= 60 ? 'text-warning' : 'text-error'}`}>{s.bestScore}%</p>
          <p className="text-[9px] text-on-surface-variant font-medium uppercase tracking-wider">Best</p>
        </div>
        <div className="bg-surface-container-low rounded-lg p-2.5 text-center">
          <div className="flex items-center justify-center gap-0.5 text-lg text-orange-500">
            <span className="material-symbols-outlined text-[18px]" style={{fontVariationSettings: "'FILL' 1"}}>local_fire_department</span>
            <span className="font-bold">{s.streak}</span>
          </div>
          <p className="text-[9px] text-on-surface-variant font-medium uppercase tracking-wider">Streak</p>
        </div>
      </div>

      {/* Test Type Breakdown */}
      <div>
        <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Tests by Type</p>
        <div className="flex gap-2">
          {[
            { key: 'chapter', label: 'Chapter', color: 'bg-blue-500' },
            { key: 'module', label: 'Module', color: 'bg-emerald-500' },
            { key: 'mode', label: 'Mode', color: 'bg-purple-500' },
            { key: 'final', label: 'Final', color: 'bg-amber-500' },
          ].map((t) => (
            <div key={t.key} className="flex-1 bg-surface-container-low rounded-lg p-2 text-center">
              <p className={`text-sm font-bold ${s.typeCounts[t.key] > 0 ? 'text-on-surface' : 'text-on-surface-variant'}`}>{s.typeCounts[t.key]}</p>
              <div className={`h-1 rounded-full mt-1 ${s.typeCounts[t.key] > 0 ? t.color : 'bg-outline-variant'}`} />
              <p className="text-[8px] text-on-surface-variant font-medium mt-1 uppercase tracking-wider">{t.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* All Badges */}
      <div>
        <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
          Badges <span className="font-normal">({s.badges.length}/{BADGES.length})</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {BADGES.map((b) => {
            const earned = s.badges.includes(b.id)
            return (
              <div key={b.id} className={`flex items-center gap-2 p-2 rounded-lg border ${earned ? 'bg-primary-fixed/10 border-primary/20' : 'bg-surface-container-low border-outline-variant/50 opacity-50'}`}>
                <span className={`material-symbols-outlined text-[18px] ${earned ? 'text-primary' : 'text-on-surface-variant'}`} style={{fontVariationSettings: "'FILL' 1"}}>{b.icon}</span>
                <div className="min-w-0">
                  <p className={`text-[11px] font-semibold leading-tight ${earned ? 'text-on-surface' : 'text-on-surface-variant'}`}>{b.name}</p>
                  <p className="text-[8px] text-on-surface-variant leading-tight truncate">{b.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent Activity */}
      {s.recentResults.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Recent Activity</p>
          <div className="space-y-1">
            {s.recentResults.map((r, idx) => {
              const qt = r.quizType || r.testType || ''
              const title = qt === 'chapter' ? r.chapter || 'Chapter Test' :
                qt === 'module' ? r.module || 'Module Test' :
                qt === 'mode' ? `${r.mode || 'Mode'} Test` :
                qt === 'final' ? 'Final Mock Test' : 'Quiz'
              return (
                <div key={idx} className="flex items-center gap-2.5 bg-surface-container-low rounded-lg px-3 py-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${(r.percentage || 0) >= 60 ? 'bg-green-100' : 'bg-red-100'}`}>
                    <span className={`material-symbols-outlined text-[12px] ${(r.percentage || 0) >= 60 ? 'text-success' : 'text-error'}`}>
                      {(r.percentage || 0) >= 60 ? 'check_circle' : 'cancel'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-on-surface truncate">{title}</p>
                    <p className="text-[9px] text-on-surface-variant">{r.score}/{r.totalQuestions} · {r.percentage}%</p>
                  </div>
                  <span className="text-[9px] text-on-surface-variant">{formatDate(r.completedAt)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Rank</h1>
        <p className="text-on-surface-variant text-sm mt-1">Your achievement profile and leaderboard rankings</p>
      </div>

      {/* My Achievement Section */}
      {myStats && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                {(profile?.displayName || profile?.email || '?')[0].toUpperCase()}
              </div>
              <div>
                <h2 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface">My Achievement</h2>
                <p className="text-[11px] text-on-surface-variant">
                  {profile?.displayName || profile?.email}
                  {myRank > 0 && <span> · Rank #{myRank}</span>}
                </p>
              </div>
            </div>
          </div>
          <AchievementCard s={myStats} />
        </div>
      )}

      {/* Leaderboard */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface">Leaderboard</h2>
        <p className="text-[10px] text-on-surface-variant">Based on Final Mock Test scores</p>
      </div>

      {entries.length === 0 && !myStats && (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-[48px] mb-3">leaderboard</span>
          <p className="text-sm font-medium">No Final Test results yet.</p>
          <p className="text-xs mt-1">Be the first to take the Final Test!</p>
        </div>
      )}

      <div className="space-y-2">
        {entries.map((entry, i) => {
          const isMe = entry.userId === profile?.uid
          return (
            <div
              key={entry.userId}
              className={`bg-surface border rounded-xl p-4 shadow-sm ${
                i < 3 ? 'border-yellow-300' : isMe ? 'border-primary border-2' : 'border-outline-variant'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 flex justify-center shrink-0">
                  {getMedal(i + 1)}
                </div>
                <div className="relative shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                    i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-500' : isMe ? 'bg-primary' : 'bg-primary/60'
                  }`}>
                    {entry.displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-1 -right-1 bg-warning text-white text-[8px] font-bold px-1 py-0.5 rounded-full leading-none border border-white">
                    Lv{entry.level}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-on-surface truncate">{entry.displayName}</p>
                    {isMe && <span className="text-[8px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">You</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
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
                  {entry.badges?.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      {BADGES.filter(b => entry.badges.includes(b.id)).slice(0, 4).map((b) => (
                        <span key={b.id} className="material-symbols-outlined text-primary text-[14px]" style={{fontVariationSettings: "'FILL' 1"}} title={b.name}>{b.icon}</span>
                      ))}
                      {entry.badges.length > 4 && (
                        <span className="text-[9px] text-on-surface-variant font-medium">+{entry.badges.length - 4}</span>
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
          )
        })}
      </div>
    </div>
  )
}
