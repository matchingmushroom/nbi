import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { pickByDifficulty } from '../lib/utils'
import { getQuizSettings, getDifficultySplit, checkAttemptLimit, checkQuizAccess, checkModuleAccess } from '../lib/quizSettings'
import { getAllQuestionsCached } from '../lib/cache'
import ProctoredQuizRunner from '../components/ProctoredQuizRunner'

export default function FinalQuizPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [questions, setQuestions] = useState(null)
  const [config, setConfig] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      const settings = await getQuizSettings()
      if (!checkQuizAccess(profile, 'final', settings)) { navigate('/quiz/select'); return }
      const allowed = await checkAttemptLimit(profile, 'final')
      if (!allowed) { navigate('/quiz/select'); return }
      const total = settings.finalQuestionCount
      const min = Math.round(total * 0.3)
      const all = await getAllQuestionsCached()
      const accessible = all.filter((q) => q.module === 'PreTest' && checkModuleAccess(profile, q.module, settings))
      if (accessible.length < min) { navigate('/quiz/select'); return }

      const split = getDifficultySplit(total, 'final')
      const picked = pickByDifficulty(accessible, split)

      setQuestions(picked.slice(0, total))
      setConfig({
        title: 'Mock Pre-Test',
        subtitle: `${total} Qs · All chapters · ${settings.finalTimerMinutes} min`,
        quizType: 'final',
        timerMinutes: settings.finalTimerMinutes,
      })
    }
    fetch()
  }, [navigate])

  if (!questions || !config) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Preparing Mock Pre-Test...</p></div>

  return <ProctoredQuizRunner proctored questions={questions} config={config} />
}
