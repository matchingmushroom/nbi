import { useState } from 'react'
import CSVUploader from '../components/CSVUploader'
import MicroLearningUploader from '../components/MicroLearningUploader'

const TABS = [
  { key: 'questions', label: 'Questions CSV' },
  { key: 'microlearning', label: 'Micro-Learning CSV' },
]

export default function AdminUploadPage() {
  const [tab, setTab] = useState('questions')

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Upload CSV</h1>
        <p className="text-on-surface-variant text-sm mt-1">Bulk add data to the database</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-container-low rounded-xl p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              tab === t.key
                ? 'bg-surface text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'questions' && (
        <>
          <div className="bg-surface border border-outline-variant rounded-xl p-4 mb-6 text-xs font-mono text-on-surface-variant overflow-x-auto shadow-sm">
            SN, chapter, question, option-a, option-b, option-c, option-d, correct-answer, explanation, difficulty, module, mode
          </div>
          <CSVUploader />
        </>
      )}

      {tab === 'microlearning' && <MicroLearningUploader />}
    </div>
  )
}
