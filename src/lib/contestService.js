import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, onSnapshot, increment } from 'firebase/firestore'
import { db } from './firebase'
import { getAllQuestionsCached } from './cache'
import { createBulkNotifications } from './notificationService'

export async function getContest(id) {
  const snap = await getDoc(doc(db, 'contests', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export function getContestRealtime(id, cb) {
  return onSnapshot(doc(db, 'contests', id), (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  })
}

export async function getUserContests(userId) {
  const [asOrganizer, asParticipant] = await Promise.all([
    getDocs(query(collection(db, 'contests'), where('organizerId', '==', userId))),
    getDocs(query(collection(db, 'contests'), where(`participants.${userId}.status`, '!=', null))),
  ])
  const map = new Map()
  asOrganizer.forEach((d) => { if (!map.has(d.id)) map.set(d.id, { id: d.id, ...d.data(), myRole: 'organizer' }) })
  asParticipant.forEach((d) => { if (!map.has(d.id)) map.set(d.id, { id: d.id, ...d.data(), myRole: 'participant' }) })
  return Array.from(map.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export async function getAllCompletedContests() {
  const snap = await getDocs(query(collection(db, 'contests'), where('status', '==', 'completed')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function createContest(organizer, { title, sourceType, sourceValue, invitedUserIds, minBet, questionCount = 10, timerMinutes = 10 }) {
  const all = await getAllQuestionsCached()
  let filtered = []
  if (sourceType === 'chapter') filtered = all.filter((q) => q.chapter === sourceValue && q.module !== 'Mock Test' && q.mode !== 'Certification')
  else if (sourceType === 'module') filtered = all.filter((q) => q.module === sourceValue && q.module !== 'Mock Test' && !(q.mode === 'Certification' && q.module === 'Course'))
  else if (sourceType === 'mode') filtered = all.filter((q) => q.mode === sourceValue && q.module !== 'Mock Test')
  else if (sourceType === 'mockTest') filtered = all.filter((q) => q.module === 'Mock Test')

  if (filtered.length < questionCount) throw new Error(`Not enough questions (${filtered.length} found, need ${questionCount})`)

  const shuffled = filtered.sort(() => Math.random() - 0.5)
  const questionIds = shuffled.slice(0, questionCount).map((q) => q.id)

  const participants = {}
  invitedUserIds.forEach((uid) => {
    participants[uid] = { status: 'invited' }
  })
  participants[organizer.uid] = { status: 'invited' }

  const ref = doc(collection(db, 'contests'))
  await setDoc(ref, {
    organizerId: organizer.uid,
    organizerName: organizer.displayName || organizer.email || 'Organizer',
    title,
    status: 'setup',
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    questionSource: { type: sourceType, value: sourceValue },
    questionIds,
    questionCount,
    timerMinutes,
    minBet,
    potAmount: 0,
    participants,
    results: { winnerId: null, winnerName: null, prizeAmount: 0, rankings: [] },
  })

  await createBulkNotifications(
    invitedUserIds,
    'contest_invite',
    'Contest Invitation',
    `${organizer.displayName || organizer.email} invited you to "${title}" (${minBet} XP bet)`,
    { path: `/contest/play/${ref.id}` }
  )

  return ref.id
}

export async function joinContest(contestId, userId) {
  await updateDoc(doc(db, 'contests', contestId), {
    [`participants.${userId}.status`]: 'joined',
  })
}

export async function startContest(contestId, allUsers) {
  const contest = await getContest(contestId)
  if (!contest || contest.status !== 'setup') throw new Error('Contest cannot be started')

  const userIds = Object.keys(contest.participants)
  const participants = {}
  let eligibleCount = 0
  userIds.forEach((uid) => {
    const userData = allUsers.find((u) => u.uid === uid) || {}
    const xp = userData.xp || 0
    const eligible = xp >= contest.minBet
    if (eligible) eligibleCount++
    participants[uid] = {
      displayName: userData.displayName || userData.email || 'Unknown',
      email: userData.email || '',
      xpAtJoin: xp,
      status: 'joined',
      answers: null,
      score: 0,
      timeTaken: 0,
      submittedAt: null,
      eligible,
    }
  })

  if (eligibleCount < 2) throw new Error('Need at least 2 eligible participants')

  await updateDoc(doc(db, 'contests', contestId), {
    status: 'active',
    startedAt: new Date().toISOString(),
    participants,
    potAmount: contest.minBet * eligibleCount,
  })

  await createBulkNotifications(
    userIds.filter((uid) => participants[uid]?.eligible),
    'contest_start',
    'Contest Started!',
    `"${contest.title}" has started! Go to play now.`,
    { path: `/contest/play/${contestId}` }
  )
}

export async function submitContestEntry(contestId, userId, answers, timeTaken) {
  const contest = await getContest(contestId)
  if (!contest || contest.status !== 'active') throw new Error('Contest is not active')
  if (contest.participants[userId]?.status === 'submitted') throw new Error('Already submitted')

  const qIds = contest.questionIds
  const all = await getAllQuestionsCached()
  const qMap = {}
  all.forEach((q) => { qMap[q.id] = q })

  const finalAnswers = answers.map((a, i) => {
    const q = qMap[qIds[i]] || {}
    return {
      questionId: qIds[i],
      question: q.question || '',
      selected: a?.selected || null,
      correct: q.correctAnswer || '',
      isCorrect: a?.selected === q.correctAnswer,
    }
  })
  const score = finalAnswers.filter((a) => a.isCorrect).length

  const now = new Date().toISOString()
  await updateDoc(doc(db, 'contests', contestId), {
    [`participants.${userId}.answers`]: finalAnswers,
    [`participants.${userId}.score`]: score,
    [`participants.${userId}.timeTaken`]: timeTaken,
    [`participants.${userId}.submittedAt`]: now,
    [`participants.${userId}.status`]: 'submitted',
  })

  const updated = await getContest(contestId)
  const allSubmitted = Object.keys(updated.participants)
    .filter((uid) => updated.participants[uid].eligible !== false)
    .every((uid) => updated.participants[uid].status === 'submitted')

  if (allSubmitted) {
    await endContest(contestId)
    return { ended: true }
  }

  return { ended: false }
}

export async function endContest(contestId) {
  const contest = await getContest(contestId)
  if (!contest || contest.status === 'completed') return

  const participants = contest.participants
  const minBet = contest.minBet

  const eligibleIds = Object.keys(participants).filter((uid) => participants[uid].eligible !== false)
  const eligibleCount = eligibleIds.length

  const list = eligibleIds.map((uid) => {
    const p = participants[uid]
    return {
      userId: uid,
      displayName: p.displayName || 'Unknown',
      score: p.score || 0,
      timeTaken: p.timeTaken || 0,
      submittedAt: p.submittedAt || '',
    }
  })

  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.timeTaken !== b.timeTaken) return a.timeTaken - b.timeTaken
    return (a.submittedAt || '').localeCompare(b.submittedAt || '')
  })

  const rankings = list.map((item, i) => ({
    ...item,
    rank: i + 1,
    xpChange: 0,
  }))

  const winner = rankings[0]
  const prizeAmount = minBet * (eligibleCount - 1)

  const updates = rankings.map((r) => {
    const xpChange = r.userId === winner.userId ? prizeAmount : -minBet
    r.xpChange = xpChange
    return updateDoc(doc(db, 'users', r.userId), {
      xp: increment(xpChange),
    })
  })

  await Promise.all(updates)

  await updateDoc(doc(db, 'contests', contestId), {
    status: 'completed',
    completedAt: new Date().toISOString(),
    potAmount: minBet * eligibleCount,
    results: {
      winnerId: winner.userId,
      winnerName: winner.displayName,
      prizeAmount,
      rankings,
    },
  })

  await createBulkNotifications(
    eligibleIds,
    'contest_result',
    'Contest Results Available',
    `"${contest.title}" is complete! ${winner.displayName} won ${prizeAmount} XP.`,
    { path: `/contest/results/${contestId}` }
  )
}

export function validateBetForUsers(allUsers, minBet) {
  return allUsers.map((u) => ({
    ...u,
    canBet: (u.xp || 0) >= minBet,
  }))
}

export async function deleteContest(contestId) {
  await deleteDoc(doc(db, 'contests', contestId))
}
