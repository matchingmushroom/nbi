import { useState, useEffect, useCallback } from 'react'
import { getQuizSettings, saveQuizSettings } from '../lib/quizSettings'
import { getAllCourses, cleanupOrphanedCourses } from '../lib/steakService'
import { getAllQuestionsCached } from '../lib/cache'

const FIELDS = [
  { key: 'chapterQuestionCount', label: 'Chapter Questions', desc: 'Default: 10' },
  { key: 'moduleQuestionCount', label: 'Module Questions', desc: 'Default: 20' },
  { key: 'modeQuestionCount', label: 'Mode Questions', desc: 'Default: 50' },
  { key: 'finalQuestionCount', label: 'Final Mock Pre-Test Questions', desc: 'Default: 15' },
  { key: 'chapterTimerMinutes', label: 'Chapter Timer (min)', desc: 'Default: 10' },
  { key: 'moduleTimerMinutes', label: 'Module Timer (min)', desc: 'Default: 30' },
  { key: 'modeTimerMinutes', label: 'Mode Timer (min)', desc: 'Default: 50' },
  { key: 'finalTimerMinutes', label: 'Final Mock Pre-Test Timer (min)', desc: 'Default: 15' },
  { key: 'certificationQuestionCount', label: 'Certification Questions', desc: 'Default: 20' },
  { key: 'certificationTimerMinutes', label: 'Certification Timer (min)', desc: 'Default: 30' },
  { key: 'contestQuestionCount', label: 'Contest Questions', desc: 'Default: 10' },
  { key: 'contestTimerMinutes', label: 'Contest Timer (min)', desc: 'Default: 10' },
]

const ATTEMPT_FIELDS = [
  { key: 'chapterAttemptLimit', label: 'Chapter Attempt Limit', desc: '0 = unlimited' },
  { key: 'moduleAttemptLimit', label: 'Module Attempt Limit', desc: '0 = unlimited' },
  { key: 'modeAttemptLimit', label: 'Mode Attempt Limit', desc: '0 = unlimited' },
  { key: 'finalAttemptLimit', label: 'Final Mock Pre-Test Attempt Limit', desc: '0 = unlimited' },
  { key: 'certificationAttemptLimit', label: 'Certification Attempt Limit', desc: '0 = unlimited' },
]

const TABS = [
  { key: 'quiz', label: 'Quiz Config', icon: 'quiz' },
  { key: 'access', label: 'Access', icon: 'lock' },
  { key: 'nav', label: 'Navigation', icon: 'explore' },
  { key: 'linking', label: 'Linking', icon: 'link' },
  { key: 'tools', label: 'Tools', icon: 'construction' },
]

const NAV_SECTIONS = [
  { key: 'home', label: 'Home' },
  { key: 'learn', label: 'Learn' },
  { key: 'exam', label: 'Exam' },
  { key: 'contest', label: 'Contest' },
  { key: 'rank', label: 'Rank' },
  { key: 'profile', label: 'Profile' },
  { key: 'users', label: 'Users (Admin)' },
  { key: 'questions', label: 'Questions (Mod+)' },
  { key: 'courses', label: 'Courses (Mod+)' },
  { key: 'settings', label: 'Settings (Admin)' },
  { key: 'analytics', label: 'Analytics (Admin)' },
]

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState('quiz')
  const [courses, setCourses] = useState([])
  const [questions, setQuestions] = useState([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [linkMode, setLinkMode] = useState('')
  const [linkChapter, setLinkChapter] = useState('')
  const [cleaning, setCleaning] = useState(false)
  const [cleanResult, setCleanResult] = useState(null)
  useEffect(() => {
    Promise.all([getQuizSettings(), getAllCourses(), getAllQuestionsCached()]).then(([s, c, q]) => {
      s.courseLinkedQuizzes = s.courseLinkedQuizzes || {}
      s.premiumCourses = s.premiumCourses || []
      setSettings(s)
      setCourses(c)
      setQuestions(q)
      if (c.length > 0) setSelectedCourse(c[0].courseId)
      setLoading(false)
    })
  }, [])

  const update = (key, value) => setSettings((prev) => ({ ...prev, [key]: Number(value) }))

  const handleSave = async () => {
    setSaving(true)
    await saveQuizSettings(settings)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const distinctModes = [...new Set(questions.map((q) => q.mode).filter(Boolean))].sort()

  const chaptersForMode = [...new Set(
    questions.filter((q) => q.mode === linkMode && q.chapter).map((q) => q.chapter)
  )].sort()

  const linkedQuizzes = selectedCourse ? (settings.courseLinkedQuizzes[selectedCourse] || []) : []

  const addLink = () => {
    if (!linkMode || !linkChapter || !selectedCourse) return
    const existing = settings.courseLinkedQuizzes[selectedCourse] || []
    if (existing.some((l) => l.mode === linkMode && l.chapter === linkChapter)) return
    setSettings((prev) => ({
      ...prev,
      courseLinkedQuizzes: {
        ...prev.courseLinkedQuizzes,
        [selectedCourse]: [...(prev.courseLinkedQuizzes[selectedCourse] || []), { mode: linkMode, chapter: linkChapter }]
      }
    }))
    setLinkMode('')
    setLinkChapter('')
  }

  const handleCleanup = useCallback(async () => {
    if (!confirm('This will remove all course enrollment data from users for courses that no longer exist. Continue?')) return
    setCleaning(true)
    setCleanResult(null)
    try {
      const res = await cleanupOrphanedCourses()
      setCleanResult(res)
    } catch (err) {
      alert('Cleanup failed: ' + err.message)
    } finally {
      setCleaning(false)
    }
  }, [])

  const removeLink = (idx) => {
    if (!selectedCourse) return
    setSettings((prev) => ({
      ...prev,
      courseLinkedQuizzes: {
        ...prev.courseLinkedQuizzes,
        [selectedCourse]: (prev.courseLinkedQuizzes[selectedCourse] || []).filter((_, i) => i !== idx)
      }
    }))
  }

  if (loading) return <div className="p-4 md:p-6"><div className="animate-pulse space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded-lg" />)}</div></div>

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="font-['Hanken_Grotesk'] text-xl md:text-2xl font-bold text-on-surface">Settings</h1>
          <p className="text-xs md:text-sm text-on-surface-variant">Configure quiz settings, access rules, and course linking</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="self-start sm:self-auto px-5 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Pill Tabs */}
      <div className="inline-flex bg-surface-container-low rounded-full p-1 mb-5 w-full">
        {TABS.map((t) => (
          <button key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2 sm:px-5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              tab === t.key
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant/60 hover:text-on-surface'
            }`}>
            <span className="material-symbols-outlined text-[18px] sm:text-[16px] leading-none" style={{fontVariationSettings: "'FILL' 1"}}>{t.icon}</span>
            <span className={`${tab === t.key ? 'inline' : 'hidden sm:inline'}`}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab: Quiz Config */}
      {tab === 'quiz' && (
        <div className="space-y-5">
          <div className="bg-surface border border-outline-variant rounded-xl p-4 md:p-5 space-y-4">
            <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Question Counts & Timers</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-on-surface mb-1">{f.label}</label>
                  <input
                    type="number"
                    min="1"
                    value={settings[f.key]}
                    onChange={(e) => update(f.key, e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                  <p className="text-[10px] text-on-surface-variant mt-0.5">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-4 md:p-5 space-y-4">
            <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Default Attempt Limits</h2>
            <p className="text-xs text-on-surface-variant -mt-2">Applied to all new users. Override per user from Users page.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ATTEMPT_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-on-surface mb-1">{f.label}</label>
                  <input
                    type="number"
                    min="0"
                    value={settings[f.key]}
                    onChange={(e) => update(f.key, e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                  <p className="text-[10px] text-on-surface-variant mt-0.5">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Access */}
      {tab === 'access' && (
        <div className="space-y-5">
          <div className="bg-surface border border-outline-variant rounded-xl p-4 md:p-5 space-y-4">
            <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Learning Lock</h2>
            <p className="text-xs text-on-surface-variant -mt-2">When enabled, students can access any day of any course without daily progression limits.</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input type="checkbox" checked={settings.bypassDailyLearningLock}
                  onChange={(e) => setSettings((prev) => ({ ...prev, bypassDailyLearningLock: e.target.checked }))} className="sr-only" />
                <div className={`w-9 h-5 rounded-full transition-colors ${settings.bypassDailyLearningLock ? 'bg-primary' : 'bg-gray-300'}`}>
                  <div className="w-4 h-4 bg-white rounded-full shadow-sm absolute top-0.5 transition-all" style={{ left: settings.bypassDailyLearningLock ? '18px' : '2px' }} />
                </div>
              </div>
              <span className="text-sm font-medium text-on-surface">{settings.bypassDailyLearningLock ? 'Bypass Active — All Days Unlocked' : 'Daily Limit Enforced'}</span>
            </label>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-4 md:p-5 space-y-4">
            <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Enrollment Limits</h2>
            <p className="text-xs text-on-surface-variant -mt-2">
              Maximum number of courses a user can be enrolled in simultaneously.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">Student Limit</label>
                <input
                  type="number"
                  min="1"
                  value={settings.studentEnrollmentLimit}
                  onChange={(e) => setSettings((prev) => ({ ...prev, studentEnrollmentLimit: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
                <p className="text-[10px] text-on-surface-variant mt-0.5">Default: 2</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface mb-1">StudentX Limit</label>
                <input
                  type="number"
                  min="1"
                  value={settings.studentxEnrollmentLimit}
                  onChange={(e) => setSettings((prev) => ({ ...prev, studentxEnrollmentLimit: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
                <p className="text-[10px] text-on-surface-variant mt-0.5">Default: 5</p>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-4 md:p-5 space-y-4">
            <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Quiz Access Control</h2>
            <p className="text-xs text-on-surface-variant -mt-2">
              Control which roles can access each quiz type. Uncheck a role to restrict access.
            </p>
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <table className="w-full text-sm min-w-[320px]">
                <thead>
                  <tr className="border-b border-outline-variant">
                    <th className="text-left py-2 pr-3 pl-4 md:pl-0 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Quiz Type</th>
                    <th className="text-center py-2 px-1.5 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Student</th>
                    <th className="text-center py-2 px-1.5 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">StudentX</th>
                    <th className="text-center py-2 px-1.5 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Mod</th>
                    <th className="text-center py-2 px-1.5 md:pr-0 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: 'chapter', label: 'Chapter Test' },
                    { key: 'module', label: 'Module Test' },
                    { key: 'mode', label: 'Mode Test' },
                    { key: 'mockTest', label: 'Quick Mock Pre-Test Revision' },
                    { key: 'final', label: 'Final Mock Pre-Test' },
                    { key: 'preassessment', label: 'Pre-Assessment' },
                    { key: 'certification', label: 'Course Cert' },
                  ].map((qt) => (
                    <tr key={qt.key} className="border-b border-outline-variant/50">
                      <td className="py-2.5 pr-3 pl-4 md:pl-0 font-medium text-on-surface text-xs sm:text-sm">{qt.label}</td>
                      {['student', 'studentx', 'moderator', 'admin'].map((role) => {
                        const access = settings.quizAccess || {}
                        const typeAccess = access[qt.key] || {}
                        const checked = typeAccess[role] !== false
                        return (
                          <td key={role} className="text-center py-2.5 px-1.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSettings((prev) => {
                                  const qa = { ...(prev.quizAccess || {}) }
                                  const ta = { ...(qa[qt.key] || {}) }
                                  ta[role] = !checked
                                  qa[qt.key] = ta
                                  return { ...prev, quizAccess: qa }
                                })
                              }}
                              className="w-4 h-4 accent-primary cursor-pointer"
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl p-4 md:p-5 space-y-4">
            <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Module Access Control</h2>
            <p className="text-xs text-on-surface-variant -mt-2">
              Control which roles can access specific modules in the Module Test. Modules not listed are accessible to all.
            </p>
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <table className="w-full text-sm min-w-[320px]">
                <thead>
                  <tr className="border-b border-outline-variant">
                    <th className="text-left py-2 pr-3 pl-4 md:pl-0 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Module</th>
                    <th className="text-center py-2 px-1.5 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Student</th>
                    <th className="text-center py-2 px-1.5 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">StudentX</th>
                    <th className="text-center py-2 px-1.5 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Mod</th>
                    <th className="text-center py-2 px-1.5 md:pr-0 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {[...new Set(questions.map((q) => q.module).filter(Boolean))].sort().map((mod) => {
                    const access = settings.moduleAccess || {}
                    const modAccess = access[mod] || {}
                    return (
                      <tr key={mod} className="border-b border-outline-variant/50">
                        <td className="py-2.5 pr-3 pl-4 md:pl-0 font-medium text-on-surface text-xs sm:text-sm">{mod}</td>
                        {['student', 'studentx', 'moderator', 'admin'].map((role) => {
                          const checked = modAccess[role] !== false
                          return (
                            <td key={role} className="text-center py-2.5 px-1.5">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setSettings((prev) => {
                                    const ma = { ...(prev.moduleAccess || {}) }
                                    const maMod = { ...(ma[mod] || {}) }
                                    maMod[role] = !checked
                                    ma[mod] = maMod
                                    return { ...prev, moduleAccess: ma }
                                  })
                                }}
                                className="w-4 h-4 accent-primary cursor-pointer"
                              />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                  {(!questions || questions.length === 0) && (
                    <tr><td colSpan="5" className="text-center py-4 text-sm text-on-surface-variant">No module data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Navigation */}
      {tab === 'nav' && (
        <div className="bg-surface border border-outline-variant rounded-xl p-4 md:p-5 space-y-4">
          <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Navigation Access Control</h2>
          <p className="text-xs text-on-surface-variant -mt-2">
            Control which roles can see each section in the navigation sidebar. Uncheck a role to hide that section.
          </p>
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-sm min-w-[320px]">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th className="text-left py-2 pr-3 pl-4 md:pl-0 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Section</th>
                  <th className="text-center py-2 px-1.5 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Student</th>
                  <th className="text-center py-2 px-1.5 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">StudentX</th>
                  <th className="text-center py-2 px-1.5 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Mod</th>
                  <th className="text-center py-2 px-1.5 md:pr-0 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Admin</th>
                </tr>
              </thead>
              <tbody>
                {NAV_SECTIONS.map((ns) => {
                  const access = settings.navAccess || {}
                  const secAccess = access[ns.key] || {}
                  return (
                    <tr key={ns.key} className="border-b border-outline-variant/50">
                      <td className="py-2.5 pr-3 pl-4 md:pl-0 font-medium text-on-surface text-xs sm:text-sm">{ns.label}</td>
                      {['student', 'studentx', 'moderator', 'admin'].map((role) => {
                        const checked = secAccess[role] !== false
                        return (
                          <td key={role} className="text-center py-2.5 px-1.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSettings((prev) => {
                                  const na = { ...(prev.navAccess || {}) }
                                  const sa = { ...(na[ns.key] || {}) }
                                  sa[role] = !checked
                                  na[ns.key] = sa
                                  return { ...prev, navAccess: na }
                                })
                              }}
                              className="w-4 h-4 accent-primary cursor-pointer"
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-on-surface-variant">Note: Roles that cannot access a section won't see it in the sidebar at all.</p>
        </div>
      )}

      {/* Tab: Linking */}
      {tab === 'linking' && (
        <div className="bg-surface border border-outline-variant rounded-xl p-4 md:p-5 space-y-4">
          <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Course-Linked Quizzes</h2>
          <p className="text-xs text-on-surface-variant -mt-2">
            Select a course, choose a mode and chapter, then link them. Quizzes matching the linked mode+chapter will only be visible to users who completed that course.
          </p>

          {courses.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No courses found. Create courses first.</p>
          ) : (
            <>
              <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
                {courses.map((c) => (
                  <button
                    key={c.courseId}
                    onClick={() => { setSelectedCourse(c.courseId); setLinkMode(''); setLinkChapter('') }}
                    className={`shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                      selectedCourse === c.courseId
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {c.courseTitle || c.courseId}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-on-surface">
                  Linked Quizzes for: <span className="text-primary">{courses.find((c) => c.courseId === selectedCourse)?.courseTitle || selectedCourse}</span>
                </p>

                {linkedQuizzes.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">No quizzes linked yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {linkedQuizzes.map((link, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 bg-[#f0f3ff] text-primary text-xs font-medium px-3 py-1.5 rounded-full">
                        <span className="material-symbols-outlined text-[14px]">quiz</span>
                        {link.chapter} · {link.mode}
                        <button
                          onClick={() => removeLink(idx)}
                          className="ml-0.5 text-on-surface-variant hover:text-error cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-outline-variant pt-3">
                  <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Add New Link</p>
                  <div className="flex flex-col sm:flex-row flex-wrap items-end gap-3">
                    <div className="w-full sm:flex-1 min-w-[140px]">
                      <label className="block text-[10px] font-medium text-on-surface-variant mb-1">Mode</label>
                      <select
                        value={linkMode}
                        onChange={(e) => { setLinkMode(e.target.value); setLinkChapter('') }}
                        className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-surface outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">— Select mode —</option>
                        {distinctModes.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-full sm:flex-1 min-w-[140px]">
                      <label className="block text-[10px] font-medium text-on-surface-variant mb-1">Chapter</label>
                      <select
                        value={linkChapter}
                        onChange={(e) => setLinkChapter(e.target.value)}
                        disabled={!linkMode}
                        className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-surface outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                      >
                        <option value="">— Select chapter —</option>
                        {chaptersForMode.map((ch) => (
                          <option key={ch} value={ch}>{ch}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={addLink}
                      disabled={!linkMode || !linkChapter}
                      className="w-full sm:w-auto px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px] align-middle">add</span> Link
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: Tools */}
      {tab === 'tools' && (
        <div className="space-y-5">
          <div className="bg-surface border border-outline-variant rounded-xl p-4 md:p-5 space-y-4">
            <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Database Maintenance</h2>
            <p className="text-xs text-on-surface-variant -mt-2">
              Remove orphaned course enrollment data from users whose courses no longer exist — e.g. after deleting a course that users were enrolled in.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <button
                onClick={handleCleanup}
                disabled={cleaning}
                className="w-full sm:w-auto px-4 py-2 bg-warning text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {cleaning ? 'Cleaning...' : 'Run Cleanup'}
              </button>
              {cleanResult && (
                <span className="text-sm text-on-surface-variant">
                  Removed {cleanResult.totalEntriesRemoved} orphaned course entr{cleanResult.totalEntriesRemoved === 1 ? 'y' : 'ies'} across {cleanResult.totalUsersAffected} user{cleanResult.totalUsersAffected === 1 ? '' : 's'}.
                </span>
              )}
              {cleanResult?.totalEntriesRemoved === 0 && (
                <span className="text-sm text-success">No orphaned data found.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
