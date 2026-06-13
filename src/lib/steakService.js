import { collection, getDocs, doc, getDoc, setDoc, query, where, writeBatch, deleteField } from 'firebase/firestore'
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
  setCache('allCourses', result, 600000)
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
  const learning = userData.learning || {}
  learning.enrolledCourses = learning.enrolledCourses || {}
  if (!learning.enrolledCourses?.[courseId]) return { error: 'User not enrolled in this course' }

  const batch = writeBatch(db)
  batch.update(ref, { [`learning.enrolledCourses.${courseId}`]: deleteField() })

  const resultsQ = query(
    collection(db, 'results'),
    where('userId', '==', userId),
    where('quizType', '==', 'Certification'),
    where('chapter', '==', courseId),
  )
  const resultsSnap = await getDocs(resultsQ)
  resultsSnap.docs.forEach((d) => batch.delete(doc(db, 'results', d.id)))

  await batch.commit()
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

export async function cleanupOrphanedCourses() {
  const [allCourses, usersSnap] = await Promise.all([
    getAllCourses(),
    getDocs(collection(db, 'users')),
  ])
  const activeIds = new Set(allCourses.map((c) => c.courseId))
  let affected = 0
  let removed = 0
  const BATCH_SIZE = 500
  let batches = []
  let currentBatch = writeBatch(db)
  let count = 0

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data()
    const enrolled = data.learning?.enrolledCourses
    if (!enrolled) continue
    const orphaned = Object.keys(enrolled).filter((cid) => !activeIds.has(cid))
    if (orphaned.length === 0) continue
    affected++
    removed += orphaned.length
    for (const cid of orphaned) {
      if (count >= BATCH_SIZE) {
        batches.push(currentBatch.commit())
        currentBatch = writeBatch(db)
        count = 0
      }
      currentBatch.update(doc(db, 'users', userDoc.id), { [`learning.enrolledCourses.${cid}`]: deleteField() })
      count++
    }
  }
  if (count > 0) batches.push(currentBatch.commit())
  await Promise.all(batches)
  invalidateCache('allUsers')
  return { totalUsersAffected: affected, totalEntriesRemoved: removed }
}
