import { doc, setDoc, updateDoc, collection, getDocs, query, where, onSnapshot, writeBatch } from 'firebase/firestore'
import { db } from './firebase'

export async function createNotification(userId, type, title, body, data) {
  const ref = doc(collection(db, 'notifications'))
  await setDoc(ref, {
    userId,
    type,
    title,
    body,
    data: data || {},
    read: false,
    createdAt: new Date().toISOString(),
  })
  return ref.id
}

export async function createBulkNotifications(userIds, type, title, body, data) {
  if (!userIds.length) return
  const batch = writeBatch(db)
  userIds.forEach((uid) => {
    const ref = doc(collection(db, 'notifications'))
    batch.set(ref, {
      userId: uid,
      type,
      title,
      body,
      data: data || {},
      read: false,
      createdAt: new Date().toISOString(),
    })
  })
  await batch.commit()
}

export function getNotificationsRealtime(userId, cb) {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId)
  )
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    data.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    cb(data.slice(0, 20))
  })
}

export function getUnreadCountRealtime(userId, cb) {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId)
  )
  return onSnapshot(q, (snap) => {
    const count = snap.docs.filter((d) => d.data().read === false).length
    cb(count)
  })
}

export async function markAsRead(notificationId) {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true })
}

export async function markAllAsRead(userId) {
  const snap = await getDocs(query(
    collection(db, 'notifications'),
    where('userId', '==', userId)
  ))
  const unread = snap.docs.filter((d) => d.data().read === false)
  if (unread.length === 0) return
  const batch = writeBatch(db)
  unread.forEach((d) => batch.update(d.ref, { read: true }))
  await batch.commit()
}
