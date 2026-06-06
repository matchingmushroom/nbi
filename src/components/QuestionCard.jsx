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
      <div className="mb-2 text-sm text-gray-500 font-medium">
        Question {index + 1} of {total}
      </div>
      <div className="text-xs text-gray-400 mb-4">
        Chapter: {question.chapter} &middot; Difficulty: {question.difficulty}
      </div>
      <h3 className="text-lg font-semibold mb-6 text-gray-900 leading-relaxed">
        {question.question}
      </h3>
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
      {revealed && (
        <div className="mt-6">
          <div className={`p-4 rounded-lg border-2 ${isCorrect ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'}`}>
            <p className="font-bold text-sm mb-1">
              {isCorrect ? 'Correct!' : 'Wrong!'}
            </p>
            <p className="text-sm text-gray-700">{question.explanation}</p>
          </div>
          <button
            onClick={handleNext}
            className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition cursor-pointer"
          >
            {index < total - 1 ? 'Next Question' : 'See Results'}
          </button>
        </div>
      )}
    </div>
  )
}
