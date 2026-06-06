import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../lib/utils'
import { FiEye } from 'react-icons/fi'

export default function ResultsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const fetch = async () => {
      const q = query(
        collection(db, 'results'),
        where('userId', '==', profile?.uid),
        orderBy('completedAt', 'desc')
      )
      const snap = await getDocs(q)
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setResults(data)
      setLoading(false)
    }
    fetch()
  }, [profile])

  const filtered = filter === 'all' ? results : results.filter((r) => r.testType === filter)

  if (loading) return <div className="flex justify-center items-center min-h-[60vh] text-xl">Loading...</div>

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">My Results</h1>
      <p className="text-gray-500 mb-6">View all your test attempts and track your progress</p>

      <div className="flex gap-2 mb-4">
        {['all', 'chapter', 'final'].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition cursor-pointer ${
              filter === t ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {t === 'all' ? 'All' : t === 'chapter' ? 'Chapter Tests' : 'Final Tests'}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">No results found.</p>
          <p className="text-sm mt-1">Take a quiz to see your results here.</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((r) => (
          <div key={r.id} className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{r.chapter}</h3>
              <p className="text-sm text-gray-500">
                Score: <span className="font-bold text-indigo-600">{r.score}</span>/{r.totalQuestions} &middot; {r.percentage}% &middot; {formatDate(r.completedAt)}
              </p>
            </div>
            <button
              onClick={() => navigate(`/results/${r.id}`)}
              className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium text-sm cursor-pointer"
            >
              <FiEye /> View
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
