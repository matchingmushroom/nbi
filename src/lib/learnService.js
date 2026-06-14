import { collection, getDocs, doc, getDoc, setDoc, updateDoc, query, where, arrayUnion, increment } from 'firebase/firestore'
import { db } from './firebase'
import { invalidateCache } from './cache'

export async function getCourseDays(courseId) {
  const q = query(collection(db, 'micro_learning'), where('courseId', '==', courseId))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.day - b.day)
}

export async function getCertificationQuestions(courseId, courseTitle) {
  let data = []
  const qCol = collection(db, 'questions')

  try {
    const settingsSnap = await getDoc(doc(db, 'config', 'quizSettings'))
    if (settingsSnap.exists()) {
      const linked = settingsSnap.data().courseLinkedQuizzes?.[courseId] || []
      for (const link of linked) {
        // try mode field first (most common), then module field
        let found = false
        try {
          const snap = await getDocs(query(qCol, where('mode', '==', link.mode), where('chapter', '==', link.chapter)))
          if (!snap.empty) { snap.docs.forEach((d) => data.push({ id: d.id, ...d.data() })); found = true }
        } catch (_) {}
        if (!found) {
          try {
            const snap = await getDocs(query(qCol, where('module', '==', link.mode), where('chapter', '==', link.chapter)))
            if (!snap.empty) { snap.docs.forEach((d) => data.push({ id: d.id, ...d.data() })); found = true }
          } catch (_) {}
        }
      }
    }
  } catch (_) {}

  if (data.length === 0) {
    try {
      const snap = await getDocs(query(qCol, where('mode', '==', 'Certification')))
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      data = all.filter((q) => q.chapter === courseId || q.chapter === courseTitle)
    } catch (_) {}
  }

  return data.sort(() => Math.random() - 0.5)
}

export async function enrollInCourse(userId, courseId) {
  const ref = doc(db, 'users', userId)
  await setDoc(ref, {
    [`learning.enrolledCourses.${courseId}`]: {
      enrolledAt: new Date().toISOString().split('T')[0],
      readDays: [],
      reviewedDays: [],
      unlockedDay: 1,
      dailyReviewRaw: 0,
      courseStatus: 'ENROLLED',
      certificationWindowEndsAt: null,
      certAttempts: 0,
      certNextAttemptAt: null,
    }
  }, { merge: true })
  invalidateCache('allUsers')
}

export async function markDayRead(userId, courseId, day, totalDays) {
  const ref = doc(db, 'users', userId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return { error: 'User not found' }
  const learning = snap.data().learning || {}
  let course = (learning.enrolledCourses || {})[courseId]

  // Bootstrap enrollment if missing (defense-in-depth against write-path issues)
  if (!course) {
    course = {
      enrolledAt: new Date().toISOString().split('T')[0],
      readDays: [],
      reviewedDays: [],
      unlockedDay: 1,
      dailyReviewRaw: 0,
      courseStatus: 'ENROLLED',
    }
  }

  const conceptId = `day_${String(day).padStart(2, '0')}`
  if (course.readDays?.includes(conceptId)) return { error: 'Already read' }

  const newReadDays = [...(course.readDays || []), conceptId]
  course.readDays = newReadDays
  course.unlockedDay = Math.max(course.unlockedDay || 1, day + 1)

  if (newReadDays.length >= totalDays) {
    course.courseStatus = 'LESSONS_COMPLETED'
    if (!course.certificationWindowEndsAt) {
      course.certificationWindowEndsAt = new Date(Date.now() + 604800000).toISOString()
    }
  }

  await setDoc(ref, {
    [`learning.enrolledCourses.${courseId}`]: course,
  }, { merge: true })
  invalidateCache('allUsers')
  return { success: true, conceptId }
}

export async function submitReview(userId, courseId, prevDay) {
  const ref = doc(db, 'users', userId)
  const conceptId = `day_${String(prevDay).padStart(2, '0')}`
  try {
    await updateDoc(ref, {
      [`learning.enrolledCourses.${courseId}.reviewedDays`]: arrayUnion(conceptId),
    })
  } catch {
    return { error: 'Not enrolled' }
  }
  invalidateCache('allUsers')
  return { success: true, conceptId }
}

export async function accumulateReviewScore(userId, courseId, score) {
  const ref = doc(db, 'users', userId)
  try {
    await updateDoc(ref, {
      [`learning.enrolledCourses.${courseId}.dailyReviewRaw`]: increment(score),
      [`learning.enrolledCourses.${courseId}.lastReviewDate`]: new Date().toISOString().split('T')[0],
    })
  } catch {
    return { error: 'Not enrolled' }
  }
  invalidateCache('allUsers')
  return { success: true }
}

export function getLearningProgress(learning, courseId) {
  if (!learning?.enrolledCourses?.[courseId]) return null
  return learning.enrolledCourses[courseId]
}

export function getCourseScore(progress, totalDays) {
  if (!progress) return { dailyRaw: 0, dailyMax: 0, dailyPct: 0, finalRaw: 0, finalMax: 80, finalPct: 0, overall: 0, overallMax: 100 }
  const dailyMax = 3 * Math.max(0, totalDays - 1)
  const dailyRaw = Math.min(progress.dailyReviewRaw || 0, dailyMax)
  const dailyPct = dailyMax > 0 ? Math.round((dailyRaw / dailyMax) * 100) : 0
  const finalRaw = Math.min(progress.finalExamRaw || 0, 80)
  const finalPct = Math.round((finalRaw / 80) * 100)
  const overall = dailyMax > 0 ? Math.round((dailyRaw / dailyMax) * 20 + finalRaw) : finalRaw
  return { dailyRaw, dailyMax, dailyPct, finalRaw, finalMax: 80, finalPct, overall, overallMax: 100 }
}

export function isFullyComplete(day, readDays, reviewedDays, totalDays, courseStatus) {
  const conceptId = `day_${String(day).padStart(2, '0')}`
  if (!readDays?.includes(conceptId)) return false
  if (day === totalDays) return courseStatus === 'LESSONS_COMPLETED' || courseStatus === 'CERTIFIED'
  if (day === 1) return true
  const prevConceptId = `day_${String(day - 1).padStart(2, '0')}`
  return reviewedDays?.includes(prevConceptId)
}

export function needsReview(day, readDays, reviewedDays) {
  if (day <= 1) return false
  const prevConceptId = `day_${String(day - 1).padStart(2, '0')}`
  return readDays?.includes(prevConceptId) && !reviewedDays?.includes(prevConceptId)
}
