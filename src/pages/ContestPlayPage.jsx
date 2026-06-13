import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAllQuestionsCached } from '../lib/cache'
import { getContestRealtime, submitContestEntry } from '../lib/contestService'

export default function ContestPlayPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [contest, setContest] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const startTimeRef = useRef(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    const unsub = getContestRealtime(id, (c) => {
      if (!c) { setError('Contest not found'); return }
      setContest(c)
      if (c.status === 'completed') {
        navigate(`/contest/results/${id}`, { replace: true })
      }
      if (c.status === 'setup') {
        navigate(`/contest/lobby/${id}`, { replace: true })
      }
    })
    return unsub
  }, [id, navigate])

  useEffect(() => {
    const fetchQ = async () => {
      if (!contest || contest.status !== 'active') return
      const all = await getAllQuestionsCached()
      const qMap = {}
      all.forEach((q) => { qMap[q.id] = q })
      const qs = (contest.questionIds || []).map((qid) => qMap[qid]).filter(Boolean)
      setQuestions(qs)
      setTimeLeft((contest.timerMinutes || 10) * 60)
      startTimeRef.current = Date.now()
    }
    fetchQ()
  }, [contest])

  useEffect(() => {
    if (timeLeft === null || submitted) return
    if (timeLeft <= 0) { handleSubmit(); return }
    const iv = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000)
    return () => clearInterval(iv)
  }, [timeLeft, submitted])

  const getOptionText = useCallback((q, letter) => {
    if (!q) return ''
    const map = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }
    return map[letter] || ''
  }, [])

  const handleSelect = (letter) => {
    if (submitted) return
    setAnswers((prev) => ({ ...prev, [currentIndex]: { selected: letter } }))
  }

  const handleSubmit = async () => {
    if (submittedRef.current || submitting) return
    submittedRef.current = true
    setSubmitting(true)
    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000)
    const finalAnswers = questions.map((_, i) => answers[i] || { selected: null })
    try {
      await submitContestEntry(id, profile?.uid, finalAnswers, timeTaken)
    } catch {}
    setSubmitted(true)
    setSubmitting(false)
  }

  const q = questions[currentIndex]
  const total = questions.length

  if (error) return <div className="h-full flex items-center justify-center p-4"><p className="text-on-surface-variant">{error}</p></div>
  if (!contest || questions.length === 0) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant animate-pulse">Loading questions...</p></div>
  if (submitted) return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="glass-strong rounded-2xl p-6 max-w-sm w-full text-center border border-white/40">
        <div className="w-14 h-14 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-success text-[32px]" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
        </div>
        <h2 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface mb-1">Submitted!</h2>
        <p className="text-sm text-on-surface-variant mb-4">Waiting for others to finish...</p>
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-on-surface-variant mt-4">You'll be redirected to results once all players submit.</p>
      </div>
    </div>
  )

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  return (
    <div className="h-full flex flex-col bg-background select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
      <div className="glass-strong border-b border-white/30 px-4 py-3 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-500 text-[20px]" style={{fontVariationSettings: "'FILL' 1"}}>emoji_events</span>
          <span className="text-xs font-semibold text-on-surface hidden sm:inline">{contest.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="font-['Hanken_Grotesk'] text-base font-bold text-on-surface tabular-nums">{formatTime(timeLeft)}</div>
          <button onClick={handleSubmit} disabled={submitting}
            className="bg-primary text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer transition-all">
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-on-surface-variant font-medium">Question {currentIndex + 1} of {total}</span>
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${answers[i] ? 'bg-primary' : 'bg-outline-variant'}`} />
            ))}
          </div>
        </div>

        <div className="glass-strong rounded-xl p-5 mb-4 border border-white/40">
          <p className="text-sm font-medium text-on-surface mb-4 leading-relaxed">{q?.question}</p>
          <div className="space-y-2">
            {['A', 'B', 'C', 'D'].map((letter) => {
              const isSelected = answers[currentIndex]?.selected === letter
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

        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0}
            className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold bg-white/50 border border-white/40 text-on-surface hover:bg-white/80 disabled:opacity-30 transition-all cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            Previous
          </button>
          <button onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))} disabled={currentIndex === total - 1}
            className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold bg-white/50 border border-white/40 text-on-surface hover:bg-white/80 disabled:opacity-30 transition-all cursor-pointer">
            Next
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  )
}
