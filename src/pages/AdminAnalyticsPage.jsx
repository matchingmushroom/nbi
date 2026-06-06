import { useState, useEffect, Fragment } from 'react'
import { collection, getDocs, doc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { BADGES, getLevelProgress, getLevel } from '../lib/gamification'
import { formatDate } from '../lib/utils'

export default function AdminAnalyticsPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [totals, setTotals] = useState({ userCount: 0, testCount: 0, avgScore: 0 })
  const [recalculating, setRecalculating] = useState(false)
  const [recalcResult, setRecalcResult] = useState(null)

  const getResultTitle = (r) => {
    const qt = r.quizType || r.testType || ''
    if (qt === 'chapter') return `Chapter: ${r.chapter || 'Unknown'}`
    if (qt === 'module') return `Module: ${r.module || 'Unknown'}`
    if (qt === 'mode') return `Mode: ${r.mode === 'Book' ? 'Self-Paced' : r.mode === 'Physical' ? 'Instructor-Led' : r.mode || 'Unknown'}`
    if (qt === 'final') return 'Final Mock Test'
    return r.chapter || r.module || r.mode || 'Quiz'
  }

  useEffect(() => {
    const fetch = async () => {
      try {
        const [usersSnap, resultsSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'results')),
        ])

        const allResults = resultsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        const allScores = allResults.map(r => r.percentage || 0)

        const userMap = {}
        usersSnap.docs.forEach(d => { userMap[d.id] = { uid: d.id, ...d.data() } })

        const userStats = usersSnap.docs.map(d => {
          const uid = d.id
          const data = { uid, ...d.data() }
          const userResults = allResults.filter(r => r.userId === uid)
          const scores = userResults.map(r => r.percentage || 0)
          return {
            ...data,
            totalTests: userResults.length,
            avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
            bestScore: scores.length ? Math.max(...scores) : 0,
            results: userResults.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')),
          }
        })

        userStats.sort((a, b) => b.totalTests - a.totalTests)
        setUsers(userStats)
        setTotals({
          userCount: usersSnap.size,
          testCount: allResults.length,
          avgScore: allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0,
        })
      } catch (e) {
        console.error('Analytics fetch error:', e)
      }
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Loading analytics...</p></div>

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Analytics</h1>
        <p className="text-on-surface-variant text-sm mt-1">Per-user statistics — tests, scores, XP, level, and badges</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-surface border border-outline-variant rounded-xl p-4">
          <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Total Users</span>
          <p className="font-['Hanken_Grotesk'] text-2xl font-bold text-primary mt-1">{totals.userCount}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-4">
          <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Tests Taken</span>
          <p className="font-['Hanken_Grotesk'] text-2xl font-bold text-primary mt-1">{totals.testCount}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-4">
          <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Avg Score (All)</span>
          <p className="font-['Hanken_Grotesk'] text-2xl font-bold text-primary mt-1">{totals.avgScore}%</p>
        </div>
      </div>

      {/* Recalculate Levels */}
      <div className="bg-surface border border-outline-variant rounded-xl p-4 mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-on-surface">Recalculate Levels</h3>
          <p className="text-[11px] text-on-surface-variant mt-0.5">Update all users' levels based on their current XP and the latest thresholds</p>
          {recalcResult && (
            <p className="text-xs font-medium mt-1" style={{ color: recalcResult.success ? '#059669' : '#DC2626' }}>{recalcResult.message}</p>
          )}
        </div>
        <button
          onClick={async () => {
            setRecalculating(true)
            setRecalcResult(null)
            try {
              const snap = await getDocs(collection(db, 'users'))
              let updated = 0
              for (const userDoc of snap.docs) {
                const data = userDoc.data()
                const currentXp = data.xp || 0
                const correctLevel = getLevel(currentXp)
                if (data.level !== correctLevel) {
                  await setDoc(doc(db, 'users', userDoc.id), { level: correctLevel }, { merge: true })
                  updated++
                }
              }
              setRecalcResult({ success: true, message: `Done! ${updated} user${updated !== 1 ? 's' : ''} updated.` })
              // Refresh table
              setExpanded(null)
              const [usersSnap, resultsSnap] = await Promise.all([
                getDocs(collection(db, 'users')),
                getDocs(collection(db, 'results')),
              ])
              const allResults = resultsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
              const userStats = usersSnap.docs.map(d => {
                const uid = d.id
                const data = { uid, ...d.data() }
                const userResults = allResults.filter(r => r.userId === uid)
                const scores = userResults.map(r => r.percentage || 0)
                return {
                  ...data,
                  totalTests: userResults.length,
                  avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
                  bestScore: scores.length ? Math.max(...scores) : 0,
                  results: userResults.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')),
                }
              })
              userStats.sort((a, b) => b.totalTests - a.totalTests)
              setUsers(userStats)
            } catch (e) {
              setRecalcResult({ success: false, message: `Error: ${e.message}` })
            }
            setRecalculating(false)
          }}
          disabled={recalculating}
          className="shrink-0 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
        >
          {recalculating && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {recalculating ? 'Recalculating...' : 'Recalculate'}
        </button>
      </div>

      {/* User Table */}
      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="text-left py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">User</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Tests</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Avg</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Best</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Level</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">XP</th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Badges</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <Fragment key={u.uid}>
                  <tr
                    className={`border-b border-outline-variant/50 hover:bg-surface-container-low transition-colors cursor-pointer ${expanded === u.uid ? 'bg-surface-container-low' : ''}`}
                    onClick={() => setExpanded(expanded === u.uid ? null : u.uid)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {(u.displayName || u.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-on-surface truncate">{u.displayName || 'Unnamed'}</p>
                          <p className="text-[10px] text-on-surface-variant truncate">{u.email || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-on-surface">{u.totalTests}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`font-semibold ${u.avgScore >= 80 ? 'text-success' : u.avgScore >= 60 ? 'text-warning' : 'text-error'}`}>
                        {u.avgScore}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`font-semibold ${u.bestScore >= 80 ? 'text-success' : u.bestScore >= 60 ? 'text-warning' : 'text-error'}`}>
                        {u.bestScore}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 bg-warning/10 text-warning px-2 py-0.5 rounded-full text-xs font-bold">
                        Lv{u.level || 1}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-semibold text-on-surface">{u.xp || 0}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-semibold text-on-surface">{u.badges?.length || 0}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="material-symbols-outlined text-on-surface-variant text-[18px] transition-transform" style={{ transform: expanded === u.uid ? 'rotate(180deg)' : '' }}>
                        expand_more
                      </span>
                    </td>
                  </tr>
                  {expanded === u.uid && (
                    <tr key={`${u.uid}-detail`}>
                      <td colSpan={8} className="p-0 bg-surface-container-low/50">
                        <div className="p-4 border-b border-outline-variant/50">
                          {u.results.length === 0 ? (
                            <p className="text-sm text-on-surface-variant text-center py-4">No tests taken yet.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-64 overflow-y-auto">
                              {u.results.map(r => (
                                <div key={r.id} className="flex items-center gap-3 bg-surface rounded-lg px-3 py-2 border border-outline-variant/50">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${(r.percentage || 0) >= 60 ? 'bg-green-100' : 'bg-red-100'}`}>
                                    <span className={`material-symbols-outlined text-[12px] ${(r.percentage || 0) >= 60 ? 'text-success' : 'text-error'}`}>
                                      {(r.percentage || 0) >= 60 ? 'check_circle' : 'cancel'}
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-on-surface truncate">{getResultTitle(r)}</p>
                                    <p className="text-[10px] text-on-surface-variant">{r.score}/{r.totalQuestions} · {r.percentage}% · {formatDate(r.completedAt)}</p>
                                  </div>
                                  <span className="text-[10px] text-on-surface-variant font-mono">{r.xpEarned || 0} XP</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Badges section within expand */}
                          {u.badges?.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-outline-variant/50">
                              <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Badges ({u.badges.length})</p>
                              <div className="flex flex-wrap gap-1.5">
                                {BADGES.filter(b => u.badges.includes(b.id)).map(b => (
                                  <div key={b.id} className="flex items-center gap-1 bg-primary-fixed/20 px-2 py-0.5 rounded text-[10px] font-medium" title={b.desc}>
                                    <span className="material-symbols-outlined text-primary text-[12px]" style={{fontVariationSettings: "'FILL' 1"}}>{b.icon}</span>
                                    {b.name}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* XP Bar */}
                          {u.xp > 0 && (
                            <div className="mt-3 pt-3 border-t border-outline-variant/50">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold text-on-surface-variant">XP Progress</span>
                                <div className="flex-1 h-2 bg-surface-container-low rounded-full overflow-hidden max-w-[200px]">
                                  <div className="h-full bg-secondary rounded-full" style={{ width: `${getLevelProgress(u.xp || 0)}%` }} />
                                </div>
                                <span className="text-[10px] text-warning font-semibold">{u.xp || 0} XP</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-on-surface-variant text-sm">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
