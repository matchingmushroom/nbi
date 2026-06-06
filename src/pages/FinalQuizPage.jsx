import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, addDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { shuffle } from '../lib/utils'
import QuestionCard from '../components/QuestionCard'
import Timer from '../components/Timer'

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
  const [timeUp, setTimeUp] = useState(false)
  const startTime = useRef(Date.now())
  const scoreRef = useRef(0)

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(collection(db, 'questions'))
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      if (all.length === 0) { navigate('/quiz/select'); return }

      const beginner = shuffle(all.filter((q) => q.difficulty === 'Beginner'))
      const intermediate = shuffle(all.filter((q) => q.difficulty === 'Intermediate'))
      const expert = shuffle(all.filter((q) => q.difficulty === 'Expert'))

      let picked = []
      picked.push(...beginner.slice(0, TARGET_BEGINNER))
      picked.push(...intermediate.slice(0, TARGET_INTERMEDIATE))
      picked.push(...expert.slice(0, TARGET_EXPERT))

      const pBeg = picked.filter(q => q.difficulty === 'Beginner').length
      const pInt = picked.filter(q => q.difficulty === 'Intermediate').length
      const pExp = picked.filter(q => q.difficulty === 'Expert').length

      let extra = []
      const remainder = shuffle(all.filter((q) => !picked.some((p) => p.id === q.id)))

      if (pBeg < TARGET_BEGINNER) extra.push(...remainder.splice(0, TARGET_BEGINNER - pBeg))
      if (pInt < TARGET_INTERMEDIATE) extra.push(...remainder.splice(0, TARGET_INTERMEDIATE - pInt))
      if (pExp < TARGET_EXPERT) extra.push(...remainder.splice(0, TARGET_EXPERT - pExp))
      if (picked.length + extra.length < TOTAL) extra.push(...remainder.splice(0, TOTAL - picked.length - extra.length))

      picked = shuffle([...picked, ...extra]).slice(0, TOTAL)

      if (picked.length < 10) { navigate('/quiz/select'); return }
      setQuestions(picked)
      setLoading(false)
    }
    fetch()
  }, [navigate])

  const finishTest = useCallback(async (finalAnswers, finalScore) => {
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
        percentage: questions.length > 0 ? Math.round((finalScore / questions.length) * 100) : 0,
        answers: finalAnswers,
        completedAt: new Date().toISOString(),
        timeTaken,
        testType: 'final',
      })
    } catch (e) { console.error('Failed to save result:', e) }
  }, [profile, questions.length])

  const handleTimeUp = useCallback(() => {
    setTimeUp(true)
    setFinished(true)
    setScore(scoreRef.current)
    finishTest(answers, scoreRef.current)
  }, [answers, finishTest])

  const handleNext = async (result) => {
    const newAnswers = [...answers, result]
    setAnswers(newAnswers)
    if (result.isCorrect) {
      const newScore = score + 1
      setScore(newScore)
      scoreRef.current = newScore
    }

    if (current + 1 >= questions.length) {
      const finalScore = score + (result.isCorrect ? 1 : 0)
      setScore(finalScore)
      setFinished(true)
      await finishTest(newAnswers, finalScore)
    } else {
      setCurrent((c) => c + 1)
    }
  }

  if (loading) return (
    <div className="md:ml-64 p-8 pb-20 flex justify-center items-center min-h-[60vh]">
      <p className="text-on-surface-variant">Preparing your Final Test...</p>
    </div>
  )

  if (finished) {
    const totalQ = questions.length || 1
    return (
      <div className="md:ml-64 p-4 md:p-8 pb-20 md:pb-8 max-w-lg mx-auto">
        <div className="bg-surface border border-outline-variant rounded-xl p-8 text-center shadow-sm">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            (score / totalQ) >= 0.6 ? 'bg-green-100' : 'bg-red-100'
          }`}>
            <span className={`material-symbols-outlined text-[36px] ${
              (score / totalQ) >= 0.6 ? 'text-success' : 'text-error'
            }`}>
              {(score / totalQ) >= 0.6 ? 'check_circle' : 'cancel'}
            </span>
          </div>
          <h2 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface mb-1">
            {(score / totalQ) >= 0.8 ? 'Excellent!' : (score / totalQ) >= 0.6 ? 'Good Job!' :
             (score / totalQ) >= 0.4 ? 'Keep Trying' : 'Needs Improvement'}
          </h2>
          <p className="text-sm text-on-surface-variant mb-6">Final Test{timeUp ? ' (Time Expired)' : ''}</p>
          <div className="text-5xl font-extrabold text-primary mb-1">{score}<span className="text-xl text-on-surface-variant">/{totalQ}</span></div>
          <p className="text-sm text-on-surface-variant mb-8">{Math.round((score / totalQ) * 100)}% Accuracy</p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/quiz/select')} className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer">
              Back to Quiz Select
            </button>
            <button onClick={() => navigate('/dashboard')} className="flex-1 bg-surface-container-low text-on-surface py-3 rounded-xl font-semibold text-sm hover:bg-surface-container-high transition-all active:scale-[0.98] cursor-pointer">
              Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  const q = questions[current]
  return (
    <div className="md:ml-64 p-4 md:p-8 pb-20 md:pb-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface">Final Test</h2>
          <p className="text-xs text-on-surface-variant">{questions.length} questions · All chapters</p>
        </div>
        <Timer minutes={60} onTimeUp={handleTimeUp} />
      </div>
      <div className="w-full bg-surface-container-low h-1.5 rounded-full mb-6 overflow-hidden">
        <div className="bg-secondary h-full rounded-full transition-all duration-300" style={{ width: `${((current) / questions.length) * 100}%` }} />
      </div>
      <div className="bg-surface border border-outline-variant rounded-xl p-5 md:p-8 shadow-sm">
        <QuestionCard question={q} onNext={handleNext} total={questions.length} index={current} />
      </div>
    </div>
  )
}
