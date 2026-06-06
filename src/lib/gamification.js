import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'

export const QUIZ_XP_BASE = {
  chapter: 10,
  module: 15,
  mode: 20,
  final: 25,
}

export const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0 },
  { level: 2, xp: 100 },
  { level: 3, xp: 250 },
  { level: 4, xp: 500 },
  { level: 5, xp: 1000 },
  { level: 6, xp: 2000 },
  { level: 7, xp: 3500 },
  { level: 8, xp: 5500 },
  { level: 9, xp: 8000 },
  { level: 10, xp: 11000 },
  { level: 11, xp: 15000 },
  { level: 12, xp: 20000 },
]

export const BADGES = [
  { id: 'first_quiz', name: 'First Step', icon: 'rocket_launch', desc: 'Complete your first quiz' },
  { id: 'perfect_score', name: 'Perfect Score', icon: 'stars', desc: 'Score 100% on any quiz' },
  { id: 'speed_demon', name: 'Speed Demon', icon: 'bolt', desc: 'Finish a quiz in under half the time limit' },
  { id: 'marathon', name: 'Marathon', icon: 'directions_run', desc: 'Complete 10 quizzes' },
  { id: 'bookworm', name: 'Bookworm', icon: 'book', desc: 'Complete 5 Book mode quizzes' },
  { id: 'physical', name: 'Physical Training', icon: 'fitness_center', desc: 'Complete 5 Physical mode quizzes' },
  { id: 'final_boss', name: 'Final Boss', icon: 'military_tech', desc: 'Complete the Final Mock Test' },
  { id: 'streak_7', name: 'Streak Master', icon: 'local_fire_department', desc: 'Maintain a 7-day streak' },
  { id: 'all_rounder', name: 'All-Rounder', icon: 'dashboard', desc: 'Take one quiz of each type' },
  { id: 'champion', name: 'Champion', icon: 'emoji_events', desc: 'Score 100% on the Final Mock Test' },
  { id: 'level_5', name: 'Rising Star', icon: 'trending_up', desc: 'Reach level 5' },
  { id: 'level_10', name: 'Legend', icon: 'verified', desc: 'Reach level 10' },
]

export function getLevel(xp) {
  let level = 1
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i].xp) {
      level = LEVEL_THRESHOLDS[i].level
      break
    }
  }
  return level
}

export function getLevelProgress(xp) {
  const current = getLevel(xp)
  const currentThreshold = LEVEL_THRESHOLDS.find(l => l.level === current)
  const nextThreshold = LEVEL_THRESHOLDS.find(l => l.level === current + 1)
  if (!nextThreshold) return 100
  const progress = ((xp - currentThreshold.xp) / (nextThreshold.xp - currentThreshold.xp)) * 100
  return Math.min(Math.round(progress), 100)
}

export function getXPForNextLevel(xp) {
  const current = getLevel(xp)
  const next = LEVEL_THRESHOLDS.find(l => l.level === current + 1)
  return next ? next.xp - xp : 0
}

function getToday() {
  return new Date().toISOString().split('T')[0]
}

function getYesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

export function updateStreak(userData) {
  const today = getToday()
  const lastActive = userData.lastActiveDate || ''
  let streak = userData.streak || 0
  if (lastActive === today) {
  } else if (lastActive === getYesterday()) {
    streak += 1
  } else {
    streak = 1
  }
  return { streak, lastActiveDate: today }
}

export function getStreakMultiplier(streak) {
  if (streak >= 14) return 2.5
  if (streak >= 7) return 2
  if (streak >= 3) return 1.5
  return 1
}

export function calcQuizXP(quizType, score, answers, questions) {
  const base = QUIZ_XP_BASE[quizType] || 10
  let xp = score * base
  if (answers && questions) {
    const expertBonus = answers.reduce((sum, a, i) => {
      if (a.isCorrect && questions[i]?.difficulty === 'Expert') return sum + 1
      return sum
    }, 0)
    xp += expertBonus
  }
  return xp
}

export function checkBadges(userData, allResults) {
  const owned = new Set(userData.badges || [])
  const results = allResults || []
  const newBadges = []

  const checks = {
    first_quiz: results.length >= 1,
    perfect_score: results.some(r => r.percentage === 100),
    speed_demon: results.some(r => r.timeTaken && r.totalQuestions && r.timeTaken < r.totalQuestions * 30),
    marathon: results.length >= 10,
    bookworm: results.filter(r => r.quizType === 'mode' && r.mode === 'Book').length >= 5,
    physical: results.filter(r => r.quizType === 'mode' && r.mode === 'Physical').length >= 5,
    final_boss: results.some(r => r.quizType === 'final'),
    streak_7: (userData.streak || 0) >= 7,
    all_rounder: (() => {
      const types = new Set(results.map(r => r.quizType))
      return types.has('chapter') && types.has('module') && types.has('mode') && types.has('final')
    })(),
    champion: results.some(r => r.quizType === 'final' && r.percentage === 100),
    level_5: getLevel(userData.xp || 0) >= 5,
    level_10: getLevel(userData.xp || 0) >= 10,
  }

  for (const badge of BADGES) {
    if (!owned.has(badge.id) && checks[badge.id]) {
      newBadges.push(badge)
    }
  }

  return newBadges
}

export async function updateGamification(userId, quizResult, quizQuestions) {
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  if (!userSnap.exists()) return null
  const userData = userSnap.data()

  const today = getToday()
  const lastActive = userData.lastActiveDate || ''
  let streak = userData.streak || 0
  if (lastActive === today) {
  } else if (lastActive === getYesterday()) {
    streak += 1
  } else {
    streak = 1
  }

  const xpEarned = calcQuizXP(quizResult.quizType, quizResult.score, quizResult.answers, quizQuestions)
  const newXp = (userData.xp || 0) + xpEarned
  const newLevel = getLevel(newXp)
  const oldLevel = getLevel(userData.xp || 0)
  const leveledUp = newLevel > oldLevel

  const resultsSnap = await getDocs(query(
    collection(db, 'results'),
    where('userId', '==', userId)
  ))
  const allResults = resultsSnap.docs.map(d => d.data())
  allResults.push(quizResult)

  const newBadges = checkBadges({ ...userData, xp: newXp, streak, lastActiveDate: today }, allResults)
  const allBadges = [...(userData.badges || []), ...newBadges.map(b => b.id)]

  await setDoc(userRef, {
    xp: newXp,
    level: newLevel,
    streak,
    lastActiveDate: today,
    badges: allBadges,
  }, { merge: true })

  return {
    xpEarned,
    totalXp: newXp,
    level: newLevel,
    leveledUp,
    streak,
    newBadges,
    progress: getLevelProgress(newXp),
    xpToNext: getXPForNextLevel(newXp),
  }
}
