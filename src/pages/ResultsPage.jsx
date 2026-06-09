import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function ResultsPage() {
  const navigate = useNavigate()
  useEffect(() => { navigate('/leaderboard', { replace: true }) }, [navigate])
  return null
}