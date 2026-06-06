import CSVUploader from '../components/CSVUploader'

export default function AdminUploadPage() {
  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Upload Questions via CSV</h1>
        <p className="text-on-surface-variant text-sm mt-1">Bulk add questions to the database</p>
      </div>
      <div className="bg-surface border border-outline-variant rounded-xl p-4 mb-6 text-xs font-mono text-on-surface-variant overflow-x-auto shadow-sm">
        SN, chapter, question, option-a, option-b, option-c, option-d, correct-answer, explanation, difficulty, module, mode
      </div>
      <CSVUploader />
    </div>
  )
}
