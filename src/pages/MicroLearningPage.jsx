import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getAvailableCourses, getCourseContent, getDayContent,
  getLocalLearningProfile, getCourseProgress,
  ensureLearningProfile, enrollCourse, submitQuizResult,
} from '../lib/steakService'
import { getLevelProgress, getXPForNextLevel } from '../lib/gamification'
import { useSound } from '../hooks/useSound'
import CourseCatalog from '../components/CourseCatalog'
import SteakReward from '../components/SteakReward'
import ConfettiEffect from '../components/ConfettiEffect'

const STEAK_VISUALS = [
  { max: 0, label: 'Not Started', emoji: '🥩', color: 'from-gray-300 to-gray-400', desc: 'Begin your learning streak today!' },
  { max: 5, label: 'Raw', emoji: '🥩', color: 'from-red-400 to-red-500', desc: 'Your steak is still raw — keep cooking!' },
  { max: 15, label: 'Medium-Rare', emoji: '🍖', color: 'from-orange-400 to-orange-500', desc: 'Coming along nicely — medium-rare!' },
  { max: 25, label: 'Medium', emoji: '🍖', color: 'from-purple-400 to-purple-500', desc: 'Getting there — solid medium!' },
  { max: 30, label: 'Perfectly Grilled', emoji: '🏆', color: 'from-amber-400 to-yellow-500', desc: 'A perfectly grilled masterpiece!' },
]

const VIEWS = { CATALOG: 'catalog', DASHBOARD: 'dashboard', READING: 'reading', QUIZ: 'quiz', REWARD: 'reward' }

function getSteakVisual(steak) {
  if (steak <= 0) return STEAK_VISUALS[0]
  if (steak <= 5) return STEAK_VISUALS[1]
  if (steak <= 15) return STEAK_VISUALS[2]
  if (steak <= 25) return STEAK_VISUALS[3]
  return STEAK_VISUALS[4]
}

export default function MicroLearningPage() {
  const { profile, updateUserDoc, refreshProfile } = useAuth()
  const { enabled: soundEnabled, toggle: toggleSound, playCorrect, playWrong, playLevelUp } = useSound()

  const [view, setView] = useState(VIEWS.CATALOG)
  const [courses, setCourses] = useState([])
  const [learning, setLearning] = useState(null)
  const [courseId, setCourseId] = useState(null)
  const [courseContent, setCourseContent] = useState([])
  const [courseProgress, setCourseProgress] = useState(null)
  const [loading, setLoading] = useState(true)

  // Current day state
  const [currentDay, setCurrentDay] = useState(null)
  const [dayData, setDayData] = useState(null)

  // Quiz state
  const [quizIndex, setQuizIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [quizAnswers, setQuizAnswers] = useState([])
  const [quizDone, setQuizDone] = useState(false)

  // Result
  const [quizResult, setQuizResult] = useState(null)
  const [showConfetti, setShowConfetti] = useState(false)

  // Load courses + user learning profile
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

  // Load course content when entering a course
  const enterCourse = async (cid) => {
    setCourseId(cid)
    setQuizAnswers([])
    setQuizIndex(0)
    setSelected(null)
    setRevealed(false)
    setQuizDone(false)
    setQuizResult(null)
    setShowConfetti(false)

    const [content, learn] = await Promise.all([
      getCourseContent(cid),
      profile?.uid ? ensureLearningProfile(profile.uid) : Promise.resolve(null),
    ])
    setCourseContent(content)
    setLearning(learn)
    const prog = getCourseProgress(learn, cid)
    setCourseProgress(prog)

    const todayDay = prog ? prog.unlockedDay : 1
    const dayIdx = Math.min(todayDay, content.length)
    setCurrentDay(dayIdx)
    const dd = content.find((c) => c.day === dayIdx)
    setDayData(dd || null)

    setView(VIEWS.DASHBOARD)
  }

  const refreshCourseProgress = async () => {
    if (!courseId || !profile?.uid) return
    const learn = await ensureLearningProfile(profile.uid)
    setLearning(learn)
    const prog = getCourseProgress(learn, courseId)
    setCourseProgress(prog)
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

  const handleStartReading = () => {
    setView(VIEWS.READING)
  }

  const handleStartQuiz = () => {
    setQuizAnswers([])
    setQuizIndex(0)
    setSelected(null)
    setRevealed(false)
    setQuizDone(false)
    setQuizResult(null)
    setView(VIEWS.QUIZ)
  }

  const handleSelect = (idx) => {
    if (revealed) return
    setSelected(idx)
    setRevealed(true)
    const q = dayData.questions[quizIndex]
    const isCorrect = idx === q.correctAnswer
    if (isCorrect) playCorrect()
    else playWrong()
  }

  const handleNextQuestion = () => {
    const q = dayData.questions[quizIndex]
    setQuizAnswers((prev) => [...prev, { ...q, selected }])
    setSelected(null)
    setRevealed(false)
    if (quizIndex + 1 >= dayData.questions.length) {
      setQuizDone(true)
      finishQuiz([...quizAnswers, { ...q, selected }])
    } else {
      setQuizIndex((i) => i + 1)
    }
  }

  const finishQuiz = async (finalAnswers) => {
    if (!profile?.uid || !courseId || !dayData) return
    const answers = finalAnswers.map((a) => a.selected)
    const result = await submitQuizResult(profile.uid, courseId, dayData.day, answers, dayData.questions)
    setQuizResult(result)
    if (result.error) { setView(VIEWS.DASHBOARD); return }
    if (result.passed) {
      if (result.steakChanged) playLevelUp()
      setShowConfetti(true)
      await refreshCourseProgress()
      await refreshProfile()
    }
    setView(VIEWS.REWARD)
  }

  const handleRetry = () => {
    setQuizAnswers([])
    setQuizIndex(0)
    setSelected(null)
    setRevealed(false)
    setQuizDone(false)
    setQuizResult(null)
    setShowConfetti(false)
    setView(VIEWS.QUIZ)
  }

  const handleBackToDashboard = () => {
    setView(VIEWS.DASHBOARD)
    refreshCourseProgress()
  }

  const handleBackToCatalog = () => {
    setCourseId(null)
    setCourseContent([])
    setCourseProgress(null)
    setDayData(null)
    setView(VIEWS.CATALOG)
    load()
  }

  if (loading) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Loading...</p></div>

  // ==================== CATALOG VIEW ====================
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

  // ==================== REWARD VIEW ====================
  if (view === VIEWS.REWARD && quizResult) {
    return (
      <>
        <ConfettiEffect active={showConfetti} />
        <SteakReward
          result={quizResult}
          courseTitle={courseContent.find(c => c.day === currentDay)?.courseTitle || courseId}
          onBack={handleBackToDashboard}
          onRetry={handleRetry}
        />
      </>
    )
  }

  // ==================== QUIZ VIEW ====================
  if (view === VIEWS.QUIZ && dayData) {
    const q = dayData.questions[quizIndex]
    const isCorrect = selected === q?.correctAnswer
    return (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto">
        <div className="mb-4">
          <button onClick={() => setView(VIEWS.READING)} className="text-xs text-primary font-medium hover:underline cursor-pointer flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>
            Back to reading
          </button>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Question {quizIndex + 1} of {dayData.questions.length}
            </span>
            <div className="flex gap-1">
              {dayData.questions.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${quizAnswers[i] ? (quizAnswers[i].selected === quizAnswers[i].correctAnswer ? 'bg-success' : 'bg-error') : i === quizIndex ? 'bg-primary' : 'bg-outline-variant'}`} />
              ))}
            </div>
          </div>
          <p className="text-sm md:text-base text-on-surface font-medium mb-4">{q?.text}</p>
          <div className="space-y-2">
            {q?.options.map((opt, i) => {
              const letters = ['A', 'B', 'C', 'D']
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
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${revealed && i === q.correctAnswer ? 'bg-success text-white' : revealed && i === selected ? 'bg-error text-white' : selected === i ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant'}`}>
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
              onClick={handleNextQuestion}
              className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
            >
              {quizIndex < dayData.questions.length - 1 ? 'Next Question' : 'See Results'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // ==================== READING VIEW ====================
  if (view === VIEWS.READING && dayData) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto">
        <div className="mb-4">
          <button onClick={handleBackToDashboard} className="text-xs text-primary font-medium hover:underline cursor-pointer flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>
            Back to course
          </button>
        </div>
        <div className="bg-surface border border-outline-variant rounded-xl p-5 md:p-6 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold text-primary uppercase tracking-widest bg-primary-fixed px-1.5 py-0.5 rounded">{dayData.category}</span>
            <span className="text-[10px] text-on-surface-variant">{dayData.estimatedReadingTime}</span>
          </div>
          <h1 className="font-['Hanken_Grotesk'] text-xl md:text-2xl font-bold text-on-surface mt-2 mb-1">{dayData.title}</h1>
          <p className="text-[11px] text-on-surface-variant mb-4">Day {dayData.day} · {dayData.courseTitle || courseId}</p>
          <div className="prose prose-sm max-w-none text-on-surface leading-relaxed whitespace-pre-line">
            {dayData.shortExplanation}
          </div>
        </div>
        <button
          onClick={handleStartQuiz}
          className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
        >
          Take the Challenge
        </button>
      </div>
    )
  }

  // ==================== DASHBOARD VIEW ====================
  const vis = getSteakVisual(courseProgress?.currentSteak || 0)
  const dayComplete = courseProgress?.dayStates?.[`day_${String(currentDay).padStart(2, '0')}`]
  const alreadyDoneToday = dayComplete?.state === 'SUCCESS' && dayComplete?.completedDate === new Date().toISOString().split('T')[0]
  const allDone = courseProgress?.completedDays?.length >= courseContent.length
  const todayStr = new Date().toISOString().split('T')[0]
  const nextDayLocked = !alreadyDoneToday && !allDone && courseProgress?.lastCompletedDate === todayStr

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-4">
        <button onClick={handleBackToCatalog} className="text-xs text-primary font-medium hover:underline cursor-pointer flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">arrow_back</span>
          All courses
        </button>
      </div>

      {/* Steak Hero Card */}
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
            <h3 className="font-semibold text-on-surface">{courseContent.find(c => c.day === currentDay)?.courseTitle || courseId}</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {courseProgress?.completedDays?.length || 0}/{courseContent.length} days completed
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-on-surface">Day {currentDay}</p>
            <p className="text-[10px] text-on-surface-variant">{courseContent.find(c => c.day === currentDay)?.estimatedReadingTime || ''}</p>
          </div>
        </div>
      </div>

      {/* Day Grid */}
      <div className="bg-surface border border-outline-variant rounded-xl p-4 mb-4">
        <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Course Progress</p>
        <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
          {Array.from({ length: courseContent.length }, (_, i) => i + 1).map((day) => {
            const conceptId = `day_${String(day).padStart(2, '0')}`
            const state = courseProgress?.dayStates?.[conceptId]
            const isToday = day === currentDay
            const completed = state?.state === 'SUCCESS'
            const failed = state?.state === 'FAIL'
            const locked = day > (courseProgress?.unlockedDay || 1) || (nextDayLocked && day >= (courseProgress?.unlockedDay || 1) && !completed && !failed)
            return (
              <div
                key={day}
                className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                  completed ? 'bg-success text-white' :
                  failed ? 'bg-error text-white' :
                  locked ? 'bg-outline-variant/30 text-on-surface-variant/40' :
                  isToday ? 'bg-primary text-white ring-2 ring-primary ring-offset-1' :
                  'bg-surface-container-low text-on-surface-variant'
                }`}
                title={`Day ${day}${completed ? ' ✅' : failed ? ' ❌' : locked ? ' 🔒' : ''}`}
              >
                {completed ? '✓' : failed ? '✗' : locked ? '🔒' : day}
              </div>
            )
          })}
        </div>
      </div>

      {/* CTA */}
      {allDone ? (
        <div className="bg-success/10 border border-success/20 rounded-xl p-5 text-center">
          <span className="material-symbols-outlined text-success text-[36px]">celebration</span>
          <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface mt-1">Course Complete!</h3>
          <p className="text-xs text-on-surface-variant mt-1">You've finished all {courseContent.length} days. Great job!</p>
        </div>
      ) : alreadyDoneToday || nextDayLocked ? (
        <div className="bg-success/10 border border-success/20 rounded-xl p-5 text-center">
          <span className="material-symbols-outlined text-success text-[36px]">check_circle</span>
          <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface mt-1">Today's Chapter Complete!</h3>
          <p className="text-xs text-on-surface-variant mt-1">Come back tomorrow for Day {currentDay}.</p>
        </div>
      ) : dayComplete?.state === 'FAIL' ? (
        <div className="flex gap-2">
          <button
            onClick={() => { setView(VIEWS.READING) }}
            className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-all cursor-pointer"
          >
            Review & Try Again
          </button>
        </div>
      ) : dayData ? (
        <button
          onClick={handleStartReading}
          className="w-full bg-primary text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">play_arrow</span>
          Start Today's Bite
        </button>
      ) : (
        <div className="text-center py-8 text-on-surface-variant text-sm">
          No content available for this day.
        </div>
      )}
    </div>
  )
}
