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

export default function MicroLearningUploader() {
  const [rows, setRows] = useState([])
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
          setError(`CSV must have columns: ${EXPECTED_COLS.slice(0, 8).join(', ')}, q1_text...q3_text, q1_optionA...q3_optionD, q1_correctAnswer...q3_correctAnswer, q1_explanation...q3_explanation`)
          setRows([])
          return
        }
        const valid = []
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
        setRows(valid.filter((r) => r.courseId && r.day > 0 && r.title))
      },
      error: () => setError('Failed to parse CSV file'),
    })
  }

  const handleUpload = async () => {
    if (!rows.length) return
    setUploading(true)
    setError(null)
    setResult(null)
    try {
      const batch = writeBatch(db)
      const mlCol = collection(db, 'micro_learning')
      const courseIds = new Set()
      rows.forEach((r) => {
        const docId = `${r.courseId}_day_${String(r.day).padStart(2, '0')}`
        batch.set(doc(mlCol, docId), r)
        courseIds.add(r.courseId)
      })
      for (const cid of courseIds) {
        const first = rows.find((r) => r.courseId === cid)
        await setDoc(doc(db, 'courses', cid), {
          courseId: cid,
          courseTitle: first?.courseTitle || cid,
          visible: true,
        }, { merge: true })
      }
      await batch.commit()
      setResult({ success: true, count: rows.length })
      setRows([])
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  if (rows.length > 0) {
    return (
      <div>
        <div className="bg-green-50 border border-success/30 rounded-xl p-4 mb-4 flex items-center gap-2 text-sm text-green-700">
          <FiCheckCircle />
          <span>{rows.length} days parsed across {[...new Set(rows.map(r => r.courseId))].length} course(s). Ready to upload.</span>
        </div>
        <div className="max-h-48 overflow-auto border border-outline-variant rounded-xl mb-4">
          <table className="w-full text-xs">
            <thead className="bg-surface-container-low sticky top-0">
              <tr>
                <th className="p-2 text-left">Course</th>
                <th className="p-2 text-left">Day</th>
                <th className="p-2 text-left">Title</th>
                <th className="p-2 text-left">Category</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r, i) => (
                <tr key={i} className="border-t border-outline-variant">
                  <td className="p-2 max-w-[120px] truncate">{r.courseTitle || r.courseId}</td>
                  <td className="p-2">{r.day}</td>
                  <td className="p-2 max-w-[200px] truncate">{r.title}</td>
                  <td className="p-2">{r.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 10 && <p className="text-xs text-on-surface-variant p-2">...and {rows.length - 10} more</p>}
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setRows([]); if (inputRef.current) inputRef.current.value = '' }}
            className="px-4 py-2 bg-surface-container-low text-on-surface rounded-xl text-sm font-medium hover:bg-surface-container-high transition-all cursor-pointer">
            Cancel
          </button>
          <button onClick={handleUpload} disabled={uploading}
            className="px-6 py-2 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer">
            {uploading ? 'Uploading...' : `Upload ${rows.length} Days`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs text-on-surface-variant mb-4 font-mono bg-surface-container-low p-3 rounded-lg leading-relaxed">
        courseId, courseTitle, day, conceptId, title, category, estimatedReadingTime, shortExplanation,<br />
        q1_text, q1_optionA, q1_optionB, q1_optionC, q1_optionD, q1_correctAnswer, q1_explanation,<br />
        q2_text ... q3_explanation
      </p>
      <div className="border-2 border-dashed border-outline-variant rounded-xl p-10 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => inputRef.current?.click()}>
        <FiUpload size={36} className="mx-auto text-on-surface-variant mb-3" />
        <p className="text-sm text-on-surface-variant mb-1">Upload a Micro-Learning CSV</p>
        <p className="text-xs text-on-surface-variant/60 mb-4">Each row = one day of one course, with 3 questions</p>
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
          <span>Successfully uploaded {result.count} days to Firestore!</span>
        </div>
      )}
    </div>
  )
}
