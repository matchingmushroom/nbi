import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAllUsersCached } from '../lib/cache'
import { getContestRealtime, joinContest, startContest, deleteContest } from '../lib/contestService'

export default function ContestLobbyPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [contest, setContest] = useState(null)
  const [allUsers, setAllUsers] = useState([])
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [starting, setStarting] = useState(false)
  const [manualReady, setManualReady] = useState(false)
  const [countdown, setCountdown] = useState(15)
  const [error, setError] = useState(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const handleStartRef = useRef(null)
  const timerStartedRef = useRef(false)

  useEffect(() => {
    const init = async () => {
      const users = await getAllUsersCached()
      setAllUsers(users)
      setUsersLoaded(true)
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

  // Auto-join the organizer when lobby loads
  useEffect(() => {
    if (!contest || contest.status !== 'setup') return
    if (contest.organizerId === profile?.uid && contest.participants?.[profile.uid]?.status === 'invited') {
      joinContest(id, profile.uid).catch(() => {})
    }
  }, [contest, id, profile])

  // Auto-start when all participants have joined
  useEffect(() => {
    if (!contest || contest.status !== 'setup' || starting || !usersLoaded) return
    const participants = contest.participants || {}
    const allJoined = Object.values(participants).every((p) => p.status === 'joined')
    if (allJoined && Object.keys(participants).length >= 1) {
      handleStartRef.current?.()
    }
  }, [contest, starting, usersLoaded])

  // 15-second timer for manual start
  useEffect(() => {
    if (!contest || contest.status !== 'setup') return
    const joinedNonOrganizer = Object.entries(contest.participants || {}).some(
      ([uid, p]) => uid !== contest.organizerId && p.status === 'joined'
    )
    if (!joinedNonOrganizer) { timerStartedRef.current = false; setManualReady(false); setCountdown(15); return }
    if (timerStartedRef.current) return
    timerStartedRef.current = true
    setManualReady(false)
    setCountdown(15)
    const cd = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000)
    const tm = setTimeout(() => setManualReady(true), 15000)
    return () => { clearInterval(cd); clearTimeout(tm) }
  }, [contest])

  const isOrganizer = contest?.organizerId === profile?.uid
  const participants = contest ? Object.entries(contest.participants || {}) : []

  const handleJoin = async () => {
    if (joining) return
    setJoining(true)
    try {
      await joinContest(id, profile?.uid)
    } catch (e) {
      setError(e.message || 'Failed to join')
    }
    setJoining(false)
  }

  const handleStart = async () => {
    if (starting) return
    setStarting(true)
    setError(null)
    try {
      const users = await getAllUsersCached()
      await startContest(id, users)
    } catch (e) {
      setError(e.message || 'Failed to start')
      setStarting(false)
    }
  }
  handleStartRef.current = handleStart

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteContest(id)
      navigate('/contests', { replace: true })
    } catch {
      setDeleting(false)
      setShowDelete(false)
    }
  }

  if (loading) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant animate-pulse">Loading lobby...</p></div>
  if (!contest) return <div className="h-full flex items-center justify-center p-4"><p className="text-on-surface-variant">Contest not found</p></div>

  const eligibleCount = participants.filter(([uid]) => {
    const userData = allUsers.find((u) => u.uid === uid)
    return (userData?.xp || 0) >= contest.minBet
  }).length

  const myStatus = contest.participants?.[profile?.uid]?.status
  const hasJoined = myStatus === 'joined'
  const someJoined = participants.some(([uid, p]) => uid !== contest?.organizerId && p.status === 'joined')
  const allJoined = Object.values(contest.participants || {}).every((p) => p.status === 'joined')

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
              const joined = p.status === 'joined'
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
                  {joined && <span className="flex items-center gap-1 text-[10px] text-success font-semibold"><span className="material-symbols-outlined text-[14px]" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>Joined</span>}
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

        {starting ? (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <p className="text-sm text-on-surface font-semibold">Starting contest...</p>
          </div>
        ) : !hasJoined ? (
          <button onClick={handleJoin} disabled={joining}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-all shadow-lg shadow-amber-500/20 cursor-pointer">
            {joining ? 'Joining...' : 'Join Contest'}
          </button>
        ) : isOrganizer ? (
          allJoined ? (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="text-sm text-on-surface font-semibold">All players joined! Starting...</p>
            </div>
          ) : someJoined ? (
            <>
              <button onClick={handleStart}
                disabled={eligibleCount < 2 || (!allJoined && !manualReady)}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-all shadow-lg shadow-amber-500/20 cursor-pointer">
                {eligibleCount < 2
                  ? 'Need at least 2 eligible players'
                  : manualReady || allJoined
                    ? 'Start Contest'
                    : `Start available in ${countdown}s`}
              </button>
              <p className="text-xs text-on-surface-variant mt-2">Contest will auto-start when all players join.</p>
            </>
          ) : (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="text-sm text-on-surface font-semibold">Waiting for players to join...</p>
              <p className="text-xs text-on-surface-variant mt-1">Share the contest link to invite others.</p>
            </div>
          )
        ) : (
          <div className="bg-success/10 border border-success/20 rounded-xl p-4">
            <p className="text-sm text-on-surface font-semibold">You've joined! Waiting for others...</p>
            <p className="text-xs text-on-surface-variant mt-1">Contest will start automatically when all players join.</p>
          </div>
        )}

        {isOrganizer && contest.status === 'setup' && (
          <div className="flex gap-2 mt-3">
            <button onClick={() => { setShowDelete(true) }} disabled={deleting}
              className="flex-1 flex items-center justify-center gap-1 border border-error/30 text-error py-2.5 rounded-xl text-xs font-semibold hover:bg-error/5 transition-all cursor-pointer disabled:opacity-40">
              <span className="material-symbols-outlined text-[15px]">delete</span>
              Delete
            </button>
            <button onClick={() => navigate('/contest/create')}
              className="flex-1 flex items-center justify-center gap-1 border border-primary/30 text-primary py-2.5 rounded-xl text-xs font-semibold hover:bg-primary/5 transition-all cursor-pointer">
              <span className="material-symbols-outlined text-[15px]">add</span>
              Create New
            </button>
          </div>
        )}

        <button onClick={() => navigate('/contests')} className="mt-3 text-xs text-on-surface-variant hover:text-on-surface cursor-pointer">
          Back to Contests
        </button>
      </div>

      {showDelete && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setShowDelete(false)}>
          <div className="bg-surface rounded-xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-on-surface mb-2">Delete Contest?</h3>
            <p className="text-sm text-on-surface-variant mb-4">This cannot be undone. All invites and data will be removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDelete(false)}
                className="flex-1 bg-surface border border-outline-variant py-2.5 rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container-low cursor-pointer">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-error text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
