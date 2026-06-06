import CSVUploader from '../components/CSVUploader'

export default function AdminUploadPage() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Upload Questions via CSV</h1>
      <p className="text-gray-500 mb-6">
        Bulk add questions to the database. CSV must have these exact columns:
      </p>
      <div className="bg-gray-50 rounded-xl p-4 mb-6 text-sm font-mono text-gray-600 overflow-x-auto">
        SN, chapter, question, option-a, option-b, option-c, option-d, correct-answer, explanation, difficulty
      </div>
      <CSVUploader />
    </div>
  )
}
