import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import {
  getAllCourses, getCourseDays, enrollInCourse,
  markDayRead, submitReview, getLearningProgress,
  getCertificationQuestions, getCourseScore,
  isFullyComplete, needsReview, accumulateReviewScore,
} from '../lib/learnService'
import { getQuizSettings, canAccessPremium, getEnrollmentLimit } from '../lib/quizSettings'
import { resetCourseProgress } from '../lib/steakService'
import { awardLearningXP } from '../lib/gamification'
import QuizRunner from '../components/QuizRunner'
import Certificate from '../components/Certificate'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

const VIEWS = { CATALOG: 'catalog', DASHBOARD: 'dashboard', READING: 'reading', REVIEW: 'review', REWARD: 'reward', CERT_QUIZ: 'cert_quiz' }

export default function SimpleLearnPage() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState(VIEWS.CATALOG)
  const [courses, setCourses] = useState([])
  const [learning, setLearning] = useState(null)
  const [courseId, setCourseId] = useState(null)
  const [dayData, setDayData] = useState(null)
  const [currentDay, setCurrentDay] = useState(null)
  const [progress, setProgress] = useState(null)
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [answers, setAnswers] = useState([])
  const [reviewResult, setReviewResult] = useState(null)
  const [certQuestions, setCertQuestions] = useState(null)
  const [slideIndex, setSlideIndex] = useState(0)
  const [bypassLock, setBypassLock] = useState(false)
  const [showCert, setShowCert] = useState(false)
  const [pendingReadDay, setPendingReadDay] = useState(null)
  const [xpToast, setXpToast] = useState(null)
  const [premiumCourses, setPremiumCourses] = useState([])
  const [quizSettings, setQuizSettings] = useState(null)
  const touchStartX = useRef(0)

  const fetchLearning = async (cid) => {
    if (!profile?.uid) return
    const snap = await getDoc(doc(db, 'users', profile.uid))
    const learn = snap.exists()
      ? (snap.data().learning || { enrolledCourses: {}, learningXp: 0 })
      : { enrolledCourses: {}, learningXp: 0 }
    setLearning(learn)
    if (cid) setProgress(getLearningProgress(learn, cid))
  }

  useEffect(() => {
    Promise.all([getAllCourses(), profile?.uid ? fetchLearning() : Promise.resolve(), getQuizSettings()]).then(([allCourses, _, s]) => {
      let filtered = allCourses.filter((x) => x.visible !== false)
      if (!canAccessPremium(profile) && s.premiumCourses?.length) {
        const banned = new Set(s.premiumCourses)
        filtered = filtered.filter((c) => !banned.has(c.courseId))
      }
      setCourses(filtered)
      setLoading(false)
      setBypassLock(s.bypassDailyLearningLock)
      setPremiumCourses(s.premiumCourses || [])
      setQuizSettings(s)
    })
  }, [profile?.uid])

  useEffect(() => {
    if (xpToast) { const t = setTimeout(() => setXpToast(null), 2500); return () => clearTimeout(t) }
  }, [xpToast])

  const enterCourse = async (cid, startDay) => {
    setCourseId(cid)
    const d = await getCourseDays(cid)
    setDays(d)
    await fetchLearning(cid)
    setView(VIEWS.DASHBOARD)
    if (startDay) startReading(startDay)
  }

  const handleEnroll = async (cid) => {
    if (!profile?.uid) return
    try {
      const s = await getQuizSettings()
      if (s.premiumCourses?.includes(cid) && !canAccessPremium(profile)) {
        alert('This course is premium and requires StudentX access.')
        return
      }
      const enrolledCount = Object.keys(learning?.enrolledCourses || {}).length
      const limit = getEnrollmentLimit(profile, s)
      if (enrolledCount >= limit) {
        alert(`You can be enrolled in up to ${limit} course(s) at a time. Complete or reset a course first.`)
        return
      }
      await enrollInCourse(profile.uid, cid)
      await fetchLearning(cid)
      await enterCourse(cid, 1)
    } catch (err) { alert(err.message) }
  }

  const handleTileClick = (day) => {
    if (!progress) return
    const conceptId = `day_${String(day).padStart(2, '0')}`
    const read = progress.readDays?.includes(conceptId)
    let calendarUnlocked = 999
    if (!bypassLock && progress.enrolledAt) {
      const enrolled = new Date(progress.enrolledAt + 'T00:00:00')
      const daysSince = Math.floor((new Date() - enrolled) / 86400000)
      calendarUnlocked = Math.max(1, daysSince + 1)
    }
    const effUnlocked = bypassLock ? 999 : Math.min(progress.unlockedDay || 1, calendarUnlocked)
    if (day > effUnlocked) return
    if (read) { startReading(day); return }
    if (day > 1 && needsReview(day, progress.readDays, progress.reviewedDays)) {
      const prevDayData = days.find((d) => d.day === day - 1)
      if (prevDayData) {
        setPendingReadDay(day)
        startReview(day - 1, prevDayData)
        return
      }
    }
    startReading(day)
  }

  const startReading = (day) => {
    const dd = days.find((d) => d.day === day)
    if (!dd) return
    setCurrentDay(day); setDayData(dd); setSlideIndex(0); setView(VIEWS.READING)
  }

  const handleMarkRead = async () => {
    if (!profile?.uid || !courseId || !currentDay) return
    const result = await markDayRead(profile.uid, courseId, currentDay, days.length)
    if (result.error) { alert(result.error); return }
    const xpResult = await awardLearningXP(profile.uid, 'lesson_read')
    if (xpResult) setXpToast(xpResult)
    await fetchLearning(courseId)
    setView(VIEWS.DASHBOARD)
  }

  const startReview = (day, dd) => {
    setCurrentDay(day); setDayData(dd)
    setQIndex(0); setSelected(null); setRevealed(false); setAnswers([]); setReviewResult(null)
    setView(VIEWS.REVIEW)
  }

  const handleSelect = (idx) => { if (!revealed) { setSelected(idx); setRevealed(true) } }

  const handleNext = () => {
    const qs = dayData?.questions?.slice(0, 3) || []
    const q = qs[qIndex]
    if (!q) return
    const next = [...answers, { ...q, selected }]
    setAnswers(next); setSelected(null); setRevealed(false)
    if (qIndex + 1 >= qs.length) {
      finishReview(next)
    } else {
      setQIndex((i) => i + 1)
    }
  }

  const finishReview = async (all) => {
    if (!profile?.uid || !courseId || !dayData) return
    const ans = all.map((a) => a.selected)
    const qs = dayData.questions?.slice(0, 3) || []
    const score = ans.slice(0, 3).filter((a, i) => a === qs[i]?.correctAnswer).length
    const details = qs.map((q, i) => ({
      text: q.text, options: q.options, selected: ans[i],
      correct: q.correctAnswer, isCorrect: ans[i] === q.correctAnswer,
      explanation: q.explanation,
    }))
    setView(VIEWS.REWARD)
    setReviewResult({ score, total: 3, details, reviewedDay: currentDay })
    const result = await submitReview(profile.uid, courseId, currentDay)
    if (result.error) { alert(result.error); setView(VIEWS.DASHBOARD); return }
    await accumulateReviewScore(profile.uid, courseId, score)
    for (let i = 0; i < score; i++) {
      await awardLearningXP(profile.uid, 'review_correct')
    }
    const xpResult = await awardLearningXP(profile.uid, 'review_complete')
    if (xpResult) setXpToast(xpResult)
    const d = await getCourseDays(courseId)
    setDays(d)
    await fetchLearning(courseId)
    await refreshProfile()
  }

  const continueToReading = () => {
    const target = pendingReadDay || (currentDay ? currentDay + 1 : null)
    setPendingReadDay(null)
    if (target && target <= days.length) {
      startReading(target)
    } else {
      setView(VIEWS.DASHBOARD)
    }
  }

  const backToDashboard = async () => { await fetchLearning(courseId); setPendingReadDay(null); setView(VIEWS.DASHBOARD) }

  const startCertQuiz = async () => {
    if (!courseId) return
    if (progress?.certAttempts >= 2) return
    if (progress?.certNextAttemptAt && new Date(progress.certNextAttemptAt) > new Date()) return
    setView(VIEWS.CERT_QUIZ)
    const course = courses.find((c) => c.courseId === courseId)
    const qs = await getCertificationQuestions(courseId, course?.courseTitle)
    setCertQuestions(qs)
  }

  const handleCertFinish = async (rawScore, totalQ) => {
    if (profile?.uid) {
      const ref = doc(db, 'users', profile.uid)
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const data = snap.data()
        const learning = data.learning || { enrolledCourses: {} }
        if (learning.enrolledCourses?.[courseId]) {
          const course = learning.enrolledCourses[courseId]
          const pct = totalQ > 0 ? rawScore / totalQ : 0
          course.finalExamRaw = Math.min(80, Math.round(pct * 80))
          if (pct >= 0.5) {
            course.courseStatus = 'CERTIFIED'
          } else {
            const attempts = (course.certAttempts || 0) + 1
            course.certAttempts = attempts
            if (attempts < 2) {
              const next = new Date()
              next.setDate(next.getDate() + 1)
              next.setHours(0, 0, 0, 0)
              course.certNextAttemptAt = next.toISOString()
            }
          }
          await setDoc(ref, { learning }, { merge: true })
        }
      }
      const certCount = Math.max(1, Math.round((rawScore / totalQ) * 10))
      await awardLearningXP(profile.uid, 'cert_quiz', certCount)
    }
    setCertQuestions(null)
    await fetchLearning(courseId)
    setView(VIEWS.DASHBOARD)
  }

  const readDays = progress?.readDays || []
  const reviewedDays = progress?.reviewedDays || []
  const scoreData = getCourseScore(progress, days.length)
  let calendarUnlocked = 999
  if (!bypassLock && progress?.enrolledAt) {
    const enrolled = new Date(progress.enrolledAt + 'T00:00:00')
    const daysSince = Math.floor((new Date() - enrolled) / 86400000)
    calendarUnlocked = Math.max(1, daysSince + 1)
  }
  const effUnlocked = bypassLock ? 999 : Math.min(progress?.unlockedDay || 1, calendarUnlocked)
  const fullyCompleted = days.filter((d) => isFullyComplete(d.day, readDays, reviewedDays, days.length, progress?.courseStatus)).length

  const certWindowEnd = progress?.certificationWindowEndsAt ? new Date(progress.certificationWindowEndsAt) : null
  const certRemainingDays = certWindowEnd
    ? Math.max(0, Math.ceil((certWindowEnd - new Date()) / (1000 * 60 * 60 * 24)))
    : null

  const DASHBOARD = () => {
    const nextUnread = days.find((d) => !readDays.includes(`day_${String(d.day).padStart(2, '0')}`) && d.day <= effUnlocked)
    return (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
        <div className="mb-4">
          <button onClick={() => { setCourseId(null); setDays([]); setProgress(null); setView(VIEWS.CATALOG) }}
            className="text-xs text-primary font-medium hover:underline cursor-pointer flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>All courses
          </button>
        </div>
        <div className="glass rounded-xl p-4 mb-4 animate-fade-scale-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-on-surface text-lg">{days[0]?.courseTitle || courseId}</h3>
              <p className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                {fullyCompleted}/{days.length} days completed
              </p>
            </div>
            <div className="relative w-14 h-14">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="var(--color-outline-variant)" strokeWidth="4" />
                <circle cx="24" cy="24" r="20" fill="none" stroke="#00288e" strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 20}`}
                  strokeDashoffset={`${2 * Math.PI * 20 * (1 - fullyCompleted / Math.max(days.length, 1))}`}
                  className="progress-ring__circle" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-primary">{fullyCompleted}/{days.length}</span>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-4 mb-4 animate-fade-scale-in">
          <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">grid_view</span>
            Course Progress
          </p>
          <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
            {Array.from({ length: days.length }, (_, i) => i + 1).map((day, idx) => {
              const conceptId = `day_${String(day).padStart(2, '0')}`
              const done = isFullyComplete(day, readDays, reviewedDays, days.length, progress?.courseStatus)
              const readOnly = !done && readDays.includes(conceptId)
              const locked = day > effUnlocked
              const isNext = day === nextUnread?.day
              const isCertified = progress?.courseStatus === 'CERTIFIED'
              let cls = 'bg-surface-container-low text-on-surface-variant'
              let icon = String(day)
              let clickable = false
              if (done) {
                cls = isCertified ? 'bg-success/70 text-white cursor-default' : 'bg-success/70 text-white cursor-pointer hover:scale-110 hover:shadow-lg active:scale-[0.92] transition-all duration-200'
                icon = '✓'; clickable = !isCertified
              } else if (readOnly) {
                cls = isCertified ? 'bg-[#00288e] text-white cursor-default' : 'bg-[#00288e] text-white cursor-pointer hover:scale-110 hover:shadow-lg active:scale-[0.92] transition-all duration-200'
                icon = '✓'; clickable = !isCertified
              } else if (locked) { cls = 'bg-outline-variant/30 text-on-surface-variant/40 cursor-default'; icon = '🔒' }
              else if (isNext) { cls = 'bg-primary text-white ring-2 ring-primary ring-offset-2 cursor-pointer hover:opacity-90 active:scale-[0.92] animate-glow-pulse'; clickable = true }
              else if (!locked) { cls = 'bg-primary text-white cursor-pointer hover:scale-110 hover:shadow-lg active:scale-[0.92] transition-all duration-200'; clickable = true }
              return clickable ? (
                <button key={day} onClick={() => handleTileClick(day)}
                  className={`aspect-square rounded-xl flex items-center justify-center text-xs font-bold ${cls}`} style={{ animationDelay: `${idx * 0.03}s` }}>{icon}</button>
              ) : (
                <div key={day} className={`aspect-square rounded-xl flex items-center justify-center text-xs font-bold ${cls}`}>{icon}</div>
              )
            })}
          </div>
        </div>

        {fullyCompleted === 0 && progress?.courseStatus === 'ENROLLED' && !bypassLock && (
          <div className="glass rounded-xl p-4 mb-4 animate-fade-scale-in text-center">
            <p className="text-sm font-semibold text-on-surface">
              Welcome aboard! 🎉 Ready to dive in? Start your very first lesson now.
            </p>
          </div>
        )}
        {fullyCompleted > 0 && fullyCompleted < days.length && progress?.courseStatus !== 'CERTIFIED' && !bypassLock && (
          <div className="glass rounded-xl p-4 mb-4 animate-fade-scale-in text-center">
            <p className="text-sm font-semibold text-on-surface">
              You're making great progress! Day {fullyCompleted} is completed. 🚀 See you tomorrow for Day {fullyCompleted + 1} ⏳
            </p>
          </div>
        )}

        {(() => {
          const attempts = progress?.certAttempts || 0
          const nextAttemptAt = progress?.certNextAttemptAt ? new Date(progress.certNextAttemptAt) : null
          const blocked = nextAttemptAt && nextAttemptAt > new Date()

          if (attempts >= 2) {
            return (
              <div className="glass rounded-xl p-4 mb-4 animate-fade-scale-in border border-warning/30">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-warning text-[28px]">report</span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-on-surface">Attempts Exhausted</h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">You've used both certification attempts. Re-take the course to try again.</p>
                    {certWindowEnd && certRemainingDays !== null && certRemainingDays > 0 && (
                      <p className="text-[10px] text-on-surface-variant mt-0.5">Window closes in {certRemainingDays} day{certRemainingDays !== 1 ? 's' : ''} (until {certWindowEnd.toLocaleDateString()})</p>
                    )}
                    <button onClick={() => { resetCourseProgress(profile.uid, courseId).then(() => navigate('/mylearn')) }}
                      className="mt-3 bg-warning text-white px-5 py-2 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.95] transition-all cursor-pointer">
                      <span className="material-symbols-outlined text-[16px] align-middle mr-1">refresh</span>
                      Re-take Course
                    </button>
                  </div>
                </div>
              </div>
            )
          }

          if (blocked) {
            return (
              <div className="glass rounded-xl p-4 mb-4 animate-fade-scale-in">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-[28px]">lock_clock</span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-on-surface">Certification Exam — Retry Pending</h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">Next attempt available on <strong>{nextAttemptAt.toLocaleDateString()}</strong></p>
                    <div className="mt-3 bg-outline-variant/50 text-on-surface-variant px-5 py-2 rounded-xl text-sm font-medium inline-block">
                      Start Certification
                    </div>
                  </div>
                </div>
              </div>
            )
          }

          return null
        })()}

        {certWindowEnd && progress?.courseStatus === 'LESSONS_COMPLETED' && progress?.courseStatus !== 'CERTIFIED' && !(progress?.certAttempts >= 2) && !(progress?.certNextAttemptAt && new Date(progress.certNextAttemptAt) > new Date()) && (
          <div className="glass rounded-xl p-4 mb-4 animate-fade-scale-in">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-[28px] animate-timer-pulse">timer</span>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-on-surface">Certification Exam Available</h3>
                {certRemainingDays !== null && certRemainingDays > 0 ? (
                  <p className="text-xs text-on-surface-variant mt-0.5">Complete within <strong className="text-primary">{certRemainingDays}</strong> day{certRemainingDays !== 1 ? 's' : ''} (until {certWindowEnd.toLocaleDateString()})</p>
                ) : (
                  <p className="text-xs text-error mt-0.5">Window expired — contact admin to reset.</p>
                )}
                <button onClick={startCertQuiz}
                  className="mt-3 bg-primary text-white px-5 py-2 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.95] transition-all cursor-pointer">
                  Start Certification
                </button>
              </div>
            </div>
          </div>
        )}

        {days.length > 0 && fullyCompleted === days.length && progress?.courseStatus !== 'CERTIFIED' && !(progress?.certAttempts >= 2) && !(progress?.certNextAttemptAt && new Date(progress.certNextAttemptAt) > new Date()) && (
          <div className="glass-dark rounded-xl p-5 text-center animate-fade-scale-in">
            <span className="material-symbols-outlined text-primary text-[42px] animate-combo-bounce">celebration</span>
            <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface mt-2 gradient-text">Course Complete!</h3>
            <p className="text-xs text-on-surface-variant mt-1">All {days.length} days completed. Great work!</p>
            <button onClick={startCertQuiz}
              className="mt-4 bg-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.95] transition-all cursor-pointer">
              Take Certification Quiz
            </button>
          </div>
        )}
        {progress?.courseStatus === 'CERTIFIED' && (
          <div className="glass-dark rounded-xl p-5 text-center animate-fade-scale-in">
            <span className="material-symbols-outlined text-primary text-[42px] animate-combo-bounce">verified</span>
            <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface mt-2 gradient-text">Certified!</h3>
            <p className="text-xs text-on-surface-variant mt-1">Final score: {scoreData.overall}/{scoreData.overallMax} ({scoreData.overall}%)</p>
            {scoreData.overall >= 50 && (
              <button onClick={() => setShowCert(true)}
                className="mt-3 bg-primary text-white px-5 py-2 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.95] transition-all cursor-pointer">
                <span className="material-symbols-outlined text-[18px] align-middle mr-1">reward</span>
                View Certificate
              </button>
            )}
          </div>
        )}
        {showCert && (
          <Certificate
            userName={profile?.displayName || profile?.email || 'User'}
            courseTitle={days[0]?.courseTitle || courseId}
            score={scoreData.overall}
            overallMax={scoreData.overallMax}
            date={new Date().toLocaleDateString()}
            courseDuration={`${days.length} day${days.length !== 1 ? 's' : ''}`}
            onClose={() => setShowCert(false)}
          />
        )}
      </div>
    )
  }

  const READING = () => {
    const posts = dayData.posts?.length > 0 ? dayData.posts : [{ title: dayData.title, content: dayData.shortExplanation }]
    const totalSlides = posts.length
    const curr = posts[slideIndex] || {}
    const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
    const handleTouchEnd = (e) => {
      const diff = touchStartX.current - e.changedTouches[0].clientX
      if (Math.abs(diff) > 50) {
        if (diff > 0 && slideIndex < totalSlides - 1) setSlideIndex((i) => i + 1)
        else if (diff < 0 && slideIndex > 0) setSlideIndex((i) => i - 1)
      }
    }
    return (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto flex flex-col animate-fade-scale-in">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => { setView(VIEWS.DASHBOARD); fetchLearning(courseId) }}
            className="text-xs text-primary font-medium hover:underline cursor-pointer flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>Back to course
          </button>
          {totalSlides > 1 && (
            <span className="text-xs text-on-surface-variant font-medium">{slideIndex + 1}/{totalSlides}</span>
          )}
        </div>
        {totalSlides > 1 && (
          <div className="h-1 bg-outline-variant/30 rounded-full mb-4 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-400" style={{ width: `${((slideIndex + 1) / totalSlides) * 100}%` }} />
          </div>
        )}
        <div className="glass-strong rounded-xl p-5 md:p-6 mb-4 flex-1 flex flex-col min-h-0 reading-slide"
          key={slideIndex} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold text-primary uppercase tracking-widest bg-primary-fixed px-1.5 py-0.5 rounded">{dayData.category || 'Lesson'}</span>
            <span className="text-[10px] text-on-surface-variant">{dayData.estimatedReadingTime || ''}</span>
          </div>
          <h1 className="font-['Hanken_Grotesk'] text-xl md:text-2xl font-bold text-on-surface mt-2 mb-1">{curr.title || dayData.title}</h1>
          <p className="text-[11px] text-on-surface-variant mb-4">Day {dayData.day}</p>
          <div className="overflow-y-auto flex-1 min-h-0 text-sm text-on-surface leading-relaxed">
            <div className="markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {curr.content || 'No content available.'}
              </ReactMarkdown>
            </div>
          </div>
        </div>
        {totalSlides > 1 && (
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setSlideIndex((i) => Math.max(0, i - 1))} disabled={slideIndex === 0}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-primary hover:bg-primary-fixed rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-default">
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>Previous
            </button>
            <div className="flex gap-2">
              {posts.map((_, i) => (
                <button key={i} onClick={() => setSlideIndex(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${i === slideIndex ? 'bg-primary scale-125' : 'bg-outline-variant hover:bg-outline'}`} />
              ))}
            </div>
            <button onClick={() => setSlideIndex((i) => Math.min(totalSlides - 1, i + 1))} disabled={slideIndex === totalSlides - 1}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-primary hover:bg-primary-fixed rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-default">
              Next<span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        )}
        {slideIndex === totalSlides - 1 && (() => {
          const alreadyRead = progress?.readDays?.includes(`day_${String(currentDay).padStart(2, '0')}`)
          if (alreadyRead) {
            return (
              <div className="w-full bg-outline-variant/30 text-on-surface-variant py-3 rounded-xl text-sm font-medium text-center">
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">visibility</span>
                  Read-only review
                </span>
              </div>
            )
          }
          return (
            <button onClick={handleMarkRead}
              className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.95] transition-all cursor-pointer animate-glow-pulse">
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Mark Lesson as Completed
              </span>
            </button>
          )
        })()}
      </div>
    )
  }

  const REVIEW = () => {
    const qs = dayData.questions?.slice(0, 3) || []
    if (qs.length === 0) return <div className="h-full flex items-center justify-center p-4 text-on-surface-variant text-sm">No review questions.</div>
    const q = qs[qIndex]
    const letters = ['A', 'B', 'C', 'D']
    return (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto animate-fade-scale-in">
        <div className="mb-4">
          <button onClick={() => { setView(VIEWS.DASHBOARD); fetchLearning(courseId); setPendingReadDay(null) }}
            className="text-xs text-primary font-medium hover:underline cursor-pointer flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>Back to course
          </button>
        </div>
        <div className="glass-strong rounded-xl p-5 mb-4" key={qIndex}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Review Day {currentDay} &middot; Question {qIndex + 1} of {qs.length}</span>
            <div className="flex gap-1.5">
              {qs.map((_, i) => (
                <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${i < qIndex ? 'bg-primary' : i === qIndex ? 'bg-primary scale-125' : i > qIndex ? 'bg-outline-variant' : 'bg-outline-variant'}`} />
              ))}
            </div>
          </div>
          <div className="text-sm md:text-base text-on-surface font-medium mb-4 animate-slide-in-right">
            <div className="markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{q?.text || ''}</ReactMarkdown>
            </div>
          </div>
          <div className="space-y-2.5">
            {q?.options.map((opt, i) => {
              let cls = 'border-outline-variant bg-surface'
              if (revealed) {
                if (i === q.correctAnswer) cls = 'border-success bg-green-50'
                else if (i === selected) cls = 'border-error bg-red-50'
                else cls = 'border-outline-variant bg-surface opacity-60'
              } else if (selected === i) cls = 'border-primary bg-primary-fixed'
              return (
                <button key={i} onClick={() => handleSelect(i)} disabled={revealed}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-sm text-left transition-all cursor-pointer disabled:cursor-default option-hover ${cls}`}>
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${revealed && i === q.correctAnswer ? 'bg-success text-white scale-110' : revealed && i === selected ? 'bg-error text-white scale-110' : selected === i ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant'}`}>
                    {revealed && i === q.correctAnswer ? '✓' : revealed && i === selected ? '✗' : letters[i]}
                  </span>
                  <span className="flex-1"><div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{opt || ''}</ReactMarkdown></div></span>
                </button>
              )
            })}
          </div>
        </div>
        {revealed && (
          <div className="glass rounded-xl p-4 animate-slide-up-in">
            <div className={`p-3 rounded-xl border mb-3 ${selected === q.correctAnswer ? 'bg-green-50 border-success' : 'bg-red-50 border-error'}`}>
              <p className="font-bold text-xs flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">{selected === q.correctAnswer ? 'check_circle' : 'cancel'}</span>
                {selected === q.correctAnswer ? 'Correct!' : 'Wrong!'}
              </p>
              <div className="text-xs text-on-surface-variant mt-1"><div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{q?.explanation || ''}</ReactMarkdown></div></div>
            </div>
            <button onClick={handleNext}
              className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.95] transition-all cursor-pointer flex items-center justify-center gap-1">
              {qIndex < qs.length - 1 ? (
                <><span>Next Question</span><span className="material-symbols-outlined text-[16px]">arrow_forward</span></>
              ) : (
                <><span className="material-symbols-outlined text-[16px]">done_all</span><span>Finish Review</span></>
              )}
            </button>
          </div>
        )}
      </div>
    )
  }

  const REWARD = () => {
    const targetDay = pendingReadDay || (currentDay ? currentDay + 1 : null)
    const colors = ['#00288e', '#059669', '#D97706', '#DC2626', '#7C3AED', '#EC4899']
    return (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] relative">
        {reviewResult.score > 0 && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i}
                className="absolute text-lg animate-confetti-particle"
                style={{
                  left: `${10 + Math.random() * 80}%`,
                  top: `${20 + Math.random() * 30}%`,
                  animationDelay: `${i * 0.08}s`,
                  color: colors[i % colors.length],
                }}>
                {['✨', '⭐', '🎉', '🌟', '💫', '🏆'][i % 6]}
              </div>
            ))}
          </div>
        )}
        <div className="glass-strong rounded-xl p-6 md:p-8 text-center max-w-md w-full animate-fade-scale-in relative z-10">
          <div className="text-5xl mb-3 animate-combo-bounce">{reviewResult.score === reviewResult.total ? '🏆' : '📝'}</div>
          <h2 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface mb-1">
            {reviewResult.score === reviewResult.total ? 'Perfect Review!' : 'Review Complete!'}
          </h2>
          <p className="text-sm text-on-surface-variant mb-3">Day {reviewResult.reviewedDay} review &middot; You scored <strong className={`${reviewResult.score === reviewResult.total ? 'text-success' : 'text-primary'}`}>{reviewResult.score}/{reviewResult.total}</strong></p>
          {xpToast && (
            <div className="inline-flex items-center gap-2 bg-primary-fixed/50 rounded-full px-4 py-1.5 mb-3 animate-slide-up-in">
              <span className="material-symbols-outlined text-[16px] text-primary">stars</span>
              <span className="text-xs font-semibold text-primary">+{xpToast.xpEarned} XP earned</span>
            </div>
          )}
          <div className="glass rounded-lg p-3 mb-4">
            <p className="text-xs text-on-surface-variant">Accumulated review score: <strong className="text-primary">{scoreData.dailyRaw}/{scoreData.dailyMax}</strong></p>
          </div>
          <div className="space-y-2 mb-4 text-left max-h-32 overflow-y-auto">
            {reviewResult.details?.map((d, i) => (
              <div key={i} className={`p-2.5 rounded-xl border text-xs transition-all ${d.isCorrect ? 'bg-green-50 border-success/30' : 'bg-red-50 border-error/30'}`}>
                <p className="font-medium mb-0.5 flex items-center gap-1.5">
                  <span>{d.isCorrect ? '✅' : '❌'}</span>
                  <span>Q{i + 1}: <strong>{d.options[d.correct]}</strong></span>
                </p>
                <div className="text-on-surface-variant"><div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{d.explanation || ''}</ReactMarkdown></div></div>
              </div>
            ))}
          </div>
          {targetDay && targetDay <= days.length ? (
            <button onClick={continueToReading}
              className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.95] transition-all cursor-pointer flex items-center justify-center gap-1.5">
              <span>Continue to Day {targetDay}</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          ) : (
            <button onClick={backToDashboard}
              className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.95] transition-all cursor-pointer">
              Back to Course
            </button>
          )}
        </div>
      </div>
    )
  }

  let content
  if (loading && view === VIEWS.CATALOG) {
    content = <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Loading...</p></div>
  } else if (view === VIEWS.CATALOG) {
    content = (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-5xl mx-auto animate-fade-scale-in">
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface mb-1">My Learning</h1>
        <p className="text-sm text-on-surface-variant mb-6">Choose a course to start learning</p>
        {courses.length === 0 && <p className="text-center py-12 text-on-surface-variant text-sm">No courses available yet.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c, idx) => {
            const enrolled = learning?.enrolledCourses?.[c.courseId]
            const stagger = `animate-slide-up-in animate-stagger-${Math.min(idx + 1, 5)}`
            return (
              <div key={c.courseId} className={`glass rounded-xl p-5 card-hover flex flex-col ${stagger}`}>
                <div className="flex-1">
                  <span className="material-symbols-outlined text-[36px] text-primary/60 mb-3" style={{fontVariationSettings: "'FILL' 1"}}>school</span>
                  <h3 className="font-semibold text-on-surface flex items-center gap-2">
                    {c.courseTitle}
                    {premiumCourses.includes(c.courseId) && (
                      <span className="shrink-0 text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Premium</span>
                    )}
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">calendar_month</span>
                    {c.dayCount} day{c.dayCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <button onClick={() => enrolled ? enterCourse(c.courseId) : handleEnroll(c.courseId)}
                  className={`mt-4 w-full py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer active:scale-[0.95] ${enrolled ? 'bg-primary text-on-primary hover:opacity-90 flex items-center justify-center gap-1.5' : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30'}`}>
                  {enrolled ? (
                    <span className="flex items-center justify-center gap-1.5"><span className="material-symbols-outlined text-[16px]">arrow_forward</span>Continue</span>
                  ) : 'Enroll'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  } else if (view === VIEWS.DASHBOARD && courseId) {
    content = <DASHBOARD />
  } else if (view === VIEWS.READING && dayData) {
    content = <READING />
  } else if (view === VIEWS.REVIEW && dayData) {
    content = <REVIEW />
  } else if (view === VIEWS.REWARD && reviewResult) {
    content = <REWARD />
  } else if (view === VIEWS.CERT_QUIZ) {
    if (!certQuestions || certQuestions.length === 0) {
      content = (
        <div className="h-full overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
          <div className="glass-strong rounded-xl p-6 text-center max-w-md w-full animate-fade-scale-in">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant">quiz</span>
            <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface mt-2">No Certification Questions</h3>
            <p className="text-sm text-on-surface-variant mt-2">Certification questions are not available yet for this course. Please check back later.</p>
            <button onClick={() => { setView(VIEWS.DASHBOARD) }}
              className="mt-4 bg-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer">
              Back to Course
            </button>
          </div>
        </div>
      )
    } else {
      content = (
        <QuizRunner
          questions={certQuestions}
          config={{ quizType: 'Certification', chapter: courseId, module: 'Course', mode: 'Certification', timerMinutes: quizSettings?.certificationTimerMinutes || 30 }}
          onFinish={handleCertFinish}
        />
      )
    }
  }

  return (
    <>
      {content}
      {xpToast && (
        <div className="fixed top-4 right-4 z-[100] xp-toast-enter">
          <div className="glass-dark rounded-xl px-4 py-3 shadow-lg flex items-center gap-3">
            <span className="material-symbols-outlined text-[22px] text-primary">stars</span>
            <div>
              <p className="text-sm font-bold text-on-surface">+{xpToast.xpEarned} XP</p>
              <p className="text-[10px] text-on-surface-variant">{xpToast.leveledUp ? `Level Up! Now Level ${xpToast.level}` : `${xpToast.totalXp} total XP`}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
