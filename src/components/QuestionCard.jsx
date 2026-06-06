import { useState } from 'react'
import OptionButton from './OptionButton'

export default function QuestionCard({ question, onNext, total, index }) {
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)

  const options = [
    { label: 'A', text: question.optionA },
    { label: 'B', text: question.optionB },
    { label: 'C', text: question.optionC },
    { label: 'D', text: question.optionD },
  ]

  const correctLetter = question.correctAnswer.toUpperCase()
  const isCorrect = selected === correctLetter

  const handleSelect = (label) => {
    if (revealed) return
    setSelected(label)
    setRevealed(true)
  }

  const handleNext = () => {
    onNext({ selected, correct: correctLetter, isCorrect })
    setSelected(null)
    setRevealed(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {question.module && (
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest bg-surface-container-low px-1.5 py-0.5 rounded">
              {question.module}
            </span>
          )}
          {question.mode && (
            <span className="text-[10px] font-semibold text-primary uppercase tracking-widest bg-primary-fixed px-1.5 py-0.5 rounded">
              {question.mode}
            </span>
          )}
          <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest bg-surface-container-low px-1.5 py-0.5 rounded">
            {question.chapter?.split(':')[0]?.trim() || 'Chapter'}
          </span>
          <span className="text-xs text-on-surface-variant font-medium">Q{index + 1}/{total}</span>
        </div>

        <p className="text-sm md:text-base text-on-surface leading-relaxed font-medium mb-3">
          {question.question}
        </p>

        <div className="space-y-1.5 pb-2">
          {options.map((opt) => (
            <OptionButton
              key={opt.label}
              label={opt.label}
              text={opt.text}
              selected={selected === opt.label}
              correct={opt.label === correctLetter}
              revealed={revealed}
              disabled={revealed}
              onClick={() => handleSelect(opt.label)}
            />
          ))}
        </div>
      </div>

      {/* Fixed footer - always on screen when revealed */}
      {revealed && (
        <div className="shrink-0 pt-2 border-t border-outline-variant mt-2">
          <div className={`p-2.5 rounded-lg border ${
            isCorrect ? 'bg-green-50 border-success' : 'bg-red-50 border-error'
          }`}>
            <p className="font-bold text-xs flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">
                {isCorrect ? 'check_circle' : 'cancel'}
              </span>
              {isCorrect ? 'Correct!' : 'Wrong!'}
            </p>
            <p className="text-xs text-on-surface-variant leading-snug mt-0.5">{question.explanation}</p>
          </div>
          <button
            onClick={handleNext}
            className="mt-2 w-full bg-primary text-white py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1"
          >
            <span>{index < total - 1 ? 'Save & Next' : 'See Results'}</span>
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      )}
    </div>
  )
}
