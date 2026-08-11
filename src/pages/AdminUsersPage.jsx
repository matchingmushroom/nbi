import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiEdit2, FiTrash2, FiPlus, FiX, FiSettings, FiRefreshCw } from 'react-icons/fi'
import { getQuizSettings } from '../lib/quizSettings'
import { resetCourseProgress, getAllCourses } from '../lib/steakService'

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
  const [resetUser, setResetUser] = useState(null)
  const [courses, setCourses] = useState([])
  const [showReset, setShowReset] = useState(false)
  const [resetCourseId, setResetCourseId] = useState('')
  const [resetting, setResetting] = useState(false)

  const fetch = async () => {
    const [data, allCourses] = await Promise.all([getAllUsers(), getAllCourses()])
    setUsers(data)
    setCourses(allCourses)
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

  const toggleBypassDaily = async (u) => {
    const current = u.bypassDailyLimit === true
    if (!confirm(`${current ? 'Disable' : 'Enable'} daily-limit bypass for ${u.displayName || u.email}? This lets them review unlimited days per day.`)) return
    await updateUserDoc(u.uid, { bypassDailyLimit: !current })
    fetch()
  }

  const openReset = (u) => {
    setResetUser(u)
    setResetCourseId('')
    setShowReset(true)
  }

  const handleResetCourse = async () => {
    if (!resetUser || !resetCourseId) return
    if (!confirm(`Reset course "${courses.find(c => c.courseId === resetCourseId)?.courseTitle || resetCourseId}" for ${resetUser.displayName || resetUser.email}? This will erase all progress, reviews, and exam data.`)) return
    setResetting(true)
    try {
      await resetCourseProgress(resetUser.uid, resetCourseId)
      setShowReset(false)
      setResetUser(null)
      setResetCourseId('')
      fetch()
    } catch (err) {
      alert('Failed to reset course: ' + err.message)
    } finally {
      setResetting(false)
    }
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
            <div key={u.uid} className="p-4 hover:bg-surface-container-low transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {(u.displayName || u.email || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">{u.displayName || '—'}</p>
                  <p className="text-xs text-on-surface-variant truncate">{u.email}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                  u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                  u.role === 'moderator' ? 'bg-blue-100 text-blue-700' :
                  u.role === 'studentx' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {u.role === 'studentx' ? 'StudentX' : u.role || 'student'}
                </span>
              </div>
              <div className="flex items-center flex-wrap gap-1.5 mt-2 pt-2 border-t border-outline-variant/40">
                <button onClick={() => openLimits(u)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-on-surface-variant hover:text-primary hover:bg-[#f0f3ff] rounded-lg transition-colors cursor-pointer" title="Attempt limits">
                  <FiSettings size={13} /> Limits
                </button>
                <button onClick={() => toggleBypassDaily(u)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${u.bypassDailyLimit ? 'text-success hover:bg-success/5' : 'text-on-surface-variant hover:text-warning hover:bg-warning/5'}`}
                  title={u.bypassDailyLimit ? 'Daily-limit bypass ON' : 'Daily-limit bypass OFF'}>
                  <span className="material-symbols-outlined text-[15px]">{u.bypassDailyLimit ? 'lock_open' : 'lock'}</span>
                  Bypass
                </button>
                <button onClick={() => openReset(u)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-warning hover:bg-warning/5 rounded-lg transition-colors cursor-pointer" title="Reset course progress">
                  <FiRefreshCw size={13} /> Reset
                </button>
                <button onClick={() => openEdit(u)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-[#f0f3ff] rounded-lg transition-colors cursor-pointer">
                  <FiEdit2 size={13} /> Edit
                </button>
                <button onClick={() => handleDelete(u.uid)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-error hover:bg-error/5 rounded-lg transition-colors cursor-pointer">
                  <FiTrash2 size={13} /> Delete
                </button>
              </div>
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
                  <option value="studentx">StudentX</option>
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
                { key: 'final', label: 'Final Mock Pre-Test' },
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

      {showReset && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setShowReset(false)}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-on-surface">Reset Course Progress</h2>
              <button onClick={() => setShowReset(false)} className="cursor-pointer"><FiX size={20} /></button>
            </div>
            <p className="text-xs text-on-surface-variant mb-4">Select a course to reset for <strong>{resetUser?.displayName || resetUser?.email}</strong>. All day progress, reviews, exam data, and scores will be erased.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Course</label>
                <select value={resetCourseId} onChange={(e) => setResetCourseId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                  <option value="">— Select course —</option>
                  {courses.map((c) => {
                    const enrolled = resetUser?.learning?.enrolledCourses?.[c.courseId]
                    if (!enrolled) return null
                    const pct = enrolled.completedDays?.length || 0
                    const total = c.dayCount || '?'
                    return (
                      <option key={c.courseId} value={c.courseId}>
                        {c.courseTitle || c.courseId} ({pct}/{total} days)
                      </option>
                    )
                  })}
                </select>
              </div>
              <button onClick={handleResetCourse} disabled={!resetCourseId || resetting}
                className="w-full bg-error text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer">
                {resetting ? 'Resetting...' : 'Reset Course'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
