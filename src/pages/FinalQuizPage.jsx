import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { shuffle, pickByDifficulty } from '../lib/utils'
import { getQuizSettings, getFinalSplit, getConfigTimerLabel, checkAttemptLimit, checkQuizAccess, checkModuleAccess } from '../lib/quizSettings'
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
      const accessible = all.filter((q) => checkModuleAccess(profile, q.module, settings))
      if (accessible.length < min) { navigate('/quiz/select'); return }

      const book = accessible.filter((q) => q.mode === 'Book')
      const physical = accessible.filter((q) => q.mode === 'Physical')
      const other = accessible.filter((q) => q.mode !== 'Book' && q.mode !== 'Physical')

      const { bookTarget, physicalTarget, bookSplit, physicalSplit } = getFinalSplit(total)

      const bookPicked = pickByDifficulty(book, bookSplit)
      const physicalPicked = pickByDifficulty(physical, physicalSplit)

      let picked = shuffle([...bookPicked, ...physicalPicked])

      if (picked.length < total) {
        const extra = shuffle(other)
        const need = total - picked.length
        picked.push(...extra.slice(0, need))
      }

      setQuestions(picked.slice(0, total))
      setConfig({
        title: 'Final Mock Test',
        subtitle: `${total} Qs · All chapters · ${settings.finalTimerMinutes} min`,
        quizType: 'final',
        timerMinutes: settings.finalTimerMinutes,
      })
    }
    fetch()
  }, [navigate])

  if (!questions || !config) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Preparing Final Mock Test...</p></div>

  return <ProctoredQuizRunner proctored questions={questions} config={config} />
}
