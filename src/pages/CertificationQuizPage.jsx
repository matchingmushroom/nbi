import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getQuizSettings, getConfigTimerLabel, checkAttemptLimit } from '../lib/quizSettings'
import { getAllQuestionsCached } from '../lib/cache'
import { getAllCourses } from '../lib/steakService'
import QuizRunner from '../components/QuizRunner'

export default function CertificationQuizPage() {
  const { courseChapter } = useParams()
  const courseId = decodeURIComponent(courseChapter)
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [questions, setQuestions] = useState(null)
  const [config, setConfig] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      const allowed = await checkAttemptLimit(profile, 'certification')
      if (!allowed) { navigate('/quiz/select'); return }
      const [settings, all, courses] = await Promise.all([
        getQuizSettings(),
        getAllQuestionsCached(),
        getAllCourses(),
      ])
      const total = settings.certificationQuestionCount || 20
      const min = Math.round(total * 0.5)

      // Match chapter field to course by courseTitle first, then courseId
      const course = courses.find((c) => c.courseTitle === courseId || c.courseId === courseId)
      const chapterMatch = course?.courseTitle || courseId
      const allCert = all.filter((q) => q.module === 'Course' && q.mode === 'Certification')
      const filtered = allCert.filter((q) => q.chapter === chapterMatch || q.chapter === courseId)
      if (filtered.length < min) { navigate('/quiz/select'); return }

      const picked = filtered.sort(() => Math.random() - 0.5).slice(0, total)
      setQuestions(picked)
      setConfig({
        title: course?.courseTitle || courseId,
        subtitle: getConfigTimerLabel('certification', settings.certificationTimerMinutes || 30),
        quizType: 'certification',
        chapter: courseId,
        timerMinutes: settings.certificationTimerMinutes || 30,
      })
    }
    fetch()
  }, [courseId, navigate])

  if (!questions || !config) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Loading certification quiz...</p></div>

  return <QuizRunner questions={questions} config={config} />
}
