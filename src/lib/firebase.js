import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDy-37FHq_J6ObSK2KrGup94nwWjcEn65s",
  authDomain: "nbi-exam.firebaseapp.com",
  projectId: "nbi-exam",
  storageBucket: "nbi-exam.firebasestorage.app",
  messagingSenderId: "932981700962",
  appId: "1:932981700962:web:3ebb5f0489454da7b2943b",
  measurementId: "G-XFTHFJQE1R"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

enableIndexedDbPersistence(db, { cacheSizeBytes: 50000000 }).catch(() => {})
