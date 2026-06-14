import { useState, useRef } from 'react'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '../lib/firebase'

const TYPE_CONFIG = {
  image: { accept: 'image/*', icon: 'image', label: 'Image' },
  video: { accept: 'video/*', icon: 'videocam', label: 'Video' },
  audio: { accept: 'audio/*', icon: 'audiotrack', label: 'Audio' },
}

export default function MediaUploader({ mediaType, courseId, onUpload, currentUrl, onRemove }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const inputRef = useRef(null)
  const urlInputRef = useRef(null)
  const cfg = TYPE_CONFIG[mediaType] || TYPE_CONFIG.image

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    setProgress(0)

    const ext = file.name.split('.').pop()
    const filename = `${mediaType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`
    const storageRef = ref(storage, `courses/${courseId}/media/${filename}`)
    const task = uploadBytesResumable(storageRef, file)

    task.on(
      'state_changed',
      (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => { setError(err.message); setUploading(false) },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        setUploading(false)
        onUpload?.(url)
      }
    )
  }

  const handlePasteUrl = () => {
    const trimmed = urlValue.trim()
    if (!trimmed) return
    setError(null)
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setError('URL must start with http:// or https://')
      return
    }
    onUpload?.(trimmed)
    setUrlValue('')
    setShowUrlInput(false)
  }

  const openUrlInput = () => {
    setShowUrlInput(true)
    setUrlValue('')
    setTimeout(() => urlInputRef.current?.focus(), 50)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input ref={inputRef} type="file" accept={cfg.accept} onChange={handleFile} className="hidden" />
      {currentUrl ? (
        <div className="flex items-center gap-1.5">
          <a href={currentUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-primary underline truncate max-w-[140px]" title={currentUrl}>{currentUrl.split('/').pop() || 'link'}</a>
          {onRemove && (
            <button onClick={onRemove} type="button"
              className="p-0.5 text-error hover:bg-error/5 rounded cursor-pointer" title="Remove">
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
          <span className="text-[10px] text-on-surface-variant mx-0.5">|</span>
          <button onClick={() => inputRef.current?.click()} type="button"
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-on-surface-variant hover:text-primary hover:bg-[#f0f3ff] rounded-lg transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[13px]">upload</span>
            Replace
          </button>
        </div>
      ) : uploading ? (
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-outline-variant rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[10px] text-on-surface-variant">{progress}%</span>
        </div>
      ) : (
        <>
          <button onClick={() => inputRef.current?.click()} type="button"
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-on-surface-variant hover:text-primary hover:bg-[#f0f3ff] rounded-lg transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[14px]">{cfg.icon}</span>
            {cfg.label}
          </button>
          {!showUrlInput && (
            <button onClick={openUrlInput} type="button"
              className="text-[10px] text-on-surface-variant/60 hover:text-primary underline cursor-pointer">
              or paste URL
            </button>
          )}
        </>
      )}
      {showUrlInput && (
        <div className="flex items-center gap-1 w-full mt-1">
          <input ref={urlInputRef} type="url" value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handlePasteUrl(); if (e.key === 'Escape') setShowUrlInput(false) }}
            placeholder="Paste any URL (Google Drive, YouTube, ...)"
            className="flex-1 px-2.5 py-1.5 text-[11px] border border-outline-variant rounded-lg bg-surface text-on-surface outline-none focus:ring-2 focus:ring-primary/30" />
          <button onClick={handlePasteUrl} type="button"
            className="p-1.5 text-primary hover:bg-[#f0f3ff] rounded-lg cursor-pointer" title="Confirm">
            <span className="material-symbols-outlined text-[16px]">check</span>
          </button>
          <button onClick={() => setShowUrlInput(false)} type="button"
            className="p-1.5 text-on-surface-variant hover:bg-gray-100 rounded-lg cursor-pointer" title="Cancel">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}
      {error && <span className="text-[10px] text-error w-full">{error}</span>}
    </div>
  )
}
