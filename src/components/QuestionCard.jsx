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
      {/* Question Meta */}
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <span className="text-[10px] font-semibold text-primary uppercase tracking-widest bg-primary-fixed px-1.5 py-0.5 rounded">
          {question.chapter?.split(':')[0]?.trim() || 'Chapter'}
        </span>
        <span className="text-xs text-on-surface-variant font-medium">Q{index + 1}/{total}</span>
      </div>

      {/* Question Text - natural height, scroll if too long */}
      <div className="shrink-0 max-h-[45%] overflow-y-auto mb-1.5">
        <p className="text-sm md:text-base text-on-surface leading-relaxed font-medium">
          {question.question}
        </p>
      </div>

      {/* Options - close to question */}
      <div className="space-y-1.5 shrink-0">
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

      {/* Spacer - pushes feedback to bottom when revealed */}
      <div className="flex-1 min-h-0" />
      {/* Feedback */}
      {revealed && (
        <div className="shrink-0">
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
