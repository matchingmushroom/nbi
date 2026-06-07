import { collection, getDocs, doc, getDoc, setDoc, query, where, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { getCached, setCache, invalidateCache, invalidateCachePrefix } from './cache'

const EXAM_WINDOW_DAYS = 7

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
    reviewedDays: [],
    dailyRawScore: 0,
    courseStatus: 'LESSONS_IN_PROGRESS',
    lessonsCompletedAt: null,
    finalExamWindowEndsAt: null,
    examResult: null,
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

export async function resetCourseProgress(userId, courseId) {
  const ref = doc(db, 'users', userId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return { error: 'User not found' }
  const userData = snap.data()
  const learning = userData.learning || getDefaultLearningProfile()
  if (!learning.enrolledCourses?.[courseId]) return { error: 'User not enrolled in this course' }

  learning.enrolledCourses[courseId] = getDefaultCourseProgress()
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

  // Calendar lock: only block if this specific day was already reviewed today
  const alreadyReviewed = course.dayStates?.[conceptId]?.state === 'REVIEWED' &&
    course.dayStates?.[conceptId]?.completedDate === today
  if (alreadyReviewed) {
    const bypass = userData?.bypassDailyLimit === true
    if (!bypass) return { error: 'You already completed this review today.' }
  }

  // Take first 3 questions
  const reviewQuestions = questions.slice(0, 3)
  const score = answers.slice(0, 3).filter((a, i) => a === reviewQuestions[i]?.correctAnswer).length

  const details = reviewQuestions.map((q, i) => ({
    questionId: q.questionId,
    text: q.text,
    options: q.options,
    selected: answers[i],
    correct: q.correctAnswer,
    isCorrect: answers[i] === q.correctAnswer,
    explanation: q.explanation,
  }))

  // Streak tracking
  const steakResult = computeSteak(course.lastCompletedDate, today)
  let newSteak = course.currentSteak
  if (steakResult === 'increment') newSteak++
  else if (steakResult === 1) newSteak = 1

  // Always unlock next day regardless of score
  const updatedCourse = {
    ...course,
    currentSteak: newSteak,
    highestSteak: Math.max(newSteak, course.highestSteak),
    lastCompletedDate: today,
    unlockedDay: Math.max(course.unlockedDay, day + 1),
    reviewedDays: [...new Set([...course.reviewedDays, conceptId])],
    dailyRawScore: (course.dailyRawScore || 0) + score,
    dayStates: {
      ...course.dayStates,
      [conceptId]: { state: 'REVIEWED', completedDate: today, score },
    },
  }

  const updatedLearning = {
    ...learning,
    enrolledCourses: {
      ...learning.enrolledCourses,
      [courseId]: updatedCourse,
    },
  }

  await setDoc(ref, { learning: updatedLearning }, { merge: true })
  invalidateCache('allUsers')

  return {
    score,
    total: 3,
    details,
    steakChanged: steakResult !== null,
    newSteak,
    highestSteak: updatedCourse.highestSteak,
    dayReviewed: conceptId,
  }
}

export async function markDayComplete(userId, courseId, day, dayCount) {
  const ref = doc(db, 'users', userId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return { error: 'User not found' }
  const userData = snap.data()
  const learning = userData.learning || getDefaultLearningProfile()
  const course = learning.enrolledCourses?.[courseId]
  if (!course) return { error: 'Not enrolled' }

  const today = getToday()
  const conceptId = `day_${String(day).padStart(2, '0')}`
  if (course.completedDays?.includes(conceptId)) return { error: 'Already completed' }

  const updatedCourse = {
    ...course,
    completedDays: [...new Set([...(course.completedDays || []), conceptId])],
    dayStates: {
      ...course.dayStates,
      [conceptId]: { state: 'COMPLETED', completedDate: today },
    },
  }

  // If this is the final day, transition to LESSONS_COMPLETED + start 7-day window
  let isFinalDay = false
  if (day === dayCount) {
    isFinalDay = true
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + EXAM_WINDOW_DAYS)
    updatedCourse.courseStatus = 'LESSONS_COMPLETED'
    updatedCourse.lessonsCompletedAt = today
    updatedCourse.finalExamWindowEndsAt = endDate.toISOString().split('T')[0]
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
    dayCompleted: conceptId,
    isFinalDay,
    learningXp: updatedLearning.learningXp,
    xpGained: 20,
    courseStatus: updatedCourse.courseStatus,
    finalExamWindowEndsAt: updatedCourse.finalExamWindowEndsAt,
  }
}

export async function submitFinalExam(userId, courseId, answers, questions, dayCount) {
  const ref = doc(db, 'users', userId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return { error: 'User not found' }
  const userData = snap.data()
  const learning = userData.learning || getDefaultLearningProfile()
  const course = learning.enrolledCourses?.[courseId]
  if (!course) return { error: 'Not enrolled' }
  if (course.courseStatus !== 'LESSONS_COMPLETED') return { error: 'Lessons not completed yet' }

  // Validate 7-day window
  const now = new Date()
  const windowEnd = new Date(course.finalExamWindowEndsAt + 'T23:59:59')
  if (now > windowEnd) return { error: 'Exam window has expired' }

  // Score exam: 2 marks per correct
  const examCorrect = answers.filter((a, i) => a === questions[i]?.correctAnswer).length
  const examRaw = examCorrect * 2

  // Daily portion: (dailyRawScore / (3 * (dayCount - 1))) * 40
  const maxDaily = 3 * (dayCount - 1)
  const dailyScore = course.dailyRawScore || 0
  const dailyPortion = maxDaily > 0 ? (dailyScore / maxDaily) * 40 : 0

  // Final score
  const finalScore = dailyPortion + examRaw
  const passed = finalScore >= 60

  const details = questions.map((q, i) => ({
    text: q.text,
    options: q.options,
    selected: answers[i],
    correct: q.correctAnswer,
    isCorrect: answers[i] === q.correctAnswer,
    explanation: q.explanation,
  }))

  const result = {
    examCorrect,
    examRaw,
    total: questions.length,
    dailyPortion: Math.round(dailyPortion * 100) / 100,
    finalScore: Math.round(finalScore * 100) / 100,
    passed,
    submittedAt: new Date().toISOString(),
  }

  const updatedCourse = {
    ...course,
    courseStatus: passed ? 'PASSED' : 'FAILED',
    examResult: result,
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

  return { ...result, details }
}

export function getCoursePhase(progress, dayCount, isModerator = false, bypassDailyLimit = false) {
  if (!progress || !dayCount) return null

  const {
    courseStatus = 'LESSONS_IN_PROGRESS',
    completedDays = [],
    reviewedDays = [],
    unlockedDay = 1,
    finalExamWindowEndsAt,
  } = progress

  // Terminal states
  if (courseStatus === 'PASSED') return { phase: 'PASSED' }
  if (courseStatus === 'FAILED') return { phase: 'FAILED' }

  // Lessons completed — exam window
  if (courseStatus === 'LESSONS_COMPLETED') {
    if (!finalExamWindowEndsAt) return { phase: 'EXAM_AVAILABLE' }
    const now = new Date()
    const end = new Date(finalExamWindowEndsAt + 'T23:59:59')
    if (now <= end) return { phase: 'EXAM_AVAILABLE', windowEndsAt: finalExamWindowEndsAt }
    return { phase: 'EXPIRED' }
  }

  // Moderator: same flow as student but no LOCKED phase
  if (isModerator) {
    const makeDayId = (d) => `day_${String(d).padStart(2, '0')}`
    for (let day = 1; day <= dayCount; day++) {
      const id = makeDayId(day)
      const complete = completedDays.includes(id)
      const reviewed = reviewedDays.includes(id)
      if (!complete) {
        if (day > 1) {
          const prevId = makeDayId(day - 1)
          if (completedDays.includes(prevId) && !reviewedDays.includes(prevId)) {
            return { phase: 'REVIEW', day: day - 1 }
          }
        }
        return { phase: 'READ_AND_COMPLETE', day }
      }
    }
    return { phase: 'ALL_DONE' }
  }

  // Find the first incomplete day
  const today = new Date().toISOString().split('T')[0]
  const isDayComplete = (day) => {
    const id = `day_${String(day).padStart(2, '0')}`
    return completedDays.includes(id)
  }
  const isDayReviewed = (day) => {
    const id = `day_${String(day).padStart(2, '0')}`
    return reviewedDays.includes(id)
  }
  const isDayReviewedToday = (day) => {
    const id = `day_${String(day).padStart(2, '0')}`
    const state = progress.dayStates?.[id]
    return state?.state === 'REVIEWED' && state.completedDate === today
  }

  for (let day = 1; day <= dayCount; day++) {
    const complete = isDayComplete(day)
    const reviewed = isDayReviewed(day)

    if (!complete) {
      if (day <= unlockedDay) {
        return { phase: 'READ_AND_COMPLETE', day }
      }
      // Day is locked — need review of previous day
      const prevDay = day - 1
      if (prevDay >= 1 && isDayComplete(prevDay) && !isDayReviewed(prevDay)) {
        if (bypassDailyLimit && isDayReviewedToday(prevDay)) return { phase: 'REVIEW', day: prevDay }
        return { phase: isDayReviewedToday(prevDay) ? 'REVIEW_LOCKED' : 'REVIEW', day: prevDay }
      }
      return { phase: 'LOCKED', day }
    }

    // Day is complete but needs review (for non-final days)
    if (day < dayCount && !reviewed) {
      if (bypassDailyLimit && isDayReviewedToday(day)) return { phase: 'REVIEW', day }
      return { phase: isDayReviewedToday(day) ? 'REVIEW_LOCKED' : 'REVIEW', day }
    }
  }

  // All days complete
  return { phase: 'ALL_DONE' }
}
