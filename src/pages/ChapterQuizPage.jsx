import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { pickByDifficulty } from '../lib/utils'
import { getQuizSettings, getDifficultySplit, getConfigTimerLabel, checkAttemptLimit } from '../lib/quizSettings'
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
      const allowed = await checkAttemptLimit(profile, 'chapter')
      if (!allowed) { navigate('/quiz/select'); return }
      const settings = await getQuizSettings()
      const total = settings.chapterQuestionCount
      const min = Math.round(total * 0.5)
      const all = await getAllQuestionsCached()
      const filtered = all.filter((q) => q.chapter === chapter && q.mode !== 'Physical')
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
