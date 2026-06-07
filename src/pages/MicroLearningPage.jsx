import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getAvailableCourses, getCourseContent,
  getLocalLearningProfile, getCourseProgress,
  ensureLearningProfile, enrollCourse, submitQuizResult,
  markDayComplete, submitFinalExam, getCoursePhase,
} from '../lib/steakService'
import { useSound } from '../hooks/useSound'
import CourseCatalog from '../components/CourseCatalog'

const STEAK_VISUALS = [
  { max: 0, label: 'Not Started', emoji: '🥩', color: 'from-gray-300 to-gray-400', desc: 'Begin your learning streak today!' },
  { max: 5, label: 'Raw', emoji: '🥩', color: 'from-red-400 to-red-500', desc: 'Your steak is still raw — keep cooking!' },
  { max: 15, label: 'Medium-Rare', emoji: '🍖', color: 'from-orange-400 to-orange-500', desc: 'Coming along nicely — medium-rare!' },
  { max: 25, label: 'Medium', emoji: '🍖', color: 'from-purple-400 to-purple-500', desc: 'Getting there — solid medium!' },
  { max: 30, label: 'Perfectly Grilled', emoji: '🏆', color: 'from-amber-400 to-yellow-500', desc: 'A perfectly grilled masterpiece!' },
]

const VIEWS = { CATALOG: 'catalog', DASHBOARD: 'dashboard', READING: 'reading', REVIEW: 'review', REWARD: 'reward', EXAM: 'exam', EXAM_RESULT: 'exam_result' }

function getSteakVisual(steak) {
  if (steak <= 0) return STEAK_VISUALS[0]
  if (steak <= 5) return STEAK_VISUALS[1]
  if (steak <= 15) return STEAK_VISUALS[2]
  if (steak <= 25) return STEAK_VISUALS[3]
  return STEAK_VISUALS[4]
}

function QuestionFlow({ questions, questionIndex, selected, revealed, handleSelect, handleNext }) {
  const q = questions[questionIndex]
  const isCorrect = selected === q?.correctAnswer
  const letters = ['A', 'B', 'C', 'D']

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto">
      <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
            Question {questionIndex + 1} of {questions.length}
          </span>
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${
                i < questionIndex ? 'bg-primary' :
                i === questionIndex ? 'bg-primary ring-2 ring-primary/30' :
                'bg-outline-variant'
              }`} />
            ))}
          </div>
        </div>
        <p className="text-sm md:text-base text-on-surface font-medium mb-4">{q?.text}</p>
        <div className="space-y-2">
          {q?.options.map((opt, i) => {
            let cls = 'border-outline-variant bg-surface hover:bg-surface-container-low'
            if (revealed) {
              if (i === q.correctAnswer) cls = 'border-success bg-green-50'
              else if (i === selected && !isCorrect) cls = 'border-error bg-red-50'
              else cls = 'border-outline-variant bg-surface opacity-60'
            } else if (selected === i) {
              cls = 'border-primary bg-primary-fixed'
            }
            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={revealed}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-all cursor-pointer disabled:cursor-default ${cls}`}
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  revealed && i === q.correctAnswer ? 'bg-success text-white' :
                  revealed && i === selected ? 'bg-error text-white' :
                  selected === i ? 'bg-primary text-white' :
                  'bg-surface-container-low text-on-surface-variant'
                }`}>
                  {revealed && i === q.correctAnswer ? '✓' : revealed && i === selected ? '✗' : letters[i]}
                </span>
                <span className="flex-1">{opt}</span>
              </button>
            )
          })}
        </div>
      </div>

      {revealed && (
        <div className="bg-surface border border-outline-variant rounded-xl p-4 shadow-sm">
          <div className={`p-3 rounded-lg border mb-3 ${isCorrect ? 'bg-green-50 border-success' : 'bg-red-50 border-error'}`}>
            <p className="font-bold text-xs flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">{isCorrect ? 'check_circle' : 'cancel'}</span>
              {isCorrect ? 'Correct!' : 'Wrong!'}
            </p>
            <p className="text-xs text-on-surface-variant mt-1">{q?.explanation}</p>
          </div>
          <button
            onClick={handleNext}
            className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
          >
            {questionIndex < questions.length - 1 ? 'Next Question' : 'Finish'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function MicroLearningPage() {
  const { profile, refreshProfile } = useAuth()
  const isModerator = profile?.role === 'moderator' || profile?.role === 'admin'
  const { playCorrect, playWrong, playLevelUp } = useSound()

  const [view, setView] = useState(VIEWS.CATALOG)
  const [courses, setCourses] = useState([])
  const [learning, setLearning] = useState(null)
  const [courseId, setCourseId] = useState(null)
  const [courseContent, setCourseContent] = useState([])
  const [courseProgress, setCourseProgress] = useState(null)
  const [loading, setLoading] = useState(true)

  const [currentDay, setCurrentDay] = useState(null)
  const [dayData, setDayData] = useState(null)

  // Shared question flow state (REVIEW + EXAM)
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [qAnswers, setQAnswers] = useState([])
  const [reviewResult, setReviewResult] = useState(null)
  const [examResult, setExamResult] = useState(null)
  const [examQuestions, setExamQuestions] = useState([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [carouselIndex, setCarouselIndex] = useState(0)

  const load = async () => {
    setLoading(true)
    const [avail, learn] = await Promise.all([
      getAvailableCourses(),
      profile?.uid ? ensureLearningProfile(profile.uid) : Promise.resolve(null),
    ])
    setCourses(avail)
    setLearning(learn)
    setLoading(false)
  }

  useEffect(() => { load() }, [profile])

  const enterCourse = async (cid) => {
    setCourseId(cid)
    resetQuizState()
    const [content, learn] = await Promise.all([
      getCourseContent(cid),
      profile?.uid ? ensureLearningProfile(profile.uid) : Promise.resolve(null),
    ])
    setCourseContent(content)
    setLearning(learn)
    const prog = getCourseProgress(learn, cid)
    setCourseProgress(prog)
    setView(VIEWS.DASHBOARD)
  }

  const refreshProgress = async () => {
    if (!courseId || !profile?.uid) return
    const learn = await ensureLearningProfile(profile.uid)
    setLearning(learn)
    const prog = getCourseProgress(learn, courseId)
    setCourseProgress(prog)
  }

  const resetQuizState = () => {
    setQIndex(0)
    setSelected(null)
    setRevealed(false)
    setQAnswers([])
    setReviewResult(null)
    setExamResult(null)
    setShowConfetti(false)
    setCarouselIndex(0)
    setCurrentDay(null)
    setDayData(null)
  }

  const handleEnroll = async (cid) => {
    if (!profile?.uid) return
    try {
      const updated = await enrollCourse(profile.uid, cid)
      if (updated) setLearning(updated)
    } catch (err) {
      alert(err.message)
    }
  }

  // -- READING: open day content --
  const handleStartReading = (day) => {
    setCurrentDay(day)
    const dd = courseContent.find((c) => c.day === day)
    setDayData(dd || null)
    setCarouselIndex(0)
    setView(VIEWS.READING)
  }

  // -- MARK COMPLETE: mark a day as read+complete --
  const handleMarkComplete = async () => {
    if (!profile?.uid || !courseId || !dayData) return
    const result = await markDayComplete(profile.uid, courseId, dayData.day, courseContent.length)
    if (result.error) { alert(result.error); return }
    if (result.xpGained) playLevelUp()
    await refreshProgress()
    await refreshProfile()
    setView(VIEWS.DASHBOARD)
  }

  // -- REVIEW: start a 3-question review --
  const handleStartReview = (day) => {
    setCurrentDay(day)
    const dd = courseContent.find((c) => c.day === day)
    setDayData(dd || null)
    resetQuizState()
    setView(VIEWS.REVIEW)
  }

  const handleSelect = (idx) => {
    if (revealed) return
    setSelected(idx)
    setRevealed(true)
    const qs = view === VIEWS.EXAM ? examQuestions : dayData?.questions?.slice(0, 3)
    const q = qs?.[qIndex]
    if (q && idx === q.correctAnswer) playCorrect()
    else playWrong()
  }

  const handleNext = () => {
    const qs = view === VIEWS.EXAM ? examQuestions : dayData?.questions?.slice(0, 3)
    const q = qs?.[qIndex]
    if (!q) return
    setQAnswers((prev) => [...prev, { ...q, selected }])
    setSelected(null)
    setRevealed(false)
    if (qIndex + 1 >= qs.length) {
      // Last question — submit
      const allAnswers = [...qAnswers, { ...q, selected }]
      if (view === VIEWS.EXAM) {
        finishExam(allAnswers)
      } else {
        finishReview(allAnswers)
      }
    } else {
      setQIndex((i) => i + 1)
    }
  }

  const finishReview = async (finalAnswers) => {
    if (!profile?.uid || !courseId || !dayData) return
    const answers = finalAnswers.map((a) => a.selected)
    const result = await submitQuizResult(profile.uid, courseId, dayData.day, answers, dayData.questions)
    if (result.error) { alert(result.error); setView(VIEWS.DASHBOARD); return }
    if (result.steakChanged) playLevelUp()
    setReviewResult(result)
    await refreshProgress()
    await refreshProfile()
    setView(VIEWS.REWARD)
  }

  // -- EXAM: start 30-question final exam --
  const handleStartExam = () => {
    const qs = courseContent.flatMap((c) => c.questions || []).slice(0, 30)
    setExamQuestions(qs)
    resetQuizState()
    setView(VIEWS.EXAM)
  }

  const finishExam = async (finalAnswers) => {
    if (!profile?.uid || !courseId) return
    const answers = finalAnswers.map((a) => a.selected)
    const result = await submitFinalExam(profile.uid, courseId, answers, examQuestions, courseContent.length)
    if (result.error) { alert(result.error); setView(VIEWS.DASHBOARD); return }
    setExamResult(result)
    setShowConfetti(result.passed)
    if (result.passed) playLevelUp()
    await refreshProgress()
    await refreshProfile()
    setView(VIEWS.EXAM_RESULT)
  }

  const handleBackToDashboard = () => {
    setView(VIEWS.DASHBOARD)
    refreshProgress()
  }

  const handleBackToCatalog = () => {
    setCourseId(null)
    setCourseContent([])
    setCourseProgress(null)
    setDayData(null)
    setExamQuestions([])
    resetQuizState()
    setView(VIEWS.CATALOG)
    load()
  }

  if (loading) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Loading...</p></div>

  // ==================== CATALOG ====================
  if (view === VIEWS.CATALOG) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
        <CourseCatalog
          courses={courses}
          enrolledCourses={learning?.enrolledCourses}
          onEnroll={handleEnroll}
          onEnter={enterCourse}
        />
      </div>
    )
  }

  // ==================== READING ====================
  if (view === VIEWS.READING && dayData) {
    const posts = dayData.posts?.length
      ? dayData.posts
      : [{ title: dayData.title, content: dayData.shortExplanation }]
    const currentPost = posts[carouselIndex]

    return (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto">
        <div className="mb-4">
          <button onClick={handleBackToDashboard} className="text-xs text-primary font-medium hover:underline cursor-pointer flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>
            Back to course
          </button>
        </div>

        {posts.length > 1 && (
          <div className="flex items-center justify-center gap-2 mb-4">
            {posts.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === carouselIndex ? 'bg-primary w-4' : 'bg-outline-variant'}`} />
            ))}
          </div>
        )}

        <div className="bg-surface border border-outline-variant rounded-xl p-5 md:p-6 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold text-primary uppercase tracking-widest bg-primary-fixed px-1.5 py-0.5 rounded">{dayData.category}</span>
            <span className="text-[10px] text-on-surface-variant">{dayData.estimatedReadingTime}</span>
            {posts.length > 1 && (
              <span className="text-[10px] text-on-surface-variant ml-auto">Post {carouselIndex + 1} of {posts.length}</span>
            )}
          </div>
          <h1 className="font-['Hanken_Grotesk'] text-xl md:text-2xl font-bold text-on-surface mt-2 mb-1">{currentPost?.title}</h1>
          <p className="text-[11px] text-on-surface-variant mb-4">Day {dayData.day} · {dayData.courseTitle || courseId}</p>
          <div className="prose prose-sm max-w-none text-on-surface leading-relaxed whitespace-pre-line">
            {currentPost?.content}
          </div>
        </div>

        {posts.length > 1 && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setCarouselIndex(i => Math.max(0, i - 1))}
              disabled={carouselIndex === 0}
              className="flex-1 px-4 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface hover:bg-surface-container-low transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Previous
            </button>
            <button
              onClick={() => setCarouselIndex(i => Math.min(posts.length - 1, i + 1))}
              disabled={carouselIndex === posts.length - 1}
              className="flex-1 px-4 py-2.5 rounded-xl border border-outline-variant text-sm font-semibold text-on-surface hover:bg-surface-container-low transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1"
            >
              Next
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        )}

        <button
          onClick={handleMarkComplete}
          className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
        >
          Mark as Complete
        </button>
      </div>
    )
  }

  // ==================== REVIEW ====================
  if (view === VIEWS.REVIEW && dayData) {
    const questions = dayData.questions?.slice(0, 3) || []
    if (questions.length === 0) {
      return <div className="h-full flex items-center justify-center p-4 text-on-surface-variant text-sm">No review questions available.</div>
    }
    return (
      <div>
        <div className="px-4 md:px-8 pt-4">
          <button onClick={handleBackToDashboard} className="text-xs text-primary font-medium hover:underline cursor-pointer flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>
            Back to course
          </button>
        </div>
        <QuestionFlow
          questions={questions}
          questionIndex={qIndex}
          selected={selected}
          revealed={revealed}
          handleSelect={handleSelect}
          handleNext={handleNext}
        />
      </div>
    )
  }

  // ==================== REWARD ====================
  if (view === VIEWS.REWARD && reviewResult) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-surface border border-outline-variant rounded-xl p-6 md:p-8 shadow-sm text-center max-w-md w-full">
          <div className="text-5xl mb-3">📝</div>
          <h2 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface mb-1">Review Complete!</h2>
          <p className="text-sm text-on-surface-variant mb-4">
            You scored {reviewResult.score}/{reviewResult.total} on this review
          </p>
          <div className="bg-surface-container-low rounded-xl p-4 mb-4">
            <p className="text-xs text-on-surface-variant mb-1">Daily Raw Score</p>
            <p className="text-lg font-bold text-primary">{courseProgress?.dailyRawScore || 0} points</p>
          </div>
          {reviewResult.steakChanged && reviewResult.newSteak > 0 && (
            <div className="flex items-center justify-center gap-1 text-orange-500 mb-4">
              <span className="material-symbols-outlined text-[20px]" style={{fontVariationSettings: "'FILL' 1"}}>local_fire_department</span>
              <span className="font-bold text-sm">{reviewResult.newSteak} day streak!</span>
            </div>
          )}
          <button
            onClick={handleBackToDashboard}
            className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  // ==================== EXAM ====================
  if (view === VIEWS.EXAM && examQuestions.length > 0) {
    const examQ = examQuestions.length > 30 ? examQuestions.slice(0, 30) : examQuestions
    return (
      <div>
        <div className="px-4 md:px-8 pt-4">
          <button onClick={handleBackToDashboard} className="text-xs text-primary font-medium hover:underline cursor-pointer flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>
            Back to course
          </button>
        </div>
        <QuestionFlow
          questions={examQ}
          questionIndex={qIndex}
          selected={selected}
          revealed={revealed}
          handleSelect={handleSelect}
          handleNext={handleNext}
        />
      </div>
    )
  }

  // ==================== EXAM RESULT ====================
  if (view === VIEWS.EXAM_RESULT && examResult) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-surface border border-outline-variant rounded-xl p-6 md:p-8 shadow-sm max-w-md w-full">
          <div className="text-center mb-5">
            <div className={`text-5xl mb-2 ${examResult.passed ? '' : 'opacity-60'}`}>
              {examResult.passed ? '🎉' : '😔'}
            </div>
            <h2 className={`font-['Hanken_Grotesk'] text-2xl font-bold ${examResult.passed ? 'text-success' : 'text-error'}`}>
              {examResult.passed ? 'Congratulations!' : 'Not this time'}
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              {examResult.passed ? 'You passed the course!' : 'You did not pass this attempt.'}
            </p>
            {examResult.passed && (
              <p className="text-xs text-success font-medium mt-1">Certificate issued</p>
            )}
          </div>

          <div className="space-y-3 mb-5">
            <div className="flex justify-between items-center py-2 border-b border-outline-variant/50">
              <span className="text-sm text-on-surface-variant">Daily Score Contribution</span>
              <span className="text-sm font-semibold text-on-surface">{Math.round(examResult.dailyPortion)} / 40</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-outline-variant/50">
              <span className="text-sm text-on-surface-variant">Exam Score ({examResult.examCorrect}/{examResult.total})</span>
              <span className="text-sm font-semibold text-on-surface">{examResult.examRaw} / 60</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-semibold text-on-surface">Final Score</span>
              <span className={`text-lg font-bold ${examResult.passed ? 'text-success' : 'text-error'}`}>
                {examResult.finalScore}%
              </span>
            </div>
            <div className="text-center">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                examResult.passed ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
              }`}>
                {examResult.passed ? 'PASSED' : 'FAILED'} · Minimum 60%
              </span>
            </div>
          </div>

          <button
            onClick={handleBackToDashboard}
            className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
          >
            Back to Course
          </button>
        </div>
      </div>
    )
  }

  // ==================== DASHBOARD ====================
  const phase = getCoursePhase(courseProgress, courseContent.length, isModerator)
  const vis = getSteakVisual(courseProgress?.currentSteak || 0)
  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-4">
        <button onClick={handleBackToCatalog} className="text-xs text-primary font-medium hover:underline cursor-pointer flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">arrow_back</span>
          All courses
        </button>
      </div>

      {/* Steak Hero */}
      <div className={`bg-gradient-to-br ${vis.color} rounded-xl p-5 md:p-6 text-white shadow-sm mb-4`}>
        <div className="flex items-center gap-4">
          <div className="text-5xl">{vis.emoji}</div>
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wider opacity-80">Steak Level</p>
            <h2 className="font-['Hanken_Grotesk'] text-xl md:text-2xl font-bold">{vis.label}</h2>
            <p className="text-sm mt-1 opacity-90">{vis.desc}</p>
            {courseProgress?.currentSteak > 0 && (
              <div className="flex items-center gap-1 mt-2 bg-white/20 rounded-full px-3 py-1 inline-flex">
                <span className="material-symbols-outlined text-[16px]" style={{fontVariationSettings: "'FILL' 1"}}>local_fire_department</span>
                <span className="text-sm font-bold">{courseProgress.currentSteak} day streak</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Course Info */}
      <div className="bg-surface border border-outline-variant rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-on-surface">{courseContent.find(c => c.day === 1)?.courseTitle || courseId}</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {courseProgress?.completedDays?.length || 0}/{courseContent.length} days completed
              {courseProgress?.dailyRawScore > 0 && (
                <span className="ml-2">· {courseProgress.dailyRawScore} daily pts</span>
              )}
            </p>
          </div>
          {phase?.phase === 'EXAM_AVAILABLE' && phase.windowEndsAt && (
            <div className="text-right">
              <p className="text-[10px] text-warning font-semibold">
                Exam window ends {new Date(phase.windowEndsAt + 'T23:59:59').toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </div>
      {isModerator && (
        <div className="bg-primary-fixed/20 border border-primary/30 rounded-xl px-4 py-3 mb-4 text-xs text-primary font-medium flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">visibility</span>
          All days unlocked (Moderator)
        </div>
      )}

      {/* Day Grid */}
      <div className="bg-surface border border-outline-variant rounded-xl p-4 mb-4">
        <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Course Progress</p>
        <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
          {Array.from({ length: courseContent.length }, (_, i) => i + 1).map((day) => {
            const conceptId = `day_${String(day).padStart(2, '0')}`
            const dayState = courseProgress?.dayStates?.[conceptId]
            const completed = courseProgress?.completedDays?.includes(conceptId)
            const reviewed = courseProgress?.reviewedDays?.includes(conceptId)
            const isActiveDay = phase?.day === day
            const isLocked = !isModerator && day > (courseProgress?.unlockedDay || 1)

            let cls = 'bg-surface-container-low text-on-surface-variant'
            let icon = String(day)
            if (completed && day === courseContent.length) {
              cls = 'bg-success text-white'
              icon = '🏁'
            } else if (completed && reviewed) {
              cls = 'bg-success/70 text-white'
              icon = '✓'
            } else if (completed && !reviewed && day < courseContent.length) {
              cls = 'bg-primary text-white'
              icon = '📋'
            } else if (isLocked) {
              cls = 'bg-outline-variant/30 text-on-surface-variant/40'
              icon = '🔒'
            } else if (isActiveDay) {
              cls = 'bg-primary text-white ring-2 ring-primary ring-offset-1'
            }
            if (isActiveDay && !completed) {
              cls = 'bg-primary text-white ring-2 ring-primary ring-offset-1'
            }

            const TileTag = isModerator && !isLocked ? 'button' : 'div'

            return (
              <TileTag
                key={day}
                onClick={isModerator && !isLocked ? () => handleStartReading(day) : undefined}
                className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all ${cls} ${isModerator && !isLocked ? 'hover:opacity-80 active:scale-[0.95] cursor-pointer' : ''}`}
                title={`Day ${day}${completed ? ' ✅' : isLocked ? ' 🔒' : ''}`}
              >
                {icon}
              </TileTag>
            )
          })}
        </div>
      </div>

      {/* CTA based on phase */}
      {phase?.phase === 'READ_AND_COMPLETE' && phase.day && (
        <button
          onClick={() => handleStartReading(phase.day)}
          className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">menu_book</span>
          Read Day {phase.day}
        </button>
      )}

      {phase?.phase === 'REVIEW' && phase.day && (
        <button
          onClick={() => handleStartReview(phase.day)}
          className="w-full bg-secondary text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">quiz</span>
          Review Day {phase.day}
        </button>
      )}

      {phase?.phase === 'REVIEW_LOCKED' && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-5 text-center">
          <span className="material-symbols-outlined text-warning text-[36px]">lock_clock</span>
          <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface mt-1">Review Locked</h3>
          <p className="text-xs text-on-surface-variant mt-1">You already completed a review today. Come back tomorrow!</p>
        </div>
      )}

      {phase?.phase === 'EXAM_AVAILABLE' && (
        <div className="bg-primary-fixed/20 border border-primary/30 rounded-xl p-5 text-center">
          <span className="material-symbols-outlined text-primary text-[36px]">assignment</span>
          <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface mt-1">Final Exam Available</h3>
          {phase.windowEndsAt && (
            <p className="text-xs text-warning font-semibold mt-1">
              Window closes {new Date(phase.windowEndsAt + 'T23:59:59').toLocaleDateString()}
            </p>
          )}
          <p className="text-xs text-on-surface-variant mt-1">30 questions covering all material. 60% to pass.</p>
          <button
            onClick={handleStartExam}
            className="mt-4 bg-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
          >
            Take Final Exam
          </button>
        </div>
      )}

      {phase?.phase === 'PASSED' && (
        <div className="bg-success/10 border border-success/20 rounded-xl p-5 text-center">
          <span className="material-symbols-outlined text-success text-[36px]">verified</span>
          <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface mt-1">Course Passed!</h3>
          <p className="text-xs text-on-surface-variant mt-1">Final score: {courseProgress?.examResult?.finalScore}%</p>
          <button className="mt-3 bg-success text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-all cursor-pointer shadow-sm flex items-center gap-2 mx-auto">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Download Certificate
          </button>
        </div>
      )}

      {phase?.phase === 'FAILED' && (
        <div className="bg-error/10 border border-error/20 rounded-xl p-5 text-center">
          <span className="material-symbols-outlined text-error text-[36px]">cancel</span>
          <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface mt-1">Course Not Passed</h3>
          <p className="text-xs text-on-surface-variant mt-1">Final score: {courseProgress?.examResult?.finalScore}% — minimum 60% required.</p>
        </div>
      )}

      {phase?.phase === 'EXPIRED' && (
        <div className="bg-error/10 border border-error/20 rounded-xl p-5 text-center">
          <span className="material-symbols-outlined text-error text-[36px]">timer_off</span>
          <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface mt-1">Exam Window Expired</h3>
          <p className="text-xs text-on-surface-variant mt-1">The 7-day window to take the final exam has closed.</p>
        </div>
      )}

      {phase?.phase === 'ALL_DONE' && (
        <div className="bg-success/10 border border-success/20 rounded-xl p-5 text-center">
          <span className="material-symbols-outlined text-success text-[36px]">celebration</span>
          <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface mt-1">All Days Complete!</h3>
          <p className="text-xs text-on-surface-variant mt-1">All {courseContent.length} days completed.</p>
        </div>
      )}

      {phase?.phase === 'LOCKED' && (
        <div className="bg-outline-variant/20 border border-outline-variant/50 rounded-xl p-5 text-center">
          <span className="material-symbols-outlined text-on-surface-variant text-[36px]">lock</span>
          <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface mt-1">Day Locked</h3>
          <p className="text-xs text-on-surface-variant mt-1">Complete the previous day's review to unlock this content.</p>
        </div>
      )}

      {!phase && (
        <div className="text-center py-8 text-on-surface-variant text-sm">
          No content available.
        </div>
      )}
    </div>
  )
}