import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { pickByDifficulty } from '../lib/utils'
import QuizRunner from '../components/QuizRunner'

export default function ChapterQuizPage() {
  const { chapterName } = useParams()
  const chapter = decodeURIComponent(chapterName)
  const navigate = useNavigate()
  const [questions, setQuestions] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(collection(db, 'questions'))
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const filtered = all.filter((q) => q.chapter === chapter && q.mode !== 'Physical')
      if (filtered.length < 6) { navigate('/quiz/select'); return }
      const picked = pickByDifficulty(filtered, { beginner: 2, intermediate: 4, expert: 4 })
      setQuestions(picked)
    }
    fetch()
  }, [chapter, navigate])

  if (!questions) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Loading chapter test...</p></div>

  return (
    <QuizRunner
      questions={questions}
      config={{
        title: chapter,
        subtitle: 'Chapter Test · 10 min',
        quizType: 'chapter',
        chapter,
        timerMinutes: 10,
      }}
    />
  )
}
