import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { calcQuizXP, updateGamification } from '../lib/gamification'
import { invalidateCache, invalidateCachePrefix } from '../lib/cache'
import QuestionCard from './QuestionCard'
import Timer from './Timer'
import ConfettiEffect from './ConfettiEffect'
import { useSound } from '../hooks/useSound'

export default function QuizRunner({ questions, config, onFinish }) {
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState([])
  const [finished, setFinished] = useState(false)
  const [score, setScore] = useState(0)
  const [timeUp, setTimeUp] = useState(false)
  const [gamify, setGamify] = useState(null)
  const [combo, setCombo] = useState(0)
  const [displayScore, setDisplayScore] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const { enabled: soundEnabled, toggle: toggleSound, playCorrect, playWrong, playLevelUp } = useSound()
  const startTime = useRef(Date.now())
  const scoreRef = useRef(0)
  const resultIdRef = useRef(null)
  const comboRef = useRef(0)
  const animStarted = useRef(false)

  const saveResult = useCallback(async (finalAnswers, finalScore) => {
    const timeTaken = Math.round((Date.now() - startTime.current) / 1000)
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
      resultIdRef.current = docRef.id
      const uid = profile?.uid || user?.uid
      if (uid) {
        const g = await updateGamification(uid, { ...result, id: docRef.id }, questions)
        if (g) setGamify(g)
        await refreshProfile()
      }
      invalidateCache('allResults')
      if (uid) invalidateCachePrefix('results_' + uid)
    } catch (e) {
      console.error('Failed to save result:', e)
    }
    onFinish?.(finalScore, questions.length)
  }, [profile, user, config, questions, onFinish, refreshProfile])

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

    if (result.isCorrect) {
      comboRef.current += 1
      playCorrect()
    } else {
      comboRef.current = 0
      playWrong()
    }
    setCombo(comboRef.current)

    if (current + 1 >= questions.length) {
      setFinished(true)
      await saveResult(newAnswers, newScore)
    } else {
      setCurrent((c) => c + 1)
    }
  }

  useEffect(() => {
    if (!finished || animStarted.current) return
    animStarted.current = true
    const target = score
    if (target === 0) { setDisplayScore(0); return }
    const duration = 1000
    const startTime = performance.now()
    const animate = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayScore(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [finished])

  useEffect(() => {
    if (!gamify) return
    if (gamify.leveledUp) { setShowConfetti(true); playLevelUp() }
    try {
      sessionStorage.setItem('nbi_quiz_done', JSON.stringify({
        xpEarned: gamify.xpEarned,
        leveledUp: gamify.leveledUp,
        newLevel: gamify.level,
        newBadges: gamify.newBadges || [],
        score,
        total: questions.length,
      }))
    } catch {}
  }, [gamify])

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
    const isPerfect = score === totalQ
    if (isPerfect) setTimeout(() => setShowConfetti(true), 300)
    return (
      <div className="h-full flex items-center justify-center p-4">
        <ConfettiEffect active={showConfetti} />
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
          <div className="text-4xl font-extrabold text-primary mb-1">{displayScore}<span className="text-lg text-on-surface-variant">/{totalQ}</span></div>
          <p className="text-xs text-on-surface-variant">{Math.round(pct * 100)}% Accuracy</p>

          {/* Gamification */}
          {gamify && (
            <div className="mt-4 pt-4 border-t border-outline-variant space-y-3">
              <div className="flex items-center justify-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-warning text-[18px]">stars</span>
                  <span className="font-bold text-on-surface">+{gamify.xpEarned} XP</span>
                  {gamify.badgeXpBonus > 0 && <span className="text-[10px] text-on-surface-variant">(incl. {gamify.badgeXpBonus} badge bonus)</span>}
                </div>
                {gamify.streak > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-orange-500 text-[18px]" style={{fontVariationSettings: "'FILL' 1"}}>local_fire_department</span>
                    <span className="font-bold text-on-surface">{gamify.streak} day streak</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-on-surface-variant font-medium">Lv.{gamify.level}</span>
                <div className="w-24 h-2 bg-surface-container-low rounded-full overflow-hidden">
                  <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${gamify.progress}%` }} />
                </div>
              </div>
              {gamify.leveledUp && (
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-2 animate-pulse">
                  <p className="text-xs font-bold text-warning flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                    LEVEL UP! You're now Level {gamify.level}
                  </p>
                </div>
              )}
              {gamify.newBadges?.length > 0 && (
                <div className="space-y-1.5">
                  {gamify.newBadges.map((b) => (
                    <div key={b.id} className="bg-primary-fixed/20 border border-primary/20 rounded-lg p-2 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px]" style={{fontVariationSettings: "'FILL' 1"}}>{b.icon}</span>
                      <div className="text-left">
                        <p className="text-xs font-bold text-primary">{b.name}</p>
                        <p className="text-[10px] text-on-surface-variant">{b.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-4">
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
      <ConfettiEffect active={showConfetti} />
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div>
          <h2 className="font-['Hanken_Grotesk'] text-sm md:text-base font-bold text-on-surface leading-tight">{config.title}</h2>
          <p className="text-[10px] text-on-surface-variant">{questions.length} Qs · {config.subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {combo >= 2 && (
            <div className="flex items-center gap-0.5 bg-orange-100 text-orange-600 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold animate-combo-bounce">
              <span className="material-symbols-outlined text-[12px] sm:text-[14px]" style={{fontVariationSettings: "'FILL' 1"}}>local_fire_department</span>
              <span className="hidden xs:inline">x</span>{combo}
            </div>
          )}
          <button onClick={toggleSound} className="p-1 rounded-full hover:bg-surface-container-low transition-colors cursor-pointer text-on-surface-variant" title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}>
            <span className="material-symbols-outlined text-[18px]">{soundEnabled ? 'volume_up' : 'volume_off'}</span>
          </button>
          <Timer minutes={config.timerMinutes} onTimeUp={handleTimeUp} />
        </div>
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
