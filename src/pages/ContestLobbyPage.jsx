import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAllUsersCached } from '../lib/cache'
import { getContestRealtime, startContest } from '../lib/contestService'

export default function ContestLobbyPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [contest, setContest] = useState(null)
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const init = async () => {
      const users = await getAllUsersCached()
      setAllUsers(users)
    }
    init()
    const unsub = getContestRealtime(id, (c) => {
      setContest(c)
      setLoading(false)
      if (c?.status === 'active') navigate(`/contest/play/${id}`, { replace: true })
      if (c?.status === 'completed') navigate(`/contest/results/${id}`, { replace: true })
    })
    return unsub
  }, [id, navigate])

  const isOrganizer = contest?.organizerId === profile?.uid
  const participants = contest ? Object.entries(contest.participants || {}) : []

  const handleStart = async () => {
    if (starting) return
    setStarting(true)
    setError(null)
    try {
      await startContest(id, allUsers)
    } catch (e) {
      setError(e.message || 'Failed to start')
      setStarting(false)
    }
  }

  if (loading) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant animate-pulse">Loading lobby...</p></div>
  if (!contest) return <div className="h-full flex items-center justify-center p-4"><p className="text-on-surface-variant">Contest not found</p></div>

  const eligibleCount = participants.filter(([, p]) => (p.xpAtJoin || 0) >= contest.minBet).length

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto flex flex-col items-center justify-center min-h-full">
      <div className="glass-strong rounded-2xl p-6 md:p-8 w-full border border-white/40 text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="material-symbols-outlined text-white text-[32px]" style={{fontVariationSettings: "'FILL' 1"}}>emoji_events</span>
        </div>
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface mb-1">{contest.title}</h1>
        <p className="text-sm text-on-surface-variant mb-5">
          by {contest.organizerName}
          {' · '}{contest.minBet} XP bet
          {' · '}{contest.questionCount} Qs · {contest.timerMinutes} min
        </p>

        {error && (
          <div className="mb-4 bg-error/5 border border-error/20 rounded-xl p-3">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        <div className="mb-5">
          <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
            Players ({participants.length})
          </h3>
          <div className="space-y-2">
            {participants.map(([uid, p]) => {
              const userData = allUsers.find((u) => u.uid === uid) || {}
              const xp = userData.xp || 0
              const eligible = xp >= contest.minBet
              return (
                <div key={uid}
                  className={`flex items-center gap-3 p-3 rounded-xl ${eligible ? 'bg-surface border border-outline-variant' : 'bg-error/5 border border-error/20'}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${uid === contest.organizerId ? 'bg-amber-500' : eligible ? 'bg-primary' : 'bg-error'}`}>
                    {(p.displayName || userData.displayName || userData.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-on-surface truncate">{p.displayName || userData.displayName || userData.email || 'Unknown'}</p>
                      {uid === contest.organizerId && <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded">Host</span>}
                    </div>
                    <p className="text-[11px] text-on-surface-variant">{xp} XP available</p>
                  </div>
                  {!eligible && <span className="text-[10px] text-error font-semibold whitespace-nowrap">Insufficient XP</span>}
                  {eligible && uid !== profile?.uid && !p.eligible === false && (
                    <span className="material-symbols-outlined text-success text-[18px]" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="glass rounded-xl p-4 mb-5 grid grid-cols-3 gap-3">
          <div>
            <p className="text-xl font-bold text-primary">{eligibleCount}</p>
            <p className="text-[10px] text-on-surface-variant">Eligible</p>
          </div>
          <div>
            <p className="text-xl font-bold text-warning">{contest.minBet * eligibleCount} XP</p>
            <p className="text-[10px] text-on-surface-variant">Total Pot</p>
          </div>
          <div>
            <p className="text-xl font-bold text-success">{contest.minBet * (eligibleCount - 1)} XP</p>
            <p className="text-[10px] text-on-surface-variant">Winner Prize</p>
          </div>
        </div>

        {isOrganizer ? (
          <button onClick={handleStart} disabled={starting || eligibleCount < 2}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-all shadow-lg shadow-amber-500/20 cursor-pointer">
            {starting ? 'Starting...' : eligibleCount < 2 ? 'Need at least 2 eligible players' : 'Start Contest'}
          </button>
        ) : (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <p className="text-sm text-on-surface font-semibold">Waiting for organizer to start the contest...</p>
            <p className="text-xs text-on-surface-variant mt-1">Stay on this page — you'll be redirected automatically.</p>
          </div>
        )}

        <button onClick={() => navigate('/contests')} className="mt-3 text-xs text-on-surface-variant hover:text-on-surface cursor-pointer">
          Back to Contests
        </button>
      </div>
    </div>
  )
}
