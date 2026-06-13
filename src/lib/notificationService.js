import { doc, setDoc, updateDoc, collection, getDocs, query, where, onSnapshot, writeBatch, orderBy, limit } from 'firebase/firestore'
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
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(20)
  )
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export function getUnreadCountRealtime(userId, cb) {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false)
  )
  return onSnapshot(q, (snap) => {
    cb(snap.size)
  })
}

export async function markAsRead(notificationId) {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true })
}

export async function markAllAsRead(userId) {
  const snap = await getDocs(query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false)
  ))
  if (snap.empty) return
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }))
  await batch.commit()
}
