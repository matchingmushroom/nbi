import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { backfillUserXP } from '../lib/gamification'
import { getCached, setCache, invalidateCache } from '../lib/cache'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const ref = doc(db, 'users', firebaseUser.uid)
        let snap
        try { snap = await getDoc(ref) } catch { snap = null }
        const data = snap?.exists() ? { uid: firebaseUser.uid, ...snap.data() } : null
        if (data && data.xp === undefined) {
          const backfill = await backfillUserXP(firebaseUser.uid)
          if (backfill) {
            data.xp = backfill.xp
            data.level = backfill.level
            data.streak = backfill.streak
            data.lastActiveDate = backfill.lastActiveDate
            data.badges = backfill.badges
          }
        }
        setProfile(data)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password)

  const register = async (email, password, displayName) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const snap = await getDocs(collection(db, 'users'))
    const isFirst = snap.empty
    await setDoc(doc(db, 'users', cred.user.uid), {
      email,
      displayName,
      role: isFirst ? 'admin' : 'student',
      createdAt: new Date().toISOString(),
      xp: 0,
      level: 1,
      streak: 0,
      lastActiveDate: '',
      badges: [],
    })
    invalidateCache('allUsers')
    return cred
  }

  const logout = () => signOut(auth)

  const createUserAsAdmin = async (email, password, displayName, role) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await setDoc(doc(db, 'users', cred.user.uid), {
      email,
      displayName,
      role: role || 'student',
      createdAt: new Date().toISOString(),
      xp: 0,
      level: 1,
      streak: 0,
      lastActiveDate: '',
      badges: [],
    })
    invalidateCache('allUsers')
    return cred
  }

  const deleteUserDoc = async (uid) => {
    await deleteDoc(doc(db, 'users', uid))
    invalidateCache('allUsers')
  }

  const updateUserDoc = async (uid, data) => {
    await setDoc(doc(db, 'users', uid), data, { merge: true })
    invalidateCache('allUsers')
  }

  const getAllUsers = async () => {
    const cached = getCached('allUsers')
    if (cached) return cached
    const snap = await getDocs(collection(db, 'users'))
    const data = snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
    setCache('allUsers', data)
    return data
  }

  const refreshProfile = async () => {
    if (!user) return
    const ref = doc(db, 'users', user.uid)
    let snap
    try { snap = await getDoc(ref) } catch { snap = null }
    setProfile(snap?.exists() ? { uid: user.uid, ...snap.data() } : null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        login,
        register,
        logout,
        createUserAsAdmin,
        deleteUserDoc,
        updateUserDoc,
        getAllUsers,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
