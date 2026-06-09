import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { formatDate } from '../lib/utils'

export default function ResultDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDoc(doc(db, 'results', id))
      if (!snap.exists()) { navigate('/results'); return }
      setResult({ id: snap.id, ...snap.data() })
      setLoading(false)
    }
    fetch()
  }, [id, navigate])

  if (loading) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant">Loading...</p></div>
  if (!result) return null

  const getTitle = (r) => {
    const qt = r.quizType || r.testType || 'chapter'
    if (qt === 'chapter') return r.chapter || 'Chapter Test'
    if (qt === 'module') return r.module || 'Module Test'
    if (qt === 'mode') {
      if (r.mode === 'Book') return 'Self-Paced (Book)'
      if (r.mode === 'Physical') return 'Instructor-Led (Physical)'
      return r.mode || 'Mode Test'
    }
    return 'Final Mock Test'
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
      <button onClick={() => navigate('/results')} className="flex items-center gap-1 text-sm text-primary font-semibold hover:underline mb-4 cursor-pointer">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Results
      </button>

      {/* Header Card */}
      <div className="bg-surface border border-outline-variant rounded-xl p-5 md:p-6 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface">{getTitle(result)}</h1>
            <p className="text-xs text-on-surface-variant mt-1">
              {result.module && <span className="mr-2">{result.module}</span>}
              {result.mode && <span className="mr-2 text-primary">{result.mode}</span>}
              {result.chapter && <span className="mr-2 text-on-surface-variant">{result.chapter}</span>}
              {formatDate(result.completedAt)}
            </p>
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
            {result.xpEarned > 0 && (
              <>
                <div className="text-center">
                  <p className="text-sm font-bold text-warning">+{result.xpEarned}</p>
                  <p className="text-xs text-on-surface-variant">XP</p>
                </div>
                <div className="w-px h-8 bg-outline-variant" />
              </>
            )}
            <div className="text-center">
              <p className="text-sm font-bold text-on-surface">
                {result.timeTaken ? `${Math.floor(result.timeTaken / 60)}m ${result.timeTaken % 60}s` : 'N/A'}
              </p>
              <p className="text-xs text-on-surface-variant">Time</p>
            </div>
          </div>
        </div>
      </div>


    </div>
  )
}
