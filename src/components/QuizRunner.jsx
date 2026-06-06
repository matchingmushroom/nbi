import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import QuestionCard from './QuestionCard'
import Timer from './Timer'

export default function QuizRunner({ questions, config, onFinish }) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState([])
  const [finished, setFinished] = useState(false)
  const [score, setScore] = useState(0)
  const [timeUp, setTimeUp] = useState(false)
  const startTime = useRef(Date.now())
  const scoreRef = useRef(0)
  const resultIdRef = useRef(null)

  const saveResult = useCallback(async (finalAnswers, finalScore) => {
    const timeTaken = Math.round((Date.now() - startTime.current) / 1000)
    const result = {
      userId: profile?.uid || 'unknown',
      userEmail: profile?.email || '',
      displayName: profile?.displayName || '',
      quizType: config.quizType,
      chapter: config.chapter || '',
      module: config.module || '',
      mode: config.mode || '',
      difficulty: 'Mixed',
      score: finalScore,
      totalQuestions: questions.length,
      percentage: questions.length > 0 ? Math.round((finalScore / questions.length) * 100) : 0,
      answers: finalAnswers,
      completedAt: new Date().toISOString(),
      timeTaken,
    }
    try {
      const docRef = await addDoc(collection(db, 'results'), result)
      resultIdRef.current = docRef.id
    } catch (e) {
      console.error('Failed to save result:', e)
    }
    onFinish?.()
  }, [profile, config, questions.length, onFinish])

  const handleTimeUp = useCallback(() => {
    setTimeUp(true)
    setFinished(true)
    setScore(scoreRef.current)
    saveResult(answers, scoreRef.current)
  }, [answers, saveResult])

  const handleNext = async (result) => {
    const newAnswers = [...answers, result]
    setAnswers(newAnswers)
    const newScore = score + (result.isCorrect ? 1 : 0)
    setScore(newScore)
    scoreRef.current = newScore
    if (current + 1 >= questions.length) {
      setFinished(true)
      await saveResult(newAnswers, newScore)
    } else {
      setCurrent((c) => c + 1)
    }
  }

  if (!questions.length) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="bg-surface border border-outline-variant rounded-xl p-6 text-center shadow-sm max-w-sm w-full">
          <span className="material-symbols-outlined text-[40px] text-on-surface-variant mb-2">error_outline</span>
          <p className="text-sm text-on-surface-variant">Not enough questions available.</p>
          <button onClick={() => navigate('/quiz/select')} className="mt-4 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold cursor-pointer">Back</button>
        </div>
      </div>
    )
  }

  if (finished) {
    const totalQ = questions.length || 1
    const pct = score / totalQ
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="bg-surface border border-outline-variant rounded-xl p-6 text-center shadow-sm max-w-sm w-full">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${pct >= 0.6 ? 'bg-green-100' : 'bg-red-100'}`}>
            <span className={`material-symbols-outlined text-[32px] ${pct >= 0.6 ? 'text-success' : 'text-error'}`}>
              {pct >= 0.6 ? 'check_circle' : 'cancel'}
            </span>
          </div>
          <h2 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface mb-1">
            {pct >= 0.8 ? 'Excellent!' : pct >= 0.6 ? 'Good Job!' : pct >= 0.4 ? 'Keep Trying' : 'Needs Improvement'}
          </h2>
          <p className="text-xs text-on-surface-variant mb-4">{config.title}{timeUp ? ' (Time Expired)' : ''}</p>
          <div className="text-4xl font-extrabold text-primary mb-1">{score}<span className="text-lg text-on-surface-variant">/{totalQ}</span></div>
          <p className="text-xs text-on-surface-variant mb-5">{Math.round(pct * 100)}% Accuracy</p>
          <div className="flex gap-2">
            <button onClick={() => navigate('/quiz/select')} className="flex-1 bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] cursor-pointer">Back</button>
            {resultIdRef.current && (
              <button onClick={() => navigate(`/results/${resultIdRef.current}`)} className="flex-1 bg-surface-container-low text-on-surface py-2.5 rounded-xl font-semibold text-sm hover:bg-surface-container-high active:scale-[0.98] cursor-pointer">Review Answers</button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const q = questions[current]
  return (
    <div className="h-full overflow-hidden flex flex-col p-3 md:p-4">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div>
          <h2 className="font-['Hanken_Grotesk'] text-sm md:text-base font-bold text-on-surface leading-tight">{config.title}</h2>
          <p className="text-[10px] text-on-surface-variant">{questions.length} Qs · {config.subtitle}</p>
        </div>
        <Timer minutes={config.timerMinutes} onTimeUp={handleTimeUp} />
      </div>
      <div className="w-full bg-surface-container-low h-1 rounded-full mb-2 shrink-0">
        <div className="bg-secondary h-full rounded-full transition-all duration-300" style={{ width: `${((current) / questions.length) * 100}%` }} />
      </div>
      <div className="flex-1 min-h-0 bg-surface border border-outline-variant rounded-xl p-3 md:p-4 shadow-sm overflow-hidden">
        <QuestionCard question={q} onNext={handleNext} total={questions.length} index={current} />
      </div>
    </div>
  )
}
