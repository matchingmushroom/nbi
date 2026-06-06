import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        setProfile(snap.exists() ? { uid: firebaseUser.uid, ...snap.data() } : null)
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
    return cred
  }

  const deleteUserDoc = async (uid) => {
    await deleteDoc(doc(db, 'users', uid))
  }

  const updateUserDoc = async (uid, data) => {
    await setDoc(doc(db, 'users', uid), data, { merge: true })
  }

  const getAllUsers = async () => {
    const snap = await getDocs(collection(db, 'users'))
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
  }

  const refreshProfile = async () => {
    if (!user) return
    const snap = await getDoc(doc(db, 'users', user.uid))
    setProfile(snap.exists() ? { uid: user.uid, ...snap.data() } : null)
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
