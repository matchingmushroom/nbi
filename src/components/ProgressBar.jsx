export default function ProgressBar({ current, total }) {
  const pct = total > 0 ? ((current) / total) * 100 : 0
  return (
    <div className="w-full bg-gray-200 rounded-full h-3 mb-6 overflow-hidden">
      <div
        className="bg-indigo-600 h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
