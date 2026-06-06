import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'

export default function QuizSelectPage() {
  const navigate = useNavigate()
  const [chapters, setChapters] = useState({})
  const [loading, setLoading] = useState(true)
  const [questionCount, setQuestionCount] = useState(0)

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(collection(db, 'questions'))
      const qs = snap.docs.map((d) => d.data())
      setQuestionCount(qs.length)
      const modules = {}
      qs.forEach((q) => {
        const mod = q.module || 'General'
        const ch = q.chapter || 'Unknown'
        if (!modules[mod]) modules[mod] = {}
        if (!modules[mod][ch]) modules[mod][ch] = 0
        modules[mod][ch]++
      })
      setChapters(modules)
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <p className="text-on-surface-variant">Loading...</p>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Select Quiz Mode</h1>
        <p className="text-on-surface-variant text-sm mt-1">{questionCount} total questions available</p>
      </div>

      {/* Final Test Card */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-warning">military_tech</span>
          Final Exam
        </h2>
        <button
          onClick={() => navigate('/quiz/final')}
          className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary p-5 rounded-xl text-left transition-all active:scale-[0.98] shadow-sm cursor-pointer"
        >
          <h3 className="font-['Hanken_Grotesk'] text-lg font-bold">Final Test — 100 Questions</h3>
          <p className="text-sm text-white/80 mt-1">20% Beginner · 30% Intermediate · 50% Expert · 60 min timer</p>
        </button>
      </div>

      {/* Chapter Tests */}
      <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-primary">menu_book</span>
        Chapter Tests
      </h2>
      <div className="space-y-4">
        {Object.keys(chapters).length === 0 && (
          <div className="text-center py-12 text-on-surface-variant">
            <span className="material-symbols-outlined text-[40px] mb-2">library_books</span>
            <p className="text-sm">No chapters available yet. Contact your admin.</p>
          </div>
        )}
        {Object.entries(chapters).sort().map(([mod, chs]) => (
          <div key={mod}>
            {mod !== 'General' && (
              <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2 px-1">{mod}</h3>
            )}
            <div className="space-y-2">
              {Object.entries(chs).sort((a, b) => a[0].localeCompare(b[0])).map(([chapter, count]) => (
                <button
                  key={chapter}
                  onClick={() => navigate(`/quiz/chapter/${encodeURIComponent(chapter)}`)}
                  className="w-full bg-surface border border-outline-variant p-4 rounded-xl hover:shadow-sm transition-all flex items-center justify-between active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">description</span>
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-sm text-on-surface">{chapter}</h3>
                      <p className="text-xs text-on-surface-variant">{count} question{count !== 1 ? 's' : ''} · 30 min timer</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-on-surface-variant bg-surface-container-low px-2 py-1 rounded-full">{Math.min(count, 10)} Qs</span>
                    <span className="material-symbols-outlined text-on-surface-variant text-[20px]">chevron_right</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
