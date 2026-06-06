import { useState, useEffect } from 'react'
import { collection, getDocs, doc, deleteDoc, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { FiEdit2, FiTrash2, FiX } from 'react-icons/fi'

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [chapterFilter, setChapterFilter] = useState('all')
  const [chapters, setChapters] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})

  const fetch = async () => {
    const snap = await getDocs(collection(db, 'questions'))
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    setQuestions(data)
    const chs = [...new Set(data.map((q) => q.chapter).filter(Boolean))].sort()
    setChapters(chs)
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const openEdit = (q) => {
    setEditing(q)
    setForm({
      chapter: q.chapter || '',
      question: q.question || '',
      optionA: q.optionA || '',
      optionB: q.optionB || '',
      optionC: q.optionC || '',
      optionD: q.optionD || '',
      correctAnswer: q.correctAnswer || '',
      explanation: q.explanation || '',
      difficulty: q.difficulty || 'Beginner',
    })
  }

  const handleSave = async () => {
    if (!editing) return
    await setDoc(doc(db, 'questions', editing.id), form, { merge: true })
    setEditing(null)
    fetch()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this question?')) return
    await deleteDoc(doc(db, 'questions', id))
    fetch()
  }

  const filtered = questions.filter((q) => {
    if (chapterFilter !== 'all' && q.chapter !== chapterFilter) return false
    if (search && !q.question?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) return <div className="flex justify-center items-center min-h-[60vh] text-xl">Loading...</div>

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Manage Questions</h1>
      <p className="text-gray-500 text-sm mb-4">{questions.length} total questions</p>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          placeholder="Search questions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
        />
        <select value={chapterFilter} onChange={(e) => setChapterFilter(e.target.value)} className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none">
          <option value="all">All Chapters</option>
          {chapters.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left w-12">#</th>
              <th className="p-3 text-left">Chapter</th>
              <th className="p-3 text-left">Question</th>
              <th className="p-3 text-left">Correct</th>
              <th className="p-3 text-left">Difficulty</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((q, i) => (
              <tr key={q.id} className="border-t hover:bg-gray-50">
                <td className="p-3 text-gray-400">{i + 1}</td>
                <td className="p-3 text-xs max-w-[120px] truncate">{q.chapter}</td>
                <td className="p-3 max-w-md truncate">{q.question}</td>
                <td className="p-3 font-medium">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    q.correctAnswer === 'A' ? 'bg-blue-100 text-blue-700' :
                    q.correctAnswer === 'B' ? 'bg-green-100 text-green-700' :
                    q.correctAnswer === 'C' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {q.correctAnswer}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    q.difficulty === 'Beginner' ? 'bg-green-100 text-green-700' :
                    q.difficulty === 'Intermediate' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {q.difficulty}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => openEdit(q)} className="text-blue-600 hover:text-blue-800 mr-3 cursor-pointer"><FiEdit2 size={16} /></button>
                  <button onClick={() => handleDelete(q.id)} className="text-red-600 hover:text-red-800 cursor-pointer"><FiTrash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="6" className="p-8 text-center text-gray-400">No questions found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Edit Question</h2>
              <button onClick={() => setEditing(null)} className="cursor-pointer"><FiX size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Chapter</label>
                <input value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Question</label>
                <textarea value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} rows="2" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {['A', 'B', 'C', 'D'].map((l) => (
                  <div key={l}>
                    <label className="block text-sm font-medium mb-1">Option {l}</label>
                    <input value={form[`option${l}`]} onChange={(e) => setForm({ ...form, [`option${l}`]: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Correct Answer</label>
                  <select value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none">
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Difficulty</label>
                  <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none">
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Expert">Expert</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Explanation</label>
                <textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} rows="2" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none" />
              </div>
              <button onClick={handleSave} className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition cursor-pointer">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
