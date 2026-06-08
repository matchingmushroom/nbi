import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { collection, writeBatch, doc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { invalidateCachePrefix } from '../lib/cache'

export default function MicroLearningUploader({ onComplete }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState(null)
  const fileRef = useRef()

  const parseQuestions = (row, prefix) => {
    const qText = row[`${prefix}_text`]
    if (!qText) return null
    return {
      text: qText,
      options: [
        row[`${prefix}_optionA`],
        row[`${prefix}_optionB`],
        row[`${prefix}_optionC`],
        row[`${prefix}_optionD`],
      ].filter(Boolean),
      correctAnswer: ['A', 'B', 'C', 'D'].indexOf(row[`${prefix}_correctAnswer`]),
      explanation: row[`${prefix}_explanation`] || '',
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setProgress('Parsing CSV...')
    setResult(null)

    try {
      const text = await file.text()
      const { data } = Papa.parse(text, { header: true, skipEmptyLines: true })
      if (!data.length) { setResult({ error: 'CSV is empty' }); return }

      const grouped = {}
      for (const row of data) {
        const key = `${row.courseId}_day_${String(Number(row.day)).padStart(2, '0')}`
        if (!grouped[key]) {
          grouped[key] = {
            id: key,
            courseId: row.courseId,
            courseTitle: row.courseTitle,
            day: Number(row.day),
            posts: [],
          }
        }
        const questions = []
        for (let i = 1; i <= 3; i++) {
          const q = parseQuestions(row, `q${i}`)
          if (q) questions.push(q)
        }
        grouped[key].posts.push({
          postNumber: Number(row.postNumber) || grouped[key].posts.length + 1,
          title: row.title || `Day ${row.day}`,
          category: row.category || '',
          estimatedReadingTime: row.estimatedReadingTime || '',
          content: row.shortExplanation || '',
          questions,
        })
      }

      const batch = writeBatch(db)
      const courseIds = new Set()

      for (const docData of Object.values(grouped)) {
        const ref = doc(collection(db, 'micro_learning'), docData.id)
        batch.set(ref, docData)
        courseIds.add(docData.courseId)
      }

      for (const cid of courseIds) {
        const courseData = data.find(r => r.courseId === cid)
        batch.set(doc(db, 'courses', cid), {
          courseId: cid,
          courseTitle: courseData?.courseTitle || cid,
          visible: true,
        }, { merge: true })
      }

      setProgress(`Uploading ${Object.keys(grouped).length} day(s)...`)
      await batch.commit()
      invalidateCachePrefix('allCourses')

      setResult({
        success: true,
        days: Object.keys(grouped).length,
        courses: courseIds.size,
      })
    } catch (err) {
      console.error(err)
      setResult({ error: err.message })
    } finally {
      setUploading(false)
      setProgress('')
    }
  }

  return (
    <div className="space-y-4">
      {!result?.success && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.name.endsWith('.csv')) setFile(f) }}
          className="border-2 border-dashed border-outline-variant rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".csv" onChange={e => setFile(e.target.files[0])} className="hidden" />
          <span className="material-symbols-outlined text-3xl text-on-surface-variant">upload_file</span>
          <p className="text-sm font-medium text-on-surface mt-2">
            {file ? file.name : 'Drop CSV here or click to browse'}
          </p>
          <p className="text-xs text-on-surface-variant mt-1">Columns: courseId, courseTitle, day, postNumber, title, category, estimatedReadingTime, shortExplanation, q1_text, q1_optionA-D, q1_correctAnswer, q1_explanation, q2_*, q3_*</p>
        </div>
      )}

      {progress && <p className="text-sm text-primary">{progress}</p>}

      {result?.success && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-4 text-center">
          <span className="material-symbols-outlined text-3xl text-success">check_circle</span>
          <p className="text-sm font-semibold text-success mt-1">Upload successful!</p>
          <p className="text-xs text-on-surface-variant">{result.days} day(s) across {result.courses} course(s)</p>
        </div>
      )}

      {result?.error && (
        <div className="bg-error/10 border border-error/30 rounded-xl p-4 text-center">
          <span className="material-symbols-outlined text-3xl text-error">error</span>
          <p className="text-sm font-semibold text-error mt-1">{result.error}</p>
        </div>
      )}

      {!result?.success && (
        <div className="flex gap-2">
          <button onClick={handleUpload} disabled={!file || uploading}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer">
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <button onClick={() => { setFile(null); setResult(null); onComplete?.() }}
            className="px-4 py-2.5 border border-outline-variant rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container-low cursor-pointer">
            Cancel
          </button>
        </div>
      )}

      {result?.success && (
        <button onClick={() => { setFile(null); setResult(null); onComplete?.() }}
          className="w-full py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 cursor-pointer">
          Done
        </button>
      )}
    </div>
  )
}
