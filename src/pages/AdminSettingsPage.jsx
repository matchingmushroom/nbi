import { useState, useEffect } from 'react'
import { getQuizSettings, saveQuizSettings } from '../lib/quizSettings'
import { getAllCourses } from '../lib/steakService'
import { getAllQuestionsCached } from '../lib/cache'

const FIELDS = [
  { key: 'chapterQuestionCount', label: 'Chapter Questions', desc: 'Default: 10' },
  { key: 'moduleQuestionCount', label: 'Module Questions', desc: 'Default: 20' },
  { key: 'modeQuestionCount', label: 'Mode Questions', desc: 'Default: 50' },
  { key: 'finalQuestionCount', label: 'Final Mock Questions', desc: 'Default: 100' },
  { key: 'chapterTimerMinutes', label: 'Chapter Timer (min)', desc: 'Default: 10' },
  { key: 'moduleTimerMinutes', label: 'Module Timer (min)', desc: 'Default: 30' },
  { key: 'modeTimerMinutes', label: 'Mode Timer (min)', desc: 'Default: 50' },
  { key: 'finalTimerMinutes', label: 'Final Mock Timer (min)', desc: 'Default: 100' },
  { key: 'certificationQuestionCount', label: 'Certification Questions', desc: 'Default: 20' },
  { key: 'certificationTimerMinutes', label: 'Certification Timer (min)', desc: 'Default: 30' },
]

const ATTEMPT_FIELDS = [
  { key: 'chapterAttemptLimit', label: 'Chapter Attempt Limit', desc: '0 = unlimited' },
  { key: 'moduleAttemptLimit', label: 'Module Attempt Limit', desc: '0 = unlimited' },
  { key: 'modeAttemptLimit', label: 'Mode Attempt Limit', desc: '0 = unlimited' },
  { key: 'finalAttemptLimit', label: 'Final Mock Attempt Limit', desc: '0 = unlimited' },
  { key: 'certificationAttemptLimit', label: 'Certification Attempt Limit', desc: '0 = unlimited' },
]

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [courses, setCourses] = useState([])
  const [questions, setQuestions] = useState([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [linkMode, setLinkMode] = useState('')
  const [linkChapter, setLinkChapter] = useState('')

  useEffect(() => {
    Promise.all([getQuizSettings(), getAllCourses(), getAllQuestionsCached()]).then(([s, c, q]) => {
      s.courseLinkedQuizzes = s.courseLinkedQuizzes || {}
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
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Quiz Settings</h1>
          <p className="text-sm text-on-surface-variant">Configure question counts, timers, and attempt limits</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="bg-surface border border-outline-variant rounded-xl p-5 space-y-4">
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

      <div className="bg-surface border border-outline-variant rounded-xl p-5 space-y-4">
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

      <div className="bg-surface border border-outline-variant rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Course-Linked Quizzes</h2>
        <p className="text-xs text-on-surface-variant -mt-2">
          Select a course, choose a mode and chapter, then link them. Quizzes matching the linked mode+chapter will only be visible to users who completed that course.
        </p>

        {courses.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No courses found. Create courses first.</p>
        ) : (
          <>
            <div className="flex gap-1 flex-wrap border-b border-outline-variant pb-2">
              {courses.map((c) => (
                <button
                  key={c.courseId}
                  onClick={() => { setSelectedCourse(c.courseId); setLinkMode(''); setLinkChapter('') }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors cursor-pointer ${
                    selectedCourse === c.courseId
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:bg-[#f0f3ff]'
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
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[140px]">
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
                  <div className="flex-1 min-w-[140px]">
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
                    className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px] align-middle">add</span> Link
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
