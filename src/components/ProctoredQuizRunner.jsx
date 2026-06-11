import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { calcQuizXP, updateGamification } from '../lib/gamification'
import { invalidateCache, invalidateCachePrefix } from '../lib/cache'
import useProctoring from '../hooks/useProctoring'
import Timer from './Timer'

const formatTime = (s) => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const getOptionText = (q, letter) => {
  if (!q) return ''
  const map = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }
  return map[letter] || ''
}

export default function ProctoredQuizRunner({ questions, config, onFinish, proctored }) {
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const [phase, setPhase] = useState(proctored ? 'landing' : 'exam')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [markedForReview, setMarkedForReview] = useState(new Set())
  const [timeLeft, setTimeLeft] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const submittedRef = useRef(false)
  const startTimeRef = useRef(null)
  const handleSubmitRef = useRef(null)
  const [scoreResult, setScoreResult] = useState(null)

  const onAutoSubmit = useCallback(() => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitted(true)
    handleSubmitRef.current?.(true)
  }, [])

  const proctoring = useProctoring({ active: phase === 'exam' && proctored, onAutoSubmit })

  const saveResult = useCallback(async (finalAnswers, finalScore, isAuto) => {
    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000)
    const result = {
      userId: profile?.uid || user?.uid || 'unknown',
      userEmail: profile?.email || user?.email || '',
      displayName: profile?.displayName || user?.displayName || profile?.email || user?.email || '',
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
      xpEarned: calcQuizXP(config.quizType, finalScore, finalAnswers, questions),
    }
    if (proctored) {
      result.proctorLog = proctoring.violationsRef.current
      result.proctorWarnings = proctoring.violationsRef.current.length
      result.proctorAutoSubmit = isAuto
    }
    try {
      const docRef = await addDoc(collection(db, 'results'), result)
      const uid = profile?.uid || user?.uid
      if (uid) {
        await updateGamification(uid, { ...result, id: docRef.id }, questions)
        await refreshProfile()
      }
      invalidateCache('allResults')
      if (uid) invalidateCachePrefix('results_' + uid)
    } catch {}
    if (!proctored) onFinish?.(finalScore, questions.length)
  }, [profile, user, config, questions, onFinish, refreshProfile, proctored, proctoring.violationsRef])

  const handleSubmit = useCallback(async (isAuto) => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    if (proctored) proctoring.stopProctoring()
    const finalAnswers = questions.map((q, i) => answers[i] || { questionId: q.id || q.question, question: q.question, selected: null, correct: q.correctAnswer, isCorrect: false })
    const finalScore = finalAnswers.filter((a) => a.isCorrect).length
    await saveResult(finalAnswers, finalScore, isAuto)
    if (proctored) {
      setScoreResult({
        score: finalScore,
        total: questions.length,
        percentage: questions.length > 0 ? Math.round((finalScore / questions.length) * 100) : 0,
        xpEarned: calcQuizXP(config.quizType, finalScore, finalAnswers, questions),
        proctorLog: proctoring.violationsRef.current,
        isAuto,
      })
      setPhase('result')
    }
    setSubmitting(false)
    setSubmitted(true)
  }, [proctored, proctoring, answers, questions, saveResult, config])
  handleSubmitRef.current = handleSubmit

  useEffect(() => {
    if (phase !== 'exam' || submittedRef.current) return
    startTimeRef.current = Date.now()
    setTimeLeft((config.timerMinutes || 30) * 60)
    if (proctored) proctoring.startProctoring()
  }, [phase, proctored, proctoring])

  useEffect(() => {
    if (phase !== 'exam' || submittedRef.current) return
    const iv = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000)
    return () => clearInterval(iv)
  }, [phase])

  useEffect(() => {
    if (phase !== 'exam' || timeLeft > 0 || submittedRef.current) return
    submittedRef.current = true
    handleSubmitRef.current?.(true)
  }, [phase, timeLeft])

  const handleSelect = (letter) => {
    if (submitted) return
    const q = questions[currentIndex]
    setAnswers((prev) => ({ ...prev, [currentIndex]: { questionId: q.id || q.question, question: q.question, selected: letter, correct: q.correctAnswer, isCorrect: letter === q.correctAnswer } }))
  }

  const toggleReview = () => {
    if (submitted) return
    setMarkedForReview((prev) => {
      const next = new Set(prev)
      next.has(currentIndex) ? next.delete(currentIndex) : next.add(currentIndex)
      return next
    })
  }

  const goTo = (idx) => { if (!submitted) setCurrentIndex(idx) }

  const total = questions.length

  // Non-proctored: render original QuizRunner
  if (!proctored) {
    const Comp = () => {
      const [current, setCurrent] = useState(0)
      const [ans, setAns] = useState([])
      const [finished, setFinished] = useState(false)
      const [score, setScore] = useState(0)
      const [timeUp, setTimeUp] = useState(false)
      const scoreRef = useRef(0)

      const save = useCallback(async (finalAnswers, finalScore) => {
        const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000)
        const result = {
          userId: profile?.uid || user?.uid || 'unknown',
          userEmail: profile?.email || user?.email || '',
          displayName: profile?.displayName || user?.displayName || profile?.email || user?.email || '',
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
          xpEarned: calcQuizXP(config.quizType, finalScore, finalAnswers, questions),
        }
        try {
          const docRef = await addDoc(collection(db, 'results'), result)
          const uid = profile?.uid || user?.uid
          if (uid) {
            await updateGamification(uid, { ...result, id: docRef.id }, questions)
            await refreshProfile()
          }
          invalidateCache('allResults')
          if (uid) invalidateCachePrefix('results_' + uid)
        } catch {}
        onFinish?.(finalScore, questions.length)
      }, [profile, user, config, questions, onFinish, refreshProfile])

      const handleNext = async (result) => {
        const newAns = [...ans, result]
        setAns(newAns)
        const newScore = score + (result.isCorrect ? 1 : 0)
        setScore(newScore)
        scoreRef.current = newScore
        if (current + 1 >= questions.length) {
          setFinished(true)
          await save(newAns, newScore)
        } else {
          setCurrent((c) => c + 1)
        }
      }

      if (finished) {
        const pct = score / (questions.length || 1)
        return (
          <div className="h-full flex items-center justify-center p-4">
            <div className="bg-surface border border-outline-variant rounded-xl p-6 text-center shadow-sm max-w-sm w-full">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${pct >= 0.6 ? 'bg-green-100' : 'bg-red-100'}`}>
                <span className={`material-symbols-outlined text-[32px] ${pct >= 0.6 ? 'text-success' : 'text-error'}`}>
                  {pct >= 0.6 ? 'check_circle' : 'cancel'}
                </span>
              </div>
              <h2 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface mb-1">
                {pct >= 0.8 ? 'Excellent!' : pct >= 0.6 ? 'Good Job!' : 'Needs Improvement'}
              </h2>
              <p className="text-xs text-on-surface-variant mb-4">{timeUp ? '(Time Expired)' : ''}</p>
              <div className="text-4xl font-extrabold text-primary mb-1">{score}<span className="text-lg text-on-surface-variant">/{questions.length}</span></div>
              <p className="text-xs text-on-surface-variant">{Math.round(pct * 100)}% Accuracy</p>
              <div className="flex gap-2 mt-4">
                <button onClick={() => window.history.back()} className="flex-1 bg-primary text-white py-2.5 rounded-xl font-semibold text-sm cursor-pointer">Back</button>
              </div>
            </div>
          </div>
        )
      }

      return (
        <div className="h-full overflow-hidden flex flex-col p-3 md:p-4">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <div>
              <h2 className="font-['Hanken_Grotesk'] text-sm md:text-base font-bold text-on-surface leading-tight">{config.title}</h2>
              <p className="text-[10px] text-on-surface-variant">{questions.length} Qs · {config.subtitle}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Timer minutes={config.timerMinutes} onTimeUp={() => { setTimeUp(true); setFinished(true); save(ans, scoreRef.current) }} />
            </div>
          </div>
          <div className="w-full bg-surface-container-low h-1 rounded-full mb-2 shrink-0">
            <div className="bg-secondary h-full rounded-full transition-all duration-300" style={{ width: `${(current / questions.length) * 100}%` }} />
          </div>
          <div className="flex-1 min-h-0 bg-surface border border-outline-variant rounded-xl p-3 md:p-4 shadow-sm overflow-hidden">
            {questions[current] && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-on-surface">{questions[current].question}</p>
                <div className="space-y-2">
                  {['A', 'B', 'C', 'D'].map((l) => (
                    <button key={l} onClick={() => handleNext({ questionId: questions[current].id || questions[current].question, question: questions[current].question, selected: l, correct: questions[current].correctAnswer, isCorrect: l === questions[current].correctAnswer })}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-outline-variant text-left hover:bg-surface-container-low transition-all cursor-pointer">
                      <span className="w-7 h-7 rounded-full bg-surface-container-low flex items-center justify-center text-xs font-bold text-on-surface-variant shrink-0">{l}</span>
                      <span className="text-sm">{getOptionText(questions[current], l)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }
    return <Comp />
  }

  // Proctored mode: landing page
  if (phase === 'landing') return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-lg mx-auto flex flex-col items-center justify-center min-h-full">
      <div className="glass-strong rounded-2xl p-6 md:p-8 w-full border border-white/40 text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="material-symbols-outlined text-white text-[32px]" style={{fontVariationSettings: "'FILL' 1"}}>verified_user</span>
        </div>
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface mb-2">{config.title || 'Certification Quiz'}</h1>
        <p className="text-sm text-on-surface-variant mb-5">{questions.length} Qs · {config.timerMinutes || 30} min · Proctored</p>
        <div className="text-left space-y-3 mb-6">
          <div className="glass rounded-xl p-3 text-xs text-on-surface">
            <span className="font-semibold">📷 Webcam</span> — face monitoring throughout the test
          </div>
          <div className="glass rounded-xl p-3 text-xs text-on-surface">
            <span className="font-semibold">🎤 Microphone</span> — noise detection for suspicious activity
          </div>
          <div className="glass rounded-xl p-3 text-xs text-on-surface">
            <span className="font-semibold">🔒 Lockdown</span> — fullscreen, tab switch tracking, shortcuts disabled
          </div>
          <div className="glass rounded-xl p-3 text-xs text-on-surface">
            <span className="font-semibold">⚑ Mark for Review</span> — flag questions to revisit
          </div>
        </div>
        <div className="space-y-3">
          <button onClick={proctoring.startCamera} disabled={proctoring.camReady}
            className="w-full flex items-center justify-center gap-2 bg-primary/5 border border-primary/20 rounded-xl py-3 text-sm font-semibold text-primary disabled:opacity-50 transition-all cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">{proctoring.camReady ? 'check_circle' : 'videocam'}</span>
            {proctoring.camReady ? 'Webcam Connected' : 'Enable Webcam'}
          </button>
          <button onClick={proctoring.startMic} disabled={proctoring.micReady}
            className="w-full flex items-center justify-center gap-2 bg-primary/5 border border-primary/20 rounded-xl py-3 text-sm font-semibold text-primary disabled:opacity-50 transition-all cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">{proctoring.micReady ? 'check_circle' : 'mic'}</span>
            {proctoring.micReady ? 'Microphone Connected' : 'Enable Microphone'}
          </button>
          <button onClick={() => setPhase('exam')} disabled={!proctoring.camReady || !proctoring.micReady}
            className="w-full bg-gradient-to-r from-primary to-blue-500 text-white py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-all shadow-lg shadow-primary/20 cursor-pointer">
            Start Certification Quiz
          </button>
          <button onClick={() => onFinish ? onFinish(undefined, undefined) : navigate('/quiz/select')} className="w-full text-xs text-on-surface-variant hover:text-on-surface py-2 cursor-pointer">Cancel</button>
        </div>
      </div>
      {proctoring.camReady && (
        <div className="mt-4 w-full max-w-xs mx-auto rounded-xl overflow-hidden border-2 border-primary/30 shadow-lg">
          <video ref={proctoring.videoRef} autoPlay muted playsInline className="w-full h-32 object-cover" />
        </div>
      )}
    </div>
  )

  // Proctored mode: result screen
  if (phase === 'result' && scoreResult) {
    const byType = {}
    scoreResult.proctorLog.forEach((v) => { byType[v.type] = (byType[v.type] || 0) + 1 })
    const passed = scoreResult.percentage >= 50
    return (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-lg mx-auto flex flex-col items-center justify-center min-h-full">
        <div className="glass-strong rounded-2xl p-6 md:p-8 w-full border border-white/40 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg ${passed ? 'bg-success/20 text-success' : 'bg-error/10 text-error'}`}>
            <span className="material-symbols-outlined text-[36px]" style={{fontVariationSettings: "'FILL' 1"}}>{passed ? 'check_circle' : 'cancel'}</span>
          </div>
          <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface mb-1">{passed ? 'Test Complete' : 'Test Submitted'}</h1>
          <p className="text-sm text-on-surface-variant mb-5">{scoreResult.isAuto ? 'Auto-submitted due to violations' : 'Your answers have been recorded'}</p>
          <div className="glass rounded-xl p-4 mb-4">
            <p className="font-['Hanken_Grotesk'] text-4xl font-extrabold text-primary">{scoreResult.percentage}%</p>
            <p className="text-sm text-on-surface-variant mt-1">{scoreResult.score}/{scoreResult.total} correct</p>
            <p className="text-xs text-warning font-semibold mt-2">+{scoreResult.xpEarned} XP</p>
          </div>
          <div className="glass rounded-xl p-4 mb-5">
            <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Proctoring Report</h3>
            <div className="space-y-1.5 text-xs">
              {scoreResult.proctorLog.length > 0 ? (
                Object.entries(byType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/30">
                    <span className="text-on-surface-variant capitalize">{type.replace(/_/g, ' ')}</span>
                    <span className="font-semibold text-on-surface">{count}x</span>
                  </div>
                ))
              ) : (
                <p className="text-on-surface-variant text-center py-2">No violations recorded</p>
              )}
            </div>
          </div>
          <button onClick={() => onFinish ? onFinish(scoreResult.score, scoreResult.total) : navigate('/quiz/select')}
            className="bg-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm cursor-pointer">
            {onFinish ? 'Continue' : 'Back to Tests'}
          </button>
        </div>
      </div>
    )
  }

  // Proctored mode: exam screen
  const q = questions[currentIndex]
  const answered = answers[currentIndex]

  return (
    <div className="h-full flex flex-col bg-background select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
      {/* Header */}
      <div className="glass-strong border-b border-white/30 px-4 py-3 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]" style={{fontVariationSettings: "'FILL' 1"}}>verified_user</span>
          <span className="text-xs font-semibold text-on-surface hidden sm:inline">{config.title || 'Certification Quiz'}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${proctoring.violations.length > 0 ? 'bg-error animate-pulse' : 'bg-success'}`} />
            <span className="text-[10px] text-on-surface-variant">{proctoring.violations.length} warnings</span>
          </div>
          <div className="font-['Hanken_Grotesk'] text-base font-bold text-on-surface tabular-nums">{formatTime(timeLeft)}</div>
          <button onClick={() => { if (!submitted && window.confirm('Submit your test?')) handleSubmit(false) }}
            disabled={submitted}
            className="bg-primary text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer transition-all">
            Submit
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-on-surface-variant font-medium">Question {currentIndex + 1} of {total}</span>
          {markedForReview.has(currentIndex) && (
            <span className="flex items-center gap-1 text-[11px] text-warning font-semibold">
              <span className="material-symbols-outlined text-[14px]" style={{fontVariationSettings: "'FILL' 1"}}>flag</span>
              Marked for Review
            </span>
          )}
        </div>

        <div className="glass-strong rounded-xl p-5 mb-4 border border-white/40">
          <p className="text-sm font-medium text-on-surface mb-4 leading-relaxed">{q?.question}</p>
          <div className="space-y-2">
            {['A', 'B', 'C', 'D'].map((letter) => {
              const isSelected = answered?.selected === letter
              return (
                <button key={letter} onClick={() => handleSelect(letter)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all cursor-pointer active:scale-[0.99] ${
                    isSelected
                      ? 'bg-primary text-on-primary shadow-sm border border-primary/30'
                      : 'bg-white/50 border border-white/40 hover:bg-white/80 text-on-surface'
                  }`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isSelected ? 'bg-white/20 text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
                  }`}>{letter}</span>
                  <span className="text-sm">{getOptionText(q, letter)}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <button onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0 || submitted}
            className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold bg-white/50 border border-white/40 text-on-surface hover:bg-white/80 disabled:opacity-30 transition-all cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            Previous
          </button>
          <button onClick={toggleReview} disabled={submitted}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              markedForReview.has(currentIndex)
                ? 'bg-warning/10 border-warning/30 text-warning'
                : 'bg-white/50 border-white/40 text-on-surface hover:bg-white/80'
            }`}>
            <span className="material-symbols-outlined text-[16px]" style={{fontVariationSettings: "'FILL' 1"}}>flag</span>
            {markedForReview.has(currentIndex) ? 'Flagged' : 'Review'}
          </button>
          <button onClick={() => goTo(currentIndex + 1)} disabled={currentIndex === total - 1 || submitted}
            className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold bg-white/50 border border-white/40 text-on-surface hover:bg-white/80 disabled:opacity-30 transition-all cursor-pointer">
            Next
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>

        {/* Question Palette */}
        <div className="glass rounded-xl p-3 border border-white/30">
          <div className="flex flex-wrap gap-1.5 justify-center">
            {questions.map((_, i) => {
              const isAns = !!answers[i]
              const isMarked = markedForReview.has(i)
              const isCur = i === currentIndex
              let cls = 'bg-white/40 border border-white/30 text-on-surface-variant'
              if (isCur) cls = 'bg-primary text-on-primary shadow-sm border border-primary/30 ring-2 ring-primary/20'
              else if (isAns && isMarked) cls = 'bg-warning/20 border border-warning/40 text-warning font-bold'
              else if (isAns) cls = 'bg-success/15 border border-success/30 text-success font-bold'
              else if (isMarked) cls = 'bg-warning/10 border border-warning/20 text-warning'
              return (
                <button key={i} onClick={() => goTo(i)} disabled={submitted}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${cls}`}>
                  {i + 1}
                </button>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-on-surface-variant">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-success/30" /> Answered</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-warning/30" /> Flagged</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-primary/30" /> Current</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-white/40 border border-white/30" /> Unanswered</span>
        </div>
      </div>

      {/* Webcam PiP */}
      <proctoring.ProctorPiP />

      {/* Warning Overlay */}
      <proctoring.WarningOverlay />

      {/* Audio indicator */}
      <proctoring.AudioIndicator />
    </div>
  )
}
