import { useState } from 'react'
import OptionButton from './OptionButton'
import { getLetters } from '../lib/utils'

export default function QuestionCard({ question, onNext, total, index }) {
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)

  const letters = getLetters()
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
    <div>
      {/* Question Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <span className="text-xs font-semibold text-primary uppercase tracking-widest bg-primary-fixed px-2 py-0.5 rounded">
            {question.chapter?.split(':')[0]?.trim() || 'Chapter'}
          </span>
          <h2 className="font-['Hanken_Grotesk'] text-lg font-semibold text-on-surface mt-1">
            Question {index + 1} of {total}
          </h2>
        </div>
        <span className="text-xs text-on-surface-variant bg-surface-container-low px-2 py-1 rounded-full">
          {question.difficulty}
        </span>
      </div>

      {/* Question Text */}
      <div className="relative mb-8">
        <div className="absolute top-0 right-0 w-24 h-24 opacity-[0.03] pointer-events-none">
          <svg viewBox="0 0 100 100" className="w-full h-full text-primary fill-current">
            <circle cx="50" cy="50" fill="none" r="40" stroke="currentColor" strokeWidth="2" />
            <path d="M10 50 L90 50 M50 10 L50 90" stroke="currentColor" strokeWidth="1" />
          </svg>
        </div>
        <p className="text-sm md:text-base text-on-surface leading-relaxed font-medium">
          {question.question}
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3">
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

      {/* Feedback */}
      {revealed && (
        <div className="mt-6">
          <div className={`p-4 md:p-5 rounded-xl border-2 ${
            isCorrect ? 'bg-green-50 border-success' : 'bg-red-50 border-error'
          }`}>
            <p className="font-bold text-sm mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">
                {isCorrect ? 'check_circle' : 'cancel'}
              </span>
              {isCorrect ? 'Correct!' : 'Wrong!'}
            </p>
            <p className="text-sm text-on-surface-variant leading-relaxed">{question.explanation}</p>
          </div>
          <button
            onClick={handleNext}
            className="mt-4 w-full bg-primary text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-all active:scale-[0.98] cursor-pointer"
          >
            {index < total - 1 ? 'Save & Next' : 'See Results'}
            <span className="material-symbols-outlined text-[18px] ml-1 align-middle">chevron_right</span>
          </button>
        </div>
      )}
    </div>
  )
}
