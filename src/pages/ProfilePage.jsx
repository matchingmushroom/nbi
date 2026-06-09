import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getLevelProgress, getXPForNextLevel } from '../lib/gamification'

export default function ProfilePage() {
  const { profile, updateUserDoc, refreshProfile } = useAuth()
  const [name, setName] = useState(profile?.displayName || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      await updateUserDoc(profile.uid, { displayName: name })
      await refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error(err)
    }
    setSaving(false)
  }

  const lvl = profile?.level || 1
  const xp = profile?.xp || 0
  const nextXp = getXPForNextLevel(xp)
  const progressPct = getLevelProgress(xp)

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Profile</h1>
        <p className="text-on-surface-variant text-sm mt-1">Manage your account</p>
      </div>

      {/* Avatar & Level — glass card */}
      <div className="glass-strong rounded-xl p-6 mb-4 flex flex-col sm:flex-row items-center gap-5 border border-white/40">
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-blue-400 text-white flex items-center justify-center text-3xl font-bold shadow-lg shadow-primary/20">
            {(profile?.displayName || profile?.email || '?')[0].toUpperCase()}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-warning text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white shadow-sm">
            Lv.{lvl}
          </div>
        </div>
        <div className="text-center sm:text-left flex-1 min-w-0">
          <h2 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface">{profile?.displayName || 'User'}</h2>
          <p className="text-xs text-on-surface-variant">{profile?.email}</p>
          <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
            <span className="text-xs text-on-surface-variant">{xp} XP</span>
            {(profile?.streak || 0) > 0 && (
              <div className="flex items-center gap-0.5 text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[14px]" style={{fontVariationSettings: "'FILL' 1"}}>local_fire_department</span>
                <span className="text-xs font-bold">{profile.streak}</span>
              </div>
            )}
            <span className="capitalize text-[10px] bg-primary/5 text-primary px-2 py-0.5 rounded-full font-medium">{profile?.role || 'student'}</span>
          </div>
        </div>
      </div>

      {/* XP Bar */}
      <div className="glass rounded-xl p-4 mb-4 border border-white/30">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-on-surface">Level Progress</span>
          <span className="text-[10px] text-on-surface-variant">{nextXp} XP to next level</span>
        </div>
        <div className="w-full h-3 bg-white/50 rounded-full overflow-hidden shadow-inner">
          <div className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full transition-all xp-bar-fill shadow-sm" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Edit Name — glass card */}
      <div className="glass-strong rounded-xl p-5 mb-4 border border-white/40">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-primary text-[18px]" style={{fontVariationSettings: "'FILL' 1"}}>badge</span>
          <h3 className="text-sm font-semibold text-on-surface">Display Name</h3>
        </div>
        <form onSubmit={handleSave} className="flex items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-white/60 border border-white/40 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm backdrop-blur-sm transition-all"
            placeholder="Your display name"
            required
          />
          <button
            type="submit"
            disabled={saving || name === (profile?.displayName || '')}
            className="bg-primary text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-40 transition-all active:scale-[0.98] cursor-pointer shadow-md shadow-primary/20"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
          </button>
        </form>
      </div>

      {/* Account Info — glass card */}
      <div className="glass-strong rounded-xl p-5 border border-white/40">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-primary text-[18px]" style={{fontVariationSettings: "'FILL' 1"}}>account_circle</span>
          <h3 className="text-sm font-semibold text-on-surface">Account Info</h3>
        </div>
        <div className="space-y-1 text-sm">
          {[
            { label: 'Email', value: profile?.email },
            { label: 'Role', value: profile?.role || 'student', cap: true },
            { label: 'Level', value: lvl },
            { label: 'XP', value: xp },
            { label: 'XP to next level', value: nextXp },
            { label: 'Streak', value: `${profile?.streak || 0} days` },
            { label: 'Badges', value: `${profile?.badges?.length || 0} earned` },
          ].map((item, i) => (
            <div key={item.label}
              className={`flex items-center justify-between py-2.5 px-3 rounded-lg ${
                i % 2 === 0 ? 'bg-white/30' : ''
              }`}>
              <span className="text-on-surface-variant text-xs font-medium">{item.label}</span>
              <span className={`text-on-surface font-semibold text-sm ${item.cap ? 'capitalize' : ''}`}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
