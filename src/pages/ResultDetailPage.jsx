import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { formatDate } from '../lib/utils'

export default function ResultDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [questionMap, setQuestionMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDoc(doc(db, 'results', id))
      if (!snap.exists()) { navigate('/results'); return }
      const data = { id: snap.id, ...snap.data() }
      setResult(data)

      const qSnap = await getDocs(collection(db, 'questions'))
      const map = {}
      qSnap.docs.forEach((d) => {
        const q = d.data()
        map[q.question] = q
      })
      setQuestionMap(map)
      setLoading(false)
    }
    fetch()
  }, [id, navigate])

  if (loading) return <div className="md:ml-64 p-8 pb-20 flex justify-center items-center min-h-[60vh]"><p className="text-on-surface-variant">Loading...</p></div>
  if (!result) return null

  const getOptionText = (q, letter) => {
    if (!q) return ''
    const map = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }
    return map[letter] || ''
  }

  return (
    <div className="md:ml-64 p-4 md:p-8 pb-24 md:pb-8 max-w-3xl mx-auto">
      <button onClick={() => navigate('/results')} className="flex items-center gap-1 text-sm text-primary font-semibold hover:underline mb-4 cursor-pointer">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Results
      </button>

      {/* Header Card */}
      <div className="bg-surface border border-outline-variant rounded-xl p-5 md:p-6 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface">{result.chapter}</h1>
            <p className="text-xs text-on-surface-variant mt-1">{formatDate(result.completedAt)}</p>
          </div>
          <div className="flex gap-4 items-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{result.score}<span className="text-sm text-on-surface-variant font-normal">/{result.totalQuestions}</span></p>
              <p className="text-xs text-on-surface-variant">Score</p>
            </div>
            <div className="w-px h-8 bg-outline-variant" />
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{result.percentage}%</p>
              <p className="text-xs text-on-surface-variant">Accuracy</p>
            </div>
            <div className="w-px h-8 bg-outline-variant" />
            <div className="text-center">
              <p className="text-sm font-bold text-on-surface">
                {result.timeTaken ? `${Math.floor(result.timeTaken / 60)}m ${result.timeTaken % 60}s` : 'N/A'}
              </p>
              <p className="text-xs text-on-surface-variant">Time</p>
            </div>
          </div>
        </div>
      </div>

      {/* Question Review */}
      <h2 className="text-sm font-semibold text-on-surface mb-4">Question Review</h2>
      <div className="space-y-3">
        {result.answers?.map((ans, i) => {
          const q = questionMap[ans.questionId] || null
          return (
            <div key={i} className={`bg-surface border rounded-xl p-4 md:p-5 border-l-4 ${
              ans.isCorrect ? 'border-l-success' : 'border-l-error'
            } shadow-sm`}>
              <div className="flex gap-3">
                <div className="mt-0.5 shrink-0">
                  {ans.isCorrect
                    ? <span className="material-symbols-outlined text-success text-[20px]">check_circle</span>
                    : <span className="material-symbols-outlined text-error text-[20px]">cancel</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface mb-3">
                    <span className="text-on-surface-variant">Q{i + 1}.</span> {q?.question || 'Question not found'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {['A', 'B', 'C', 'D'].map((l) => (
                      <div key={l} className={`text-xs p-2.5 rounded-lg ${
                        ans.correct === l ? 'bg-green-50 border border-success text-success font-medium' :
                        ans.selected === l && ans.selected !== ans.correct ? 'bg-red-50 border border-error text-error font-medium' :
                        'bg-surface-container-low text-on-surface-variant'
                      }`}>
                        <span className="font-bold">{l}.</span> {q ? getOptionText(q, l) : ''}
                        {ans.correct === l && <span className="ml-1">✓</span>}
                        {ans.selected === l && ans.selected !== ans.correct && <span className="ml-1">✗</span>}
                      </div>
                    ))}
                  </div>
                  {q?.explanation && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-800 leading-relaxed">
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
