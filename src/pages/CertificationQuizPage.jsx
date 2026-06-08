import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAllCourses, ensureLearningProfile, getCourseProgress, submitFinalExam } from '../lib/steakService'
import { getQuizSettings } from '../lib/quizSettings'
import { getAllQuestionsCached } from '../lib/cache'
import { downloadCertificate } from '../lib/certificate'

const optLabels = ['A', 'B', 'C', 'D']

export default function CertificationQuizPage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [questions, setQuestions] = useState([])
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [courseTitle, setCourseTitle] = useState('')

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [courses, settings, allQ, prof] = await Promise.all([
        getAllCourses(),
        getQuizSettings(),
        getAllQuestionsCached(),
        ensureLearningProfile(user.uid)
      ])

      const course = courses.find(c => c.courseId === courseId || c.courseTitle === courseId)
      if (!course) { setError('Course not found'); setLoading(false); return }
      setCourseTitle(course.courseTitle || course.courseId || courseId)

      const progress = getCourseProgress(prof.learning, course.courseId)
      if (!progress || progress.courseStatus !== 'LESSONS_COMPLETED') {
        setError('Lessons not completed yet. Complete all lessons before taking the certification exam.')
        setLoading(false)
        return
      }

      if (progress.examResult) {
        setResult(progress.examResult)
        setLoading(false)
        return
      }

      const windowEnd = new Date(progress.finalExamWindowEndsAt + 'T23:59:59')
      if (new Date() > windowEnd) {
        setError('Exam window has expired.')
        setLoading(false)
        return
      }

      const total = settings.certificationQuestionCount || 20
      const min = Math.round(total * 0.5)

      const chapterMatch = course.courseTitle || courseId
      const certQ = allQ.filter(q => q.module === 'Course' && q.mode === 'Certification')
      const filtered = certQ.filter(q => q.chapter === chapterMatch || q.chapter === courseId)

      if (filtered.length < min) {
        setError(`Not enough certification questions available (need ${min}, found ${filtered.length}). Contact admin.`)
        setLoading(false)
        return
      }

      const picked = filtered.sort(() => Math.random() - 0.5).slice(0, total)
      setQuestions(picked)
      setAnswers(new Array(picked.length).fill(-1))
    } catch (err) {
      console.error(err)
      setError('Failed to load exam. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const course = (await getAllCourses()).find(c => c.courseId === courseId || c.courseTitle === courseId)
      const dayCount = course?.dayCount || 5
      const res = await submitFinalExam(user.uid, courseId, answers, questions, dayCount)
      if (res.error) { setError(res.error); setSubmitting(false); return }
      setResult(res)
    } catch (err) {
      console.error(err)
      setError('Failed to submit exam. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const answeredCount = answers.filter(a => a >= 0).length
  const allAnswered = answeredCount === questions.length

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-outline-variant/30 rounded w-1/3" />
        <div className="h-64 bg-outline-variant/20 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto text-center space-y-4">
        <span className="material-symbols-outlined text-5xl text-warning">error_outline</span>
        <p className="text-sm text-on-surface-variant">{error}</p>
        <button onClick={() => navigate('/learn')}
          className="px-6 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 cursor-pointer">
          Back to Learning
        </button>
      </div>
    )
  }

  if (result) {
    const passed = result.passed
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5 text-center">
        <div className={`bg-surface rounded-2xl border ${passed ? 'border-success/30' : 'border-warning/30'} p-8 space-y-4`}>
          <div className="text-6xl">{passed ? '🎉' : '💪'}</div>
          <h2 className={`font-['Hanken_Grotesk'] text-2xl font-bold ${passed ? 'text-success' : 'text-warning'}`}>
            {passed ? 'Congratulations! You Passed!' : 'You did not pass.'}
          </h2>
          <div className="space-y-2">
            <p className="text-3xl font-bold text-on-surface">{result.finalScore}%</p>
            <div className="text-sm text-on-surface-variant space-y-1">
              <p>Daily Review Score: {result.dailyPortion}/40</p>
              <p>Exam Score: {result.examRaw}/60</p>
              <p>Correct: {result.examCorrect}/{result.total}</p>
            </div>
          </div>
        </div>
        {passed && (
          <button onClick={() => downloadCertificate({
            userName: profile?.displayName || profile?.email || 'Student',
            courseTitle,
            score: result.finalScore,
            date: new Date().toISOString().split('T')[0],
          })}
            className="w-full py-3 bg-success text-white rounded-xl font-semibold text-sm hover:opacity-90 cursor-pointer flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Download Certificate
          </button>
        )}
        <button onClick={() => navigate('/learn')}
          className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 cursor-pointer">
          Back to Learning
        </button>
      </div>
    )
  }

  const q = questions[current]
  if (!q) return null

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/learn')}
          className="flex items-center gap-1 text-sm text-primary font-medium hover:opacity-80 cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Exit
        </button>
        <span className="text-xs text-on-surface-variant">{answeredCount}/{questions.length} answered</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-outline-variant/30 rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
      </div>

      {/* Question card */}
      <div className="bg-surface rounded-xl border border-outline-variant p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            Question {current + 1} of {questions.length}
          </span>
          {q.chapter && <span className="text-[10px] text-on-surface-variant">{q.chapter}</span>}
        </div>

        <p className="text-sm font-medium text-on-surface leading-relaxed">{q.text}</p>

        <div className="space-y-2">
          {q.options?.map((opt, i) => {
            const selected = answers[current] === i
            return (
              <button key={i} onClick={() => {
                const copy = [...answers]
                copy[current] = i
                setAnswers(copy)
              }}
                className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer active:scale-[0.98] ${selected ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant hover:bg-surface-container-low text-on-surface'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${selected ? 'bg-primary text-white' : 'bg-outline-variant/20 text-on-surface-variant'}`}>
                  {optLabels[i]}
                </span>
                <span>{opt}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-2">
        <button onClick={() => setCurrent(i => Math.max(0, i - 1))} disabled={current === 0}
          className="flex-1 py-2.5 border border-outline-variant rounded-xl text-sm font-medium text-on-surface hover:bg-surface-container-low disabled:opacity-30 transition-all cursor-pointer disabled:cursor-not-allowed">
          ← Previous
        </button>
        {current < questions.length - 1 ? (
          <button onClick={() => setCurrent(i => i + 1)}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all cursor-pointer">
            Next →
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={!allAnswered || submitting}
            className="flex-1 py-2.5 bg-success text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed">
            {submitting ? 'Submitting...' : `Submit${!allAnswered ? ` (${questions.length - answeredCount} unanswered)` : ''}`}
          </button>
        )}
      </div>
    </div>
  )
}
