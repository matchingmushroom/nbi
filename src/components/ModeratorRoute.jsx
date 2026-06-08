import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ModeratorRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="flex justify-center items-center min-h-screen text-xl">Loading...</div>
  if (!user || (profile?.role !== 'admin' && profile?.role !== 'moderator')) return <Navigate to="/dashboard" replace />
  return children
}
