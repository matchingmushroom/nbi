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
  },
}

export async function getQuizSettings() {
  const cached = getCached('quizSettings')
  if (cached) return cached
  const ref = doc(db, 'config', 'quizSettings')
  const snap = await getDoc(ref)
  const data = snap.exists() ? { ...DEFAULTS, ...snap.data() } : DEFAULTS
  setCache('quizSettings', data)
  return data
}

export async function saveQuizSettings(data) {
  const ref = doc(db, 'config', 'quizSettings')
  await setDoc(ref, data, { merge: true })
  invalidateCache('quizSettings')
}

export function getDifficultySplit(total, type) {
  if (type === 'mode') {
    const beginner = Math.round(total * 0.3)
    const intermediate = Math.round(total * 0.3)
    const expert = total - beginner - intermediate
    return { beginner, intermediate, expert }
  }
  if (type === 'final') {
    const beginner = Math.round(total * 0.05)
    const intermediate = Math.round(total * 0.1)
    const expert = total - beginner - intermediate
    return { beginner, intermediate, expert }
  }
  const beginner = Math.round(total * 0.2)
  const intermediate = Math.round(total * 0.4)
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
  return access[profile.role] === true
}
