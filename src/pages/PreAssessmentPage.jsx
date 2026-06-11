import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { getQuizSettings } from '../lib/quizSettings'
import { getAllQuestionsCached } from '../lib/cache'
import { calcQuizXP, updateGamification } from '../lib/gamification'
import { invalidateCache, invalidateCachePrefix } from '../lib/cache'

const TAB_SWITCH_MAX = 4
const FULLSCREEN_EXIT_MAX = 2
const NO_FACE_MAX_SEC = 30
const MULTI_FACE_MAX_SEC = 15
const FACE_CHECK_INTERVAL = 2000
const AUDIO_CHECK_INTERVAL = 1000
const AUDIO_THRESHOLD = 40

export default function PreAssessmentPage() {
  const navigate = useNavigate()
  const { profile, user, refreshProfile } = useAuth()
  const [phase, setPhase] = useState('loading')
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const audioSourceRef = useRef(null)
  const analyserRef = useRef(null)
  const faceIntervalRef = useRef(null)
  const audioIntervalRef = useRef(null)
  const timerRef = useRef(null)
  const [camReady, setCamReady] = useState(false)
  const [micReady, setMicReady] = useState(false)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const modelsLoadedRef = useRef(false)

  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [markedForReview, setMarkedForReview] = useState(new Set())
  const [timeLeft, setTimeLeft] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [scoreResult, setScoreResult] = useState(null)

  const violationsRef = useRef([])
  const [violations, setViolations] = useState([])
  const [faceStatus, setFaceStatus] = useState({ count: 0, looking: true })
  const [noiseLevel, setNoiseLevel] = useState(0)
  const [showWarning, setShowWarning] = useState(null)
  const noFaceSecRef = useRef(0)
  const multiFaceSecRef = useRef(0)
  const [submitted, setSubmitted] = useState(false)
  const submittedRef = useRef(false)
  const startTimeRef = useRef(null)

  const tabWarnRef = useRef(0)
  const fsWarnRef = useRef(0)

  const getOptionText = useCallback((q, letter) => {
    if (!q) return ''
    const map = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }
    return map[letter] || ''
  }, [])

  const logViolation = useCallback((type) => {
    if (submittedRef.current) return
    violationsRef.current = [...violationsRef.current, { type, timestamp: new Date().toISOString() }]
    setViolations(violationsRef.current)
  }, [])

  const showWarningOverlay = useCallback((type, count, max) => {
    setShowWarning({ type, count, max })
    setTimeout(() => setShowWarning(null), 3000)
  }, [])

  const autoSubmit = useCallback(async () => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitted(true)
    handleSubmit(true)
  }, [])

  const handleTabSwitch = useCallback(() => {
    logViolation('tab_switch')
    tabWarnRef.current++
    showWarningOverlay('Tab switch detected', tabWarnRef.current, TAB_SWITCH_MAX)
    if (tabWarnRef.current >= TAB_SWITCH_MAX) {
      autoSubmit()
    }
  }, [logViolation, showWarningOverlay, autoSubmit])

  const handleFullscreenExit = useCallback(() => {
    logViolation('fullscreen_exit')
    fsWarnRef.current++
    showWarningOverlay('Fullscreen exited', fsWarnRef.current, FULLSCREEN_EXIT_MAX)
    if (fsWarnRef.current >= FULLSCREEN_EXIT_MAX) {
      autoSubmit()
    }
  }, [logViolation, showWarningOverlay, autoSubmit])

  const checkFullscreen = useCallback(() => {
    if (phase !== 'exam') return
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      handleFullscreenExit()
      document.documentElement.requestFullscreen?.() || document.documentElement.webkitRequestFullscreen?.()
    }
  }, [phase, handleFullscreenExit])

  useEffect(() => {
    if (phase !== 'exam') return
    const iv = setInterval(checkFullscreen, 3000)
    return () => clearInterval(iv)
  }, [phase, checkFullscreen])

  useEffect(() => {
    if (phase !== 'exam') return
    const onVis = () => { if (document.hidden) handleTabSwitch() }
    const onBlur = () => handleTabSwitch()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('blur', onBlur)
    }
  }, [phase, handleTabSwitch])

  useEffect(() => {
    if (phase !== 'exam') return
    const onKey = (e) => {
      if (e.ctrlKey && ['c', 'v', 'p', 'x', 'a', 's'].includes(e.key.toLowerCase())) e.preventDefault()
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['i', 'j'].includes(e.key.toLowerCase()))) e.preventDefault()
    }
    const onCtx = (e) => e.preventDefault()
    document.addEventListener('keydown', onKey)
    document.addEventListener('contextmenu', onCtx)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('contextmenu', onCtx)
    }
  }, [phase])

  useEffect(() => {
    const init = async () => {
      try {
        const settings = await getQuizSettings()
        const all = await getAllQuestionsCached()
        const bookPhysical = all.filter((q) => (q.mode === 'Book' || q.mode === 'Physical') && q.difficulty === 'Expert')
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

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCamReady(true)
    } catch { setCamReady(false) }
  }, [])

  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      audioCtxRef.current = ctx
      audioSourceRef.current = src
      analyserRef.current = analyser
      setMicReady(true)
    } catch { setMicReady(false) }
  }, [])

  const startFaceDetection = useCallback(async () => {
    try {
      const faceapi = await import('@vladmandic/face-api')
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models')
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models')
      modelsLoadedRef.current = true
      setModelsLoaded(true)

      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })

      faceIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || !videoRef.current.videoWidth) return
        try {
          const detections = await faceapi.detectAllFaces(videoRef.current, options).withFaceLandmarks()
          const count = detections.length
          setFaceStatus((prev) => ({ ...prev, count }))

          if (count === 0) {
            noFaceSecRef.current += FACE_CHECK_INTERVAL / 1000
            if (noFaceSecRef.current >= NO_FACE_MAX_SEC) {
              logViolation('no_face')
              noFaceSecRef.current = 0
              if (!submittedRef.current) autoSubmit()
            }
          } else {
            noFaceSecRef.current = 0
          }

          if (count > 1) {
            multiFaceSecRef.current += FACE_CHECK_INTERVAL / 1000
            if (multiFaceSecRef.current >= MULTI_FACE_MAX_SEC) {
              logViolation('multiple_faces')
              multiFaceSecRef.current = 0
              if (!submittedRef.current) autoSubmit()
            }
          } else {
            multiFaceSecRef.current = 0
          }

          if (count > 0) {
            const landmarks = detections[0].landmarks
            const leftEye = landmarks.getLeftEye()
            const rightEye = landmarks.getRightEye()
            const eyeCenterY = (leftEye.reduce((s, p) => s + p.y, 0) / leftEye.length + rightEye.reduce((s, p) => s + p.y, 0) / rightEye.length) / 2
            const nose = landmarks.getNose()
            const noseY = nose.reduce((s, p) => s + p.y, 0) / nose.length
            const looking = Math.abs(eyeCenterY - noseY) < 15
            setFaceStatus((prev) => ({ ...prev, looking }))
          }
        } catch {}
      }, FACE_CHECK_INTERVAL)
    } catch {}
  }, [logViolation, autoSubmit])

  const startAudioMonitor = useCallback(() => {
    audioIntervalRef.current = setInterval(() => {
      const analyser = analyserRef.current
      if (!analyser) return
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteTimeDomainData(dataArray)
      const rms = Math.sqrt(dataArray.reduce((sum, val) => sum + (val - 128) ** 2, 0) / dataArray.length)
      setNoiseLevel(Math.round(rms))
      if (rms > AUDIO_THRESHOLD) {
        logViolation('loud_noise')
      }
    }, AUDIO_CHECK_INTERVAL)
  }, [logViolation])

  useEffect(() => {
    if (phase !== 'exam') return
    if (timeLeft <= 0) { handleSubmit(true); return }
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [phase, timeLeft])

  useEffect(() => {
    if (phase !== 'exam') return
    startTimeRef.current = Date.now()
    startCamera()
    startMic()
    startFaceDetection()
    startAudioMonitor()
    setTimeout(() => { try { document.documentElement.requestFullscreen?.() || document.documentElement.webkitRequestFullscreen?.() } catch {} }, 500)
    return () => {
      clearInterval(faceIntervalRef.current)
      clearInterval(audioIntervalRef.current)
      clearInterval(timerRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
      if (audioCtxRef.current) audioCtxRef.current.close()
      try { document.exitFullscreen?.() } catch {}
    }
  }, [phase, startCamera, startMic, startFaceDetection, startAudioMonitor])

  const handleSelect = (letter) => {
    if (submitted) return
    const q = questions[currentIndex]
    setAnswers((prev) => ({ ...prev, [currentIndex]: { questionId: q.id || q.question, question: q.question, selected: letter, correct: q.answer, isCorrect: letter === q.answer } }))
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

  const handleSubmit = useCallback(async (isAuto) => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    const finalAnswers = questions.map((q, i) => answers[i] || { questionId: q.id || q.question, question: q.question, selected: null, correct: q.answer, isCorrect: false })
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
      proctorLog: violationsRef.current,
      proctorWarnings: violationsRef.current.length,
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
    clearInterval(faceIntervalRef.current)
    clearInterval(audioIntervalRef.current)
    clearInterval(timerRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
    if (audioCtxRef.current) audioCtxRef.current.close()
    try { document.exitFullscreen?.() } catch {}
    stopProctoring()
    setScoreResult({ score: finalScore, total: questions.length, percentage: result.percentage, xpEarned: result.xpEarned, proctorLog: violationsRef.current, isAuto })
    setPhase('result')
    setSubmitting(false)
    setSubmitted(true)
  }, [profile, user, questions, answers, refreshProfile])

  const stopProctoring = () => {
    clearInterval(faceIntervalRef.current)
    clearInterval(audioIntervalRef.current)
    clearInterval(timerRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
    if (audioCtxRef.current) audioCtxRef.current.close()
    try { document.exitFullscreen?.() } catch {}
  }

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
          <button onClick={startCamera} disabled={camReady}
            className="w-full flex items-center justify-center gap-2 bg-primary/5 border border-primary/20 rounded-xl py-3 text-sm font-semibold text-primary disabled:opacity-50 transition-all cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">{camReady ? 'check_circle' : 'videocam'}</span>
            {camReady ? 'Webcam Connected' : 'Enable Webcam'}
          </button>
          <button onClick={startMic} disabled={micReady}
            className="w-full flex items-center justify-center gap-2 bg-primary/5 border border-primary/20 rounded-xl py-3 text-sm font-semibold text-primary disabled:opacity-50 transition-all cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">{micReady ? 'check_circle' : 'mic'}</span>
            {micReady ? 'Microphone Connected' : 'Enable Microphone'}
          </button>
          <button
            onClick={() => setPhase('exam')}
            disabled={!camReady || !micReady}
            className="w-full bg-gradient-to-r from-red-600 to-rose-500 text-white py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-all shadow-lg shadow-red-500/20 cursor-pointer">
            Start Pre-Assessment Test
          </button>
          <button onClick={() => navigate('/quiz/select')} className="w-full text-xs text-on-surface-variant hover:text-on-surface py-2 cursor-pointer">Cancel</button>
        </div>
      </div>
      {camReady && (
        <div className="mt-4 w-full max-w-xs mx-auto rounded-xl overflow-hidden border-2 border-primary/30 shadow-lg">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-32 object-cover" />
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
            <span className={`w-2 h-2 rounded-full ${violations.length > 0 ? 'bg-error animate-pulse' : 'bg-success'}`} />
            <span className="text-[10px] text-on-surface-variant">{violations.length} warnings</span>
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
      <div className="fixed bottom-4 right-4 z-40 w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden border-2 border-white/40 shadow-xl glass-dark">
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-full text-[9px] text-white">
          <span className={`w-1.5 h-1.5 rounded-full ${faceStatus.count > 0 ? 'bg-success' : 'bg-error'}`} />
          {faceStatus.count > 0 ? `${faceStatus.count} face${faceStatus.count > 1 ? 's' : ''}` : 'No face'}
        </div>
      </div>

      {/* Warning Overlay */}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowWarning(null)}>
          <div className="glass-dark rounded-2xl p-6 max-w-sm w-full mx-4 text-center border border-white/20 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-error/20 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-error text-[28px]">warning</span>
            </div>
            <h3 className="text-base font-bold text-on-surface mb-1 capitalize">{showWarning.type}</h3>
            <p className="text-sm text-on-surface-variant mb-3">Warning {showWarning.count} of {showWarning.max}</p>
            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-error rounded-full transition-all" style={{ width: `${(showWarning.count / showWarning.max) * 100}%` }} />
            </div>
            {showWarning.count >= showWarning.max && (
              <p className="text-xs text-error font-semibold mt-3">Auto-submitting...</p>
            )}
          </div>
        </div>
      )}

      {/* Audio indicator */}
      {noiseLevel > 0 && (
        <div className="fixed bottom-4 left-4 z-40 glass-dark rounded-full px-3 py-1.5 border border-white/20 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]" style={{fontVariationSettings: noiseLevel > AUDIO_THRESHOLD ? "'FILL' 1" : "'FILL' 0"}}>
            {noiseLevel > AUDIO_THRESHOLD ? 'mic' : 'mic_none'}
          </span>
          <div className="w-12 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${noiseLevel > AUDIO_THRESHOLD ? 'bg-error' : 'bg-success'}`}
              style={{ width: `${Math.min(100, (noiseLevel / 80) * 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}
