import { collection, getDocs, doc, getDoc, setDoc, query, where, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { getCached, setCache, invalidateCache, invalidateCachePrefix } from './cache'

function getToday() {
  return new Date().toISOString().split('T')[0]
}

function getYesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

function getDefaultCourseProgress() {
  return {
    enrolledAt: getToday(),
    currentSteak: 0,
    highestSteak: 0,
    lastCompletedDate: '',
    unlockedDay: 1,
    completedDays: [],
    dayStates: {},
  }
}

function getDefaultLearningProfile() {
  return {
    enrolledCourses: {},
    learningXp: 0,
  }
}

export async function ensureLearningProfile(userId) {
  const ref = doc(db, 'users', userId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return getDefaultLearningProfile()
  const data = snap.data()
  if (!data.learning) {
    await setDoc(ref, { learning: getDefaultLearningProfile() }, { merge: true })
    return getDefaultLearningProfile()
  }
  return data.learning
}

export function getLocalLearningProfile(profile) {
  if (!profile?.learning) return getDefaultLearningProfile()
  return profile.learning
}

export function getCourseProgress(learning, courseId) {
  if (!learning?.enrolledCourses?.[courseId]) return null
  return learning.enrolledCourses[courseId]
}

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

export async function deleteCourse(courseId) {
  const q = query(collection(db, 'micro_learning'), where('courseId', '==', courseId))
  const snap = await getDocs(q)
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.delete(doc(db, 'micro_learning', d.id)))
  batch.delete(doc(db, 'courses', courseId))
  await batch.commit()
  invalidateCachePrefix('allCourses')
}

export async function getCourseContent(courseId) {
  const q = query(collection(db, 'micro_learning'), where('courseId', '==', courseId))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.day - b.day)
}

export async function getDayContent(courseId, day) {
  const docId = `${courseId}_day_${String(day).padStart(2, '0')}`
  const ref = doc(db, 'micro_learning', docId)
  const snap = await getDoc(ref)
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function enrollCourse(userId, courseId) {
  const ref = doc(db, 'users', userId)
  const snap = await getDoc(ref)
  const userData = snap.data()
  const learning = userData?.learning || getDefaultLearningProfile()
  if (learning.enrolledCourses?.[courseId]) return

  const role = userData?.role || 'student'
  if (role === 'student') {
    const enrolledIds = Object.keys(learning.enrolledCourses || {})
    if (enrolledIds.length > 0) {
      const mlSnap = await getDocs(collection(db, 'micro_learning'))
      const dayCounts = {}
      mlSnap.docs.forEach((d) => {
        const cid = d.data().courseId
        if (cid) dayCounts[cid] = (dayCounts[cid] || 0) + 1
      })
      const inProgress = enrolledIds.filter((id) => {
        const prog = learning.enrolledCourses[id]
        const total = dayCounts[id] || 999
        return (prog?.completedDays?.length || 0) < total
      })
      if (inProgress.length >= 2) {
        throw new Error('You can have at most 2 courses in progress. Complete one before enrolling in another.')
      }
    }
  }

  const updated = {
    ...learning,
    enrolledCourses: {
      ...(learning.enrolledCourses || {}),
      [courseId]: getDefaultCourseProgress(),
    },
  }
  await setDoc(ref, { learning: updated }, { merge: true })
  invalidateCache('allUsers')
  return updated
}

export function computeSteak(lastCompletedDate, today) {
  if (!lastCompletedDate) return 1
  if (lastCompletedDate === today) return null
  if (lastCompletedDate === getYesterday()) return 'increment'
  return 1
}

export async function submitQuizResult(userId, courseId, day, answers, questions) {
  const ref = doc(db, 'users', userId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return { error: 'User not found' }
  const userData = snap.data()
  const learning = userData.learning || getDefaultLearningProfile()
  const course = learning.enrolledCourses?.[courseId]
  if (!course) return { error: 'Not enrolled in this course' }

  const today = getToday()

  const conceptId = `day_${String(day).padStart(2, '0')}`

  const doneToday = Object.entries(course.dayStates || {})
    .filter(([, s]) => s.completedDate === today)
  if (doneToday.length > 0) {
    return { error: 'You already completed a chapter for this course today. Come back tomorrow!' }
  }

  const score = answers.filter((a, i) => a === questions[i]?.correctAnswer).length
  const passed = score >= 2

  const details = questions.map((q, i) => ({
    questionId: q.questionId,
    text: q.text,
    options: q.options,
    selected: answers[i],
    correct: q.correctAnswer,
    isCorrect: answers[i] === q.correctAnswer,
    explanation: q.explanation,
  }))

  if (passed) {
    const steakResult = computeSteak(course.lastCompletedDate, today)
    let newSteak = course.currentSteak
    if (steakResult === 'increment') newSteak++
    else if (steakResult === 1) newSteak = 1

    const updatedCourse = {
      ...course,
      currentSteak: newSteak,
      highestSteak: Math.max(newSteak, course.highestSteak),
      lastCompletedDate: today,
      unlockedDay: Math.max(course.unlockedDay, day + 1),
      completedDays: [...new Set([...course.completedDays, conceptId])],
      dayStates: {
        ...course.dayStates,
        [conceptId]: { state: 'SUCCESS', completedDate: today, score },
      },
    }

    const updatedLearning = {
      ...learning,
      learningXp: (learning.learningXp || 0) + 20,
      enrolledCourses: {
        ...learning.enrolledCourses,
        [courseId]: updatedCourse,
      },
    }

    await setDoc(ref, { learning: updatedLearning }, { merge: true })
    invalidateCache('allUsers')

    return {
      passed: true,
      score,
      total: questions.length,
      details,
      steakChanged: steakResult !== null,
      newSteak,
      highestSteak: updatedCourse.highestSteak,
      dayCompleted: conceptId,
      learningXp: updatedLearning.learningXp,
      xpGained: 20,
    }
  }

  const updatedCourse = {
    ...course,
    dayStates: {
      ...course.dayStates,
      [conceptId]: { state: 'FAIL', completedDate: today, score },
    },
  }

  await setDoc(ref, {
    learning: {
      ...learning,
      enrolledCourses: {
        ...learning.enrolledCourses,
        [courseId]: updatedCourse,
      },
    },
  }, { merge: true })
  invalidateCache('allUsers')

  return {
    passed: false,
    score,
    total: questions.length,
    details,
    dayCompleted: conceptId,
  }
}
