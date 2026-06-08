import { useState, useEffect } from 'react'
import { getAvailableCourses, getLocalLearningProfile, getCourseProgress, enrollCourse } from '../lib/steakService'
import { useAuth } from '../context/AuthContext'

export default function CourseCatalog({ learning, onRefresh, onEnter, onError }) {
  const { user } = useAuth()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(null)
  const [fetchError, setFetchError] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setFetchError(null)
    try {
      const avail = await getAvailableCourses()
      console.log('[CourseCatalog] courses loaded:', avail.length)
      setCourses(avail)
    } catch (err) {
      console.error('[CourseCatalog] failed to load courses:', err)
      setFetchError(err.message || 'Failed to fetch courses')
    } finally {
      setLoading(false)
    }
  }

  async function handleEnroll(courseId) {
    setEnrolling(courseId)
    try {
      await enrollCourse(user.uid, courseId)
      if (onRefresh) await onRefresh()
      if (onEnter) await onEnter(courseId)
    } catch (err) {
      console.error(err)
      if (onError) onError(err.message || 'Enrollment failed')
    } finally {
      setEnrolling(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2].map(i => (
          <div key={i} className="bg-outline-variant/20 rounded-xl h-28" />
        ))}
      </div>
    )
  }

  if (courses.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="material-symbols-outlined text-5xl text-outline-variant">school</span>
        <p className="text-sm text-on-surface-variant mt-2">No courses available yet.</p>
        {fetchError && (
          <p className="text-xs text-error mt-1">Error loading courses. Check console (F12).</p>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      {courses.map(c => {
        const prog = getCourseProgress(learning, c.courseId)
        const enrolled = !!prog
        const busy = enrolling === c.courseId
        return (
          <div key={c.courseId} className="bg-surface rounded-xl border border-outline-variant p-4 space-y-3">
            <div>
              <h2 className="font-['Hanken_Grotesk'] font-bold text-on-surface">{c.courseTitle}</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">{c.dayCount} day{c.dayCount > 1 ? 's' : ''}</p>
            </div>
            {enrolled && prog && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-on-surface-variant">
                  <span>Progress</span>
                  <span>{prog.completedDays?.length || 0}/{c.dayCount}</span>
                </div>
                <div className="h-1.5 bg-outline-variant/30 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${((prog.completedDays?.length || 0) / c.dayCount) * 100}%` }} />
                </div>
              </div>
            )}
            <button
              onClick={() => enrolled ? onEnter(c.courseId) : handleEnroll(c.courseId)}
              disabled={busy}
              className="w-full py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
            >
              {busy ? 'Enrolling...' : enrolled ? 'Continue Learning' : 'Enroll Now'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
