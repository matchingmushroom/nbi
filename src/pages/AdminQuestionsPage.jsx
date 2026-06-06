import { useState, useEffect } from 'react'
import { collection, getDocs, doc, deleteDoc, setDoc } from 'firebase/firestore'
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

  if (loading) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Loading...</p></div>

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Manage Questions</h1>
        <p className="text-on-surface-variant text-sm mt-1">{questions.length} total questions</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
          <input placeholder="Search questions..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-full text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
        </div>
        <select value={chapterFilter} onChange={(e) => setChapterFilter(e.target.value)}
          className="px-4 py-2 bg-surface-container-low border border-outline-variant rounded-full text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
          <option value="all">All Chapters</option>
          {chapters.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
        </select>
      </div>

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
        <div className="divide-y divide-outline-variant">
          {filtered.map((q, i) => (
            <div key={q.id} className="flex items-center gap-3 p-3 hover:bg-surface-container-low transition-colors">
              <span className="text-xs text-on-surface-variant w-6 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-on-surface truncate">{q.question}</p>
                <p className="text-xs text-on-surface-variant truncate">{q.chapter}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                q.correctAnswer === 'A' ? 'bg-blue-100 text-blue-700' :
                q.correctAnswer === 'B' ? 'bg-green-100 text-green-700' :
                q.correctAnswer === 'C' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
              }`}>{q.correctAnswer}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                q.difficulty === 'Beginner' ? 'bg-green-100 text-green-700' :
                q.difficulty === 'Intermediate' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
              }`}>{q.difficulty}</span>
              <button onClick={() => openEdit(q)} className="text-primary hover:text-primary/70 cursor-pointer"><FiEdit2 size={14} /></button>
              <button onClick={() => handleDelete(q.id)} className="text-error hover:text-error/70 cursor-pointer"><FiTrash2 size={14} /></button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-on-surface-variant text-sm">No questions found.</div>
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-lg mx-auto max-h-[85vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-on-surface">Edit Question</h2>
              <button onClick={() => setEditing(null)} className="cursor-pointer"><FiX size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Chapter</label>
                <input value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Question</label>
                <textarea value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} rows="2" className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {['A', 'B', 'C', 'D'].map((l) => (
                  <div key={l}>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1">Option {l}</label>
                    <input value={form[`option${l}`]} onChange={(e) => setForm({ ...form, [`option${l}`]: e.target.value })} className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">Correct Answer</label>
                  <select value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })} className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">Difficulty</label>
                  <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Expert">Expert</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Explanation</label>
                <textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} rows="2" className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
              </div>
              <button onClick={handleSave} className="w-full bg-primary text-on-primary py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
