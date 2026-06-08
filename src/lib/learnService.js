import { collection, getDocs, doc, getDoc, setDoc, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { getCached, setCache, invalidateCache } from './cache'

export async function getAllCourses() {
  const cached = getCached('learnCourses')
  if (cached) return cached
  const [cs, ms] = await Promise.all([
    getDocs(collection(db, 'courses')),
    getDocs(collection(db, 'micro_learning')),
  ])
  const dayCounts = {}
  ms.docs.forEach((d) => {
    const cid = d.data().courseId
    if (cid) dayCounts[cid] = (dayCounts[cid] || 0) + 1
  })
  const map = {}
  cs.docs.forEach((d) => {
    map[d.id] = { courseId: d.id, ...d.data(), dayCount: dayCounts[d.id] || 0 }
  })
  ms.docs.forEach((d) => {
    const data = d.data()
    if (data.courseId && !map[data.courseId]) {
      map[data.courseId] = {
        courseId: data.courseId,
        courseTitle: data.courseTitle || data.courseId,
        visible: true,
        dayCount: dayCounts[data.courseId] || 0,
      }
    }
  })
  const result = Object.values(map).sort((a, b) => a.courseId.localeCompare(b.courseId))
  setCache('learnCourses', result)
  return result
}

export async function getCourseDays(courseId) {
  const q = query(collection(db, 'micro_learning'), where('courseId', '==', courseId))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.day - b.day)
}

export async function getCertificationQuestions(courseId, courseTitle) {
  let data = []

  // 1. Try direct query: module=Course, mode=Certification, chapter=courseId
  try {
    const snap = await getDocs(query(
      collection(db, 'questions'),
      where('module', '==', 'Course'),
      where('mode', '==', 'Certification'),
      where('chapter', '==', courseId),
    ))
    data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (_) {}

  // 2. Fallback: chapter=courseTitle
  if (data.length === 0 && courseTitle) {
    try {
      const snap = await getDocs(query(
        collection(db, 'questions'),
        where('module', '==', 'Course'),
        where('mode', '==', 'Certification'),
        where('chapter', '==', courseTitle),
      ))
      data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    } catch (_) {}
  }

  // 3. Fallback: use course-linked quizzes from settings
  if (data.length === 0) {
    try {
      const settingsSnap = await getDoc(doc(db, 'config', 'quizSettings'))
      if (settingsSnap.exists()) {
        const linked = settingsSnap.data().courseLinkedQuizzes?.[courseId] || []
        for (const link of linked) {
          const snap = await getDocs(query(
            collection(db, 'questions'),
            where('module', '==', link.mode),
            where('chapter', '==', link.chapter),
          ))
          snap.docs.forEach((d) => data.push({ id: d.id, ...d.data() }))
        }
      }
    } catch (_) {}
  }

  // 4. Last resort: mode=Certification, any chapter matching courseId
  if (data.length === 0) {
    try {
      const snap = await getDocs(query(
        collection(db, 'questions'),
        where('mode', '==', 'Certification'),
        where('chapter', '==', courseId),
      ))
      data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    } catch (_) {}
  }

  return data.sort(() => Math.random() - 0.5)
}

export async function enrollInCourse(userId, courseId) {
  const ref = doc(db, 'users', userId)
  const snap = await getDoc(ref)
  const userData = snap.data()
  const learning = userData?.learning || { enrolledCourses: {} }
  if (learning.enrolledCourses?.[courseId]) return learning

  learning.enrolledCourses[courseId] = {
    enrolledAt: new Date().toISOString().split('T')[0],
    readDays: [],
    reviewedDays: [],
    unlockedDay: 1,
    dailyReviewRaw: 0,
    courseStatus: 'ENROLLED',
    certificationWindowEndsAt: null,
  }
  await setDoc(ref, { learning }, { merge: true })
  invalidateCache('allUsers')
  return learning
}

export async function markDayRead(userId, courseId, day, totalDays) {
  const ref = doc(db, 'users', userId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return { error: 'User not found' }
  const userData = snap.data()
  const learning = userData.learning || { enrolledCourses: {} }
  const course = learning.enrolledCourses?.[courseId]
  if (!course) return { error: 'Not enrolled' }

  const conceptId = `day_${String(day).padStart(2, '0')}`
  if (course.readDays?.includes(conceptId)) return { error: 'Already read' }

  course.readDays = [...new Set([...(course.readDays || []), conceptId])]
  course.unlockedDay = Math.max(course.unlockedDay || 1, day + 1)

  if (course.readDays.length >= totalDays) {
    course.courseStatus = 'LESSONS_COMPLETED'
    if (!course.certificationWindowEndsAt) {
      const end = new Date()
      end.setDate(end.getDate() + 7)
      course.certificationWindowEndsAt = end.toISOString()
    }
  }

  await setDoc(ref, { learning }, { merge: true })
  invalidateCache('allUsers')
  return { success: true, conceptId }
}

export async function submitReview(userId, courseId, prevDay) {
  const ref = doc(db, 'users', userId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return { error: 'User not found' }
  const userData = snap.data()
  const learning = userData.learning || { enrolledCourses: {} }
  const course = learning.enrolledCourses?.[courseId]
  if (!course) return { error: 'Not enrolled' }

  const conceptId = `day_${String(prevDay).padStart(2, '0')}`
  if (course.reviewedDays?.includes(conceptId)) return { error: 'Already reviewed' }

  course.reviewedDays = [...new Set([...(course.reviewedDays || []), conceptId])]

  await setDoc(ref, { learning }, { merge: true })
  invalidateCache('allUsers')
  return { success: true, conceptId }
}

export async function accumulateReviewScore(userId, courseId, score) {
  const ref = doc(db, 'users', userId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return { error: 'User not found' }
  const userData = snap.data()
  const learning = userData.learning || { enrolledCourses: {} }
  const course = learning.enrolledCourses?.[courseId]
  if (!course) return { error: 'Not enrolled' }

  course.dailyReviewRaw = (course.dailyReviewRaw || 0) + score
  course.lastReviewDate = new Date().toISOString().split('T')[0]

  await setDoc(ref, { learning }, { merge: true })
  invalidateCache('allUsers')
  return { success: true, dailyReviewRaw: course.dailyReviewRaw }
}

export function getLearningProgress(learning, courseId) {
  if (!learning?.enrolledCourses?.[courseId]) return null
  return learning.enrolledCourses[courseId]
}

export function getCourseScore(progress, totalDays) {
  if (!progress) return { dailyRaw: 0, dailyMax: 0, dailyPct: 0, finalRaw: 0, finalMax: 60, finalPct: 0, overall: 0, overallMax: 100 }
  const dailyMax = 3 * Math.max(0, totalDays - 1)
  const dailyRaw = progress.dailyReviewRaw || 0
  const dailyPct = dailyMax > 0 ? Math.round((dailyRaw / dailyMax) * 100) : 0
  const finalRaw = progress.finalExamRaw || 0
  const overall = dailyMax > 0 ? Math.round((dailyRaw / dailyMax) * 40 + finalRaw) : finalRaw
  return { dailyRaw, dailyMax, dailyPct, finalRaw, finalMax: 60, finalPct: Math.round((finalRaw / 60) * 100), overall, overallMax: 100 }
}

export function isFullyComplete(day, readDays, reviewedDays, totalDays, courseStatus) {
  const conceptId = `day_${String(day).padStart(2, '0')}`
  if (!readDays?.includes(conceptId)) return false
  if (day === totalDays) return courseStatus === 'LESSONS_COMPLETED' || courseStatus === 'CERTIFIED'
  if (day === 1) return reviewedDays?.includes(conceptId)
  const prevConceptId = `day_${String(day - 1).padStart(2, '0')}`
  return reviewedDays?.includes(prevConceptId)
}

export function needsReview(day, readDays, reviewedDays) {
  if (day <= 1) return false
  const prevConceptId = `day_${String(day - 1).padStart(2, '0')}`
  return readDays?.includes(prevConceptId) && !reviewedDays?.includes(prevConceptId)
}
