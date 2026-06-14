import { useState, useEffect } from 'react'
import { collection, getDocs, doc, deleteDoc, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { getAllQuestionsCached, invalidateCache } from '../lib/cache'
import { FiEdit2, FiTrash2, FiX, FiCheckSquare, FiDownload } from 'react-icons/fi'
import Papa from 'papaparse'
import CSVUploader from '../components/CSVUploader'

export default function AdminQuestionsPage() {
  const { profile } = useAuth()
  const isModerator = profile?.role === 'moderator'
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [chapterFilter, setChapterFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [batchMode, setBatchMode] = useState(false)
  const [batchFilterType, setBatchFilterType] = useState('chapter')
  const [batchSelected, setBatchSelected] = useState([])
  const [deleting, setDeleting] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState(null)
  const [showUpload, setShowUpload] = useState(false)

  const fetch = async () => {
    const data = await getAllQuestionsCached()
    setQuestions(data)
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const openEdit = (q) => {
    setEditing(q)
    setForm({
      module: q.module || '',
      mode: q.mode || '',
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
    invalidateCache('allQuestions')
    setEditing(null)
    fetch()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this question?')) return
    try {
      await deleteDoc(doc(db, 'questions', id))
      invalidateCache('allQuestions')
      setDeleteMsg({ ok: true, text: 'Question deleted from database.' })
      fetch()
    } catch (err) {
      setDeleteMsg({ ok: false, text: 'Delete failed: ' + err.message })
    }
    setTimeout(() => setDeleteMsg(null), 3000)
  }

  const toggleBatchItem = (val) => {
    setBatchSelected((prev) =>
      prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val]
    )
  }

  const batchItems = () => {
    const field = batchFilterType
    const vals = [...new Set(questions.map((q) => q[field]).filter(Boolean))].sort()
    return vals
  }

  const handleBatchDelete = async () => {
    if (batchSelected.length === 0) return
    const field = batchFilterType
    const toDelete = questions.filter((q) => batchSelected.includes(q[field]))
    if (!confirm(`Delete all ${toDelete.length} questions from ${batchSelected.length} ${batchFilterType}(s)? This cannot be undone.`)) return
      setDeleting(true)
    try {
      const batch = writeBatch(db)
      toDelete.forEach((q) => {
        batch.delete(doc(db, 'questions', q.id))
      })
      await batch.commit()
      invalidateCache('allQuestions')
      setBatchSelected([])
      setBatchMode(false)
      setDeleteMsg({ ok: true, text: `${toDelete.length} questions deleted from database.` })
      fetch()
    } catch (err) {
      setDeleteMsg({ ok: false, text: 'Batch delete failed: ' + err.message })
    } finally {
      setDeleting(false)
      setTimeout(() => setDeleteMsg(null), 4000)
    }
  }

  const filtered = questions.filter((q) => {
    if (chapterFilter !== 'all' && q.chapter !== chapterFilter) return false
    if (search && !q.question?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const hidden = questions.filter((q) => !filtered.includes(q))

  const handleDownloadCSV = () => {
    const data = questions.map((q, i) => ({
      SN: i + 1,
      chapter: q.chapter || '',
      question: q.question || '',
      'option-a': q.optionA || '',
      'option-b': q.optionB || '',
      'option-c': q.optionC || '',
      'option-d': q.optionD || '',
      'correct-answer': q.correctAnswer || '',
      explanation: q.explanation || '',
      difficulty: q.difficulty || '',
      module: q.module || '',
      mode: q.mode || '',
    }))
    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'questions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDeleteHidden = async () => {
    if (hidden.length === 0) return
    if (!confirm(`Delete ${hidden.length} question${hidden.length !== 1 ? 's' : ''} not shown in the current view? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const batch = writeBatch(db)
      hidden.forEach((q) => { batch.delete(doc(db, 'questions', q.id)) })
      await batch.commit()
      invalidateCache('allQuestions')
      setDeleteMsg({ ok: true, text: `${hidden.length} hidden question${hidden.length !== 1 ? 's' : ''} deleted from database.` })
      fetch()
    } catch (err) {
      setDeleteMsg({ ok: false, text: 'Delete failed: ' + err.message })
    } finally {
      setDeleting(false)
      setTimeout(() => setDeleteMsg(null), 4000)
    }
  }

  if (loading) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Loading...</p></div>

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Manage Questions</h1>
          <p className="text-on-surface-variant text-sm mt-1">{questions.length} total questions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-4 py-2 bg-surface-container-low text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-all active:scale-[0.98] cursor-pointer"
          >
            <FiDownload size={16} />
            Download CSV
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            Upload
          </button>
          {!isModerator && (
            <button
              onClick={() => { setBatchMode(!batchMode); setBatchSelected([]) }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] cursor-pointer ${
                batchMode ? 'bg-error text-white' : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <FiCheckSquare size={16} />
              {batchMode ? 'Exit Batch' : 'Batch Delete'}
            </button>
          )}
        </div>
      </div>

      {batchMode && (
        <div className="bg-surface border border-error/30 rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-on-surface">Batch Delete by</h3>
            <div className="flex gap-1">
              {['chapter', 'module', 'mode'].map((t) => (
                <button
                  key={t}
                  onClick={() => { setBatchFilterType(t); setBatchSelected([]) }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                    batchFilterType === t ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {batchSelected.length > 0 && (
            <p className="text-xs text-on-surface-variant mb-2">
              {questions.filter((q) => batchSelected.includes(q[batchFilterType])).length} questions selected
            </p>
          )}
          <div className="flex flex-wrap gap-2 mb-3">
            {batchItems().map((val) => {
              const count = questions.filter((q) => q[batchFilterType] === val).length
              const selected = batchSelected.includes(val)
              return (
                <button
                  key={val}
                  onClick={() => toggleBatchItem(val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    selected
                      ? 'bg-error/10 border-error text-error'
                      : 'bg-surface-container-low border-outline-variant text-on-surface-variant hover:border-error/50'
                  }`}
                >
                  {val} ({count})
                </button>
              )
            })}
          </div>
          {batchSelected.length > 0 && (
            <button
              onClick={handleBatchDelete}
              disabled={deleting}
              className="w-full bg-error text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
            >
              {deleting ? 'Deleting...' : `Delete ${questions.filter((q) => batchSelected.includes(q[batchFilterType])).length} Questions`}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
          <input placeholder="Search questions..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-full text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
        </div>
        <select value={chapterFilter} onChange={(e) => setChapterFilter(e.target.value)}
          className="px-4 py-2 bg-surface-container-low border border-outline-variant rounded-full text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
          <option value="all">All Chapters</option>
          {[...new Set(questions.map((q) => q.chapter).filter(Boolean))].sort().map((ch) => <option key={ch} value={ch}>{ch}</option>)}
        </select>
        {!isModerator && hidden.length > 0 && (
          <button
            onClick={handleDeleteHidden}
            disabled={deleting}
            className="shrink-0 px-4 py-2 bg-error/10 text-error border border-error/30 rounded-full text-sm font-semibold hover:bg-error/20 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
            Delete Hidden ({hidden.length})
          </button>
        )}
      </div>

      {deleteMsg && (
        <div className={`mb-3 px-4 py-2 rounded-lg text-sm font-medium ${deleteMsg.ok ? 'bg-success/10 text-success border border-success/20' : 'bg-error-container/30 text-on-error-container border border-red-200'}`}>
          {deleteMsg.text}
        </div>
      )}

      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
        <div className="divide-y divide-outline-variant">
          {filtered.map((q, i) => (
            <div key={q.id} className="p-3 hover:bg-surface-container-low transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-xs text-on-surface-variant w-5 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface truncate">{q.question}</p>
                  <p className="text-xs text-on-surface-variant truncate">
                    {q.module && <span className="mr-2">{q.module}</span>}
                    {q.mode && <span className="mr-2 text-primary">{q.mode}</span>}
                    {q.chapter}
                  </p>
                </div>
              </div>
              <div className="flex items-center flex-wrap gap-1.5 mt-1.5 ml-7">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  q.correctAnswer === 'A' ? 'bg-blue-100 text-blue-700' :
                  q.correctAnswer === 'B' ? 'bg-green-100 text-green-700' :
                  q.correctAnswer === 'C' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                }`}>Ans: {q.correctAnswer}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  q.difficulty === 'Beginner' ? 'bg-green-100 text-green-700' :
                  q.difficulty === 'Intermediate' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                }`}>{q.difficulty}</span>
                <button onClick={() => openEdit(q)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-[#f0f3ff] rounded-lg transition-colors cursor-pointer">
                  <FiEdit2 size={12} /> Edit
                </button>
                {!isModerator && (
                  <button onClick={() => handleDelete(q.id)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-error hover:bg-error/5 rounded-lg transition-colors cursor-pointer">
                    <FiTrash2 size={12} /> Delete
                  </button>
                )}
              </div>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">Module</label>
                  <input value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">Mode</label>
                  <input value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </div>
              </div>
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
      {showUpload && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setShowUpload(false)}>
          <div className="bg-surface rounded-xl p-6 w-full max-w-3xl mx-auto max-h-[85vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-on-surface">Upload Questions CSV</h2>
              <button onClick={() => setShowUpload(false)} className="cursor-pointer"><span className="material-symbols-outlined">close</span></button>
            </div>
            <CSVUploader onUploadComplete={() => { invalidateCache('allQuestions'); fetch() }} />
          </div>
        </div>
      )}
    </div>
  )
}
