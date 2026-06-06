import { collection, getDocs, doc, getDoc, setDoc, query, where } from 'firebase/firestore'
import { db } from './firebase'

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

export async function getAvailableCourses() {
  const snap = await getDocs(collection(db, 'micro_learning'))
  const courses = {}
  snap.docs.forEach((d) => {
    const data = d.data()
    if (data.courseId && !courses[data.courseId]) {
      courses[data.courseId] = {
        courseId: data.courseId,
        courseTitle: data.courseTitle || data.courseId,
        dayCount: 0,
      }
    }
    if (courses[data.courseId]) courses[data.courseId].dayCount++
  })
  return Object.values(courses).sort((a, b) => a.courseId.localeCompare(b.courseId))
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
  const learning = snap.data()?.learning || getDefaultLearningProfile()
  if (learning.enrolledCourses?.[courseId]) return
  const updated = {
    ...learning,
    enrolledCourses: {
      ...(learning.enrolledCourses || {}),
      [courseId]: getDefaultCourseProgress(),
    },
  }
  await setDoc(ref, { learning: updated }, { merge: true })
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

  return {
    passed: false,
    score,
    total: questions.length,
    details,
    dayCompleted: conceptId,
  }
}
