import { useState, useEffect, useRef } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import {
  getAllCourses, getCourseDays, enrollInCourse,
  markDayRead, submitReview, getLearningProgress,
  getCertificationQuestions, getCourseScore,
  isFullyComplete, needsReview, accumulateReviewScore,
} from '../lib/learnService'
import { getQuizSettings } from '../lib/quizSettings'
import QuizRunner from '../components/QuizRunner'
import Certificate from '../components/Certificate'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

const VIEWS = { CATALOG: 'catalog', DASHBOARD: 'dashboard', READING: 'reading', REVIEW: 'review', REWARD: 'reward', CERT_QUIZ: 'cert_quiz' }

export default function SimpleLearnPage() {
  const { profile, refreshProfile } = useAuth()
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
    getAllCourses().then((c) => { setCourses(c.filter((x) => x.visible !== false)); setLoading(false) })
    if (profile?.uid) fetchLearning()
    getQuizSettings().then((s) => setBypassLock(s.bypassDailyLearningLock))
  }, [profile?.uid])

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
      await enrollInCourse(profile.uid, cid)
      await fetchLearning(cid)
      await enterCourse(cid, 1)
    } catch (err) { alert(err.message) }
  }

  const handleTileClick = (day) => {
    if (!progress) return
    const conceptId = `day_${String(day).padStart(2, '0')}`
    const read = progress.readDays?.includes(conceptId)
    const effUnlocked = bypassLock ? 999 : (progress.unlockedDay || 1)
    if (day > effUnlocked) return
    if (read) return
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
    const result = await submitReview(profile.uid, courseId, currentDay)
    if (result.error) { alert(result.error); setView(VIEWS.DASHBOARD); return }
    await accumulateReviewScore(profile.uid, courseId, score)
    const d = await getCourseDays(courseId)
    setDays(d)
    await fetchLearning(courseId)
    await refreshProfile()
    setReviewResult({ score, total: 3, details, reviewedDay: currentDay })
    setView(VIEWS.REWARD)
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
          course.courseStatus = 'CERTIFIED'
          course.finalExamRaw = rawScore * 2
          await setDoc(ref, { learning }, { merge: true })
        }
      }
    }
    setCertQuestions(null)
    await fetchLearning(courseId)
    setView(VIEWS.DASHBOARD)
  }

  const readDays = progress?.readDays || []
  const reviewedDays = progress?.reviewedDays || []
  const scoreData = getCourseScore(progress, days.length)
  const effUnlocked = bypassLock ? 999 : (progress?.unlockedDay || 1)
  const fullyCompleted = days.filter((d) => isFullyComplete(d.day, readDays, reviewedDays, days.length, progress?.courseStatus)).length

  const certWindowEnd = progress?.certificationWindowEndsAt ? new Date(progress.certificationWindowEndsAt) : null
  const certRemainingDays = certWindowEnd
    ? Math.max(0, Math.ceil((certWindowEnd - new Date()) / (1000 * 60 * 60 * 24)))
    : null

  if (loading && view === VIEWS.CATALOG) {
    return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Loading...</p></div>
  }

  // ==================== CATALOG ====================
  if (view === VIEWS.CATALOG) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface mb-1">My Learning</h1>
        <p className="text-sm text-on-surface-variant mb-6">Choose a course to start learning</p>
        {courses.length === 0 && <p className="text-center py-12 text-on-surface-variant text-sm">No courses available yet.</p>}
        <div className="space-y-3">
          {courses.map((c) => {
            const enrolled = learning?.enrolledCourses?.[c.courseId]
            return (
              <div key={c.courseId} className="bg-surface border border-outline-variant rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-on-surface">{c.courseTitle}</h3>
                    <p className="text-xs text-on-surface-variant mt-1">{c.dayCount} day{c.dayCount !== 1 ? 's' : ''}</p>
                  </div>
                  {enrolled ? (
                    <button onClick={() => enterCourse(c.courseId)}
                      className="shrink-0 px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer">Enter</button>
                  ) : (
                    <button onClick={() => handleEnroll(c.courseId)}
                      className="shrink-0 px-4 py-2 border border-primary text-primary rounded-xl text-sm font-semibold hover:bg-primary-fixed active:scale-[0.98] transition-all cursor-pointer">Enroll</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ==================== DASHBOARD ====================
  if (view === VIEWS.DASHBOARD && courseId) {
    const nextUnread = days.find((d) => !readDays.includes(`day_${String(d.day).padStart(2, '0')}`) && d.day <= effUnlocked)
    return (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
        <div className="mb-4">
          <button onClick={() => { setCourseId(null); setDays([]); setProgress(null); setView(VIEWS.CATALOG) }}
            className="text-xs text-primary font-medium hover:underline cursor-pointer flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>All courses
          </button>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-4 mb-4">
          <h3 className="font-semibold text-on-surface">{days[0]?.courseTitle || courseId}</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">{fullyCompleted}/{days.length} days completed</p>
        </div>

          {scoreData.dailyMax > 0 && (
          <div className="bg-surface border border-outline-variant rounded-xl p-4 mb-4">
            <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Daily Review Score (40% weight)</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-primary">{scoreData.dailyPct}%</span>
              <div className="flex-1 h-2 bg-outline-variant rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${scoreData.dailyPct}%` }} />
              </div>
              <span className="text-xs text-on-surface-variant">{scoreData.dailyRaw}/{scoreData.dailyMax} &middot; {Math.round((scoreData.dailyRaw / scoreData.dailyMax) * 40)}/40 pts</span>
            </div>
          </div>
        )}
        {scoreData.finalRaw > 0 && (
          <div className="bg-surface border border-outline-variant rounded-xl p-4 mb-4">
            <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Final Exam Score (60% weight)</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-primary">{scoreData.finalPct}%</span>
              <div className="flex-1 h-2 bg-outline-variant rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${scoreData.finalPct}%` }} />
              </div>
              <span className="text-xs text-on-surface-variant">{scoreData.finalRaw}/{scoreData.finalMax} &middot; {scoreData.finalRaw}/60 pts</span>
            </div>
          </div>
        )}
        {(scoreData.dailyMax > 0 || scoreData.finalRaw > 0) && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4">
            <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Overall Score</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-primary">{scoreData.overall}/{scoreData.overallMax}</span>
              <div className="flex-1 h-2 bg-outline-variant rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${scoreData.overall}%` }} />
              </div>
              <span className="text-xs text-on-surface-variant">{scoreData.overall}%</span>
            </div>
          </div>
        )}

        <div className="bg-surface border border-outline-variant rounded-xl p-4 mb-4">
          <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Progress</p>
          <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
            {Array.from({ length: days.length }, (_, i) => i + 1).map((day) => {
              const conceptId = `day_${String(day).padStart(2, '0')}`
              const done = isFullyComplete(day, readDays, reviewedDays, days.length, progress?.courseStatus)
              const readOnly = !done && readDays.includes(conceptId)
              const locked = day > effUnlocked
              const isNext = day === nextUnread?.day
              let cls = 'bg-surface-container-low text-on-surface-variant'
              let icon = String(day)
              let clickable = false
              if (done) { cls = 'bg-success/70 text-white cursor-default'; icon = '✓' }
              else if (readOnly) { cls = 'bg-[#00288e] text-white cursor-default'; icon = '✓' }
              else if (locked) { cls = 'bg-outline-variant/30 text-on-surface-variant/40 cursor-default'; icon = '🔒' }
              else if (isNext) { cls = 'bg-primary text-white ring-2 ring-primary ring-offset-1 cursor-pointer hover:opacity-90 active:scale-[0.97]'; clickable = true }
              else if (!locked) { cls = 'bg-primary text-white cursor-pointer hover:opacity-90 active:scale-[0.97]'; clickable = true }
              return clickable ? (
                <button key={day} onClick={() => handleTileClick(day)}
                  className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all ${cls}`}>{icon}</button>
              ) : (
                <div key={day} className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all ${cls}`}>{icon}</div>
              )
            })}
          </div>
        </div>

        {certWindowEnd && progress?.courseStatus === 'LESSONS_COMPLETED' && progress?.courseStatus !== 'CERTIFIED' && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-[24px]">timer</span>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-on-surface">Certification Exam Available</h3>
                {certRemainingDays !== null && certRemainingDays > 0 ? (
                  <p className="text-xs text-on-surface-variant mt-0.5">Complete within {certRemainingDays} day{certRemainingDays !== 1 ? 's' : ''} (until {certWindowEnd.toLocaleDateString()})</p>
                ) : (
                  <p className="text-xs text-error mt-0.5">Window expired — contact admin to reset.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {days.length > 0 && fullyCompleted === days.length && progress?.courseStatus !== 'CERTIFIED' && (
          <div className="bg-success/10 border border-success/20 rounded-xl p-5 text-center">
            <span className="material-symbols-outlined text-success text-[36px]">celebration</span>
            <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface mt-1">Course Complete!</h3>
            <p className="text-xs text-on-surface-variant mt-1">All {days.length} days completed.</p>
            <button onClick={startCertQuiz}
              className="mt-4 bg-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer">
              Take Certification Quiz
            </button>
          </div>
        )}
        {progress?.courseStatus === 'CERTIFIED' && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-5 text-center">
            <span className="material-symbols-outlined text-primary text-[36px]">verified</span>
            <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface mt-1">Certified!</h3>
            <p className="text-xs text-on-surface-variant mt-1">Final score: {scoreData.overall}/{scoreData.overallMax} ({scoreData.overall}%)</p>
            {scoreData.overall >= 60 && (
              <button onClick={() => setShowCert(true)}
                className="mt-3 bg-primary text-white px-5 py-2 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer">
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
            onClose={() => setShowCert(false)}
          />
        )}
      </div>
    )
  }

  // ==================== READING ====================
  if (view === VIEWS.READING && dayData) {
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
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto flex flex-col">
        <div className="mb-4">
          <button onClick={() => { setView(VIEWS.DASHBOARD); fetchLearning(courseId) }}
            className="text-xs text-primary font-medium hover:underline cursor-pointer flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>Back to course
          </button>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-5 md:p-6 shadow-sm mb-4 flex-1 flex flex-col min-h-0"
          onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold text-primary uppercase tracking-widest bg-primary-fixed px-1.5 py-0.5 rounded">{dayData.category || 'Lesson'}</span>
            <span className="text-[10px] text-on-surface-variant">{dayData.estimatedReadingTime || ''}</span>
          </div>
          <h1 className="font-['Hanken_Grotesk'] text-xl md:text-2xl font-bold text-on-surface mt-2 mb-1">{curr.title || dayData.title}</h1>
          <p className="text-[11px] text-on-surface-variant mb-4">Day {dayData.day}{totalSlides > 1 ? ` \u00b7 ${slideIndex + 1}/${totalSlides}` : ''}</p>
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
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-primary hover:bg-primary-fixed rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-default">
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>Previous
            </button>
            <div className="flex gap-1.5">
              {posts.map((_, i) => (
                <button key={i} onClick={() => setSlideIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all cursor-pointer ${i === slideIndex ? 'bg-primary scale-125' : 'bg-outline-variant'}`} />
              ))}
            </div>
            <button onClick={() => setSlideIndex((i) => Math.min(totalSlides - 1, i + 1))} disabled={slideIndex === totalSlides - 1}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-primary hover:bg-primary-fixed rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-default">
              Next<span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        )}
        <button onClick={handleMarkRead}
          className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-sm">
          Mark Lesson as Completed Reading
        </button>
      </div>
    )
  }

  // ==================== REVIEW ====================
  if (view === VIEWS.REVIEW && dayData) {
    const qs = dayData.questions?.slice(0, 3) || []
    if (qs.length === 0) return <div className="h-full flex items-center justify-center p-4 text-on-surface-variant text-sm">No review questions.</div>
    const q = qs[qIndex]
    const letters = ['A', 'B', 'C', 'D']
    return (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto">
        <div className="mb-4">
          <button onClick={() => { setView(VIEWS.DASHBOARD); fetchLearning(courseId); setPendingReadDay(null) }}
            className="text-xs text-primary font-medium hover:underline cursor-pointer flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>Back to course
          </button>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Review Day {currentDay} &middot; Question {qIndex + 1} of {qs.length}</span>
            <div className="flex gap-1">{qs.map((_, i) => (<div key={i} className={`w-2 h-2 rounded-full ${i < qIndex ? 'bg-primary' : i === qIndex ? 'bg-primary ring-2 ring-primary/30' : 'bg-outline-variant'}`} />))}</div>
          </div>
          <div className="text-sm md:text-base text-on-surface font-medium mb-4">
            <div className="markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{q?.text || ''}</ReactMarkdown>
            </div>
          </div>
          <div className="space-y-2">
            {q?.options.map((opt, i) => {
              let cls = 'border-outline-variant bg-surface hover:bg-surface-container-low'
              if (revealed) {
                if (i === q.correctAnswer) cls = 'border-success bg-green-50'
                else if (i === selected) cls = 'border-error bg-red-50'
                else cls = 'border-outline-variant bg-surface opacity-60'
              } else if (selected === i) cls = 'border-primary bg-primary-fixed'
              return (
                <button key={i} onClick={() => handleSelect(i)} disabled={revealed}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-all cursor-pointer disabled:cursor-default ${cls}`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${revealed && i === q.correctAnswer ? 'bg-success text-white' : revealed && i === selected ? 'bg-error text-white' : selected === i ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant'}`}>
                    {revealed && i === q.correctAnswer ? '✓' : revealed && i === selected ? '✗' : letters[i]}
                  </span>
                  <span className="flex-1"><div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{opt || ''}</ReactMarkdown></div></span>
                </button>
              )
            })}
          </div>
        </div>
        {revealed && (
          <div className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm">
            <div className={`p-3 rounded-lg border mb-3 ${selected === q.correctAnswer ? 'bg-green-50 border-success' : 'bg-red-50 border-error'}`}>
              <p className="font-bold text-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">{selected === q.correctAnswer ? 'check_circle' : 'cancel'}</span>
                {selected === q.correctAnswer ? 'Correct!' : 'Wrong!'}
              </p>
              <div className="text-xs text-on-surface-variant mt-1"><div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{q?.explanation || ''}</ReactMarkdown></div></div>
            </div>
            <button onClick={handleNext}
              className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer">
              {qIndex < qs.length - 1 ? 'Next Question' : 'Finish Review'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // ==================== REWARD ====================
  if (view === VIEWS.REWARD && reviewResult) {
    const targetDay = pendingReadDay || (currentDay ? currentDay + 1 : null)
    return (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-surface border border-outline-variant rounded-xl p-6 md:p-8 shadow-sm text-center max-w-md w-full">
          <div className="text-5xl mb-3">📝</div>
          <h2 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface mb-1">Review Complete!</h2>
          <p className="text-sm text-on-surface-variant mb-2">Day {reviewResult.reviewedDay} review &middot; You scored {reviewResult.score}/{reviewResult.total}</p>
          <div className="bg-primary-fixed/30 rounded-lg p-3 mb-4">
            <p className="text-xs text-on-surface-variant">Accumulated review score: <strong className="text-primary">{scoreData.dailyRaw}/{scoreData.dailyMax}</strong> ({scoreData.dailyPct}%)</p>
          </div>
          <div className="space-y-2 mb-4 text-left max-h-32 overflow-y-auto">
            {reviewResult.details?.map((d, i) => (
              <div key={i} className={`p-2 rounded-lg border text-xs ${d.isCorrect ? 'bg-green-50 border-success/30' : 'bg-red-50 border-error/30'}`}>
                <p className="font-medium mb-0.5">Q{i + 1}: {d.isCorrect ? '✅' : '❌'} Correct: {d.options[d.correct]}</p>
                <div className="text-on-surface-variant"><div className="markdown-content"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{d.explanation || ''}</ReactMarkdown></div></div>
              </div>
            ))}
          </div>
          {targetDay && targetDay <= days.length ? (
            <button onClick={continueToReading}
              className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer">
              Continue to Day {targetDay} Lesson
            </button>
          ) : (
            <button onClick={backToDashboard}
              className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer">
              Back to Course
            </button>
          )}
        </div>
      </div>
    )
  }

  // ==================== CERTIFICATION QUIZ ====================
  if (view === VIEWS.CERT_QUIZ) {
    if (!certQuestions || certQuestions.length === 0) {
      return (
        <div className="h-full overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
          <div className="bg-surface border border-outline-variant rounded-xl p-6 shadow-sm text-center max-w-md w-full">
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
    }
    return (
      <QuizRunner
        questions={certQuestions}
        config={{ quizType: 'Certification', chapter: courseId, module: 'Course', mode: 'Certification' }}
        onFinish={handleCertFinish}
      />
    )
  }

  return null
}
