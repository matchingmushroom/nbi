import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, addDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { shuffle } from '../lib/utils'
import QuestionCard from '../components/QuestionCard'
import ProgressBar from '../components/ProgressBar'
import ResultSummary from '../components/ResultSummary'

const TARGET_BEGINNER = 20
const TARGET_INTERMEDIATE = 30
const TARGET_EXPERT = 50
const TOTAL = 100

export default function FinalQuizPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState([])
  const [finished, setFinished] = useState(false)
  const [score, setScore] = useState(0)
  const startTime = useRef(Date.now())

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(collection(db, 'questions'))
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      if (all.length === 0) {
        navigate('/quiz/select')
        return
      }

      const beginner = shuffle(all.filter((q) => q.difficulty === 'Beginner'))
      const intermediate = shuffle(all.filter((q) => q.difficulty === 'Intermediate'))
      const expert = shuffle(all.filter((q) => q.difficulty === 'Expert'))

      let picked = []
      picked.push(...beginner.slice(0, TARGET_BEGINNER))
      picked.push(...intermediate.slice(0, TARGET_INTERMEDIATE))
      picked.push(...expert.slice(0, TARGET_EXPERT))

      const pickedBeginners = picked.filter(q => q.difficulty === 'Beginner').length
      const pickedIntermediates = picked.filter(q => q.difficulty === 'Intermediate').length
      const pickedExperts = picked.filter(q => q.difficulty === 'Expert').length

      let extra = []
      const remainder = all.filter(
        (q) => !picked.some((p) => p.id === q.id)
      )
      const shuffledRemainder = shuffle(remainder)

      if (pickedBeginners < TARGET_BEGINNER) {
        const needed = TARGET_BEGINNER - pickedBeginners
        extra.push(...shuffledRemainder.splice(0, needed))
      }
      if (pickedIntermediates < TARGET_INTERMEDIATE) {
        const needed = TARGET_INTERMEDIATE - pickedIntermediates
        extra.push(...shuffledRemainder.splice(0, needed))
      }
      if (pickedExperts < TARGET_EXPERT) {
        const needed = TARGET_EXPERT - pickedExperts
        extra.push(...shuffledRemainder.splice(0, needed))
      }

      if (picked.length + extra.length < TOTAL) {
        extra.push(...shuffledRemainder.splice(0, TOTAL - picked.length - extra.length))
      }

      picked = shuffle([...picked, ...extra]).slice(0, TOTAL)

      if (picked.length < 10) {
        navigate('/quiz/select')
        return
      }

      setQuestions(picked)
      setLoading(false)
    }
    fetch()
  }, [navigate])

  const handleNext = async (result) => {
    const newAnswers = [...answers, result]
    setAnswers(newAnswers)
    if (result.isCorrect) setScore((s) => s + 1)

    if (current + 1 >= questions.length) {
      const finalScore = score + (result.isCorrect ? 1 : 0)
      setScore(finalScore)
      setFinished(true)

      const timeTaken = Math.round((Date.now() - startTime.current) / 1000)
      try {
        await addDoc(collection(db, 'results'), {
          userId: profile?.uid || 'unknown',
          userEmail: profile?.email || '',
          displayName: profile?.displayName || '',
          chapter: 'Final Test',
          difficulty: 'Mixed',
          score: finalScore,
          totalQuestions: questions.length,
          percentage: Math.round((finalScore / questions.length) * 100),
          answers: [...newAnswers, result],
          completedAt: new Date().toISOString(),
          timeTaken,
          testType: 'final',
        })
      } catch (e) {
        console.error('Failed to save result:', e)
      }
    } else {
      setCurrent((c) => c + 1)
    }
  }

  if (loading) return <div className="flex justify-center items-center min-h-[60vh] text-xl">Preparing your Final Test...</div>

  if (finished) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <ResultSummary score={score} total={questions.length} answers={answers} chapter="Final Test" />
      </div>
    )
  }

  const q = questions[current]
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-lg font-semibold mb-1">Final Test</h2>
      <p className="text-sm text-gray-500 mb-4">
        {questions.length} questions &middot; All chapters mixed
      </p>
      <ProgressBar current={current} total={questions.length} />
      <div className="bg-white rounded-xl shadow p-6">
        <QuestionCard question={q} onNext={handleNext} total={questions.length} index={current} />
      </div>
    </div>
  )
}
