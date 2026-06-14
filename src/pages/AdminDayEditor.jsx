import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { getCourseDays } from '../lib/learnService'
import { invalidateCachePrefix } from '../lib/cache'
import MediaUploader from '../components/MediaUploader'
import MediaRenderer from '../components/MediaRenderer'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

export default function AdminDayEditor() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingDay, setEditingDay] = useState(null)
  const [dayPosts, setDayPosts] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [courseTitle, setCourseTitle] = useState('')

  useEffect(() => {
    (async () => {
      setLoading(true)
      const data = await getCourseDays(courseId)
      setDays(data)
      setCourseTitle(data[0]?.courseTitle || courseId)
      setLoading(false)
    })()
  }, [courseId])

  useEffect(() => {
    if (saveMsg) { const t = setTimeout(() => setSaveMsg(null), 3000); return () => clearTimeout(t) }
  }, [saveMsg])

  const openDay = (day) => {
    const d = days.find((x) => x.day === day)
    if (!d) return
    const posts = d.posts?.length > 0
      ? d.posts.map((p) => ({ ...p }))
      : [{ postNumber: 1, title: d.title, content: d.shortExplanation || '', imageUrl: '', videoUrl: '', audioUrl: '' }]
    setDayPosts(posts)
    setEditingDay(day)
  }

  const updatePost = (idx, field, value) => {
    setDayPosts((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  const handleMediaUpload = (idx, field, url) => {
    updatePost(idx, field, url)
  }

  const removeMedia = (idx, field) => {
    updatePost(idx, field, '')
  }

  const saveDay = async () => {
    if (!editingDay) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const existing = days.find((d) => d.day === editingDay)
      if (!existing) { setSaving(false); return }
      const ref = doc(db, 'micro_learning', existing.id)
      await setDoc(ref, { posts: dayPosts }, { merge: true })
      invalidateCachePrefix('allCourses')
      setSaveMsg({ type: 'success', text: `Day ${editingDay} saved` })
      const fresh = await getCourseDays(courseId)
      setDays(fresh)
    } catch (err) {
      setSaveMsg({ type: 'error', text: err.message })
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-200 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/courses')}
          className="p-1.5 text-on-surface-variant hover:bg-gray-100 rounded-lg cursor-pointer">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div>
          <h1 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface">{courseTitle}</h1>
          <p className="text-xs text-on-surface-variant">{days.length} day{days.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {saveMsg && (
        <div className={`mb-4 px-4 py-2 rounded-xl text-sm flex items-center gap-2 ${
          saveMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-success/30' : 'bg-red-50 text-red-700 border border-error/30'
        }`}>
          <span className="material-symbols-outlined text-[18px]">{saveMsg.type === 'success' ? 'check_circle' : 'error'}</span>
          {saveMsg.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 space-y-1">
          <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Days</p>
          {days.map((d) => (
            <button key={d.day} onClick={() => openDay(d.day)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                editingDay === d.day ? 'bg-primary text-on-primary font-medium' : 'text-on-surface hover:bg-surface-container-low'
              }`}>
              Day {d.day}
              <span className={`block text-[10px] ${editingDay === d.day ? 'text-on-primary/70' : 'text-on-surface-variant'}`}>
                {d.posts?.length || 1} post{(d.posts?.length || 1) !== 1 ? 's' : ''}
              </span>
            </button>
          ))}
        </div>

        <div className="md:col-span-2">
          {editingDay === null ? (
            <div className="text-center py-12 text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-2">edit_note</span>
              <p className="text-sm">Select a day to edit</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-on-surface">Day {editingDay}</h2>
                <button onClick={saveDay} disabled={saving}
                  className="px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>

              {dayPosts.map((post, idx) => (
                <div key={post.postNumber} className="glass rounded-xl p-4 border border-outline-variant">
                  <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    Post {post.postNumber} of {dayPosts.length}
                  </p>

                  <label className="block text-xs font-medium text-on-surface mb-1">Title</label>
                  <input type="text" value={post.title}
                    onChange={(e) => updatePost(idx, 'title', e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm bg-surface text-on-surface outline-none focus:ring-2 focus:ring-primary/30 mb-3" />

                  <label className="block text-xs font-medium text-on-surface mb-1">Content (Markdown)</label>
                  <textarea value={post.content}
                    onChange={(e) => updatePost(idx, 'content', e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm bg-surface text-on-surface outline-none focus:ring-2 focus:ring-primary/30 font-mono mb-3" />

                  <label className="block text-xs font-medium text-on-surface mb-1">Media</label>
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <MediaUploader
                      mediaType="image"
                      courseId={courseId}
                      currentUrl={post.imageUrl}
                      onUpload={(url) => handleMediaUpload(idx, 'imageUrl', url)}
                      onRemove={() => removeMedia(idx, 'imageUrl')}
                    />
                    <MediaUploader
                      mediaType="video"
                      courseId={courseId}
                      currentUrl={post.videoUrl}
                      onUpload={(url) => handleMediaUpload(idx, 'videoUrl', url)}
                      onRemove={() => removeMedia(idx, 'videoUrl')}
                    />
                    <MediaUploader
                      mediaType="audio"
                      courseId={courseId}
                      currentUrl={post.audioUrl}
                      onUpload={(url) => handleMediaUpload(idx, 'audioUrl', url)}
                      onRemove={() => removeMedia(idx, 'audioUrl')}
                    />
                  </div>

                  {(post.imageUrl || post.videoUrl || post.audioUrl) && (
                    <div className="border-t border-outline-variant/40 pt-3 mt-2">
                      <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Preview</p>
                      {post.imageUrl && <MediaRenderer url={post.imageUrl} type="image" />}
                      {post.videoUrl && <MediaRenderer url={post.videoUrl} type="video" />}
                      {post.audioUrl && <MediaRenderer url={post.audioUrl} type="audio" />}
                    </div>
                  )}

                  <div className="border-t border-outline-variant/40 pt-3 mt-2">
                    <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Content Preview</p>
                    <div className="text-sm text-on-surface leading-relaxed markdown-content max-h-40 overflow-y-auto">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                        {post.content || '*No content*'}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
