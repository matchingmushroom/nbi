import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { FiChevronRight, FiAward } from 'react-icons/fi'

export default function QuizSelectPage() {
  const navigate = useNavigate()
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [questionCount, setQuestionCount] = useState(0)

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(collection(db, 'questions'))
      const qs = snap.docs.map((d) => d.data())
      setQuestionCount(qs.length)
      const map = {}
      qs.forEach((q) => {
        const ch = q.chapter || 'Unknown'
        if (!map[ch]) map[ch] = 0
        map[ch]++
      })
      setChapters(Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])))
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) return <div className="flex justify-center items-center min-h-[60vh] text-xl">Loading...</div>

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Select Quiz Mode</h1>
      <p className="text-gray-500 mb-6">{questionCount} total questions available</p>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FiAward className="text-yellow-500" /> Final Test
        </h2>
        <button
          onClick={() => navigate('/quiz/final')}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-5 rounded-xl shadow hover:shadow-lg transition text-left cursor-pointer"
        >
          <h3 className="text-lg font-bold">Final Test — 100 Questions</h3>
          <p className="text-sm text-indigo-200 mt-1">
            20% Beginner &middot; 30% Intermediate &middot; 50% Expert
          </p>
        </button>
      </div>

      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <FiChevronRight className="text-indigo-500" /> Chapter Tests (10 Questions Each)
      </h2>
      <div className="space-y-2">
        {chapters.length === 0 && (
          <p className="text-gray-400 text-center py-8">No chapters available yet. Contact your admin.</p>
        )}
        {chapters.map(([chapter, count]) => (
          <button
            key={chapter}
            onClick={() => navigate(`/quiz/chapter/${encodeURIComponent(chapter)}`)}
            className="w-full bg-white p-4 rounded-xl shadow hover:shadow-md transition flex items-center justify-between cursor-pointer"
          >
            <div>
              <h3 className="font-semibold text-left">{chapter}</h3>
              <p className="text-sm text-gray-500 text-left">{count} question{count !== 1 ? 's' : ''} available</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400">{Math.min(count, 10)} questions</span>
              <FiChevronRight className="text-gray-400 ml-2 inline" />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
