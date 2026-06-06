import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../lib/utils'
import { FiUsers, FiFileText, FiBookOpen } from 'react-icons/fi'

export default function DashboardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = profile?.role === 'admin'
  const [recentResults, setRecentResults] = useState([])
  const [stats, setStats] = useState({ total: 0, avgScore: 0, bestScore: 0 })

  useEffect(() => {
    if (!profile?.uid) return
    let cancelled = false
    const fetch = async () => {
      try {
        if (isAdmin) {
          const [userSnap, resultsSnap] = await Promise.all([
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'results')),
          ])
          if (cancelled) return
          const allResults = resultsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
          allResults.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
          setRecentResults(allResults.slice(0, 10))
          const scores = allResults.map((r) => r.percentage || 0)
          setStats({
            total: allResults.length,
            avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
            bestScore: scores.length ? Math.max(...scores) : 0,
            userCount: userSnap.size,
          })
        } else {
          const q = query(
            collection(db, 'results'),
            where('userId', '==', profile.uid),
            orderBy('completedAt', 'desc'),
            limit(5)
          )
          const snap = await getDocs(q)
          if (cancelled) return
          const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          setRecentResults(data)

          const allSnap = await getDocs(query(
            collection(db, 'results'),
            where('userId', '==', profile.uid)
          ))
          if (cancelled) return
          const all = allSnap.docs.map((d) => d.data())
          if (all.length) {
            const scores = all.map((r) => r.percentage || 0)
            setStats({
              total: all.length,
              avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
              bestScore: Math.max(...scores),
            })
          }
        }
      } catch (e) {
        console.error('Dashboard fetch error:', e)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [isAdmin, profile, location.pathname])

  const getResultTitle = (r) => {
    const qt = r.quizType || r.testType || ''
    if (qt === 'chapter') return r.chapter || 'Chapter Test'
    if (qt === 'module') return r.module || 'Module Test'
    if (qt === 'mode') {
      if (r.mode === 'Book') return 'Self-Paced (Book)'
      if (r.mode === 'Physical') return 'Instructor-Led (Physical)'
      return r.mode || 'Mode Test'
    }
    if (qt === 'final') return 'Final Mock Test'
    return r.chapter || r.module || r.mode || 'Quiz'
  }

  if (isAdmin) {
    return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Admin Dashboard</h1>
          <p className="text-on-surface-variant text-sm mt-1">Welcome, {profile?.displayName || profile?.email}</p>
        </div>

        {/* Admin Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-surface border border-outline-variant rounded-xl p-4">
            <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Users</span>
            <p className="font-['Hanken_Grotesk'] text-2xl font-bold text-primary mt-1">{stats?.userCount || 0}</p>
          </div>
          <div className="bg-surface border border-outline-variant rounded-xl p-4">
            <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Quizzes Taken</span>
            <p className="font-['Hanken_Grotesk'] text-2xl font-bold text-primary mt-1">{stats.total}</p>
          </div>
          <div className="bg-surface border border-outline-variant rounded-xl p-4">
            <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Avg Score</span>
            <p className="font-['Hanken_Grotesk'] text-2xl font-bold text-primary mt-1">{stats.avgScore}%</p>
          </div>
        </div>

        {/* Recent Activity Across All Users */}
        <div className="bg-surface border border-outline-variant rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-on-surface">Recent Activity — All Users</h3>
          </div>
          {recentResults.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-6">No quizzes taken yet.</p>
          ) : (
            <div className="space-y-2">
              {recentResults.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-2 border-b border-outline-variant last:border-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${(r.percentage || 0) >= 60 ? 'bg-success' : 'bg-error'}`}>
                    {r.displayName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-on-surface truncate">
                      <span className="font-semibold">{r.displayName || r.userEmail || 'Unknown'}</span>
                      {' '}took{' '}
                      {getResultTitle(r)}
                    </p>
                    <p className="text-[10px] text-on-surface-variant">{r.score}/{r.totalQuestions} · {r.percentage}% · {formatDate(r.completedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Management Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button onClick={() => navigate('/admin/users')} className="bg-surface border border-outline-variant p-6 rounded-xl hover:shadow-sm transition-all text-left cursor-pointer active:scale-[0.98]">
            <FiUsers size={24} className="text-primary mb-3" />
            <h3 className="font-semibold text-on-surface">Manage Users</h3>
            <p className="text-xs text-on-surface-variant mt-1">Create, edit, or delete users</p>
          </button>
          <button onClick={() => navigate('/admin/questions')} className="bg-surface border border-outline-variant p-6 rounded-xl hover:shadow-sm transition-all text-left cursor-pointer active:scale-[0.98]">
            <FiFileText size={24} className="text-primary mb-3" />
            <h3 className="font-semibold text-on-surface">Manage Questions</h3>
            <p className="text-xs text-on-surface-variant mt-1">View, edit, or delete questions</p>
          </button>
          <button onClick={() => navigate('/admin/upload')} className="bg-surface border border-outline-variant p-6 rounded-xl hover:shadow-sm transition-all text-left cursor-pointer active:scale-[0.98]">
            <FiBookOpen size={24} className="text-primary mb-3" />
            <h3 className="font-semibold text-on-surface">Upload CSV</h3>
            <p className="text-xs text-on-surface-variant mt-1">Bulk add questions from CSV</p>
          </button>
        </div>
      </div>
    )
  }

  return (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-5xl mx-auto">
      {/* Greeting */}
      <section className="mb-6">
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Welcome back, {profile?.displayName?.split(' ')[0] || 'Student'}</h1>
        <p className="text-on-surface-variant text-sm mt-0.5">You've completed {stats.total} test{stats.total !== 1 ? 's' : ''}. Keep going!</p>
      </section>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-surface border border-outline-variant rounded-xl p-4">
          <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Tests</span>
          <p className="font-['Hanken_Grotesk'] text-2xl font-bold text-primary mt-1">{stats.total}</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-4">
          <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Avg</span>
          <p className="font-['Hanken_Grotesk'] text-2xl font-bold text-primary mt-1">{stats.avgScore}%</p>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-4">
          <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Best</span>
          <p className="font-['Hanken_Grotesk'] text-2xl font-bold text-primary mt-1">{stats.bestScore}%</p>
        </div>
      </div>

      {/* CTA Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <button onClick={() => navigate('/quiz/select')} className="bg-primary text-on-primary p-6 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer shadow-sm">
          <span className="material-symbols-outlined text-[32px] mb-3">play_arrow</span>
          <h3 className="font-['Hanken_Grotesk'] text-lg font-bold">Take a Quiz</h3>
          <p className="text-sm text-white/80 mt-1">Chapter, Module, Mode, or Final Mock Test</p>
        </button>
        <button onClick={() => navigate('/results')} className="bg-surface border border-outline-variant p-6 rounded-xl text-left hover:shadow-sm transition-all active:scale-[0.98] cursor-pointer">
          <span className="material-symbols-outlined text-[32px] text-primary mb-3">insights</span>
          <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface">My Results</h3>
          <p className="text-sm text-on-surface-variant mt-1">View past attempts and track progress</p>
        </button>
      </div>

      {/* Recent Activity */}
      <div className="bg-surface border border-outline-variant rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-on-surface">Recent Activity</h3>
          <button onClick={() => navigate('/results')} className="text-xs text-primary font-semibold hover:underline cursor-pointer">View All</button>
        </div>
        {recentResults.length === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-6">No tests taken yet. Start a quiz to see activity!</p>
        ) : (
          <div className="space-y-3">
            {recentResults.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  (r.percentage || 0) >= 80 ? 'bg-green-100 text-success' :
                  (r.percentage || 0) >= 60 ? 'bg-yellow-100 text-warning' :
                  'bg-red-100 text-error'
                }`}>
                  <span className="material-symbols-outlined text-[16px]">
                    {(r.percentage || 0) >= 60 ? 'check_circle' : 'close'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">{getResultTitle(r)}</p>
                  <p className="text-xs text-on-surface-variant">{r.score}/{r.totalQuestions} · {r.percentage}% · {formatDate(r.completedAt)}</p>
                </div>
                <span className={`text-xs font-bold ${(r.percentage || 0) >= 60 ? 'text-success' : 'text-error'}`}>
                  {(r.percentage || 0) >= 60 ? 'Pass' : 'Fail'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
