const INITIAL_SRS = {
  easeFactor: 2.5,
  interval: 0,
  nextReviewAt: null,
  lastReviewAt: null,
  consecutiveCorrect: 0,
  totalAttempts: 0,
}

function getTodayISO() {
  return new Date().toISOString().split('T')[0]
}

function dateDaysFromNow(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export function calculateNextReview(current, score0to3) {
  const ef = Math.max(1.3, current.easeFactor + (0.1 - (3 - score0to3) * (0.08 + (3 - score0to3) * 0.02)))
  let interval
  if (score0to3 < 2) {
    interval = 0
  } else if (current.interval === 0) {
    interval = 1
  } else if (current.interval === 1) {
    interval = 3
  } else {
    interval = Math.round(current.interval * ef)
  }
  interval = Math.min(interval, 180)
  const nextReview = score0to3 < 2 ? dateDaysFromNow(1) : dateDaysFromNow(interval)
  return {
    easeFactor: Math.round(ef * 100) / 100,
    interval,
    nextReviewAt: nextReview,
    lastReviewAt: new Date().toISOString(),
    consecutiveCorrect: score0to3 >= 2 ? (current.consecutiveCorrect || 0) + 1 : 0,
    totalAttempts: (current.totalAttempts || 0) + 1,
  }
}

export function getDueReviews(learning, courseId) {
  const course = learning?.enrolledCourses?.[courseId]
  if (!course?.reviews) return []
  const now = new Date().toISOString()
  return Object.entries(course.reviews)
    .filter(([, r]) => r.nextReviewAt && r.nextReviewAt <= now && r.nextReviewAt !== null)
    .sort(([, a], [, b]) => (a.nextReviewAt || '').localeCompare(b.nextReviewAt || ''))
    .map(([conceptId, data]) => ({ conceptId, ...data }))
}

export function getAllDueReviews(learning) {
  if (!learning?.enrolledCourses) return []
  const result = []
  for (const [courseId, course] of Object.entries(learning.enrolledCourses)) {
    if (!course.reviews) continue
    const now = new Date().toISOString()
    for (const [conceptId, r] of Object.entries(course.reviews)) {
      if (r.nextReviewAt && r.nextReviewAt <= now && r.nextReviewAt !== null) {
        const daysOverdue = Math.floor((Date.now() - new Date(r.nextReviewAt).getTime()) / 86400000)
        result.push({ courseId, conceptId, daysOverdue, ...r })
      }
    }
  }
  return result.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0))
}

export function getReviewStatus(reviews, conceptId) {
  const r = reviews?.[conceptId]
  if (!r) return 'new'
  if (!r.nextReviewAt) return 'new'
  if (new Date(r.nextReviewAt) <= new Date()) return 'due'
  return 'scheduled'
}

export { INITIAL_SRS }
