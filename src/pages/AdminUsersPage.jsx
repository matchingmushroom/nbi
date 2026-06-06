import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiEdit2, FiTrash2, FiPlus, FiX } from 'react-icons/fi'

export default function AdminUsersPage() {
  const { getAllUsers, createUserAsAdmin, deleteUserDoc, updateUserDoc } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ email: '', password: '', displayName: '', role: 'student' })

  const fetch = async () => {
    const data = await getAllUsers()
    setUsers(data)
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ email: '', password: '', displayName: '', role: 'student' })
    setShowModal(true)
  }

  const openEdit = (u) => {
    setEditing(u)
    setForm({ email: u.email, password: '', displayName: u.displayName || '', role: u.role || 'student' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (editing) {
      const data = { displayName: form.displayName, role: form.role }
      if (form.email) data.email = form.email
      await updateUserDoc(editing.uid, data)
    } else {
      await createUserAsAdmin(form.email, form.password, form.displayName, form.role)
    }
    setShowModal(false)
    fetch()
  }

  const handleDelete = async (uid) => {
    if (!confirm('Delete this user? This cannot be undone.')) return
    await deleteUserDoc(uid)
    fetch()
  }

  if (loading) return <div className="flex justify-center items-center min-h-[60vh] text-xl">Loading...</div>

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Manage Users</h1>
          <p className="text-gray-500 text-sm">{users.length} total users</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition cursor-pointer">
          <FiPlus /> Add User
        </button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.uid} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{u.displayName || '—'}</td>
                <td className="p-3 text-gray-500">{u.email}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                    {u.role || 'student'}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => openEdit(u)} className="text-blue-600 hover:text-blue-800 mr-3 cursor-pointer"><FiEdit2 size={16} /></button>
                  <button onClick={() => handleDelete(u.uid)} className="text-red-600 hover:text-red-800 cursor-pointer"><FiTrash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editing ? 'Edit User' : 'Create User'}</h2>
              <button onClick={() => setShowModal(false)} className="cursor-pointer"><FiX size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none" />
              </div>
              {!editing && (
                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none">
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button onClick={handleSave} className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition cursor-pointer">
                {editing ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
