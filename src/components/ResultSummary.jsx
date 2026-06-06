import { useNavigate } from 'react-router-dom'
import { FaCheckCircle, FaTimesCircle, FaTrophy } from 'react-icons/fa'

export default function ResultSummary({ score, total, answers, chapter }) {
  const navigate = useNavigate()
  const pct = Math.round((score / total) * 100)

  const getGrade = () => {
    if (pct >= 80) return { label: 'Excellent!', color: 'text-green-600', icon: <FaTrophy size={40} /> }
    if (pct >= 60) return { label: 'Good Job!', color: 'text-blue-600', icon: <FaCheckCircle size={40} /> }
    if (pct >= 40) return { label: 'Keep Trying', color: 'text-yellow-600', icon: <FaCheckCircle size={40} /> }
    return { label: 'Needs Improvement', color: 'text-red-600', icon: <FaTimesCircle size={40} /> }
  }

  const grade = getGrade()

  return (
    <div className="max-w-md mx-auto text-center">
      <div className={`${grade.color} flex justify-center mb-2`}>{grade.icon}</div>
      <h2 className="text-2xl font-bold mb-1">{grade.label}</h2>
      <p className="text-gray-500 mb-6">{chapter}</p>
      <div className="text-6xl font-extrabold text-indigo-700 mb-2">{score}<span className="text-2xl text-gray-400">/{total}</span></div>
      <p className="text-lg text-gray-500 mb-8">{pct}% Accuracy</p>
      <div className="flex gap-3">
        <button
          onClick={() => navigate('/quiz/select')}
          className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition cursor-pointer"
        >
          Back to Quiz Select
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition cursor-pointer"
        >
          Dashboard
        </button>
      </div>
    </div>
  )
}
