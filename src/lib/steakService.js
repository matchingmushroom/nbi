import { collection, getDocs, doc, getDoc, setDoc, query, where, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { getCached, setCache, invalidateCache, invalidateCachePrefix } from './cache'

export async function getAllCourses() {
  const cached = getCached('allCourses')
  if (cached) return cached
  const [coursesSnap, mlSnap] = await Promise.all([
    getDocs(collection(db, 'courses')),
    getDocs(collection(db, 'micro_learning')),
  ])
  const dayCounts = {}
  mlSnap.docs.forEach((d) => {
    const cid = d.data().courseId
    if (cid) dayCounts[cid] = (dayCounts[cid] || 0) + 1
  })
  const courses = {}
  coursesSnap.docs.forEach((d) => {
    const data = d.data()
    courses[d.id] = { courseId: d.id, ...data, dayCount: dayCounts[d.id] || 0 }
  })
  mlSnap.docs.forEach((d) => {
    const data = d.data()
    if (data.courseId && !courses[data.courseId]) {
      courses[data.courseId] = {
        courseId: data.courseId,
        courseTitle: data.courseTitle || data.courseId,
        visible: true,
        dayCount: dayCounts[data.courseId] || 0,
      }
    }
  })
  const result = Object.values(courses).sort((a, b) => a.courseId.localeCompare(b.courseId))
  setCache('allCourses', result)
  return result
}

export async function getAvailableCourses() {
  const all = await getAllCourses()
  return all.filter((c) => c.visible !== false)
}

export async function setCourseVisibility(courseId, visible) {
  const ref = doc(db, 'courses', courseId)
  await setDoc(ref, { courseId, visible }, { merge: true })
  invalidateCachePrefix('allCourses')
}

export async function updateCourseTitle(courseId, newTitle) {
  const mlSnap = await getDocs(query(collection(db, 'micro_learning'), where('courseId', '==', courseId)))
  const batch = writeBatch(db)
  mlSnap.docs.forEach((d) => batch.update(doc(db, 'micro_learning', d.id), { courseTitle: newTitle }))
  batch.set(doc(db, 'courses', courseId), { courseTitle: newTitle }, { merge: true })
  await batch.commit()
  invalidateCachePrefix('allCourses')
}

export async function resetCourseProgress(userId, courseId) {
  const ref = doc(db, 'users', userId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return { error: 'User not found' }
  const userData = snap.data()
  const learning = userData.learning || { enrolledCourses: {}, learningXp: 0 }
  if (!learning.enrolledCourses?.[courseId]) return { error: 'User not enrolled in this course' }

  learning.enrolledCourses[courseId] = {
    enrolledAt: new Date().toISOString().split('T')[0],
    currentSteak: 0,
    highestSteak: 0,
    lastCompletedDate: '',
    unlockedDay: 1,
    completedDays: [],
    dayStates: {},
    reviewedDays: [],
    dailyRawScore: 0,
    courseStatus: 'LESSONS_IN_PROGRESS',
    lessonsCompletedAt: null,
    finalExamWindowEndsAt: null,
    examResult: null,
  }
  await setDoc(ref, { learning }, { merge: true })
  invalidateCache('allUsers')
  return { success: true }
}

export async function deleteCourse(courseId) {
  const q = query(collection(db, 'micro_learning'), where('courseId', '==', courseId))
  const snap = await getDocs(q)
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.delete(doc(db, 'micro_learning', d.id)))
  batch.delete(doc(db, 'courses', courseId))
  await batch.commit()
  invalidateCachePrefix('allCourses')
}
