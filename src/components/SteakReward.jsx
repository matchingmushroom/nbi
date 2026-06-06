import ConfettiEffect from './ConfettiEffect'

const STEAK_LEVELS = [
  { max: 0, label: 'Not Started', emoji: '🥩', desc: 'Your steak journey starts today!' },
  { max: 5, label: 'Raw', emoji: '🥩', desc: 'Your steak is just getting started — still raw!' },
  { max: 15, label: 'Medium-Rare', emoji: '🍖', desc: 'Coming along nicely — medium-rare perfection!' },
  { max: 25, label: 'Medium', emoji: '🍖', desc: 'Getting there — cooked to a solid medium!' },
  { max: 30, label: 'Perfectly Grilled Masterpiece', emoji: '🏆', desc: 'Well done! A perfectly grilled masterpiece!' },
]

function getSteakLevel(steak) {
  if (steak <= 0) return STEAK_LEVELS[0]
  if (steak <= 5) return STEAK_LEVELS[1]
  if (steak <= 15) return STEAK_LEVELS[2]
  if (steak <= 25) return STEAK_LEVELS[3]
  return STEAK_LEVELS[4]
}

export default function SteakReward({ result, courseTitle, onBack, onRetry }) {
  const steak = result.newSteak || 0
  const level = getSteakLevel(steak)

  if (result.passed) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <ConfettiEffect active={true} />
        <div className="bg-surface border border-outline-variant rounded-xl p-6 text-center shadow-sm max-w-sm w-full">
          <div className="text-5xl mb-3">{level.emoji}</div>
          <h2 className="font-['Hanken_Grotesk'] text-2xl font-bold text-success">Day Complete!</h2>
          <p className="text-xs text-on-surface-variant mt-1 mb-4">{courseTitle}</p>

          <div className="bg-success/10 border border-success/20 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm font-bold text-success">{result.score}/{result.total} Correct</p>
            {result.steakChanged && (
              <p className="text-lg font-extrabold text-warning mt-1">
                <span className="material-symbols-outlined text-[20px] align-text-bottom" style={{fontVariationSettings: "'FILL' 1"}}>local_fire_department</span>
                Steak Saved! Day {result.newSteak}
              </p>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-xs text-on-surface-variant">Steak Level:</span>
            <span className="text-sm font-bold text-on-surface">{level.label}</span>
          </div>

          <p className="text-xs text-on-surface-variant mb-4">{level.desc}</p>

          {(result.xpGained || 0) > 0 && (
            <div className="flex items-center justify-center gap-1 text-sm mb-4">
              <span className="material-symbols-outlined text-warning text-[18px]">stars</span>
              <span className="font-bold text-on-surface">+{result.xpGained} XP</span>
            </div>
          )}

          <button
            onClick={onBack}
            className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
          >
            Back to Course
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="bg-surface border border-outline-variant rounded-xl p-6 text-center shadow-sm max-w-sm w-full">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-[32px] text-error">cancel</span>
        </div>
        <h2 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface mb-1">Keep Trying!</h2>
        <p className="text-xs text-on-surface-variant mb-4">You need at least 2/3 correct to pass</p>

        <div className="bg-red-50 border border-error/20 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm font-bold text-error">{result.score}/{result.total} Correct</p>
        </div>

        <div className="space-y-2 mb-4 text-left max-h-40 overflow-y-auto">
          {result.details?.map((d, i) => (
            <div key={i} className={`p-2 rounded-lg border text-xs ${d.isCorrect ? 'bg-green-50 border-success/30' : 'bg-red-50 border-error/30'}`}>
              <p className="font-medium mb-0.5">Q{i + 1}: {d.isCorrect ? '✅' : '❌'} Correct answer: {d.options[d.correct]}</p>
              <p className="text-on-surface-variant">{d.explanation}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onBack} className="flex-1 bg-surface-container-low text-on-surface py-2.5 rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-all cursor-pointer">
            Back
          </button>
          <button onClick={onRetry} className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer">
            Try Again
          </button>
        </div>
      </div>
    </div>
  )
}
