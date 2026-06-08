import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ensureLearningProfile, getLocalLearningProfile, getCourseContent, getCourseProgress, getCoursePhase, markDayComplete, submitQuizResult } from '../lib/steakService'
import CourseCatalog from '../components/CourseCatalog'
import MarkdownRenderer from '../components/MarkdownRenderer'

function padDay(d) { return `day_${String(d).padStart(2, '0')}` }

export default function MicroLearningPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState('CATALOG')
  const [courseContent, setCourseContent] = useState([])
  const [courseId, setCourseId] = useState(null)
  const [dayCount, setDayCount] = useState(0)
  const [learning, setLearning] = useState(null)
  const [currentDay, setCurrentDay] = useState(1)
  const [loading, setLoading] = useState(true)
  const [reviewResult, setReviewResult] = useState(null)
  const [examData, setExamData] = useState(null)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [completedMsg, setCompletedMsg] = useState(null)
  const [reviewQuestions, setReviewQuestions] = useState([])
  const [reviewIndex, setReviewIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [reviewScore, setReviewScore] = useState(0)
  const [rewardScore, setRewardScore] = useState(0)
  const [rewardSteak, setRewardSteak] = useState(0)
  const [rewardNextDay, setRewardNextDay] = useState(null)
  const [courseError, setCourseError] = useState(null)
  const touchStartX = useRef(0)
  const reviewAnswers = useRef({})
  const rewardTimer = useRef(null)

  // Auto-advance from REWARD to READING after 5 seconds
  useEffect(() => {
    if (view === 'REWARD') {
      const nextDay = rewardNextDay || currentDay + 1
      rewardTimer.current = setTimeout(() => {
        handleStartReading(nextDay)
      }, 5000)
    }
    return () => {
      if (rewardTimer.current) {
        clearTimeout(rewardTimer.current)
        rewardTimer.current = null
      }
    }
  }, [view])

  useEffect(() => {
    if (!user) return
    loadProfile()
  }, [user])

  async function loadProfile() {
    setLoading(true)
    try {
      const prof = await ensureLearningProfile(user.uid)
      setLearning(prof.learning)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function refreshLearning() {
    const prof = await ensureLearningProfile(user.uid)
    setLearning(prof.learning)
  }

  async function enterCourse(cid) {
    setCourseError(null)
    setLoading(true)
    try {
      const content = await getCourseContent(cid)
      if (!content.length) {
        setCourseError('No lesson content found for this course. Contact admin.')
        return
      }
      setCourseContent(content)
      setCourseId(cid)
      setDayCount(content.length)
      const prof = await ensureLearningProfile(user.uid)
      setLearning(prof.learning)
      setView('DASHBOARD')
    } catch (err) {
      console.error('enterCourse error:', err)
      setCourseError('Failed to load course: ' + (err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  async function finishReview() {
    const answers = reviewQuestions.map((_, i) => reviewAnswers.current[i] ?? -1)
    const correctCount = reviewQuestions.filter((q, i) => answers[i] === q.correctAnswer).length

    let steakInfo = { newSteak: 0 }
    try {
      const result = await submitQuizResult(user.uid, courseId, currentDay, answers, reviewQuestions)
      if (result && !result.error) {
        steakInfo = { newSteak: result.newSteak || 0 }
      }
    } catch (err) {
      console.error(err)
    }

    setRewardScore(correctCount)
    setRewardSteak(steakInfo.newSteak)
    setRewardNextDay(currentDay + 1)
    setView('REWARD')
  }

  async function handleMarkComplete() {
    if (!user?.uid || !courseId || !currentDay) return
    const result = await markDayComplete(user.uid, courseId, currentDay, dayCount)
    if (result.error) { alert(result.error); return }
    await refreshLearning()
    setCompletedMsg(`Day ${currentDay} completed! Learning finished for today. Return back tomorrow.`)
    setTimeout(() => setCompletedMsg(null), 5000)
  }

  function startReview(day) {
    const dayData = courseContent.find(d => d.day === day)
    if (!dayData) return
    const allQ = []
    const posts = dayData.posts?.length ? dayData.posts : [dayData]
    posts.forEach(p => {
      if (p.questions?.length) allQ.push(...p.questions)
    })
    const shuffled = allQ.sort(() => Math.random() - 0.5).slice(0, 3)
    reviewAnswers.current = {}
    setReviewQuestions(shuffled)
    setReviewIndex(0)
    setSelectedAnswer(null)
    setReviewScore(0)
    setCurrentDay(day)
    setView('REVIEW')
  }

  function handleStartReading(day) {
    setCarouselIndex(0)
    setCurrentDay(day)
    setView('READING')
  }

  function handleTileClick(day) {
    const prog = getCourseProgress(learning, courseId)
    if (!prog) return
    const id = padDay(day)
    const complete = prog.completedDays?.includes(id)
    const reviewed = prog.reviewedDays?.includes(id)
    const unlocked = day <= (prog.unlockedDay || 1)

    if (!unlocked) return

    // If previous day is completed but not reviewed, start review
    if (day > 1) {
      const prevId = padDay(day - 1)
      if (prog.completedDays?.includes(prevId) && !prog.reviewedDays?.includes(prevId)) {
        startReview(day - 1)
        return
      }
    }

    // If this day is complete, still allow opening reading view
    handleStartReading(day)
  }

  const phase = (() => {
    const prog = getCourseProgress(learning, courseId)
    if (!prog || !dayCount) return null
    return getCoursePhase(prog, dayCount)
  })()

  if (loading && !courseId) {
    return (
      <div className="p-6 max-w-2xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-outline-variant/30 rounded w-1/3" />
        <div className="h-32 bg-outline-variant/20 rounded-xl" />
        <div className="h-20 bg-outline-variant/20 rounded-xl" />
      </div>
    )
  }

  if (view === 'CATALOG') {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
        <h1 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface">Available Courses</h1>
        {courseError && (
          <div className="bg-error/10 border border-error/30 rounded-xl p-3 text-center">
            <p className="text-sm text-error font-medium">{courseError}</p>
            <button onClick={() => setCourseError(null)} className="mt-2 text-xs text-primary underline cursor-pointer">Dismiss</button>
          </div>
        )}
        <CourseCatalog
          learning={learning}
          onRefresh={refreshLearning}
          onEnter={enterCourse}
          onError={(msg) => setCourseError(msg)}
        />
      </div>
    )
  }

  if (view === 'DASHBOARD') {
    const prog = getCourseProgress(learning, courseId)
    const course = courseContent?.[0]
    const today = new Date().toISOString().split('T')[0]
    const streakDay = prog?.lastCompletedDate === today ? 'Today' : prog?.lastCompletedDate === (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0] })() ? 'Yesterday' : null

    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
        {/* Back */}
        <button onClick={() => setView('CATALOG')}
          className="flex items-center gap-1 text-sm text-primary font-medium hover:opacity-80 transition-opacity cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          All Courses
        </button>

        {/* Streak hero */}
        <div className="bg-gradient-to-br from-primary to-[#001d66] rounded-2xl p-5 text-white space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-['Hanken_Grotesk'] text-lg font-bold">{course?.courseTitle || 'Course'}</h2>
            <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1">
              <span className="material-symbols-outlined text-[18px] text-[#ff9800]">local_fire_department</span>
              <span className="font-bold text-sm">{prog?.currentSteak || 0}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-white/80">
            <span>🔥 Best: {prog?.highestSteak || 0} day streak</span>
            <span>·</span>
            <span>📖 {prog?.completedDays?.length || 0}/{dayCount} days</span>
          </div>
          {streakDay && <p className="text-xs text-white/60">Last activity: {streakDay}</p>}
        </div>

        {/* Day grid */}
        <div>
          <h3 className="font-['Hanken_Grotesk'] font-bold text-on-surface mb-3">Your Progress</h3>
          <div className="grid grid-cols-6 md:grid-cols-10 gap-2">
            {Array.from({ length: dayCount }, (_, i) => i + 1).map(d => {
              const id = padDay(d)
              const complete = prog?.completedDays?.includes(id)
              const reviewed = prog?.reviewedDays?.includes(id)
              const unlocked = d <= (prog?.unlockedDay || 1)
              const isActive = phase?.phase === 'READ_AND_COMPLETE' && phase?.day === d
              const isReviewTarget = phase?.phase === 'REVIEW' && phase?.day === d

              let tileStyle = 'bg-outline-variant/10 text-on-surface-variant cursor-default'
              let content = <span className="text-sm">🔒</span>

              if (complete && reviewed) {
                tileStyle = 'bg-success/70 text-white cursor-pointer'
                content = <span className="material-symbols-outlined text-[18px]">check_circle</span>
              } else if (complete) {
                tileStyle = 'bg-primary text-white cursor-pointer'
                content = <span className="material-symbols-outlined text-[18px]">check_circle</span>
              } else if (unlocked) {
                tileStyle = 'bg-primary text-white cursor-pointer ring-2 ring-primary/30'
                content = <span className="font-bold text-sm">{d}</span>
              }

              if (isReviewTarget && !complete) {
                tileStyle = 'bg-warning text-white cursor-pointer ring-2 ring-warning/30 animate-pulse'
                content = <span className="material-symbols-outlined text-[18px]">rate_review</span>
              }

              return (
                <button key={d} onClick={() => unlocked && handleTileClick(d)}
                  className={`aspect-square rounded-xl flex items-center justify-center transition-all active:scale-90 ${tileStyle}`}>
                  {content}
                </button>
              )
            })}
          </div>
        </div>

        {/* Phase CTA */}
        {phase && (
          <div>
            {phase.phase === 'READ_AND_COMPLETE' && (
              <button onClick={() => handleStartReading(phase.day)}
                className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer">
                Read Day {phase.day}
              </button>
            )}
            {phase.phase === 'REVIEW' && (
              <button onClick={() => startReview(phase.day)}
                className="w-full py-3 bg-warning text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer">
                Review Day {phase.day}
              </button>
            )}
            {phase.phase === 'REVIEW_LOCKED' && (
              <p className="text-center text-sm text-on-surface-variant">Review already completed today. Come back tomorrow.</p>
            )}
            {phase.phase === 'LOCKED' && (
              <p className="text-center text-sm text-on-surface-variant">Complete previous lessons to unlock Day {phase.day}.</p>
            )}
            {phase.phase === 'EXAM_AVAILABLE' && (
              <button onClick={() => navigate(`/quiz/certification/${courseId}`)}
                className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer">
                Take Certification Exam
              </button>
            )}
            {phase.phase === 'EXPIRED' && (
              <p className="text-center text-sm text-warning font-medium">Exam window has expired. Contact admin.</p>
            )}
            {(phase.phase === 'PASSED' || phase.phase === 'FAILED') && (
              <div className="text-center space-y-2">
                <p className={`font-bold text-lg font-['Hanken_Grotesk'] ${phase.phase === 'PASSED' ? 'text-success' : 'text-warning'}`}>
                  {phase.phase === 'PASSED' ? '🎉 Congratulations! You Passed!' : '❌ You did not pass.'}
                </p>
                <p className="text-sm text-on-surface-variant">Score: {prog?.examResult?.finalScore}%</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (view === 'REVIEW') {
    const q = reviewQuestions[reviewIndex]
    const answered = reviewAnswers.current[reviewIndex] !== undefined
    const isLastQuestion = reviewIndex === reviewQuestions.length - 1

    const handleSelect = (optIdx) => {
      if (answered) return
      reviewAnswers.current[reviewIndex] = optIdx
      setSelectedAnswer(optIdx)
    }

    if (!q) return <div className="p-6 text-center text-sm text-on-surface-variant">No review questions available.</div>

    const optLabels = ['A', 'B', 'C', 'D']

    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
        {/* Back */}
        <button onClick={() => { setView('DASHBOARD'); setCompletedMsg(null) }}
          className="flex items-center gap-1 text-sm text-primary font-medium hover:opacity-80 transition-opacity cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Dashboard
        </button>

        <div className="bg-surface rounded-xl border border-outline-variant p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-['Hanken_Grotesk'] font-bold text-on-surface">Review Day {currentDay}</h2>
            <span className="text-xs text-on-surface-variant">Question {reviewIndex + 1} of {reviewQuestions.length}</span>
          </div>

          {/* Question */}
          <p className="text-sm font-medium text-on-surface leading-relaxed">{q.text}</p>

          {/* Options */}
          <div className="space-y-2">
            {q.options?.map((opt, i) => {
              const isSelected = selectedAnswer === i
              const isCorrect = i === q.correctAnswer
              let optStyle = 'border-outline-variant hover:bg-surface-container-low'
              if (answered) {
                if (isCorrect) optStyle = 'border-success bg-success/10 text-success'
                else if (isSelected) optStyle = 'border-warning bg-warning/10 text-warning'
                else optStyle = 'border-outline-variant/50 text-on-surface-variant/50'
              } else if (isSelected) {
                optStyle = 'border-primary bg-primary/10 text-primary'
              }

              return (
                <button key={i} onClick={() => handleSelect(i)} disabled={answered}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer disabled:cursor-default ${optStyle}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${answered && isCorrect ? 'bg-success text-white' : answered && isSelected ? 'bg-warning text-white' : 'bg-outline-variant/20 text-on-surface-variant'}`}>
                    {answered && isCorrect ? <span className="material-symbols-outlined text-[14px]">check</span> : answered && isSelected ? <span className="material-symbols-outlined text-[14px]">close</span> : optLabels[i]}
                  </span>
                  <span>{opt}</span>
                </button>
              )
            })}
          </div>

          {/* Explanation */}
          {answered && (
            <div className={`p-3 rounded-xl text-sm ${selectedAnswer === q.correctAnswer ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
              <p className="font-semibold mb-1">
                {selectedAnswer === q.correctAnswer ? '✓ Correct!' : `✗ Wrong. Correct answer: ${optLabels[q.correctAnswer]}. ${q.options[q.correctAnswer]}`}
              </p>
              <p className="text-xs text-on-surface-variant">{q.explanation}</p>
            </div>
          )}

          {/* Next / Finish */}
          {answered && (
            <button onClick={() => {
              if (isLastQuestion) {
                finishReview()
              } else {
                setReviewIndex(i => i + 1)
                setSelectedAnswer(null)
              }
            }}
              className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer">
              {isLastQuestion ? 'Finish Review' : 'Next Question'}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (view === 'REWARD') {
    const nextDay = rewardNextDay || currentDay + 1

    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto text-center space-y-5">
        <div className="bg-surface rounded-2xl border border-outline-variant p-8 space-y-4">
          <div className="text-5xl">{rewardScore >= 2 ? '🎉' : '💪'}</div>
          <h2 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface">Review Complete!</h2>
          <div className="flex justify-center gap-2">
            {[1, 2, 3].map(i => (
              <span key={i} className={`text-2xl ${i <= rewardScore ? '' : 'opacity-20'}`}>
                {i <= rewardScore ? '⭐' : '☆'}
              </span>
            ))}
          </div>
          <p className="text-lg font-bold text-on-surface">{rewardScore} / 3</p>
          <p className="text-sm text-on-surface-variant">🔥 Streak: {rewardSteak} day{rewardSteak > 1 ? 's' : ''}</p>
        </div>

        <p className="text-xs text-on-surface-variant">Continuing to Day {nextDay} in 5 seconds...</p>

        <button onClick={() => handleStartReading(nextDay)}
          className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer">
          Continue to Day {nextDay}
        </button>
      </div>
    )
  }

  if (view === 'READING') {
    const dayData = courseContent.find(d => d.day === currentDay)
    if (!dayData) return <div className="p-6 text-center text-sm text-on-surface-variant">Day content not found.</div>

    const posts = dayData.posts?.length
      ? dayData.posts
      : [{ title: dayData.title, content: dayData.shortExplanation }]
    const currentPost = posts[carouselIndex]
    const isCompleted = dayData.day && getCourseProgress(learning, courseId)?.completedDays?.includes(padDay(dayData.day))

    const handleTouchEnd = (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX.current
      if (Math.abs(dx) > 50) {
        if (dx < 0 && carouselIndex < posts.length - 1) setCarouselIndex(i => i + 1)
        if (dx > 0 && carouselIndex > 0) setCarouselIndex(i => i - 1)
      }
    }

    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
        {/* Back */}
        <button onClick={() => { setView('DASHBOARD'); setCompletedMsg(null) }}
          className="flex items-center gap-1 text-sm text-primary font-medium hover:opacity-80 transition-opacity cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Dashboard
        </button>

        {/* Completed toast */}
        {completedMsg && (
          <div className="bg-success/10 border border-success/30 text-success text-sm font-medium px-4 py-2.5 rounded-xl text-center">
            {completedMsg}
          </div>
        )}

        {/* Carousel */}
        <div
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
          onTouchEnd={handleTouchEnd}
          className="bg-surface rounded-xl border border-outline-variant p-5 space-y-3"
        >
          {/* Top bar */}
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <span className="font-medium text-primary">Day {dayData.day}</span>
            {dayData.estimatedReadingTime && <span>· {dayData.estimatedReadingTime}</span>}
            {posts.length > 1 && <span className="ml-auto">Post {carouselIndex + 1} of {posts.length}</span>}
          </div>

          {/* Title */}
          <h1 className="font-['Hanken_Grotesk'] text-xl md:text-2xl font-bold text-on-surface">
            {currentPost?.title || `Day ${dayData.day}`}
          </h1>

          {/* Category chip */}
          {currentPost?.category && (
            <span className="inline-block bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
              {currentPost.category}
            </span>
          )}

          {/* Content */}
          <div className="markdown-body">
            <MarkdownRenderer content={currentPost?.content || ''} />
          </div>

          {/* Dots */}
          {posts.length > 1 && (
            <div className="flex justify-center gap-1.5 pt-2">
              {posts.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === carouselIndex ? 'bg-primary w-4' : 'bg-outline-variant'}`} />
              ))}
            </div>
          )}

          {/* Prev/Next */}
          {posts.length > 1 && (
            <div className="flex gap-2 pt-1">
              <button onClick={() => setCarouselIndex(i => Math.max(0, i - 1))} disabled={carouselIndex === 0}
                className="flex-1 py-2 border border-outline-variant rounded-xl text-sm font-medium text-on-surface hover:bg-surface-container-low disabled:opacity-30 transition-all cursor-pointer disabled:cursor-not-allowed">
                ← Previous
              </button>
              <button onClick={() => setCarouselIndex(i => Math.min(posts.length - 1, i + 1))} disabled={carouselIndex === posts.length - 1}
                className="flex-1 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-30 transition-all cursor-pointer disabled:cursor-not-allowed">
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Mark Complete / Completed badge */}
        {isCompleted ? (
          <div className="flex items-center justify-center gap-2 py-3 bg-success/10 border border-success/30 rounded-xl text-success font-semibold text-sm">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            Lesson Completed ✓
          </div>
        ) : (
          <button onClick={handleMarkComplete}
            className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-sm">
            Mark as Complete
          </button>
        )}
      </div>
    )
  }

  return null
}
