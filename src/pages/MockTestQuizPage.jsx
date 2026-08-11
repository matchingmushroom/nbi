import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { pickByDifficulty } from '../lib/utils'
import { getQuizSettings, checkQuizAccess } from '../lib/quizSettings'
import { getAllQuestionsCached } from '../lib/cache'
import QuizRunner from '../components/QuizRunner'

const TIMER_MINUTES = 15
const SPLIT = { beginner: 1, intermediate: 2, expert: 12 }

export default function MockTestQuizPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [questions, setQuestions] = useState(null)
  const [config, setConfig] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      const settings = await getQuizSettings()
      if (!checkQuizAccess(profile, 'mockTest', settings)) { navigate('/quiz/select'); return }
      const all = await getAllQuestionsCached()
      const filtered = all.filter((q) => q.module === 'PreTest' && !(q.module === 'Course' && q.mode === 'Certification'))
      if (filtered.length < 1) { navigate('/quiz/select'); return }
      const picked = pickByDifficulty(filtered, SPLIT)
      setQuestions(picked)
      setConfig({
        title: 'Quick Mock Pre-Test Revision',
        subtitle: `${picked.length} Qs · ${TIMER_MINUTES} min`,
        quizType: 'mock-test',
        timerMinutes: TIMER_MINUTES,
      })
    }
    fetch()
  }, [navigate])

  if (!questions || !config) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Loading Quick Mock Pre-Test Revision...</p></div>

  return <QuizRunner questions={questions} config={config} />
}
