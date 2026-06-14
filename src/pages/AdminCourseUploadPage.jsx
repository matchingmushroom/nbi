import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { collection, writeBatch, doc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { invalidateCachePrefix } from '../lib/cache'

const MEDIA_COLS = ['imageUrl', 'videoUrl', 'audioUrl']
const BASE_COLS = ['courseId', 'courseTitle', 'day', 'conceptId', 'postNumber', 'title', 'category', 'estimatedReadingTime', 'shortExplanation']
const Q_FIELDS = ['q1_text', 'q1_optionA', 'q1_optionB', 'q1_optionC', 'q1_optionD', 'q1_correctAnswer', 'q1_explanation',
  'q2_text', 'q2_optionA', 'q2_optionB', 'q2_optionC', 'q2_optionD', 'q2_correctAnswer', 'q2_explanation',
  'q3_text', 'q3_optionA', 'q3_optionB', 'q3_optionC', 'q3_optionD', 'q3_correctAnswer', 'q3_explanation']

function parseRow(r, i) {
  if (!r.courseId || !r.day) return null
  const qs = []
  for (let qi = 1; qi <= 3; qi++) {
    const text = r[`q${qi}_text`]
    const correctRaw = r[`q${qi}_correctAnswer`]
    if (!text || !correctRaw) continue
    const options = [r[`q${qi}_optionA`], r[`q${qi}_optionB`], r[`q${qi}_optionC`], r[`q${qi}_optionD`]].filter(Boolean)
    const correctIdx = ['A', 'B', 'C', 'D'].indexOf(correctRaw.toUpperCase().trim())
    qs.push({
      text: text.trim(),
      options,
      correctAnswer: correctIdx >= 0 && correctIdx < options.length ? correctIdx : 0,
      explanation: r[`q${qi}_explanation`]?.trim() || '',
    })
  }
  return {
    courseId: r.courseId?.trim() || '',
    courseTitle: r.courseTitle?.trim() || '',
    day: parseInt(r.day) || (i + 1),
    conceptId: r.conceptId || `day_${String(parseInt(r.day) || i + 1).padStart(2, '0')}`,
    postNumber: parseInt(r.postNumber) || 1,
    title: r.title?.trim() || '',
    category: r.category?.trim() || '',
    estimatedReadingTime: r.estimatedReadingTime?.trim() || '',
    content: r.shortExplanation?.trim() || '',
    imageUrl: r.imageUrl?.trim() || '',
    videoUrl: r.videoUrl?.trim() || '',
    audioUrl: r.audioUrl?.trim() || '',
    questions: qs,
  }
}

export default function AdminCourseUploadPage() {
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
        const hasBase = BASE_COLS.every((c) => cols.includes(c))
        if (!hasBase) {
          setError(`CSV must have columns: ${BASE_COLS.join(', ')}`)
          setRows([])
          return
        }
        const parsed = res.data.map(parseRow).filter(Boolean)
        setRows(parsed)
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
      const courseRef = doc(db, 'courses', rows[0].courseId)
      await setDoc(courseRef, { courseId: rows[0].courseId, courseTitle: rows[0].courseTitle, visible: true }, { merge: true })

      const groups = {}
      rows.forEach((r) => {
        const key = `${r.courseId}___${r.day}`
        if (!groups[key]) {
          groups[key] = { ...r, posts: [], questions: r.questions }
        }
        groups[key].posts.push({ postNumber: r.postNumber, title: r.title, content: r.content, imageUrl: r.imageUrl, videoUrl: r.videoUrl, audioUrl: r.audioUrl })
        if (r.questions.length > 0) groups[key].questions = r.questions
      })

      const batch = writeBatch(db)
      const mlCol = collection(db, 'micro_learning')
      Object.values(groups).forEach((g) => {
        const ref = doc(mlCol)
        batch.set(ref, {
          courseId: rows[0].courseId,
          courseTitle: rows[0].courseTitle,
          day: g.day,
          conceptId: g.conceptId,
          title: g.title,
          category: g.category,
          estimatedReadingTime: g.estimatedReadingTime,
          shortExplanation: g.content,
          posts: g.posts,
          questions: g.questions,
        })
      })
      await batch.commit()
      invalidateCachePrefix('allCourses')
      invalidateCachePrefix('learnCourses')
      const dayCount = Object.keys(groups).length
      setResult({ success: true, days: dayCount, posts: rows.length, courseTitle: rows[0].courseTitle })
      setRows([])
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  if (rows.length > 0) {
    const groups = {}
    rows.forEach((r) => {
      const key = `${r.courseId}___${r.day}`
      if (!groups[key]) groups[key] = { ...r, posts: [] }
      groups[key].posts.push(r.postNumber)
    })
    const dayCount = Object.keys(groups).length
    const courseTitle = rows[0]?.courseTitle || ''
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface mb-1">Preview Upload</h1>
        <p className="text-sm text-on-surface-variant mb-4">Course: <strong>{courseTitle}</strong> &middot; {dayCount} day{dayCount > 1 ? 's' : ''} &middot; {rows.length} post{rows.length > 1 ? 's' : ''}</p>
        <div className="bg-green-50 border border-success/30 rounded-xl p-4 mb-4 flex items-center gap-2 text-sm text-green-700">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{rows.length} rows parsed across {dayCount} day(s). Ready to upload.</span>
        </div>
        <div className="max-h-48 overflow-auto border border-outline-variant rounded-xl mb-4">
          <table className="w-full text-xs">
            <thead className="bg-surface-container-low sticky top-0">
              <tr>
                <th className="p-2 text-left">Day</th>
                <th className="p-2 text-left">Post#</th>
                <th className="p-2 text-left">Title</th>
                <th className="p-2 text-left">Questions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-outline-variant">
                  <td className="p-2">Day {r.day}</td>
                  <td className="p-2">{r.postNumber}</td>
                  <td className="p-2 max-w-[200px] truncate">{r.title}</td>
                  <td className="p-2">{r.questions.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setRows([]); if (inputRef.current) inputRef.current.value = '' }}
            className="px-4 py-2 bg-surface-container-low text-on-surface rounded-xl text-sm font-medium hover:bg-surface-container-high transition-all cursor-pointer">
            Cancel
          </button>
          <button onClick={handleUpload} disabled={uploading}
            className="px-6 py-2 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer">
            {uploading ? 'Uploading...' : `Upload ${dayCount} Day(s)`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface mb-1">Upload Course CSV</h1>
      <p className="text-sm text-on-surface-variant mb-6">Import micro-learning courses from a CSV file</p>

      <div className="border-2 border-dashed border-outline-variant rounded-xl p-10 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => inputRef.current?.click()}>
        <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-3">upload_file</span>
        <p className="text-sm text-on-surface-variant mb-1">Drag and drop a CSV file, or click to browse</p>
        <p className="text-xs text-on-surface-variant/60 mb-4">Columns: courseId, courseTitle, day, conceptId, postNumber, title, category, estimatedReadingTime, shortExplanation + q1–q3 + optional imageUrl, videoUrl, audioUrl</p>
        <input ref={inputRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        <span className="inline-block bg-primary text-on-primary px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer">
          Select CSV File
        </span>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-error/30 rounded-xl p-4 flex items-center gap-2 text-sm text-red-700">
          <span className="material-symbols-outlined text-[20px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {result?.success && (
        <div className="mt-4 bg-green-50 border border-success/30 rounded-xl p-4 flex items-center gap-2 text-sm text-green-700">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>Successfully uploaded "{result.courseTitle}" — {result.days} day(s), {result.posts} post(s)</span>
        </div>
      )}
    </div>
  )
}
