import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { pickByDifficulty } from '../lib/utils'
import { getQuizSettings, getDifficultySplit, getConfigTimerLabel, checkAttemptLimit, checkQuizAccess, checkModuleAccess } from '../lib/quizSettings'
import { getAllQuestionsCached } from '../lib/cache'
import QuizRunner from '../components/QuizRunner'

export default function ChapterQuizPage() {
  const { chapterName } = useParams()
  const chapter = decodeURIComponent(chapterName)
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [questions, setQuestions] = useState(null)
  const [config, setConfig] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      const settings = await getQuizSettings()
      if (!checkQuizAccess(profile, 'chapter', settings)) { navigate('/quiz/select'); return }
      const all = await getAllQuestionsCached()
      const chModule = all.find((q) => q.chapter === chapter)?.module
      if (chModule && !checkModuleAccess(profile, chModule, settings)) { navigate('/quiz/select'); return }
      if (!checkModuleAccess(profile, chapter, settings)) { navigate('/quiz/select'); return }
      const allowed = await checkAttemptLimit(profile, 'chapter')
      if (!allowed) { navigate('/quiz/select'); return }
      const total = settings.chapterQuestionCount
      const min = Math.round(total * 0.5)
      const filtered = all.filter((q) => q.chapter === chapter && (q.module === 'Mock Test' || q.mode !== 'Physical') && !(q.module === 'Course' && q.mode === 'Certification'))
      if (filtered.length < min) { navigate('/quiz/select'); return }
      const split = getDifficultySplit(total, 'chapter')
      const picked = pickByDifficulty(filtered, split)
      setQuestions(picked)
      setConfig({
        title: chapter,
        subtitle: getConfigTimerLabel('chapter', settings.chapterTimerMinutes),
        quizType: 'chapter',
        chapter,
        timerMinutes: settings.chapterTimerMinutes,
      })
    }
    fetch()
  }, [chapter, navigate])

  if (!questions || !config) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Loading chapter test...</p></div>

  return <QuizRunner questions={questions} config={config} />
}
