import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { collection, writeBatch, doc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { FiUpload, FiCheckCircle, FiAlertCircle } from 'react-icons/fi'

const EXPECTED_COLS = ['courseId', 'courseTitle', 'day', 'conceptId', 'title', 'category', 'estimatedReadingTime', 'shortExplanation',
  'q1_text', 'q1_optionA', 'q1_optionB', 'q1_optionC', 'q1_optionD', 'q1_correctAnswer', 'q1_explanation',
  'q2_text', 'q2_optionA', 'q2_optionB', 'q2_optionC', 'q2_optionD', 'q2_correctAnswer', 'q2_explanation',
  'q3_text', 'q3_optionA', 'q3_optionB', 'q3_optionC', 'q3_optionD', 'q3_correctAnswer', 'q3_explanation']

const LETTER_MAP = { A: 0, B: 1, C: 2, D: 3 }

function buildQuestions(row) {
  const questions = []
  for (let i = 1; i <= 3; i++) {
    const text = row[`q${i}_text`]?.trim()
    const optionA = row[`q${i}_optionA`]?.trim()
    const optionB = row[`q${i}_optionB`]?.trim()
    const optionC = row[`q${i}_optionC`]?.trim()
    const optionD = row[`q${i}_optionD`]?.trim()
    const correctLetter = row[`q${i}_correctAnswer`]?.trim().toUpperCase()
    const explanation = row[`q${i}_explanation`]?.trim()
    if (!text || !optionA || !correctLetter) return null
    questions.push({
      questionId: `q${i}`,
      text,
      options: [optionA, optionB, optionC, optionD].filter(Boolean),
      correctAnswer: LETTER_MAP[correctLetter] ?? 0,
      explanation: explanation || '',
    })
  }
  return questions.length === 3 ? questions : null
}

export default function MicroLearningUploader({ onUploadComplete } = {}) {
  const [days, setDays] = useState([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const handleFile = (e) => {
    setError(null)
    setResult(null)
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const cols = Object.keys(res.data[0] || {})
        const hasAll = EXPECTED_COLS.every((c) => cols.includes(c))
        if (!hasAll) {
          setError(`CSV must have columns: courseId, courseTitle, day, conceptId, title, category, estimatedReadingTime, shortExplanation, q1_text...q3_text, q1_optionA...q3_optionD, q1_correctAnswer...q3_correctAnswer, q1_explanation...q3_explanation`)
          setDays([])
          return
        }
        const hasPostNumber = cols.includes('postNumber')
        const valid = []

        if (hasPostNumber) {
          // Group rows by courseId + day
          const groups = {}
          for (const r of res.data) {
            const key = `${r.courseId?.trim()}|${r.day}`
            if (!groups[key]) groups[key] = []
            groups[key].push(r)
          }
          for (const rows of Object.values(groups)) {
            const sorted = rows.sort((a, b) => (parseInt(a.postNumber) || 1) - (parseInt(b.postNumber) || 1))
            const first = sorted[0]
            const questions = buildQuestions(first)
            if (!questions) continue
            const posts = sorted
              .map(r => ({
                title: r.title?.trim() || '',
                content: r.shortExplanation?.trim() || '',
              }))
              .filter(p => p.content)
            if (!posts.length) continue
            valid.push({
              courseId: first.courseId?.trim(),
              courseTitle: first.courseTitle?.trim(),
              day: parseInt(first.day) || 0,
              conceptId: first.conceptId?.trim(),
              title: first.title?.trim(),
              category: first.category?.trim(),
              estimatedReadingTime: first.estimatedReadingTime?.trim(),
              shortExplanation: first.shortExplanation?.trim(),
              posts,
              questions,
            })
          }
        } else {
          for (const r of res.data) {
            const questions = buildQuestions(r)
            if (!questions) continue
            valid.push({
              courseId: r.courseId?.trim(),
              courseTitle: r.courseTitle?.trim(),
              day: parseInt(r.day) || 0,
              conceptId: r.conceptId?.trim(),
              title: r.title?.trim(),
              category: r.category?.trim(),
              estimatedReadingTime: r.estimatedReadingTime?.trim(),
              shortExplanation: r.shortExplanation?.trim(),
              questions,
            })
          }
        }
        setDays(valid.filter((d) => d.courseId && d.day > 0 && d.title))
      },
      error: () => setError('Failed to parse CSV file'),
    })
  }

  const handleUpload = async () => {
    if (!days.length) return
    setUploading(true)
    setError(null)
    setResult(null)
    try {
      const batch = writeBatch(db)
      const mlCol = collection(db, 'micro_learning')
      const courseIds = new Set()
      days.forEach((d) => {
        const docId = `${d.courseId}_day_${String(d.day).padStart(2, '0')}`
        batch.set(doc(mlCol, docId), d)
        courseIds.add(d.courseId)
      })
      for (const cid of courseIds) {
        const first = days.find((d) => d.courseId === cid)
        await setDoc(doc(db, 'courses', cid), {
          courseId: cid,
          courseTitle: first?.courseTitle || cid,
          visible: true,
        }, { merge: true })
      }
      await batch.commit()
      setResult({ success: true, count: days.length })
      setDays([])
      if (inputRef.current) inputRef.current.value = ''
      if (onUploadComplete) onUploadComplete()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  if (days.length > 0) {
    return (
      <div>
        <div className="bg-green-50 border border-success/30 rounded-xl p-4 mb-4 flex items-center gap-2 text-sm text-green-700">
          <FiCheckCircle />
          <span>{days.length} day{days.length !== 1 ? 's' : ''} parsed across {[...new Set(days.map(d => d.courseId))].length} course(s). Ready to upload.</span>
        </div>
        <div className="max-h-48 overflow-auto border border-outline-variant rounded-xl mb-4">
          <table className="w-full text-xs">
            <thead className="bg-surface-container-low sticky top-0">
              <tr>
                <th className="p-2 text-left">Course</th>
                <th className="p-2 text-left">Day</th>
                <th className="p-2 text-left">Title</th>
                <th className="p-2 text-left">Category</th>
                <th className="p-2 text-left">Posts</th>
              </tr>
            </thead>
            <tbody>
              {days.slice(0, 10).map((d, i) => (
                <tr key={i} className="border-t border-outline-variant">
                  <td className="p-2 max-w-[120px] truncate">{d.courseTitle || d.courseId}</td>
                  <td className="p-2">{d.day}</td>
                  <td className="p-2 max-w-[200px] truncate">{d.title}</td>
                  <td className="p-2">{d.category}</td>
                  <td className="p-2">{d.posts?.length || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {days.length > 10 && <p className="text-xs text-on-surface-variant p-2">...and {days.length - 10} more</p>}
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setDays([]); if (inputRef.current) inputRef.current.value = '' }}
            className="px-4 py-2 bg-surface-container-low text-on-surface rounded-xl text-sm font-medium hover:bg-surface-container-high transition-all cursor-pointer">
            Cancel
          </button>
          <button onClick={handleUpload} disabled={uploading}
            className="px-6 py-2 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer">
            {uploading ? 'Uploading...' : `Upload ${days.length} Day${days.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs text-on-surface-variant mb-4 font-mono bg-surface-container-low p-3 rounded-lg leading-relaxed">
        Required: courseId, courseTitle, day, conceptId, title, category, estimatedReadingTime, shortExplanation,<br />
        q1_text, q1_optionA, q1_optionB, q1_optionC, q1_optionD, q1_correctAnswer, q1_explanation,<br />
        q2_text ... q3_explanation<br />
        <span className="text-primary font-semibold">Optional:</span> postNumber — repeat same courseId+day with postNumber 1,2,3... for carousel slides. Questions on first row only.
      </p>
      <div className="border-2 border-dashed border-outline-variant rounded-xl p-10 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => inputRef.current?.click()}>
        <FiUpload size={36} className="mx-auto text-on-surface-variant mb-3" />
        <p className="text-sm text-on-surface-variant mb-1">Upload a Micro-Learning CSV</p>
        <p className="text-xs text-on-surface-variant/60 mb-4">Each row = one day or one carousel post, with 3 questions</p>
        <input ref={inputRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        <span className="inline-block bg-primary text-on-primary px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer">
          Select CSV File
        </span>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-error/30 rounded-xl p-4 flex items-center gap-2 text-sm text-red-700">
          <FiAlertCircle />
          <span>{error}</span>
        </div>
      )}

      {result?.success && (
        <div className="mt-4 bg-green-50 border border-success/30 rounded-xl p-4 flex items-center gap-2 text-sm text-green-700">
          <FiCheckCircle />
          <span>Successfully uploaded {result.count} day{result.count !== 1 ? 's' : ''} to Firestore!</span>
        </div>
      )}
    </div>
  )
}