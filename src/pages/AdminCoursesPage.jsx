import { useState, useEffect } from 'react'
import { getAllCourses, setCourseVisibility, deleteCourse, updateCourseTitle, resetCourseProgress, resetDailyLimit } from '../lib/steakService'
import { useAuth } from '../context/AuthContext'
import { invalidateCachePrefix } from '../lib/cache'
import MicroLearningUploader from '../components/MicroLearningUploader'

export default function AdminCoursesPage() {
  const { profile, getAllUsers } = useAuth()
  const isModerator = profile?.role === 'moderator'
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [users, setUsers] = useState([])
  const [resetCourseId, setResetCourseId] = useState(null)
  const [resetUserId, setResetUserId] = useState('')
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [dailyResetCourseId, setDailyResetCourseId] = useState(null)
  const [dailyResetUserId, setDailyResetUserId] = useState('')
  const [showDailyResetModal, setShowDailyResetModal] = useState(false)
  const [dailyResetting, setDailyResetting] = useState(false)

  const load = async () => {
    setLoading(true)
    const [allCourses, allUsers] = await Promise.all([getAllCourses(), getAllUsers()])
    setCourses(allCourses)
    setUsers(allUsers.filter((u) => u.role !== 'admin' && u.role !== 'moderator'))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleToggle = async (courseId, currentVisible) => {
    setToggling(courseId)
    await setCourseVisibility(courseId, !currentVisible)
    setCourses((prev) => prev.map((c) => c.courseId === courseId ? { ...c, visible: !currentVisible } : c))
    setToggling(null)
  }

  const handleDelete = async (courseId) => {
    if (!window.confirm('Delete this course and ALL its content permanently? This cannot be undone.')) return
    setDeleting(courseId)
    try {
      await deleteCourse(courseId)
      setCourses((prev) => prev.filter((c) => c.courseId !== courseId))
    } catch (err) {
      alert('Failed to delete course: ' + err.message)
    }
    setDeleting(null)
  }

  const startEdit = (course) => {
    setEditingId(course.courseId)
    setEditValue(course.courseTitle)
  }

  const openReset = (courseId) => {
    setResetCourseId(courseId)
    setResetUserId('')
    setShowResetModal(true)
  }

  const handleResetCourse = async () => {
    if (!resetCourseId || !resetUserId) return
    const user = users.find((u) => u.uid === resetUserId)
    const course = courses.find((c) => c.courseId === resetCourseId)
    if (!confirm(`Reset "${course?.courseTitle || resetCourseId}" for ${user?.displayName || user?.email}? This erases all progress, reviews, and exam data.`)) return
    setResetting(true)
    try {
      await resetCourseProgress(resetUserId, resetCourseId)
      setShowResetModal(false)
      setResetCourseId(null)
      setResetUserId('')
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setResetting(false)
    }
  }

  const openDailyReset = (courseId) => {
    setDailyResetCourseId(courseId)
    setDailyResetUserId('')
    setShowDailyResetModal(true)
  }

  const handleDailyReset = async () => {
    if (!dailyResetCourseId || !dailyResetUserId) return
    const user = users.find((u) => u.uid === dailyResetUserId)
    const course = courses.find((c) => c.courseId === dailyResetCourseId)
    if (!confirm(`Reset daily limit for "${course?.courseTitle || dailyResetCourseId}" for ${user?.displayName || user?.email}? This clears all dayStates and reviewedDays for that day.`)) return
    setDailyResetting(true)
    try {
      await resetDailyLimit(dailyResetUserId, dailyResetCourseId)
      setShowDailyResetModal(false)
      setDailyResetCourseId(null)
      setDailyResetUserId('')
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setDailyResetting(false)
    }
  }

  const saveEdit = async () => {
    const id = editingId
    if (!id || !editValue.trim()) { setEditingId(null); return }
    try {
      await updateCourseTitle(id, editValue.trim())
      setCourses((prev) => prev.map((c) => c.courseId === id ? { ...c, courseTitle: editValue.trim() } : c))
    } catch (err) {
      alert('Failed to update title: ' + err.message)
    }
    setEditingId(null)
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-200 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Manage Courses</h1>
            <p className="text-sm text-on-surface-variant">Show or hide courses from students</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              Upload CSV
            </button>
            <button onClick={load} className="px-3 py-2 text-sm font-medium text-primary hover:bg-[#f0f3ff] rounded-lg transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-[20px] align-middle">refresh</span>
            </button>
          </div>
        </div>

      {showUpload && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setShowUpload(false)}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-3xl mx-auto max-h-[85vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-on-surface">Upload Micro-Learning CSV</h2>
              <button onClick={() => setShowUpload(false)} className="cursor-pointer"><span className="material-symbols-outlined">close</span></button>
            </div>
            <MicroLearningUploader onUploadComplete={() => { invalidateCachePrefix('allCourses'); load() }} />
          </div>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => !resetting && setShowResetModal(false)}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-sm mx-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-on-surface mb-1">Reset Course Progress</h3>
            <p className="text-xs text-on-surface-variant mb-4">
              Select a student to reset <strong>{courses.find((c) => c.courseId === resetCourseId)?.courseTitle || resetCourseId}</strong> for.
            </p>
            <select
              value={resetUserId}
              onChange={(e) => setResetUserId(e.target.value)}
              className="w-full px-3 py-2.5 border border-outline-variant rounded-xl text-sm bg-surface outline-none focus:ring-2 focus:ring-primary/30 mb-4"
            >
              <option value="">— Select student —</option>
              {users.map((u) => {
                const enrolled = u.learning?.enrolledCourses?.[resetCourseId]
                return (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName || u.email}{enrolled ? ` (Day ${enrolled.completedDays?.length || 0}/${courses.find((c) => c.courseId === resetCourseId)?.dayCount || '?'})` : ' (not enrolled)'}
                  </option>
                )
              })}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowResetModal(false)} disabled={resetting} className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-gray-100 rounded-xl cursor-pointer disabled:opacity-50">Cancel</button>
              <button onClick={handleResetCourse} disabled={!resetUserId || resetting} className="px-4 py-2 text-sm font-semibold text-on-primary bg-warning rounded-xl hover:opacity-90 transition-all cursor-pointer disabled:opacity-50">
                {resetting ? 'Resetting...' : 'Reset All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDailyResetModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => !dailyResetting && setShowDailyResetModal(false)}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-sm mx-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-on-surface mb-1">Reset Daily Limit</h3>
            <p className="text-xs text-on-surface-variant mb-4">
              Clear dayStates and reviewedDays for <strong>{courses.find((c) => c.courseId === dailyResetCourseId)?.courseTitle || dailyResetCourseId}</strong> — allows the student to re-review days.
            </p>
            <select
              value={dailyResetUserId}
              onChange={(e) => setDailyResetUserId(e.target.value)}
              className="w-full px-3 py-2.5 border border-outline-variant rounded-xl text-sm bg-surface outline-none focus:ring-2 focus:ring-primary/30 mb-4"
            >
              <option value="">— Select student —</option>
              {users.map((u) => {
                const enrolled = u.learning?.enrolledCourses?.[dailyResetCourseId]
                return (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName || u.email}{enrolled ? ` (Day ${enrolled.completedDays?.length || 0}/${courses.find((c) => c.courseId === dailyResetCourseId)?.dayCount || '?'})` : ' (not enrolled)'}
                  </option>
                )
              })}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDailyResetModal(false)} disabled={dailyResetting} className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-gray-100 rounded-xl cursor-pointer disabled:opacity-50">Cancel</button>
              <button onClick={handleDailyReset} disabled={!dailyResetUserId || dailyResetting} className="px-4 py-2 text-sm font-semibold text-on-primary bg-secondary rounded-xl hover:opacity-90 transition-all cursor-pointer disabled:opacity-50">
                {dailyResetting ? 'Resetting...' : 'Reset Daily Limit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">school</span>
          <p className="text-on-surface-variant mt-2">No courses found. Upload micro-learning content first.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {courses.map((course) => (
            <div key={course.courseId} className="bg-surface rounded-xl px-4 py-3 border border-outline-variant">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {editingId === course.courseId ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
                        className="flex-1 px-2 py-1 text-sm font-semibold border border-primary rounded-lg outline-none focus:ring-2 focus:ring-primary/30"
                        autoFocus
                      />
                      <button onClick={saveEdit} className="p-1.5 text-success hover:bg-success/5 rounded-lg cursor-pointer" title="Save">
                        <span className="material-symbols-outlined text-[18px]">check</span>
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-on-surface-variant hover:bg-gray-100 rounded-lg cursor-pointer" title="Cancel">
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                  ) : (
                    <p className="font-semibold text-on-surface truncate">{course.courseTitle}</p>
                  )}
                  <p className="text-xs text-on-surface-variant">
                    ID: {course.courseId} &middot; {course.dayCount} day{course.dayCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center flex-wrap gap-1 mt-2 pt-2 border-t border-outline-variant/40">
                <button
                  onClick={() => startEdit(course)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-on-surface-variant hover:text-primary hover:bg-[#f0f3ff] rounded-lg transition-colors cursor-pointer"
                  title="Edit title"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Edit
                </button>
                {!isModerator && (
                  <>
                    <button
                      onClick={() => openDailyReset(course.courseId)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-secondary hover:bg-[#e7eefe] rounded-lg transition-colors cursor-pointer"
                      title="Reset daily limit"
                    >
                      <span className="material-symbols-outlined text-[16px]">lock_reset</span>
                      Reset Daily
                    </button>
                    <button
                      onClick={() => openReset(course.courseId)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-warning hover:bg-warning/5 rounded-lg transition-colors cursor-pointer"
                      title="Reset all progress"
                    >
                      <span className="material-symbols-outlined text-[16px]">refresh</span>
                      Reset All
                    </button>
                    <button
                      onClick={() => handleDelete(course.courseId)}
                      disabled={deleting === course.courseId}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-error hover:bg-error/5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Delete course"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      Delete
                    </button>
                  </>
                )}
                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => handleToggle(course.courseId, course.visible !== false)}
                    disabled={toggling === course.courseId}
                    className={'relative inline-flex items-center shrink-0 cursor-pointer disabled:opacity-50' + (toggling === course.courseId ? ' opacity-50' : '')}
                  >
                    <div className={'w-9 h-5 rounded-full transition-colors relative ' + (course.visible !== false ? 'bg-primary' : 'bg-gray-300')}>
                      <div className="w-4 h-4 bg-white rounded-full shadow-sm absolute top-0.5 transition-all" style={{ left: course.visible !== false ? '18px' : '2px' }} />
                    </div>
                    <span className="ml-1.5 text-[10px] font-medium text-on-surface-variant">
                      {course.visible !== false ? 'Visible' : 'Hidden'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
