import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { pickByDifficulty } from '../lib/utils'
import QuizRunner from '../components/QuizRunner'

export default function ModuleQuizPage() {
  const { moduleName } = useParams()
  const mod = decodeURIComponent(moduleName)
  const navigate = useNavigate()
  const [questions, setQuestions] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(collection(db, 'questions'))
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const filtered = all.filter((q) => q.module === mod)
      if (filtered.length < 12) { navigate('/quiz/select'); return }
      const picked = pickByDifficulty(filtered, { beginner: 4, intermediate: 8, expert: 8 })
      setQuestions(picked)
    }
    fetch()
  }, [mod, navigate])

  if (!questions) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Loading module test...</p></div>

  return (
    <QuizRunner
      questions={questions}
      config={{
        title: mod,
        subtitle: 'Module Test · 30 min',
        quizType: 'module',
        module: mod,
        timerMinutes: 30,
      }}
    />
  )
}
