import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'

export default function QuizSelectPage() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(collection(db, 'questions'))
      const qs = snap.docs.map((d) => d.data())
      const totalQuestions = qs.length

      const modules = {}
      const modes = {}
      const chaptersByModule = {}

      qs.forEach((q) => {
        const mod = q.module || 'General'
        const mode = q.mode || 'Unknown'
        const ch = q.chapter || 'Unknown'

        if (!modules[mod]) modules[mod] = 0
        modules[mod]++

        if (!modes[mode]) modes[mode] = 0
        modes[mode]++

        if (!chaptersByModule[mod]) chaptersByModule[mod] = {}
        if (!chaptersByModule[mod][ch]) chaptersByModule[mod][ch] = 0
        chaptersByModule[mod][ch]++
      })

      setData({ totalQuestions, modules, modes, chaptersByModule })
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <p className="text-on-surface-variant">Loading...</p>
    </div>
  )

  const { totalQuestions, modules, modes, chaptersByModule } = data

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Select Quiz Mode</h1>
        <p className="text-on-surface-variant text-sm mt-1">{totalQuestions} total questions available</p>
      </div>

      {/* D. Final Mock Test */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-warning">military_tech</span>
          Final Mock Test
        </h2>
        <button
          onClick={() => navigate('/quiz/final')}
          className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary p-5 rounded-xl text-left transition-all active:scale-[0.98] shadow-sm cursor-pointer"
        >
          <h3 className="font-['Hanken_Grotesk'] text-lg font-bold">Final Mock Test — 100 Questions</h3>
          <p className="text-sm text-white/80 mt-1">60% Book · 40% Physical · 100 min · 1 mark each</p>
        </button>
      </div>

      {/* C. Based on Mode */}
      {Object.keys(modes).length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-secondary">school</span>
            Based on Mode
          </h2>
          <div className="space-y-2">
            {Object.entries(modes).sort().map(([mode, count]) => (
              <button
                key={mode}
                onClick={() => navigate(`/quiz/mode/${encodeURIComponent(mode)}`)}
                className="w-full bg-surface border border-outline-variant p-4 rounded-xl hover:shadow-sm transition-all flex items-center justify-between active:scale-[0.98] cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined">library_books</span>
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-sm text-on-surface">
                      {mode === 'Book' ? 'Self-Paced (Book)' : mode === 'Physical' ? 'Instructor-Led (Physical)' : mode}
                    </h3>
                    <p className="text-xs text-on-surface-variant">{count} questions · 50 min · 15B / 15I / 20E</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant bg-surface-container-low px-2 py-1 rounded-full">50 Qs</span>
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px]">chevron_right</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* B. Based on Module */}
      {Object.keys(modules).length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">folder</span>
            Based on Module
          </h2>
          <div className="space-y-2">
            {Object.entries(modules).sort().map(([mod, count]) => (
              <button
                key={mod}
                onClick={() => navigate(`/quiz/module/${encodeURIComponent(mod)}`)}
                className="w-full bg-surface border border-outline-variant p-4 rounded-xl hover:shadow-sm transition-all flex items-center justify-between active:scale-[0.98] cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">folder_open</span>
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-sm text-on-surface">{mod}</h3>
                    <p className="text-xs text-on-surface-variant">{count} questions · 30 min · 4B / 8I / 8E</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant bg-surface-container-low px-2 py-1 rounded-full">20 Qs</span>
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px]">chevron_right</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* A. Based on Chapter */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary">menu_book</span>
          Based on Chapter
        </h2>
        {Object.keys(chaptersByModule).length === 0 ? (
          <div className="text-center py-12 text-on-surface-variant">
            <span className="material-symbols-outlined text-[40px] mb-2">library_books</span>
            <p className="text-sm">No chapters available yet. Contact your admin.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(chaptersByModule).sort().map(([mod, chs]) => (
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
                          <p className="text-xs text-on-surface-variant">{count} questions · 10 min · 2B / 4I / 4E</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-on-surface-variant bg-surface-container-low px-2 py-1 rounded-full">10 Qs</span>
                        <span className="material-symbols-outlined text-on-surface-variant text-[20px]">chevron_right</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
