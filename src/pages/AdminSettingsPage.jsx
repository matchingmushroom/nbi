import { useState, useEffect } from 'react'
import { getQuizSettings, saveQuizSettings } from '../lib/quizSettings'

const FIELDS = [
  { key: 'chapterQuestionCount', label: 'Chapter Questions', desc: 'Default: 10' },
  { key: 'moduleQuestionCount', label: 'Module Questions', desc: 'Default: 20' },
  { key: 'modeQuestionCount', label: 'Mode Questions', desc: 'Default: 50' },
  { key: 'finalQuestionCount', label: 'Final Mock Questions', desc: 'Default: 100' },
  { key: 'chapterTimerMinutes', label: 'Chapter Timer (min)', desc: 'Default: 10' },
  { key: 'moduleTimerMinutes', label: 'Module Timer (min)', desc: 'Default: 30' },
  { key: 'modeTimerMinutes', label: 'Mode Timer (min)', desc: 'Default: 50' },
  { key: 'finalTimerMinutes', label: 'Final Mock Timer (min)', desc: 'Default: 100' },
]

const ATTEMPT_FIELDS = [
  { key: 'chapterAttemptLimit', label: 'Chapter Attempt Limit', desc: '0 = unlimited' },
  { key: 'moduleAttemptLimit', label: 'Module Attempt Limit', desc: '0 = unlimited' },
  { key: 'modeAttemptLimit', label: 'Mode Attempt Limit', desc: '0 = unlimited' },
  { key: 'finalAttemptLimit', label: 'Final Mock Attempt Limit', desc: '0 = unlimited' },
]

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getQuizSettings().then((s) => { setSettings(s); setLoading(false) })
  }, [])

  const update = (key, value) => setSettings((prev) => ({ ...prev, [key]: Number(value) }))

  const handleSave = async () => {
    setSaving(true)
    await saveQuizSettings(settings)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
    </div>
  )
}
