import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { FiUpload, FiCheckCircle, FiAlertCircle } from 'react-icons/fi'

const EXPECTED_COLS = ['SN', 'chapter', 'question', 'option-a', 'option-b', 'option-c', 'option-d', 'correct-answer', 'explanation', 'difficulty']

export default function CSVUploader() {
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
          setError(`CSV must have columns: ${EXPECTED_COLS.join(', ')}`)
          setRows([])
          return
        }
        const valid = res.data.map((r, i) => ({
          sn: parseInt(r.SN) || i + 1,
          chapter: r.chapter?.trim(),
          question: r.question?.trim(),
          optionA: r['option-a']?.trim(),
          optionB: r['option-b']?.trim(),
          optionC: r['option-c']?.trim(),
          optionD: r['option-d']?.trim(),
          correctAnswer: r['correct-answer']?.trim().toUpperCase(),
          explanation: r.explanation?.trim(),
          difficulty: r.difficulty?.trim(),
        })).filter((r) => r.question && r.chapter)
        setRows(valid)
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
      const qCol = collection(db, 'questions')
      rows.forEach((r) => {
        const ref = doc(qCol)
        batch.set(ref, r)
      })
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

  return (
    <div>
      {!rows.length && (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-indigo-400 transition">
          <FiUpload size={40} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">Drag and drop a CSV file, or click to browse</p>
          <p className="text-xs text-gray-400 mb-4">Columns: SN, chapter, question, option-a, option-b, option-c, option-d, correct-answer, explanation, difficulty</p>
          <input ref={inputRef} type="file" accept=".csv" onChange={handleFile} className="hidden" id="csvInput" />
          <label htmlFor="csvInput" className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-indigo-700 transition">
            Select CSV File
          </label>
        </div>
      )}

      {rows.length > 0 && (
        <div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-center gap-2 text-green-700">
            <FiCheckCircle />
            <span>{rows.length} questions parsed. Ready to upload.</span>
          </div>
          <div className="max-h-64 overflow-auto border rounded-lg mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Chapter</th>
                  <th className="p-2 text-left">Question</th>
                  <th className="p-2 text-left">Correct</th>
                  <th className="p-2 text-left">Difficulty</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="p-2">{r.sn}</td>
                    <td className="p-2 text-xs">{r.chapter}</td>
                    <td className="p-2 text-xs max-w-xs truncate">{r.question}</td>
                    <td className="p-2">{r.correctAnswer}</td>
                    <td className="p-2">{r.difficulty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 20 && <p className="text-xs text-gray-400 p-2">...and {rows.length - 20} more</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setRows([]); if (inputRef.current) inputRef.current.value = '' }} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition cursor-pointer">
              Cancel
            </button>
            <button onClick={handleUpload} disabled={uploading} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer">
              {uploading ? 'Uploading...' : `Upload ${rows.length} Questions`}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
          <FiAlertCircle />
          <span>{error}</span>
        </div>
      )}

      {result?.success && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2 text-green-700">
          <FiCheckCircle />
          <span>Successfully uploaded {result.count} questions to Firestore!</span>
        </div>
      )}
    </div>
  )
}
