import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import { getAllQuestionsCached } from './cache'
import { getLevel } from './gamification'

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

export async function createContest(organizer, { title, sourceType, sourceValue, invitedUserIds, minBet }) {
  const all = await getAllQuestionsCached()
  let filtered = []
  if (sourceType === 'chapter') filtered = all.filter((q) => q.chapter === sourceValue && q.module !== 'Mock Test' && q.mode !== 'Certification')
  else if (sourceType === 'module') filtered = all.filter((q) => q.module === sourceValue && q.module !== 'Mock Test' && !(q.mode === 'Certification' && q.module === 'Course'))
  else if (sourceType === 'mode') filtered = all.filter((q) => q.mode === sourceValue && q.module !== 'Mock Test')
  else if (sourceType === 'mockTest') filtered = all.filter((q) => q.module === 'Mock Test')

  if (filtered.length < 10) throw new Error(`Not enough questions (${filtered.length} found, need 10)`)

  const shuffled = filtered.sort(() => Math.random() - 0.5)
  const questionIds = shuffled.slice(0, 10).map((q) => q.id)
  const timerMinutes = 10

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
    questionCount: 10,
    timerMinutes,
    minBet,
    potAmount: 0,
    participants,
    results: { winnerId: null, winnerName: null, prizeAmount: 0, rankings: [] },
  })
  return ref.id
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
      status: 'invited',
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

  await updateDoc(doc(db, 'contests', contestId), {
    [`participants.${userId}.answers`]: finalAnswers,
    [`participants.${userId}.score`]: score,
    [`participants.${userId}.timeTaken`]: timeTaken,
    [`participants.${userId}.submittedAt`]: new Date().toISOString(),
    [`participants.${userId}.status`]: 'submitted',
  })

  const updated = await getContest(contestId)
  const allSubmitted = Object.values(updated.participants).every((p) => p.status === 'submitted' || !p.eligible)
  if (allSubmitted) await endContest(contestId)
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

  const updates = []
  rankings.forEach((r) => {
    if (r.userId === winner.userId) {
      r.xpChange = prizeAmount
    } else {
      r.xpChange = -minBet
    }
  })

  for (const r of rankings) {
    const userRef = doc(db, 'users', r.userId)
    const userSnap = await getDoc(userRef)
    if (!userSnap.exists()) continue
    const currentXp = userSnap.data().xp || 0
    let newXp = currentXp + r.xpChange
    if (newXp < 0) newXp = 0
    const newLevel = getLevel(newXp)
    updates.push(updateDoc(userRef, { xp: newXp, level: newLevel }))
  }

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
}

export function validateBetForUsers(allUsers, minBet) {
  return allUsers.map((u) => ({
    ...u,
    canBet: (u.xp || 0) >= minBet,
  }))
}
