import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getQuizSettings, canAccessPremium } from '../lib/quizSettings'
import { getAllQuestionsCached } from '../lib/cache'


function getTestTypes(settings) {
  return [
    { key: 'chapter', icon: 'menu_book', label: 'Chapter Based Test', desc: `${settings.chapterQuestionCount} Qs · ${settings.chapterTimerMinutes} min · 20% B / 40% I / 40% E`, color: 'from-blue-600 to-blue-500', linkedCourse: settings.chapterLinkedCourse || '' },
    { key: 'module', icon: 'folder', label: 'Module Based Test', desc: `${settings.moduleQuestionCount} Qs · ${settings.moduleTimerMinutes} min · 20% B / 40% I / 40% E`, color: 'from-emerald-600 to-emerald-500', linkedCourse: settings.moduleLinkedCourse || '' },
    { key: 'mode', icon: 'school', label: 'Mode Based Test', desc: `${settings.modeQuestionCount} Qs · ${settings.modeTimerMinutes} min · 30% B / 30% I / 40% E`, color: 'from-purple-600 to-purple-500', linkedCourse: settings.modeLinkedCourse || '' },
    { key: 'final', icon: 'military_tech', label: 'Final Mock Test', desc: `${settings.finalQuestionCount} Qs · ${settings.finalTimerMinutes} min · 60% Book / 40% Physical`, color: 'from-amber-600 to-orange-500', linkedCourse: settings.finalLinkedCourse || '' },
  ]
}

export default function QuizSelectPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState('choose')
  const [selectedType, setSelectedType] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState(null)
  const [limitError, setLimitError] = useState(null)


  useEffect(() => {
    const data = sessionStorage.getItem('nbi_attempt_limit')
    if (data) {
      const parsed = JSON.parse(data)
      const labels = { chapter: 'Chapter', module: 'Module', mode: 'Mode', final: 'Final Mock' }
      setLimitError(`You've reached your attempt limit for ${labels[parsed.quizType] || parsed.quizType} Tests. Contact admin to increase your limit.`)
      sessionStorage.removeItem('nbi_attempt_limit')
    }
  }, [])

  useEffect(() => {
    const fetch = async () => {
      const [qs, s] = await Promise.all([
        getAllQuestionsCached(),
        getQuizSettings(),
      ])
      setSettings(s)

      const modules = {}
      const chaptersByModule = {}
      const modes = {}

      qs.forEach((q) => {
        const mod = q.module || 'General'
        const ch = q.chapter || 'Unknown'
        const mode = q.mode || 'Unknown'

        modules[mod] = (modules[mod] || 0) + 1
        modes[mode] = (modes[mode] || 0) + 1
        if (q.mode !== 'Physical') {
          if (!chaptersByModule[mod]) chaptersByModule[mod] = {}
          chaptersByModule[mod][ch] = (chaptersByModule[mod][ch] || 0) + 1
        }
      })

      setItems({ modules, chaptersByModule, modes })
      setLoading(false)

      if (!canAccessPremium(profile) && s.premiumQuizChapters?.length) {
        const banned = new Set(s.premiumQuizChapters)
        Object.keys(chaptersByModule).forEach((mod) => {
          Object.keys(chaptersByModule[mod]).forEach((ch) => {
            if (banned.has(ch)) delete chaptersByModule[mod][ch]
          })
          if (Object.keys(chaptersByModule[mod]).length === 0) delete chaptersByModule[mod]
        })
      }
    }
    fetch()
  }, [])

  const handleTypeSelect = (type) => {
    if (type === 'final') {
      navigate('/quiz/final')
      return
    }
    setSelectedType(type)
    setStep('list')
  }

  const handleBack = () => {
    setStep('choose')
    setSelectedType(null)
  }

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <p className="text-on-surface-variant">Loading...</p>
    </div>
  )

  if (step === 'list' && selectedType === 'module') {
    const { modules } = items
    return (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
        <button onClick={handleBack} className="flex items-center gap-1 text-sm text-primary font-semibold hover:underline mb-4 cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Test Types
        </button>
        <h1 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface mb-1">Module Based Test</h1>
        <p className="text-sm text-on-surface-variant mb-5">Select a module to test your knowledge</p>
        <div className="space-y-2">
          {Object.entries(modules).sort().map(([mod, count]) => (
            <button
              key={mod}
              onClick={() => navigate(`/quiz/module/${encodeURIComponent(mod)}`)}
              className="w-full bg-surface border border-outline-variant p-4 rounded-xl hover:shadow-sm transition-all flex items-center justify-between active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <span className="material-symbols-outlined">folder_open</span>
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-sm text-on-surface">{mod}</h3>
                  <p className="text-xs text-on-surface-variant">{count} questions available</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant text-[20px]">chevron_right</span>
            </button>
          ))}
          {Object.keys(modules).length === 0 && (
            <p className="text-center py-8 text-on-surface-variant text-sm">No modules available.</p>
          )}
        </div>
      </div>
    )
  }

  if (step === 'list' && selectedType === 'chapter') {
    const { chaptersByModule } = items
    return (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
        <button onClick={handleBack} className="flex items-center gap-1 text-sm text-primary font-semibold hover:underline mb-4 cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Test Types
        </button>
        <h1 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface mb-1">Chapter Based Test</h1>
        <p className="text-sm text-on-surface-variant mb-5">Select a chapter to test your knowledge</p>
        {Object.keys(chaptersByModule).length === 0 ? (
          <p className="text-center py-8 text-on-surface-variant text-sm">No chapters available.</p>
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
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                          <span className="material-symbols-outlined">description</span>
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-sm text-on-surface">{chapter}</h3>
                          <p className="text-xs text-on-surface-variant">{count} questions available</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant text-[20px]">chevron_right</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (step === 'list' && selectedType === 'mode') {
    const { modes } = items
    return (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
        <button onClick={handleBack} className="flex items-center gap-1 text-sm text-primary font-semibold hover:underline mb-4 cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Test Types
        </button>
        <h1 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface mb-1">Mode Based Test</h1>
        <p className="text-sm text-on-surface-variant mb-5">Select a mode to test your knowledge</p>
        <div className="space-y-2">
          {Object.entries(modes).sort().map(([mode, count]) => (
            <button
              key={mode}
              onClick={() => navigate(`/quiz/mode/${encodeURIComponent(mode)}`)}
              className="w-full bg-surface border border-outline-variant p-4 rounded-xl hover:shadow-sm transition-all flex items-center justify-between active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                  <span className="material-symbols-outlined">library_books</span>
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-sm text-on-surface">
                    {mode === 'Book' ? 'Self-Paced (Book)' : mode === 'Physical' ? 'Instructor-Led (Physical)' : mode}
                  </h3>
                  <p className="text-xs text-on-surface-variant">{count} questions available</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant text-[20px]">chevron_right</span>
            </button>
          ))}
          {Object.keys(modes).length === 0 && (
            <p className="text-center py-8 text-on-surface-variant text-sm">No modes available.</p>
          )}
        </div>
      </div>
    )
  }

  const testTypes = settings ? getTestTypes(settings) : []

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Choose Type of Test</h1>
        <p className="text-on-surface-variant text-sm mt-1">Select a test type to begin your exam</p>
      </div>

      {limitError && (
        <div className="mb-4 bg-error/5 border border-error/20 rounded-xl p-3 flex items-start gap-2">
          <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">error</span>
          <p className="text-sm text-on-surface">{limitError}</p>
          <button onClick={() => setLimitError(null)} className="text-on-surface-variant hover:text-on-surface cursor-pointer shrink-0">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      <div className="space-y-3">
        {testTypes.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTypeSelect(t.key)}
            className="w-full bg-surface border border-outline-variant p-5 rounded-xl hover:shadow-md transition-all flex items-center gap-4 text-left active:scale-[0.98] cursor-pointer"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center shrink-0 shadow-sm`}>
              <span className="material-symbols-outlined text-white text-[24px]">{t.icon}</span>
            </div>
            <div className="flex-1">
              <h3 className="font-['Hanken_Grotesk'] font-bold text-base text-on-surface">{t.label}</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">{t.desc}</p>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant text-[22px]">chevron_right</span>
          </button>
        ))}
      </div>
    </div>
  )
}
