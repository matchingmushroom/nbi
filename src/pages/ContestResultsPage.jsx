import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getContest } from '../lib/contestService'

export default function ContestResultsPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [contest, setContest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedUser, setExpandedUser] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      const c = await getContest(id)
      setContest(c)
      setLoading(false)
    }
    fetch()
  }, [id])

  if (loading) return <div className="h-full flex items-center justify-center"><p className="text-on-surface-variant animate-pulse">Loading results...</p></div>
  if (!contest) return <div className="h-full flex items-center justify-center p-4"><p className="text-on-surface-variant">Contest not found</p></div>

  const rankings = contest.results?.rankings || []
  const winner = rankings[0]
  const isWinner = winner?.userId === profile?.uid

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/30">
          <span className="material-symbols-outlined text-white text-[44px]" style={{fontVariationSettings: "'FILL' 1"}}>emoji_events</span>
        </div>
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface mb-1">{contest.title}</h1>
        <p className="text-sm text-on-surface-variant mb-2">Contest Complete</p>
        <p className="text-3xl font-extrabold text-warning">{contest.potAmount} XP <span className="text-sm font-normal text-on-surface-variant">Pot</span></p>
      </div>

      {winner && (
        <div className={`glass-strong rounded-2xl p-6 mb-6 border-2 text-center ${isWinner ? 'border-amber-400 shadow-lg shadow-amber-500/20' : 'border-white/40'}`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl ${isWinner ? 'bg-amber-100 text-amber-500' : 'bg-surface-container-low text-on-surface-variant'}`}>
            {isWinner ? <span className="material-symbols-outlined text-[36px]" style={{fontVariationSettings: "'FILL' 1"}}>military_tech</span> : <span className="material-symbols-outlined text-[36px]">emoji_events</span>}
          </div>
          <h2 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface mb-1">
            {isWinner ? 'You Won!' : `${winner.displayName} Wins!`}
          </h2>
          <p className="text-2xl font-extrabold text-success mb-2">+{contest.results.prizeAmount} XP</p>
          <p className="text-xs text-on-surface-variant">{winner.score}/{contest.questionCount} correct</p>
        </div>
      )}

      <div className="bg-surface border border-outline-variant rounded-xl p-4 mb-6">
        <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Rankings</h3>
        <div className="space-y-2">
          {rankings.map((r, i) => {
            const isMe = r.userId === profile?.uid
            return (
              <div key={r.userId}>
                <button onClick={() => setExpandedUser(expandedUser === r.userId ? null : r.userId)}
                  className={`w-full bg-surface border rounded-xl p-4 text-left transition-all cursor-pointer ${
                    i === 0 ? 'border-amber-300' : isMe ? 'border-primary border-2' : 'border-outline-variant hover:shadow-sm'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 flex justify-center shrink-0">
                      {i === 0 ? (
                        <span className="material-symbols-outlined text-yellow-500 text-[24px]" style={{fontVariationSettings: "'FILL' 1"}}>military_tech</span>
                      ) : i === 1 ? (
                        <span className="material-symbols-outlined text-gray-400 text-[24px]" style={{fontVariationSettings: "'FILL' 1"}}>military_tech</span>
                      ) : i === 2 ? (
                        <span className="material-symbols-outlined text-orange-400 text-[24px]" style={{fontVariationSettings: "'FILL' 1"}}>military_tech</span>
                      ) : (
                        <span className="text-sm font-bold text-on-surface-variant">{i + 1}</span>
                      )}
                    </div>
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                      {r.displayName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-on-surface truncate">{r.displayName}</p>
                        {isMe && <span className="text-[8px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">You</span>}
                      </div>
                      <p className="text-[11px] text-on-surface-variant">{r.score}/{contest.questionCount} · {r.timeTaken}s</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className={`text-sm font-bold ${r.xpChange > 0 ? 'text-success' : r.xpChange < 0 ? 'text-error' : 'text-on-surface-variant'}`}>
                        {r.xpChange > 0 ? '+' : ''}{r.xpChange} XP
                      </p>
                    </div>
                  </div>
                </button>
                {expandedUser === r.userId && r.answers && (
                  <div className="bg-surface-container-low rounded-xl p-3 mt-1 mb-2 space-y-2 border border-outline-variant/50">
                    {r.answers.map((a, idx) => (
                      <div key={idx} className="text-xs">
                        <p className="font-medium text-on-surface mb-0.5">Q{idx + 1}: {a.question || '—'}</p>
                        <p className={a.isCorrect ? 'text-success font-semibold' : 'text-error font-semibold'}>
                          Your answer: {a.selected || '(none)'} {a.isCorrect ? '✓' : `✗ (correct: ${a.correct})`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => navigate('/contests')} className="flex-1 bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] cursor-pointer">
          Back to Contests
        </button>
        <button onClick={() => navigate('/quiz/select')} className="flex-1 bg-surface border border-outline-variant text-on-surface py-2.5 rounded-xl font-semibold text-sm hover:shadow-sm active:scale-[0.98] cursor-pointer">
          Take a Quiz
        </button>
      </div>
    </div>
  )
}
