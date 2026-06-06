import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { pickByDifficulty } from '../lib/utils'
import QuizRunner from '../components/QuizRunner'

export default function ModeQuizPage() {
  const { modeName } = useParams()
  const mode = decodeURIComponent(modeName)
  const navigate = useNavigate()
  const [questions, setQuestions] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(collection(db, 'questions'))
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const filtered = all.filter((q) => q.mode === mode)
      if (filtered.length < 15) { navigate('/quiz/select'); return }
      const picked = pickByDifficulty(filtered, { beginner: 15, intermediate: 15, expert: 20 })
      setQuestions(picked)
    }
    fetch()
  }, [mode, navigate])

  if (!questions) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Loading mode test...</p></div>

  return (
    <QuizRunner
      questions={questions}
      config={{
        title: mode === 'Book' ? 'Self-Paced (Book)' : 'Instructor-Led (Physical)',
        subtitle: 'Mode Test · 50 min',
        quizType: 'mode',
        mode,
        timerMinutes: 50,
      }}
    />
  )
}
