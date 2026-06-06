import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiBookOpen, FiUsers, FiFileText, FiBarChart2 } from 'react-icons/fi'

export default function DashboardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'admin'

  if (isAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-gray-500 mb-6">Welcome, {profile?.displayName || profile?.email}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={() => navigate('/admin/users')} className="bg-white p-6 rounded-xl shadow hover:shadow-md transition text-left cursor-pointer">
            <FiUsers size={28} className="text-indigo-600 mb-3" />
            <h3 className="font-semibold text-lg">Manage Users</h3>
            <p className="text-sm text-gray-500">Create, edit, or delete users</p>
          </button>
          <button onClick={() => navigate('/admin/questions')} className="bg-white p-6 rounded-xl shadow hover:shadow-md transition text-left cursor-pointer">
            <FiFileText size={28} className="text-indigo-600 mb-3" />
            <h3 className="font-semibold text-lg">Manage Questions</h3>
            <p className="text-sm text-gray-500">View, edit, or delete questions</p>
          </button>
          <button onClick={() => navigate('/admin/upload')} className="bg-white p-6 rounded-xl shadow hover:shadow-md transition text-left cursor-pointer">
            <FiBookOpen size={28} className="text-indigo-600 mb-3" />
            <h3 className="font-semibold text-lg">Upload CSV</h3>
            <p className="text-sm text-gray-500">Bulk add questions from CSV</p>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Welcome, {profile?.displayName || 'Student'}!</h1>
      <p className="text-gray-500 mb-6">Ready to test your knowledge?</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button onClick={() => navigate('/quiz/select')} className="bg-white p-8 rounded-xl shadow hover:shadow-md transition text-left cursor-pointer">
          <FiBookOpen size={36} className="text-indigo-600 mb-4" />
          <h3 className="font-semibold text-xl mb-1">Take a Quiz</h3>
          <p className="text-sm text-gray-500">Chapter tests (10 questions) or Final Test (100 questions)</p>
        </button>
        <button onClick={() => navigate('/results')} className="bg-white p-8 rounded-xl shadow hover:shadow-md transition text-left cursor-pointer">
          <FiBarChart2 size={36} className="text-indigo-600 mb-4" />
          <h3 className="font-semibold text-xl mb-1">My Results</h3>
          <p className="text-sm text-gray-500">View your past test attempts and track progress</p>
        </button>
      </div>
      <div className="mt-4">
        <button onClick={() => navigate('/leaderboard')} className="bg-white p-8 rounded-xl shadow hover:shadow-md transition text-left w-full cursor-pointer">
          <FiUsers size={36} className="text-indigo-600 mb-4" />
          <h3 className="font-semibold text-xl mb-1">Leaderboard</h3>
          <p className="text-sm text-gray-500">See top scores in Final Tests</p>
        </button>
      </div>
    </div>
  )
}
