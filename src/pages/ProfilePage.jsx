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

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Profile</h1>
        <p className="text-on-surface-variant text-sm mt-1">Manage your account</p>
      </div>

      {/* Avatar & Level */}
      <div className="bg-surface border border-outline-variant rounded-xl p-6 mb-4 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold shrink-0">
          {(profile?.displayName || profile?.email || '?')[0].toUpperCase()}
        </div>
        <div>
          <h2 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface">{profile?.displayName || 'User'}</h2>
          <p className="text-xs text-on-surface-variant">{profile?.email}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="bg-warning/10 text-warning px-2 py-0.5 rounded-full text-xs font-bold">Lv.{profile?.level || 1}</span>
            <span className="text-xs text-on-surface-variant">{profile?.xp || 0} XP</span>
            {(profile?.streak || 0) > 0 && (
              <div className="flex items-center gap-0.5 text-orange-500">
                <span className="material-symbols-outlined text-[14px]" style={{fontVariationSettings: "'FILL' 1"}}>local_fire_department</span>
                <span className="text-xs font-bold">{profile.streak}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Name */}
      <div className="bg-surface border border-outline-variant rounded-xl p-5 mb-4">
        <h3 className="text-sm font-semibold text-on-surface mb-3">Display Name</h3>
        <form onSubmit={handleSave} className="flex items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
            placeholder="Your display name"
            required
          />
          <button
            type="submit"
            disabled={saving || name === (profile?.displayName || '')}
            className="bg-primary text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-40 transition-all active:scale-[0.98] cursor-pointer"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
          </button>
        </form>
      </div>

      {/* Account Info */}
      <div className="bg-surface border border-outline-variant rounded-xl p-5">
        <h3 className="text-sm font-semibold text-on-surface mb-3">Account Info</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-outline-variant/50">
            <span className="text-on-surface-variant">Email</span>
            <span className="text-on-surface font-medium">{profile?.email}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-outline-variant/50">
            <span className="text-on-surface-variant">Role</span>
            <span className="capitalize text-on-surface font-medium">{profile?.role || 'student'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-outline-variant/50">
            <span className="text-on-surface-variant">Level</span>
            <span className="text-on-surface font-medium">{profile?.level || 1}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-outline-variant/50">
            <span className="text-on-surface-variant">XP</span>
            <span className="text-on-surface font-medium">{profile?.xp || 0}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-outline-variant/50">
            <span className="text-on-surface-variant">XP to next level</span>
            <span className="text-on-surface font-medium">{getXPForNextLevel(profile?.xp || 0)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-outline-variant/50">
            <span className="text-on-surface-variant">Streak</span>
            <span className="text-on-surface font-medium">{profile?.streak || 0} days</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-on-surface-variant">Badges</span>
            <span className="text-on-surface font-medium">{profile?.badges?.length || 0} earned</span>
          </div>
        </div>
      </div>
    </div>
  )
}
