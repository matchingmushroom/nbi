import { useState, useEffect } from 'react'
import { getAllCourses, setCourseVisibility, deleteCourse, updateCourseTitle } from '../lib/steakService'
import { useAuth } from '../context/AuthContext'
import { invalidateCachePrefix } from '../lib/cache'
import MicroLearningUploader from '../components/MicroLearningUploader'

export default function AdminCoursesPage() {
  const { profile } = useAuth()
  const isModerator = profile?.role === 'moderator'
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [showUpload, setShowUpload] = useState(false)

  const load = async () => {
    setLoading(true)
    const all = await getAllCourses()
    setCourses(all)
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

      {courses.length === 0 ? (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant">school</span>
          <p className="text-on-surface-variant mt-2">No courses found. Upload micro-learning content first.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {courses.map((course) => (
            <div key={course.courseId} className="flex items-center justify-between bg-surface rounded-xl px-4 py-3 border border-outline-variant">
              <div className="flex-1 min-w-0">
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
              <div className="flex items-center gap-1 shrink-0 ml-4">
                <button
                  onClick={() => startEdit(course)}
                  className="p-2 text-on-surface-variant hover:text-primary hover:bg-[#f0f3ff] rounded-lg transition-colors cursor-pointer"
                  title="Edit title"
                >
                  <span className="material-symbols-outlined text-[20px]">edit</span>
                </button>
                {!isModerator && (
                  <button
                    onClick={() => handleDelete(course.courseId)}
                    disabled={deleting === course.courseId}
                    className="p-2 text-error hover:bg-error/5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    title="Delete course"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                )}
                <button
                  onClick={() => handleToggle(course.courseId, course.visible !== false)}
                  disabled={toggling === course.courseId}
                  className={'relative inline-flex items-center shrink-0 cursor-pointer disabled:opacity-50' + (toggling === course.courseId ? ' opacity-50' : '')}
                >
                  <div className={'w-11 h-6 rounded-full transition-colors relative ' + (course.visible !== false ? 'bg-primary' : 'bg-gray-300')}>
                    <div className="w-5 h-5 bg-white rounded-full shadow-sm absolute top-0.5 transition-all" style={{ left: course.visible !== false ? '22px' : '2px' }} />
                  </div>
                  <span className="ml-2 text-xs font-medium text-on-surface-variant">
                    {course.visible !== false ? 'Visible' : 'Hidden'}
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
