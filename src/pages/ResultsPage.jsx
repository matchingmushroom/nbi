import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../lib/utils'

export default function ResultsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!profile?.uid) return
    let cancelled = false
    setLoading(true)
    const fetch = async () => {
      try {
        const q = query(
          collection(db, 'results'),
          where('userId', '==', profile.uid)
        )
        const snap = await getDocs(q)
        if (cancelled) return
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        data.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
        setResults(data)
      } catch (e) {
        console.error('Results fetch error:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [profile, location.pathname])

  const getQuizType = (r) => r.quizType || r.testType || 'chapter'

  const filtered = filter === 'all' ? results : results.filter((r) => getQuizType(r) === filter)

  const getTitle = (r) => {
    const qt = getQuizType(r)
    if (qt === 'chapter') return r.chapter || 'Chapter Test'
    if (qt === 'module') return r.module || 'Module Test'
    if (qt === 'mode') {
      if (r.mode === 'Book') return 'Self-Paced (Book)'
      if (r.mode === 'Physical') return 'Instructor-Led (Physical)'
      return r.mode || 'Mode Test'
    }
    return 'Final Mock Test'
  }

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <p className="text-on-surface-variant">Loading...</p>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">My Results</h1>
        <p className="text-on-surface-variant text-sm mt-1">{results.length} total attempt{results.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: 'all', label: 'All Tests' },
          { key: 'chapter', label: 'Chapter' },
          { key: 'module', label: 'Module' },
          { key: 'mode', label: 'Mode' },
          { key: 'final', label: 'Final' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              filter === t.key
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-[48px] mb-3">insights</span>
          <p className="text-sm font-medium">No results found.</p>
          <p className="text-xs mt-1">Take a quiz to see your results here.</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((r) => (
          <button
            key={r.id}
            onClick={() => navigate(`/results/${r.id}`)}
            className="w-full bg-surface border border-outline-variant rounded-xl p-4 hover:shadow-sm transition-all flex items-center justify-between active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                (r.percentage || 0) >= 80 ? 'bg-green-100' :
                (r.percentage || 0) >= 60 ? 'bg-yellow-100' : 'bg-red-100'
              }`}>
                <span className={`material-symbols-outlined text-[20px] ${
                  (r.percentage || 0) >= 80 ? 'text-success' :
                  (r.percentage || 0) >= 60 ? 'text-warning' : 'text-error'
                }`}>
                  {(r.percentage || 0) >= 60 ? 'check_circle' : 'cancel'}
                </span>
              </div>
              <div className="text-left min-w-0">
                <h3 className="text-sm font-semibold text-on-surface truncate">{getTitle(r)}</h3>
                <p className="text-xs text-on-surface-variant">{formatDate(r.completedAt)}</p>
              </div>
            </div>
            <div className="text-right shrink-0 ml-3">
              <p className="text-sm font-bold text-primary">{r.score}<span className="text-xs text-on-surface-variant font-normal">/{r.totalQuestions}</span></p>
              <p className="text-xs text-on-surface-variant">{r.percentage}%</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
