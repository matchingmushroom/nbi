import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { pickByDifficulty } from '../lib/utils'
import { getQuizSettings, getDifficultySplit, getConfigTimerLabel, checkAttemptLimit } from '../lib/quizSettings'
import { getAllQuestionsCached } from '../lib/cache'
import QuizRunner from '../components/QuizRunner'

export default function ModuleQuizPage() {
  const { moduleName } = useParams()
  const mod = decodeURIComponent(moduleName)
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [questions, setQuestions] = useState(null)
  const [config, setConfig] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      const allowed = await checkAttemptLimit(profile, 'module')
      if (!allowed) { navigate('/quiz/select'); return }
      const settings = await getQuizSettings()
      const total = settings.moduleQuestionCount
      const min = Math.round(total * 0.5)
      const all = await getAllQuestionsCached()
      const filtered = all.filter((q) => q.module === mod && !(q.module === 'Course' && q.mode === 'Certification'))
      if (filtered.length < min) { navigate('/quiz/select'); return }
      const split = getDifficultySplit(total, 'module')
      const picked = pickByDifficulty(filtered, split)
      setQuestions(picked)
      setConfig({
        title: mod,
        subtitle: getConfigTimerLabel('module', settings.moduleTimerMinutes),
        quizType: 'module',
        module: mod,
        timerMinutes: settings.moduleTimerMinutes,
      })
    }
    fetch()
  }, [mod, navigate])

  if (!questions || !config) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Loading module test...</p></div>

  return <QuizRunner questions={questions} config={config} />
}
