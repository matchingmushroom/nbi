import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiEdit2, FiTrash2, FiPlus, FiX, FiSettings } from 'react-icons/fi'
import { getQuizSettings } from '../lib/quizSettings'

export default function AdminUsersPage() {
  const { getAllUsers, createUserAsAdmin, deleteUserDoc, updateUserDoc } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ email: '', password: '', displayName: '', role: 'student' })
  const [limitsUser, setLimitsUser] = useState(null)
  const [limits, setLimits] = useState({ chapter: 0, module: 0, mode: 0, final: 0 })
  const [showLimits, setShowLimits] = useState(false)
  const [savingLimits, setSavingLimits] = useState(false)

  const fetch = async () => {
    const data = await getAllUsers()
    setUsers(data)
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ email: '', password: '', displayName: '', role: 'student' })
    setShowModal(true)
  }

  const openEdit = (u) => {
    setEditing(u)
    setForm({ email: u.email, password: '', displayName: u.displayName || '', role: u.role || 'student' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (editing) {
      const data = { displayName: form.displayName, role: form.role }
      if (form.email) data.email = form.email
      await updateUserDoc(editing.uid, data)
    } else {
      await createUserAsAdmin(form.email, form.password, form.displayName, form.role)
    }
    setShowModal(false)
    fetch()
  }

  const handleDelete = async (uid) => {
    if (!confirm('Delete this user? This cannot be undone.')) return
    await deleteUserDoc(uid)
    fetch()
  }

  const openLimits = async (u) => {
    const defaults = await getQuizSettings()
    const existing = u.attemptLimits || {}
    setLimits({
      chapter: existing.chapter ?? defaults.chapterAttemptLimit ?? 0,
      module: existing.module ?? defaults.moduleAttemptLimit ?? 0,
      mode: existing.mode ?? defaults.modeAttemptLimit ?? 0,
      final: existing.final ?? defaults.finalAttemptLimit ?? 0,
    })
    setLimitsUser(u)
    setShowLimits(true)
  }

  const saveLimits = async () => {
    if (!limitsUser) return
    setSavingLimits(true)
    try {
      await updateUserDoc(limitsUser.uid, { attemptLimits: limits })
      setShowLimits(false)
      setLimitsUser(null)
      setSavingLimits(false)
      fetch()
    } catch (err) {
      alert('Failed to save limits: ' + err.message)
      setSavingLimits(false)
    }
  }

  if (loading) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Loading...</p></div>

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Manage Users</h1>
          <p className="text-on-surface-variant text-sm mt-1">{users.length} total users</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer">
          <FiPlus size={16} /> Add User
        </button>
      </div>

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
        <div className="divide-y divide-outline-variant">
          {users.map((u) => (
            <div key={u.uid} className="flex items-center gap-3 p-4 hover:bg-surface-container-low transition-colors">
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                {(u.displayName || u.email || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">{u.displayName || '—'}</p>
                <p className="text-xs text-on-surface-variant truncate">{u.email}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                u.role === 'moderator' ? 'bg-blue-100 text-blue-700' :
                'bg-green-100 text-green-700'
              }`}>
                {u.role || 'student'}
              </span>
              <button onClick={() => openLimits(u)} className="text-on-surface-variant hover:text-primary ml-1 cursor-pointer" title="Attempt limits"><FiSettings size={14} /></button>
              <button onClick={() => openEdit(u)} className="text-primary hover:text-primary/70 ml-1 cursor-pointer"><FiEdit2 size={15} /></button>
              <button onClick={() => handleDelete(u.uid)} className="text-error hover:text-error/70 cursor-pointer"><FiTrash2 size={15} /></button>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-on-surface">{editing ? 'Edit User' : 'Create User'}</h2>
              <button onClick={() => setShowModal(false)} className="cursor-pointer"><FiX size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Name</label>
                <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Email</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
              </div>
              {!editing && (
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">Password</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                  <option value="student">Student</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button onClick={handleSave} className="w-full bg-primary text-on-primary py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer">
                {editing ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLimits && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setShowLimits(false)}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-on-surface">Attempt Limits</h2>
              <button onClick={() => setShowLimits(false)} className="cursor-pointer"><FiX size={20} /></button>
            </div>
            <p className="text-xs text-on-surface-variant mb-4 truncate">for {limitsUser?.displayName || limitsUser?.email}</p>
            <div className="space-y-3">
              {[
                { key: 'chapter', label: 'Chapter Tests' },
                { key: 'module', label: 'Module Tests' },
                { key: 'mode', label: 'Mode Tests' },
                { key: 'final', label: 'Final Mock Test' },
              ].map((item) => (
                <div key={item.key}>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">{item.label}</label>
                  <input
                    type="number"
                    min="0"
                    value={limits[item.key]}
                    onChange={(e) => setLimits((prev) => ({ ...prev, [item.key]: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                  <p className="text-[10px] text-on-surface-variant mt-0.5">0 = unlimited</p>
                </div>
              ))}
              <button onClick={saveLimits} disabled={savingLimits} className="w-full bg-primary text-on-primary py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer">
                {savingLimits ? 'Saving...' : 'Save Limits'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
