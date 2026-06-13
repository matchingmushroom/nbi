import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { getQuizSettings, checkQuizAccess } from '../lib/quizSettings'
import { calcQuizXP, updateGamification } from '../lib/gamification'
import { invalidateCache, invalidateCachePrefix } from '../lib/cache'
import useProctoring from '../hooks/useProctoring'

export default function PreAssessmentPage() {
  const navigate = useNavigate()
  const { profile, user, refreshProfile } = useAuth()
  const [phase, setPhase] = useState('loading')

  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [markedForReview, setMarkedForReview] = useState(new Set())
  const [timeLeft, setTimeLeft] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [scoreResult, setScoreResult] = useState(null)

  const [submitted, setSubmitted] = useState(false)
  const submittedRef = useRef(false)
  const startTimeRef = useRef(null)
  const handleSubmitRef = useRef(null)

  const onAutoSubmit = useCallback(() => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitted(true)
    handleSubmitRef.current?.(true)
  }, [])

  const proctoring = useProctoring({ active: phase === 'exam', onAutoSubmit })

  const getOptionText = useCallback((q, letter) => {
    if (!q) return ''
    const map = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }
    return map[letter] || ''
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const settings = await getQuizSettings()
        if (!checkQuizAccess(profile, 'preassessment', settings)) { navigate('/quiz/select'); return }
        const snap = await getDocs(collection(db, 'questions'))
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        const bookPhysical = all.filter((q) => (q.mode === 'Book' || q.mode === 'Physical') && q.difficulty === 'Expert' && q.module !== 'Mock Test')
        if (bookPhysical.length < settings.preassessmentQuestionCount) {
          setPhase('error')
          return
        }
        const shuffled = [...bookPhysical].sort(() => Math.random() - 0.5)
        const picked = shuffled.slice(0, settings.preassessmentQuestionCount)
        setQuestions(picked)
        setTimeLeft(settings.preassessmentTimerMinutes * 60)
        setPhase('landing')
      } catch { setPhase('error') }
    }
    init()
  }, [])

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

  useEffect(() => {
    if (phase !== 'exam') return
    const iv = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000)
    return () => clearInterval(iv)
  }, [phase])

  useEffect(() => {
    if (phase !== 'exam' || timeLeft > 0) return
    handleSubmit(true)
  }, [phase, timeLeft])

  useEffect(() => {
    if (phase !== 'exam') return
    startTimeRef.current = Date.now()
    proctoring.startProctoring()
    return proctoring.stopProctoring
  }, [phase])

  const handleSubmit = useCallback(async (isAuto) => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    proctoring.stopProctoring()
    const finalAnswers = questions.map((q, i) => answers[i] || { questionId: q.id || q.question, question: q.question, selected: null, correct: q.correctAnswer, isCorrect: false })
    const finalScore = finalAnswers.filter((a) => a.isCorrect).length
    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000)
    const result = {
      userId: profile?.uid || user?.uid || 'unknown',
      userEmail: profile?.email || user?.email || '',
      displayName: profile?.displayName || user?.displayName || profile?.email || user?.email || '',
      quizType: 'preassessment',
      score: finalScore,
      totalQuestions: questions.length,
      percentage: questions.length > 0 ? Math.round((finalScore / questions.length) * 100) : 0,
      answers: finalAnswers,
      completedAt: new Date().toISOString(),
      timeTaken,
      xpEarned: calcQuizXP('preassessment', finalScore, finalAnswers, questions),
      proctorLog: proctoring.violationsRef.current,
      proctorWarnings: proctoring.violationsRef.current.length,
      proctorAutoSubmit: isAuto,
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
    setScoreResult({ score: finalScore, total: questions.length, percentage: result.percentage, xpEarned: result.xpEarned, proctorLog: proctoring.violationsRef.current, isAuto })
    setPhase('result')
    setSubmitting(false)
    setSubmitted(true)
  }, [profile, user, questions, answers, refreshProfile, proctoring])
  handleSubmitRef.current = handleSubmit

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  if (phase === 'loading') return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant animate-pulse">Preparing Pre-Assessment Test...</p></div>

  if (phase === 'error') return (
    <div className="h-full flex flex-col items-center justify-center p-4 text-center">
      <span className="material-symbols-outlined text-[48px] text-error mb-3">error</span>
      <p className="text-lg font-semibold text-on-surface mb-1">Not enough questions</p>
      <p className="text-sm text-on-surface-variant mb-4">Need 20 Expert questions from Book or Physical mode.</p>
      <button onClick={() => navigate('/quiz/select')} className="bg-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm cursor-pointer">Back to Tests</button>
    </div>
  )

  if (phase === 'landing') return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-lg mx-auto flex flex-col items-center justify-center min-h-full">
      <div className="glass-strong rounded-2xl p-6 md:p-8 w-full border border-white/40 text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-rose-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="material-symbols-outlined text-white text-[32px]" style={{fontVariationSettings: "'FILL' 1"}}>verified_user</span>
        </div>
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface mb-2">Pre-Assessment Test</h1>
        <p className="text-sm text-on-surface-variant mb-5">20 Expert questions · {Math.floor(timeLeft / 60)} min · Proctored</p>

        <div className="text-left space-y-3 mb-6">
          <div className="glass rounded-xl p-3 text-xs text-on-surface">
            <span className="font-semibold">📷 Webcam</span> — face monitoring to verify your identity throughout the test
          </div>
          <div className="glass rounded-xl p-3 text-xs text-on-surface">
            <span className="font-semibold">🎤 Microphone</span> — noise detection to flag suspicious background activity
          </div>
          <div className="glass rounded-xl p-3 text-xs text-on-surface">
            <span className="font-semibold">🔒 Lockdown</span> — fullscreen mode, tab switch tracking, keyboard shortcuts disabled
          </div>
          <div className="glass rounded-xl p-3 text-xs text-on-surface">
            <span className="font-semibold">⚑ Mark for Review</span> — flag questions to revisit before submitting
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
          <button
            onClick={() => setPhase('exam')}
            disabled={!proctoring.camReady || !proctoring.micReady}
            className="w-full bg-gradient-to-r from-red-600 to-rose-500 text-white py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-all shadow-lg shadow-red-500/20 cursor-pointer">
            Start Pre-Assessment Test
          </button>
          <button onClick={() => navigate('/quiz/select')} className="w-full text-xs text-on-surface-variant hover:text-on-surface py-2 cursor-pointer">Cancel</button>
        </div>
      </div>
      {proctoring.camReady && (
        <div className="mt-4 w-full max-w-xs mx-auto rounded-xl overflow-hidden border-2 border-primary/30 shadow-lg">
          <video ref={proctoring.videoRef} autoPlay muted playsInline className="w-full h-32 object-cover" />
        </div>
      )}
    </div>
  )

  if (phase === 'result' && scoreResult) {
    const passed = scoreResult.percentage >= 50
    const byType = {}
    scoreResult.proctorLog.forEach((v) => { byType[v.type] = (byType[v.type] || 0) + 1 })
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
              {Object.entries(byType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/30">
                  <span className="text-on-surface-variant capitalize">{type.replace(/_/g, ' ')}</span>
                  <span className="font-semibold text-on-surface">{count}x</span>
                </div>
              ))}
              {scoreResult.proctorLog.length === 0 && <p className="text-on-surface-variant text-center py-2">No violations recorded</p>}
            </div>
          </div>

          <button onClick={() => navigate('/quiz/select')} className="bg-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm cursor-pointer">
            Back to Tests
          </button>
        </div>
      </div>
    )
  }

  const q = questions[currentIndex]
  const answered = answers[currentIndex]
  const total = questions.length

  return (
    <div className="h-full flex flex-col bg-background select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
      {/* Header */}
      <div className="glass-strong border-b border-white/30 px-4 py-3 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-red-600 text-[20px]" style={{fontVariationSettings: "'FILL' 1"}}>verified_user</span>
          <span className="text-xs font-semibold text-on-surface hidden sm:inline">Pre-Assessment</span>
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

      <proctoring.ProctorPiP />
      <proctoring.WarningOverlay />
      <proctoring.AudioIndicator />
    </div>
  )
}
