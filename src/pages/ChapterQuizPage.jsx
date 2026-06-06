import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, getDocs, addDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { shuffle } from '../lib/utils'
import QuestionCard from '../components/QuestionCard'
import ProgressBar from '../components/ProgressBar'
import ResultSummary from '../components/ResultSummary'

export default function ChapterQuizPage() {
  const { chapterName } = useParams()
  const chapter = decodeURIComponent(chapterName)
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
      const filtered = all.filter((q) => q.chapter === chapter)
      if (filtered.length === 0) {
        navigate('/quiz/select')
        return
      }
      const picked = shuffle(filtered).slice(0, 10)
      setQuestions(picked)
      setLoading(false)
    }
    fetch()
  }, [chapter, navigate])

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
          chapter,
          difficulty: 'Mixed',
          score: finalScore,
          totalQuestions: questions.length,
          percentage: Math.round((finalScore / questions.length) * 100),
          answers: [...newAnswers, result],
          completedAt: new Date().toISOString(),
          timeTaken,
          testType: 'chapter',
        })
      } catch (e) {
        console.error('Failed to save result:', e)
      }
    } else {
      setCurrent((c) => c + 1)
    }
  }

  if (loading) return <div className="flex justify-center items-center min-h-[60vh] text-xl">Loading questions...</div>

  if (finished) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <ResultSummary score={score} total={questions.length} answers={answers} chapter={`Chapter Test: ${chapter}`} />
      </div>
    )
  }

  const q = questions[current]
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-lg font-semibold mb-1">Chapter Test: {chapter}</h2>
      <ProgressBar current={current} total={questions.length} />
      <div className="bg-white rounded-xl shadow p-6">
        <QuestionCard question={q} onNext={handleNext} total={questions.length} index={current} />
      </div>
    </div>
  )
}
