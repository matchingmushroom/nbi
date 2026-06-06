export default function OptionButton({ label, text, selected, correct, revealed, disabled, onClick }) {
  let containerStyle = 'border-outline-variant bg-surface hover:bg-surface-bright'
  let circleStyle = 'border-outline-variant text-on-surface-variant'
  let textStyle = ''

  if (revealed) {
    if (correct) {
      containerStyle = 'border-success bg-green-50'
      circleStyle = 'bg-success text-white border-success'
      textStyle = 'text-success font-medium'
    } else if (selected) {
      containerStyle = 'border-error bg-red-50'
      circleStyle = 'bg-error text-white border-error'
      textStyle = 'text-error font-medium'
    } else {
      containerStyle = 'border-outline-variant bg-gray-50'
      textStyle = 'text-gray-400'
    }
  } else if (selected) {
    containerStyle = 'border-primary bg-[#f0f3ff]'
    circleStyle = 'bg-primary text-white border-primary'
  }

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center p-4 md:p-5 rounded-xl border-2 transition-all duration-200 ${containerStyle} ${
        !revealed && !disabled ? 'hover:border-primary hover:bg-[#f0f3ff] active:scale-[0.99]' : ''
      } cursor-pointer`}
    >
      <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center mr-4 shrink-0 transition-colors ${circleStyle}`}>
        <span className="text-sm font-bold">{label}</span>
      </div>
      <span className={`text-sm md:text-base text-left leading-relaxed ${textStyle}`}>{text}</span>
    </button>
  )
}
