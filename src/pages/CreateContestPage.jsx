import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAllQuestionsCached, getAllUsersCached } from '../lib/cache'
import { getQuizSettings, checkModuleAccess, canAccessPremium } from '../lib/quizSettings'
import { createContest, validateBetForUsers } from '../lib/contestService'

const QUESTION_SOURCES = [
  { type: 'chapter', icon: 'menu_book', label: 'Chapter Based', color: 'from-blue-600 to-blue-500' },
  { type: 'module', icon: 'folder', label: 'Module Based', color: 'from-emerald-600 to-emerald-500' },
  { type: 'mode', icon: 'school', label: 'Mode Based', color: 'from-purple-600 to-purple-500' },
  { type: 'mockTest', icon: 'fact_check', label: 'Mock Test', color: 'from-indigo-600 to-violet-500' },
]

export default function CreateContestPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [sourceType, setSourceType] = useState(null)
  const [sourceValue, setSourceValue] = useState('')
  const [items, setItems] = useState({})
  const [settings, setSettings] = useState(null)
  const [allUsers, setAllUsers] = useState([])
  const [selectedUsers, setSelectedUsers] = useState(new Set())
  const [title, setTitle] = useState('')
  const [minBet, setMinBet] = useState(50)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      const [qs, s, users] = await Promise.all([
        getAllQuestionsCached(),
        getQuizSettings(),
        getAllUsersCached(),
      ])
      setSettings(s)
      setAllUsers(users.filter((u) => u.uid !== profile?.uid))

      const modules = {}
      const chaptersByModule = {}
      const modes = {}
      qs.forEach((q) => {
        if (q.module === 'Course' && q.mode === 'Certification') return
        if (q.module === 'Mock Test') return
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

      if (!canAccessPremium(profile) && s.premiumQuizChapters?.length) {
        const banned = new Set(s.premiumQuizChapters)
        Object.keys(chaptersByModule).forEach((mod) => {
          Object.keys(chaptersByModule[mod]).forEach((ch) => {
            if (banned.has(ch)) delete chaptersByModule[mod][ch]
          })
          if (Object.keys(chaptersByModule[mod]).length === 0) delete chaptersByModule[mod]
        })
      }

      setItems({ modules, chaptersByModule, modes })
      setLoading(false)
    }
    fetch()
  }, [profile])

  const eligibleUsers = useMemo(() => {
    if (minBet < 1) return allUsers.map((u) => ({ ...u, canBet: false, reason: 'Minimum bet is 1' }))
    return validateBetForUsers(allUsers, minBet)
  }, [allUsers, minBet])

  const canProceedStep2 = sourceType && sourceValue
  const canProceedStep3 = selectedUsers.size >= 1 && title.trim().length >= 3 && minBet >= 1

  const handleCreate = async () => {
    if (!canProceedStep3 || creating) return
    setCreating(true)
    setError(null)
    try {
      const id = await createContest(profile, {
        title: title.trim(),
        sourceType,
        sourceValue,
        invitedUserIds: Array.from(selectedUsers),
        minBet,
      })
      navigate(`/contest/lobby/${id}`)
    } catch (e) {
      setError(e.message || 'Failed to create contest')
      setCreating(false)
    }
  }

  if (loading) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant animate-pulse">Loading...</p></div>

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
      <button onClick={() => step === 1 ? navigate('/contests') : setStep(step - 1)}
        className="flex items-center gap-1 text-sm text-primary font-semibold hover:underline mb-4 cursor-pointer">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        {step === 1 ? 'Back to Contests' : 'Back'}
      </button>

      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              s <= step ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
            }`}>{s}</div>
            <span className={`text-xs font-medium hidden sm:inline ${s <= step ? 'text-on-surface' : 'text-on-surface-variant'}`}>
              {s === 1 ? 'Questions' : s === 2 ? 'Players' : 'Bet & Create'}
            </span>
            {s < 3 && <div className={`flex-1 h-px ${s < step ? 'bg-primary' : 'bg-outline-variant'}`} />}
          </div>
        ))}
      </div>

      <h1 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface mb-1">
        {step === 1 ? 'Select Question Source' : step === 2 ? 'Invite Players' : 'Set Bet & Create'}
      </h1>
      <p className="text-sm text-on-surface-variant mb-5">
        {step === 1 ? 'Choose where questions come from' : step === 2 ? 'Select users to invite (they need enough XP)' : 'Name your contest and set the entry fee'}
      </p>

      {error && (
        <div className="mb-4 bg-error/5 border border-error/20 rounded-xl p-3 flex items-start gap-2">
          <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">error</span>
          <p className="text-sm text-on-surface">{error}</p>
        </div>
      )}

      {/* Step 1: Source */}
      {step === 1 && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {QUESTION_SOURCES.map((src) => (
              <button key={src.type} onClick={() => { setSourceType(src.type); setSourceValue('') }}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  sourceType === src.type ? 'border-primary bg-primary/5' : 'border-outline-variant bg-surface hover:border-primary/30'
                }`}>
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${src.color} flex items-center justify-center mb-3`}>
                  <span className="material-symbols-outlined text-white text-[20px]">{src.icon}</span>
                </div>
                <p className="text-sm font-bold text-on-surface">{src.label}</p>
              </button>
            ))}
          </div>

          {sourceType === 'chapter' && (
            <div className="space-y-2 mb-6">
              {Object.entries(items.chaptersByModule || {}).sort().map(([mod, chs]) => (
                <div key={mod}>
                  {mod !== 'General' && <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1 px-1">{mod}</h3>}
                  <div className="space-y-1 ml-2">
                    {Object.entries(chs).sort().map(([ch, count]) => (
                      <button key={ch} onClick={() => setSourceValue(ch)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-all cursor-pointer ${
                          sourceValue === ch ? 'bg-primary text-on-primary' : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface'
                        }`}>
                        <span className="text-sm font-medium truncate">{ch}</span>
                        <span className={`text-[11px] shrink-0 ml-2 ${sourceValue === ch ? 'text-on-primary/70' : 'text-on-surface-variant'}`}>{count} Qs</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {sourceType === 'module' && (
            <div className="space-y-1 mb-6">
              {Object.entries(items.modules || {}).sort().map(([mod, count]) => (
                checkModuleAccess(profile, mod, settings) && (
                  <button key={mod} onClick={() => setSourceValue(mod)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-all cursor-pointer ${
                      sourceValue === mod ? 'bg-primary text-on-primary' : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface'
                    }`}>
                    <span className="text-sm font-medium truncate">{mod}</span>
                    <span className={`text-[11px] shrink-0 ml-2 ${sourceValue === mod ? 'text-on-primary/70' : 'text-on-surface-variant'}`}>{count} Qs</span>
                  </button>
                )
              ))}
            </div>
          )}

          {sourceType === 'mode' && (
            <div className="space-y-1 mb-6">
              {Object.entries(items.modes || {}).sort().map(([mode, count]) => (
                <button key={mode} onClick={() => setSourceValue(mode)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-all cursor-pointer ${
                    sourceValue === mode ? 'bg-primary text-on-primary' : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface'
                  }`}>
                  <span className="text-sm font-medium truncate">{mode === 'Book' ? 'Self-Paced (Book)' : mode === 'Physical' ? 'Instructor-Led (Physical)' : mode}</span>
                  <span className={`text-[11px] shrink-0 ml-2 ${sourceValue === mode ? 'text-on-primary/70' : 'text-on-surface-variant'}`}>{count} Qs</span>
                </button>
              ))}
            </div>
          )}

          {sourceType === 'mockTest' && (
            <div className="bg-surface-container-low rounded-xl p-4 mb-6">
              <p className="text-sm text-on-surface">15 Mock Test questions will be used (10 will be selected randomly)</p>
              <button onClick={() => setSourceValue('Mock Test')}
                className={`mt-3 w-full p-3 rounded-lg text-center font-semibold transition-all cursor-pointer ${
                  sourceValue === 'Mock Test' ? 'bg-primary text-on-primary' : 'bg-surface border border-outline-variant text-on-surface hover:border-primary/30'
                }`}>Mock Test</button>
            </div>
          )}

          <button onClick={() => setStep(2)} disabled={!canProceedStep2}
            className="w-full bg-primary text-on-primary py-3 rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer">
            Continue to Invite Players
          </button>
        </>
      )}

      {/* Step 2: Invite */}
      {step === 2 && (
        <>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">All Users</span>
              <span className="text-[11px] text-on-surface-variant">({eligibleUsers.length} total)</span>
            </div>

            <div className="space-y-1 max-h-80 overflow-y-auto">
              {eligibleUsers.map((u) => {
                const isSelected = selectedUsers.has(u.uid)
                const disabled = !u.canBet
                return (
                  <button key={u.uid} onClick={() => {
                    if (disabled) return
                    setSelectedUsers((prev) => {
                      const next = new Set(prev)
                      next.has(u.uid) ? next.delete(u.uid) : next.add(u.uid)
                      return next
                    })
                  }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all cursor-pointer ${
                      isSelected ? 'bg-primary/10 border border-primary/30' : disabled ? 'bg-surface opacity-50 border border-outline-variant' : 'bg-surface border border-outline-variant hover:border-primary/20'
                    }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                      isSelected ? 'bg-primary' : 'bg-primary/50'
                    }`}>{u.displayName?.charAt(0)?.toUpperCase() || u.email?.charAt(0)?.toUpperCase() || '?'}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-on-surface truncate">{u.displayName || u.email}</p>
                      <p className="text-[11px] text-on-surface-variant">{u.xp || 0} XP available</p>
                    </div>
                    {disabled ? (
                      <span className="text-[10px] text-error font-semibold whitespace-nowrap">Low XP</span>
                    ) : isSelected ? (
                      <span className="material-symbols-outlined text-primary text-[18px]" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                    ) : (
                      <span className="w-[18px] h-[18px] rounded-full border-2 border-outline-variant" />
                    )}
                  </button>
                )
              })}
              {eligibleUsers.length === 0 && (
                <p className="text-center py-4 text-sm text-on-surface-variant">No other users found.</p>
              )}
            </div>
          </div>

          <div className="glass rounded-xl p-3 mb-4">
            <p className="text-xs text-on-surface-variant">
              <strong className="text-on-surface">{selectedUsers.size}</strong> player{selectedUsers.size !== 1 ? 's' : ''} selected
              {selectedUsers.size > 0 && (
                <span className="ml-2 text-primary">
                  (including you: {selectedUsers.size + 1} total)
                </span>
              )}
            </p>
          </div>

          <button onClick={() => setStep(3)} disabled={selectedUsers.size < 1}
            className="w-full bg-primary text-on-primary py-3 rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer">
            Continue to Bet & Create
          </button>
        </>
      )}

      {/* Step 3: Bet & Create */}
      {step === 3 && (
        <>
          <div className="glass-strong rounded-2xl p-6 border border-white/40 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Contest Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Chapter 5 Showdown"
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
              {title.length > 0 && title.length < 3 && <p className="text-[11px] text-error mt-1">Title must be at least 3 characters</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Minimum Bet (XP)</label>
              <div className="flex items-center gap-3">
                <input type="number" min={1} value={minBet} onChange={(e) => setMinBet(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 px-4 py-3 bg-surface-container-low border border-outline-variant rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                <span className="text-sm text-on-surface-variant">XP per player</span>
              </div>
              {minBet < 1 && <p className="text-[11px] text-error mt-1">Minimum bet is 1 XP</p>}
            </div>

            <div className="bg-primary/5 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-on-surface uppercase tracking-wider">Summary</h3>
              <div className="space-y-1.5 text-xs text-on-surface-variant">
                <div className="flex justify-between"><span>Players</span><span className="font-semibold text-on-surface">{selectedUsers.size + 1}</span></div>
                <div className="flex justify-between"><span>Bet per player</span><span className="font-semibold text-on-surface">{minBet} XP</span></div>
                <div className="flex justify-between"><span>Total pot</span><span className="font-semibold text-warning">{minBet * (selectedUsers.size + 1)} XP</span></div>
                <div className="flex justify-between"><span>Winner prize</span><span className="font-semibold text-success">{minBet * selectedUsers.size} XP</span></div>
                <div className="flex justify-between"><span>Question source</span><span className="font-semibold text-on-surface">{sourceType}: {sourceValue}</span></div>
              </div>
            </div>

            {eligibleUsers.filter((u) => selectedUsers.has(u.uid) && !u.canBet).length > 0 && (
              <div className="bg-error/5 border border-error/20 rounded-xl p-3">
                <p className="text-xs font-semibold text-error mb-1">Ineligible players</p>
                <p className="text-[11px] text-on-surface-variant">
                  {eligibleUsers.filter((u) => selectedUsers.has(u.uid) && !u.canBet).map((u) => u.displayName || u.email).join(', ')}
                  {' '}don't have enough XP. Remove them or lower the bet.
                </p>
              </div>
            )}
          </div>

          <button onClick={handleCreate} disabled={!canProceedStep3 || creating}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-xl font-bold text-sm mt-4 hover:opacity-90 disabled:opacity-40 transition-all shadow-lg shadow-amber-500/20 cursor-pointer">
            {creating ? 'Creating...' : `Create Contest — ${minBet * (selectedUsers.size + 1)} XP Pot`}
          </button>
        </>
      )}
    </div>
  )
}
