import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'

const CACHE_PREFIX = 'bm_'
const DEFAULT_TTL = 60000 // 60 seconds
const LONG_TTL = 600000 // 10 minutes
const MEDIUM_TTL = 300000 // 5 minutes
const SHORT_TTL = 120000 // 2 minutes

export function getCached(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const { data, expiry } = JSON.parse(raw)
    if (Date.now() > expiry) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    return data
  } catch { return null }
}

export function setCache(key, data, ttl = DEFAULT_TTL) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, expiry: Date.now() + ttl }))
  } catch { /* ignore quota errors */ }
}

export function invalidateCache(key) {
  try { localStorage.removeItem(CACHE_PREFIX + key) } catch {}
}

export function invalidateCachePrefix(prefix) {
  try {
    const fullPrefix = CACHE_PREFIX + prefix
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(fullPrefix))
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {}
}

export async function getAllQuestionsCached() {
  const cached = getCached('allQuestions')
  if (cached) return cached
  const snap = await getDocs(collection(db, 'questions'))
  const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  setCache('allQuestions', data, LONG_TTL)
  return data
}

export async function getAllResultsCached() {
  const cached = getCached('allResults')
  if (cached) return cached
  const snap = await getDocs(collection(db, 'results'))
  const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  setCache('allResults', data, SHORT_TTL)
  return data
}

export async function getAllUsersCached() {
  const cached = getCached('allUsers')
  if (cached) return cached
  const snap = await getDocs(collection(db, 'users'))
  const data = snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
  setCache('allUsers', data, MEDIUM_TTL)
  return data
}

export async function getUserResultsCached(userId) {
  const key = `results_${userId}`
  const cached = getCached(key)
  if (cached) return cached
  const q = query(collection(db, 'results'), where('userId', '==', userId))
  const snap = await getDocs(q)
  const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  setCache(key, data, SHORT_TTL)
  return data
}
