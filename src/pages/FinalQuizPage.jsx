import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { shuffle, pickByDifficulty } from '../lib/utils'
import QuizRunner from '../components/QuizRunner'

export default function FinalQuizPage() {
  const navigate = useNavigate()
  const [questions, setQuestions] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(collection(db, 'questions'))
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      if (all.length < 30) { navigate('/quiz/select'); return }

      const book = all.filter((q) => q.mode === 'Book')
      const physical = all.filter((q) => q.mode === 'Physical')
      const other = all.filter((q) => q.mode !== 'Book' && q.mode !== 'Physical')

      const bookTarget = 60
      const physicalTarget = 40

      const bookPicked = pickByDifficulty(book, { beginner: 18, intermediate: 18, expert: 24 })
      const physicalPicked = pickByDifficulty(physical, { beginner: 12, intermediate: 12, expert: 16 })

      let picked = shuffle([...bookPicked, ...physicalPicked])

      if (picked.length < 100) {
        const extra = shuffle(other)
        const need = 100 - picked.length
        picked.push(...extra.slice(0, need))
      }

      setQuestions(picked.slice(0, 100))
    }
    fetch()
  }, [navigate])

  if (!questions) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Preparing Final Mock Test...</p></div>

  return (
    <QuizRunner
      questions={questions}
      config={{
        title: 'Final Mock Test',
        subtitle: '100 Qs · All chapters · 100 min',
        quizType: 'final',
        timerMinutes: 100,
      }}
    />
  )
}
