import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import { getCached, setCache, invalidateCache } from './cache'

const DEFAULTS = {
  chapterQuestionCount: 10,
  moduleQuestionCount: 20,
  modeQuestionCount: 50,
  finalQuestionCount: 100,
  chapterTimerMinutes: 10,
  moduleTimerMinutes: 30,
  modeTimerMinutes: 50,
  finalTimerMinutes: 100,
  chapterAttemptLimit: 0,
  moduleAttemptLimit: 0,
  modeAttemptLimit: 0,
  finalAttemptLimit: 0,
  chapterLinkedCourse: '',
  moduleLinkedCourse: '',
  modeLinkedCourse: '',
  finalLinkedCourse: '',
  certificationQuestionCount: 20,
  certificationTimerMinutes: 30,
  contestQuestionCount: 10,
  contestTimerMinutes: 10,
  certificationAttemptLimit: 0,
  courseLinkedQuizzes: {},
  preassessmentQuestionCount: 20,
  preassessmentTimerMinutes: 30,
  bypassDailyLearningLock: false,
  premiumCourses: [],
  premiumQuizChapters: [],
  studentEnrollmentLimit: 2,
  studentxEnrollmentLimit: 5,
  quizAccess: {
    chapter: { student: true, studentx: true, moderator: true, admin: true },
    module: { student: true, studentx: true, moderator: true, admin: true },
    mode: { student: true, studentx: true, moderator: true, admin: true },
    final: { student: true, studentx: true, moderator: true, admin: true },
    preassessment: { student: true, studentx: true, moderator: true, admin: true },
    certification: { student: true, studentx: true, moderator: true, admin: true },
    mockTest: { student: false, studentx: true, moderator: true, admin: true },
  },
  moduleAccess: {
    "Mock Test": { student: false, studentx: true, moderator: true, admin: true },
  },
  navAccess: {
    home: { student: true, studentx: true, moderator: true, admin: true },
    learn: { student: true, studentx: true, moderator: true, admin: true },
    exam: { student: true, studentx: true, moderator: true, admin: true },
    contest: { student: true, studentx: true, moderator: true, admin: true },
    rank: { student: true, studentx: true, moderator: true, admin: true },
    profile: { student: true, studentx: true, moderator: true, admin: true },
    users: { student: false, studentx: false, moderator: false, admin: true },
    questions: { student: false, studentx: false, moderator: true, admin: true },
    courses: { student: false, studentx: false, moderator: true, admin: true },
    settings: { student: false, studentx: false, moderator: false, admin: true },
    analytics: { student: false, studentx: false, moderator: false, admin: true },
  },
}

export async function getQuizSettings() {
  const cached = getCached('quizSettings')
  if (cached) return cached
  const ref = doc(db, 'config', 'quizSettings')
  const snap = await getDoc(ref)
  const data = snap.exists() ? { ...DEFAULTS, ...snap.data() } : DEFAULTS
  if (snap.exists()) {
    // Deep merge moduleAccess: per-module defaults preserved when saved data has partial entries
    const savedModuleAccess = snap.data().moduleAccess || {}
    data.moduleAccess = {}
    for (const key of new Set([...Object.keys(DEFAULTS.moduleAccess), ...Object.keys(savedModuleAccess)])) {
      data.moduleAccess[key] = { ...(DEFAULTS.moduleAccess[key] || {}), ...(savedModuleAccess[key] || {}) }
    }
    // Deep merge quizAccess: same treatment
    const savedQuizAccess = snap.data().quizAccess || {}
    data.quizAccess = {}
    for (const key of new Set([...Object.keys(DEFAULTS.quizAccess), ...Object.keys(savedQuizAccess)])) {
      data.quizAccess[key] = { ...(DEFAULTS.quizAccess[key] || {}), ...(savedQuizAccess[key] || {}) }
    }
    // Deep merge navAccess
    const savedNavAccess = snap.data().navAccess || {}
    data.navAccess = {}
    for (const key of new Set([...Object.keys(DEFAULTS.navAccess), ...Object.keys(savedNavAccess)])) {
      data.navAccess[key] = { ...(DEFAULTS.navAccess[key] || {}), ...(savedNavAccess[key] || {}) }
    }
  }
  setCache('quizSettings', data, 300000)
  return data
}

export async function saveQuizSettings(data) {
  const ref = doc(db, 'config', 'quizSettings')
  await setDoc(ref, data, { merge: true })
  invalidateCache('quizSettings')
}

export function getDifficultySplit(total, type) {
  if (type === 'final') {
    const beginner = Math.round(total * 0.05)
    const intermediate = Math.round(total * 0.1)
    const expert = total - beginner - intermediate
    return { beginner, intermediate, expert }
  }
  const beginner = Math.round(total * 0.1)
  const intermediate = Math.round(total * 0.2)
  const expert = total - beginner - intermediate
  return { beginner, intermediate, expert }
}

export function getFinalSplit(total) {
  const bookTarget = Math.round(total * 0.6)
  const physicalTarget = total - bookTarget
  const bookSplit = getDifficultySplit(bookTarget, 'final')
  const physicalSplit = getDifficultySplit(physicalTarget, 'final')
  return { bookTarget, physicalTarget, bookSplit, physicalSplit }
}

export function getConfigTimerLabel(quizType, timerMinutes) {
  const labels = {
    chapter: 'Chapter Test',
    module: 'Module Test',
    mode: 'Mode Test',
    final: 'Final Mock Test',
    certification: 'Certification Quiz',
  }
  return `${labels[quizType] || 'Quiz'} · ${timerMinutes} min`
}

export async function getAttemptLimit(profile, quizType) {
  if (!profile?.uid) return -1
  const userSnap = await getDoc(doc(db, 'users', profile.uid))
  const userData = userSnap.data()
  const userLimits = userData?.attemptLimits || {}
  if (userLimits[quizType] !== undefined) return userLimits[quizType]

  const settings = await getQuizSettings()
  const defaultKey = `${quizType}AttemptLimit`
  return settings[defaultKey] ?? 0
}

export async function checkAttemptLimit(profile, quizType) {
  if (profile?.role === 'moderator' || profile?.role === 'admin') return true
  const limit = await getAttemptLimit(profile, quizType)
  if (limit <= 0) return true
  const q = query(
    collection(db, 'results'),
    where('userId', '==', profile.uid),
    where('quizType', '==', quizType)
  )
  const snap = await getDocs(q)
  if (snap.size < limit) return true
  sessionStorage.setItem('nbi_attempt_limit', JSON.stringify({ quizType, limit }))
  return false
}

export function canAccessPremium(profile) {
  return profile?.role === 'studentx' || profile?.role === 'admin' || profile?.role === 'moderator'
}

export function getEnrollmentLimit(profile, settings) {
  if (profile?.role === 'studentx') return settings.studentxEnrollmentLimit || 5
  return settings.studentEnrollmentLimit || 2
}

export function checkQuizAccess(profile, quizType, settings) {
  if (!profile?.role) return false
  const access = settings?.quizAccess?.[quizType]
  if (!access) return true
  return access[profile.role] !== false
}

export function checkModuleAccess(profile, moduleName, settings) {
  if (!profile?.role) return false
  const access = settings?.moduleAccess?.[moduleName]
  if (!access) return true
  return access[profile.role] !== false
}
