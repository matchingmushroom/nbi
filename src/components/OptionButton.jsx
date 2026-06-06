export default function OptionButton({ label, text, selected, correct, revealed, disabled, onClick }) {
  let bg = 'bg-white border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
  if (revealed) {
    if (correct) bg = 'bg-green-100 border-green-500 text-green-800'
    else if (selected) bg = 'bg-red-100 border-red-500 text-red-800'
    else bg = 'bg-gray-50 border-gray-200 text-gray-400'
  } else if (selected) {
    bg = 'bg-indigo-100 border-indigo-500'
  }

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border-2 transition font-medium flex items-center gap-3 ${bg}`}
    >
      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
        revealed && correct ? 'bg-green-500 text-white' :
        revealed && selected ? 'bg-red-500 text-white' :
        'bg-indigo-100 text-indigo-700'
      }`}>
        {label}
      </span>
      <span>{text}</span>
    </button>
  )
}
