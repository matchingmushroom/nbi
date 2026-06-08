import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../lib/utils'
import { BADGES, getLevelProgress } from '../lib/gamification'
import { DAILY_MISSIONS, checkDailyMission } from '../lib/missions'
import { FiUsers, FiFileText, FiBookOpen } from 'react-icons/fi'
import { getAllUsersCached, getAllResultsCached, getUserResultsCached } from '../lib/cache'
import { ensureLearningProfile, getLocalLearningProfile, getCourseProgress } from '../lib/steakService'

export default function DashboardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = profile?.role === 'admin'
  const isModerator = profile?.role === 'moderator'
  const [recentResults, setRecentResults] = useState([])
  const [stats, setStats] = useState({ total: 0, avgScore: 0, bestScore: 0 })
  const [completedMissions, setCompletedMissions] = useState([])
  const [quizToast, setQuizToast] = useState(null)
  const [enrolledCourses, setEnrolledCourses] = useState([])
  const [allCourseInfo, setAllCourseInfo] = useState([])


  useEffect(() => {
    if (!profile?.uid || isAdmin) return
    loadCourses()
  }, [profile?.uid, isAdmin])

  async function loadCourses() {
    if (!profile?.uid) return
    try {
      const { getAllCourses } = await import('../lib/steakService')
      const prof = await ensureLearningProfile(profile.uid)
      const courses = await getAllCourses()
      const enrolled = Object.keys(prof.learning?.enrolledCourses || {})
        .map(cid => {
          const info = courses.find(c => c.courseId === cid)
          const prog = prof.learning?.enrolledCourses?.[cid]
          if (!info || !prog) return null
          return { ...info, progress: prog }
        })
        .filter(Boolean)
      setEnrolledCourses(enrolled)
      setAllCourseInfo(courses)
    } catch (e) {
      console.error('Courses load error:', e)
    }
  }

  useEffect(() => {
    try {
      const data = sessionStorage.getItem('nbi_quiz_done')
      if (data) {
        setQuizToast(JSON.parse(data))
        sessionStorage.removeItem('nbi_quiz_done')
        setTimeout(() => setQuizToast(null), 6000)
      }
    } catch {}
  }, [location.pathname])

  useEffect(() => {
    if (!profile?.uid) return
    let cancelled = false
    const fetch = async () => {
      try {
        if (isAdmin) {
          const [allUsers, allResults] = await Promise.all([
            getAllUsersCached(),
            getAllResultsCached(),
          ])
          if (cancelled) return
          allResults.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
          setRecentResults(allResults.slice(0, 10))
          const scores = allResults.map((r) => r.percentage || 0)
          setStats({
            total: allResults.length,
            avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
            bestScore: scores.length ? Math.max(...scores) : 0,
            userCount: allUsers.length,
          })
        } else {
          const all = await getUserResultsCached(profile.uid)
          if (cancelled) return
          all.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
          setRecentResults(all.slice(0, 5))
          if (all.length) {
            const scores = all.map((r) => r.percentage || 0)
            setStats({
              total: all.length,
              avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
              bestScore: Math.max(...scores),
            })
          }
          const todayStr = new Date().toISOString().split('T')[0]
          const todayResults = all.filter(r => (r.completedAt || '').split('T')[0] === todayStr)
          setCompletedMissions(DAILY_MISSIONS.filter(m => checkDailyMission(m.id, todayResults)).map(m => m.id))

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
                      <span className="font-semibold">{r.displayName || r.userEmail?.split('@')[0] || r.userEmail || 'Unknown'}</span>
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
          <button onClick={() => navigate('/admin/questions')} className="bg-surface border border-outline-variant p-6 rounded-xl hover:shadow-sm transition-all text-left cursor-pointer active:scale-[0.98]">
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
      {/* Quiz Completion Toast */}
      {quizToast && (
        <div className="mb-4 bg-primary-fixed border border-primary/20 rounded-xl p-3 shadow-sm animate-slide-down">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-[20px]">stars</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-primary">+{quizToast.xpEarned} XP Earned!</p>
              <p className="text-[11px] text-on-surface-variant">Score: {quizToast.score}/{quizToast.total} · {quizToast.leveledUp ? `Leveled up to ${quizToast.newLevel}!` : `${quizToast.newBadges?.length || 0} new badge${quizToast.newBadges?.length !== 1 ? 's' : ''} earned`}</p>
            </div>
            <button onClick={() => setQuizToast(null)} className="text-on-surface-variant hover:text-on-surface cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          {quizToast.leveledUp && (
            <div className="mt-2 bg-warning/10 border border-warning/20 rounded-lg p-1.5 text-center">
              <p className="text-xs font-bold text-warning flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                LEVEL UP! You're now Level {quizToast.newLevel}
              </p>
            </div>
          )}
          {quizToast.newBadges?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quizToast.newBadges.map(b => (
                <div key={b.id} className="flex items-center gap-1 bg-primary-fixed-dim/30 px-2 py-0.5 rounded text-[10px] font-medium">
                  <span className="material-symbols-outlined text-primary text-[12px]" style={{fontVariationSettings: "'FILL' 1"}}>{b.icon}</span>
                  {b.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Greeting */}
      <section className="mb-6">
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Welcome back, {profile?.displayName?.split(' ')[0] || 'Student'}</h1>
        <p className="text-on-surface-variant text-sm mt-0.5">You've completed {stats.total} test{stats.total !== 1 ? 's' : ''}. Keep going!</p>
      </section>

      {/* XP & Level Card */}
      <div className="bg-surface border border-outline-variant rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-on-surface">Level {profile?.level || 1}</span>
            <span className="text-xs text-on-surface-variant">{profile?.xp || 0} XP</span>
          </div>
          <div className="flex items-center gap-2">
            {(profile?.streak || 0) > 0 && (
              <div className="flex items-center gap-1 text-orange-500">
                <span className="material-symbols-outlined text-[16px]" style={{fontVariationSettings: "'FILL' 1"}}>local_fire_department</span>
                <span className="text-xs font-bold">{profile.streak}</span>
              </div>
            )}
          </div>
        </div>
        <div className="w-full h-2 bg-surface-container-low rounded-full overflow-hidden">
          <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${getLevelProgress(profile?.xp || 0)}%` }} />
        </div>
      </div>

      {/* Daily Missions */}
      <div className="bg-surface border border-outline-variant rounded-xl p-4 mb-4">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="material-symbols-outlined text-[14px] text-on-surface-variant">assignment</span>
          <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Today's Missions</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DAILY_MISSIONS.map(m => {
            const done = completedMissions.includes(m.id)
            return (
              <div key={m.id} className={`flex items-center gap-2 p-2 rounded-lg border ${done ? 'bg-success/5 border-success/20' : 'bg-surface-container-low/50 border-outline-variant/50'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-success/20 text-success' : 'bg-outline-variant/50 text-on-surface-variant'}`}>
                  <span className="material-symbols-outlined text-[14px]">{done ? 'check' : m.icon}</span>
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-semibold leading-tight ${done ? 'text-success' : 'text-on-surface'}`}>{m.name}</p>
                  <p className="text-[9px] text-on-surface-variant leading-tight truncate">{m.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
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
        <div className="bg-surface border border-outline-variant rounded-xl p-4">
          <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Courses</span>
          <p className="font-['Hanken_Grotesk'] text-2xl font-bold text-primary mt-1">{enrolledCourses.length}</p>
        </div>
      </div>

      {/* Enrolled Courses */}
      {enrolledCourses.length > 0 && (
        <div className="mb-6 space-y-3">
          <h3 className="font-['Hanken_Grotesk'] font-bold text-on-surface">My Courses</h3>
          {enrolledCourses.map(c => {
            const complete = c.progress?.completedDays?.length || 0
            const total = c.dayCount || 1
            const streak = c.progress?.currentSteak || 0
            const hasReview = c.progress?.completedDays?.length > 0 &&
              c.progress?.reviewedDays?.length < c.progress?.completedDays?.length
            return (
              <div key={c.courseId} onClick={() => navigate('/learn')}
                className="bg-surface border border-outline-variant rounded-xl p-4 cursor-pointer hover:shadow-sm transition-all active:scale-[0.98]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm text-on-surface">{c.courseTitle}</h4>
                  {streak > 0 && (
                    <div className="flex items-center gap-0.5 text-xs text-orange-500">
                      <span className="material-symbols-outlined text-[14px]" style={{fontVariationSettings:"'FILL' 1"}}>local_fire_department</span>
                      {streak}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-on-surface-variant mb-1.5">
                  <span>{complete}/{total} days</span>
                  {hasReview && <span className="text-warning font-medium">Review pending</span>}
                  {c.progress?.courseStatus === 'LESSONS_COMPLETED' && <span className="text-success font-medium">Exam ready</span>}
                  {c.progress?.courseStatus === 'PASSED' && <span className="text-success font-medium">Passed ✓</span>}
                  {c.progress?.courseStatus === 'FAILED' && <span className="text-error font-medium">Failed</span>}
                </div>
                <div className="h-1.5 bg-outline-variant/30 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${(complete / total) * 100}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CTA Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {enrolledCourses.length > 0 && (() => {
          const latest = enrolledCourses.sort((a, b) => (b.progress?.enrolledAt || '').localeCompare(a.progress?.enrolledAt || ''))[0]
          const readyForReview = latest?.progress?.completedDays?.length > 0 &&
            latest?.progress?.reviewedDays?.length < latest?.progress?.completedDays?.length
          return (
            <button onClick={() => navigate('/learn')} className="bg-primary text-on-primary p-6 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer shadow-sm md:col-span-1">
              <span className="material-symbols-outlined text-[32px] mb-3">school</span>
              <h3 className="font-['Hanken_Grotesk'] text-lg font-bold">Continue Learning</h3>
              <p className="text-sm text-white/80 mt-1">
                {latest?.progress?.courseStatus === 'LESSONS_COMPLETED' ? 'Take certification exam'
                  : readyForReview ? `${latest?.courseTitle} — review pending`
                  : `${latest?.courseTitle} — day ${(latest?.progress?.completedDays?.length || 0) + 1}`
                }
              </p>
            </button>
          )
        })()}
        <button onClick={() => navigate('/quiz/select')} className="bg-primary text-on-primary p-6 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer shadow-sm">
          <span className="material-symbols-outlined text-[32px] mb-3">play_arrow</span>
          <h3 className="font-['Hanken_Grotesk'] text-lg font-bold">Take a Quiz</h3>
          <p className="text-sm text-white/80 mt-1">Chapter, Module, Mode, or Final Mock Test</p>
        </button>
        <button onClick={() => navigate('/results')} className="bg-amber-500 text-white p-6 rounded-xl text-left transition-all active:scale-[0.98] cursor-pointer shadow-sm">
          <span className="material-symbols-outlined text-[32px] mb-3">insights</span>
          <h3 className="font-['Hanken_Grotesk'] text-lg font-bold">View Results</h3>
          <p className="text-sm text-white/80 mt-1">Track your progress and scores</p>
        </button>
      </div>

      {/* Moderator Management */}
      {isModerator && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <button onClick={() => navigate('/admin/questions')} className="bg-surface border border-outline-variant p-6 rounded-xl hover:shadow-sm transition-all text-left cursor-pointer active:scale-[0.98]">
            <span className="material-symbols-outlined text-[32px] text-primary mb-3">quiz</span>
            <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface">Manage Questions</h3>
            <p className="text-sm text-on-surface-variant mt-1">View, edit, or delete questions</p>
          </button>
          <button onClick={() => navigate('/admin/courses')} className="bg-surface border border-outline-variant p-6 rounded-xl hover:shadow-sm transition-all text-left cursor-pointer active:scale-[0.98]">
            <span className="material-symbols-outlined text-[32px] text-primary mb-3">school</span>
            <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface">Manage Courses</h3>
            <p className="text-sm text-on-surface-variant mt-1">Show, hide, or edit courses</p>
          </button>
        </div>
      )}

      {/* Badges */}
      {profile?.badges?.length > 0 && (
        <div className="bg-surface border border-outline-variant rounded-xl p-4 mb-4">
          <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Badges ({profile.badges.length})</h3>
          <div className="flex flex-wrap gap-2">
            {BADGES.filter(b => profile.badges.includes(b.id)).map((b) => (
              <div key={b.id} className="flex items-center gap-1.5 bg-primary-fixed/10 px-2.5 py-1.5 rounded-lg" title={b.desc}>
                <span className="material-symbols-outlined text-primary text-[14px]" style={{fontVariationSettings: "'FILL' 1"}}>{b.icon}</span>
                <span className="text-[10px] font-semibold text-on-surface">{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
