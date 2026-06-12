import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { pickByDifficulty } from '../lib/utils'
import { getQuizSettings, getDifficultySplit, getConfigTimerLabel, checkAttemptLimit, checkQuizAccess, checkModuleAccess } from '../lib/quizSettings'
import { getAllQuestionsCached } from '../lib/cache'
import QuizRunner from '../components/QuizRunner'

export default function ModeQuizPage() {
  const { modeName } = useParams()
  const mode = decodeURIComponent(modeName)
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [questions, setQuestions] = useState(null)
  const [config, setConfig] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      const settings = await getQuizSettings()
      if (!checkQuizAccess(profile, 'mode', settings)) { navigate('/quiz/select'); return }
      const allowed = await checkAttemptLimit(profile, 'mode')
      if (!allowed) { navigate('/quiz/select'); return }
      const total = settings.modeQuestionCount
      const min = Math.round(total * 0.3)
      const all = await getAllQuestionsCached()
      const filtered = all.filter((q) => q.mode === mode && !(q.module === 'Course' && q.mode === 'Certification') && q.module !== 'Mock Test' && checkModuleAccess(profile, q.module, settings))
      if (filtered.length < min) { navigate('/quiz/select'); return }
      const split = getDifficultySplit(total, 'mode')
      const picked = pickByDifficulty(filtered, split)
      setQuestions(picked)
      setConfig({
        title: mode === 'Book' ? 'Self-Paced (Book)' : 'Instructor-Led (Physical)',
        subtitle: getConfigTimerLabel('mode', settings.modeTimerMinutes),
        quizType: 'mode',
        mode,
        timerMinutes: settings.modeTimerMinutes,
      })
    }
    fetch()
  }, [mode, navigate])

  if (!questions || !config) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Loading mode test...</p></div>

  return <QuizRunner questions={questions} config={config} />
}
