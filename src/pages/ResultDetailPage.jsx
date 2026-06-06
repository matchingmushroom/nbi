import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { formatDate } from '../lib/utils'
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa'

export default function ResultDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [questionMap, setQuestionMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDoc(doc(db, 'results', id))
      if (!snap.exists()) {
        navigate('/results')
        return
      }
      const data = { id: snap.id, ...snap.data() }
      setResult(data)

      const qSnap = await getDocs(collection(db, 'questions'))
      const map = {}
      qSnap.docs.forEach((d) => {
        const q = d.data()
        if (data.answers && data.answers.length > 0) {
          map[q.question] = q
        }
      })
      setQuestionMap(map)
      setLoading(false)
    }
    fetch()
  }, [id, navigate])

  if (loading) return <div className="flex justify-center items-center min-h-[60vh] text-xl">Loading...</div>
  if (!result) return null

  const getOptionText = (q, letter) => {
    if (!q) return ''
    const map = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }
    return map[letter] || ''
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button onClick={() => navigate('/results')} className="text-indigo-600 hover:underline mb-4 inline-block cursor-pointer">&larr; Back to Results</button>
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h1 className="text-xl font-bold">{result.chapter}</h1>
        <p className="text-gray-500 text-sm mt-1">{formatDate(result.completedAt)}</p>
        <div className="mt-4 flex gap-6">
          <div>
            <span className="text-3xl font-bold text-indigo-700">{result.score}</span>
            <span className="text-gray-400">/{result.totalQuestions}</span>
          </div>
          <div className="text-sm text-gray-500">
            <p>Percentage: <strong>{result.percentage}%</strong></p>
            <p>Time: <strong>{result.timeTaken ? `${Math.floor(result.timeTaken / 60)}m ${result.timeTaken % 60}s` : 'N/A'}</strong></p>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-4">Question Review</h2>
      <div className="space-y-4">
        {result.answers?.map((ans, i) => {
          const q = questionMap[ans.questionId] || null
          return (
            <div key={i} className={`bg-white rounded-xl shadow p-5 border-l-4 ${ans.isCorrect ? 'border-l-green-500' : 'border-l-red-500'}`}>
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {ans.isCorrect ? <FaCheckCircle className="text-green-500" /> : <FaTimesCircle className="text-red-500" />}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 mb-2">Q{i + 1}. {q?.question || 'Question not found'}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {['A', 'B', 'C', 'D'].map((l) => (
                      <div key={l} className={`p-2 rounded ${
                        ans.correct === l ? 'bg-green-100 text-green-800 font-medium' :
                        ans.selected === l && ans.selected !== ans.correct ? 'bg-red-100 text-red-800 font-medium' :
                        'bg-gray-50'
                      }`}>
                        <span className="font-bold">{l}.</span> {q ? getOptionText(q, l) : ''}
                        {ans.correct === l && <span className="ml-1 text-xs text-green-600">(Correct)</span>}
                        {ans.selected === l && ans.selected !== ans.correct && <span className="ml-1 text-xs text-red-600">(Your answer)</span>}
                      </div>
                    ))}
                  </div>
                  {q?.explanation && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                      <strong>Explanation:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
