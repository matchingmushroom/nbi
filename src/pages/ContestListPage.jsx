import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserContests } from '../lib/contestService'

export default function ContestListPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [contests, setContests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      if (!profile?.uid) return
      const data = await getUserContests(profile.uid)
      setContests(data)
      setLoading(false)
    }
    fetch()
  }, [profile])

  const created = contests.filter((c) => c.myRole === 'organizer')
  const invited = contests.filter((c) => c.myRole === 'participant')

  const getStatusBadge = (c) => {
    if (c.status === 'setup') return <span className="text-[10px] font-semibold bg-warning/10 text-warning px-2 py-0.5 rounded-full">Setup</span>
    if (c.status === 'active') return <span className="text-[10px] font-semibold bg-success/10 text-success px-2 py-0.5 rounded-full animate-pulse">Active</span>
    return <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">Completed</span>
  }

  const getAction = (c) => {
    if (c.status === 'setup' && c.myRole === 'organizer') return () => navigate(`/contest/lobby/${c.id}`)
    if (c.status === 'active' && c.myRole === 'participant') return () => navigate(`/contest/play/${c.id}`)
    if (c.status === 'active' && c.myRole === 'organizer') return () => navigate(`/contest/lobby/${c.id}`)
    if (c.status === 'completed') return () => navigate(`/contest/results/${c.id}`)
    if (c.status === 'setup' && c.myRole === 'participant') return () => navigate(`/contest/lobby/${c.id}`)
    return null
  }

  const renderCard = (c) => {
    const participantCount = Object.keys(c.participants || {}).length
    const action = getAction(c)
    return (
      <button key={c.id} onClick={action}
        className="w-full bg-surface border border-outline-variant rounded-xl p-4 text-left hover:shadow-sm transition-all active:scale-[0.98] cursor-pointer">
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-sm font-bold text-on-surface truncate">{c.title}</h3>
              {getStatusBadge(c)}
            </div>
            <p className="text-[11px] text-on-surface-variant">
              {c.myRole === 'organizer' ? 'Created by you' : `by ${c.organizerName}`}
              {' · '}{participantCount} participant{participantCount !== 1 ? 's' : ''}
              {' · '}{c.minBet} XP bet
            </p>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[20px] shrink-0 ml-2">chevron_right</span>
        </div>
        {c.status === 'completed' && c.results?.winnerName && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-outline-variant/30">
            <span className="material-symbols-outlined text-yellow-500 text-[14px]" style={{fontVariationSettings: "'FILL' 1"}}>emoji_events</span>
            <span className="text-[11px] text-on-surface-variant">Winner: <strong className="text-on-surface">{c.results.winnerName}</strong></span>
            {c.results.prizeAmount > 0 && <span className="text-[11px] text-warning font-semibold ml-auto">+{c.results.prizeAmount} XP</span>}
          </div>
        )}
      </button>
    )
  }

  if (loading) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant animate-pulse">Loading contests...</p></div>

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Contests</h1>
          <p className="text-on-surface-variant text-sm mt-1">Create or join XP-based contests</p>
        </div>
        <button onClick={() => navigate('/contest/create')}
          className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Contest
        </button>
      </div>

      {contests.length === 0 && (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-[56px] text-outline-variant mb-3">emoji_events</span>
          <p className="text-base font-semibold text-on-surface mb-1">No contests yet</p>
          <p className="text-sm text-on-surface-variant mb-4">Create your first contest and challenge others!</p>
          <button onClick={() => navigate('/contest/create')}
            className="bg-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm cursor-pointer">
            Create Contest
          </button>
        </div>
      )}

      {created.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Created by You ({created.length})</h2>
          <div className="space-y-2">{created.map(renderCard)}</div>
        </div>
      )}

      {invited.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Invited ({invited.length})</h2>
          <div className="space-y-2">{invited.map(renderCard)}</div>
        </div>
      )}
    </div>
  )
}
