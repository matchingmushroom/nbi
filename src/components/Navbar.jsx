import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiLogOut, FiUser } from 'react-icons/fi'

export default function Navbar() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <nav className="bg-indigo-700 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/dashboard" className="text-xl font-bold tracking-tight">
          NBI Exam
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {isAdmin ? (
            <>
              <Link to="/admin/users" className="hover:text-indigo-200 transition">Users</Link>
              <Link to="/admin/questions" className="hover:text-indigo-200 transition">Questions</Link>
              <Link to="/admin/upload" className="hover:text-indigo-200 transition">Upload CSV</Link>
            </>
          ) : (
            <>
              <Link to="/quiz/select" className="hover:text-indigo-200 transition">Take Quiz</Link>
              <Link to="/results" className="hover:text-indigo-200 transition">Results</Link>
              <Link to="/leaderboard" className="hover:text-indigo-200 transition">Leaderboard</Link>
            </>
          )}
          <div className="flex items-center gap-2 ml-4 pl-4 border-l border-indigo-500">
            <FiUser />
            <span className="text-xs">{profile?.displayName || profile?.email}</span>
            <button onClick={handleLogout} className="ml-2 hover:text-indigo-200 transition" title="Logout">
              <FiLogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
