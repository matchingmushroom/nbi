import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, getDocs, addDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { shuffle } from '../lib/utils'
import QuestionCard from '../components/QuestionCard'
import Timer from '../components/Timer'

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
  const [timeUp, setTimeUp] = useState(false)
  const startTime = useRef(Date.now())
  const scoreRef = useRef(0)

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(collection(db, 'questions'))
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const filtered = all.filter((q) => q.chapter === chapter)
      if (filtered.length === 0) { navigate('/quiz/select'); return }
      const picked = shuffle(filtered).slice(0, 10)
      setQuestions(picked)
      setLoading(false)
    }
    fetch()
  }, [chapter, navigate])

  const finishTest = useCallback(async (finalAnswers, finalScore) => {
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
        percentage: questions.length > 0 ? Math.round((finalScore / questions.length) * 100) : 0,
        answers: finalAnswers,
        completedAt: new Date().toISOString(),
        timeTaken,
        testType: 'chapter',
      })
    } catch (e) { console.error('Failed to save result:', e) }
  }, [profile, chapter, questions.length])

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
    <div className="h-full flex items-center justify-center">
      <p className="text-on-surface-variant">Loading questions...</p>
    </div>
  )

  if (finished) {
    const totalQ = questions.length || 1
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="bg-surface border border-outline-variant rounded-xl p-6 text-center shadow-sm max-w-sm w-full">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${(score / totalQ) >= 0.6 ? 'bg-green-100' : 'bg-red-100'}`}>
            <span className={`material-symbols-outlined text-[32px] ${(score / totalQ) >= 0.6 ? 'text-success' : 'text-error'}`}>
              {(score / totalQ) >= 0.6 ? 'check_circle' : 'cancel'}
            </span>
          </div>
          <h2 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface mb-1">
            {(score / totalQ) >= 0.8 ? 'Excellent!' : (score / totalQ) >= 0.6 ? 'Good Job!' : (score / totalQ) >= 0.4 ? 'Keep Trying' : 'Needs Improvement'}
          </h2>
          <p className="text-xs text-on-surface-variant mb-4">{chapter}{timeUp ? ' (Time Expired)' : ''}</p>
          <div className="text-4xl font-extrabold text-primary mb-1">{score}<span className="text-lg text-on-surface-variant">/{totalQ}</span></div>
          <p className="text-xs text-on-surface-variant mb-5">{Math.round((score / totalQ) * 100)}% Accuracy</p>
          <div className="flex gap-2">
            <button onClick={() => navigate('/quiz/select')} className="flex-1 bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] cursor-pointer">Back</button>
            <button onClick={() => navigate('/dashboard')} className="flex-1 bg-surface-container-low text-on-surface py-2.5 rounded-xl font-semibold text-sm hover:bg-surface-container-high active:scale-[0.98] cursor-pointer">Dashboard</button>
          </div>
        </div>
      </div>
    )
  }

  const q = questions[current]
  return (
    <div className="h-full overflow-hidden flex flex-col p-3 md:p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div>
          <h2 className="font-['Hanken_Grotesk'] text-sm md:text-base font-bold text-on-surface leading-tight">{chapter}</h2>
          <p className="text-[10px] text-on-surface-variant">Chapter Test · {questions.length} Qs</p>
        </div>
        <Timer minutes={30} onTimeUp={handleTimeUp} />
      </div>
      {/* Progress */}
      <div className="w-full bg-surface-container-low h-1 rounded-full mb-2 shrink-0">
        <div className="bg-secondary h-full rounded-full transition-all duration-300" style={{ width: `${(current / questions.length) * 100}%` }} />
      </div>
      {/* Question Card - fills remaining space */}
      <div className="flex-1 min-h-0 bg-surface border border-outline-variant rounded-xl p-3 md:p-4 shadow-sm overflow-hidden">
        <QuestionCard question={q} onNext={handleNext} total={questions.length} index={current} />
      </div>
    </div>
  )
}
