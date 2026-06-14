import { useState } from 'react'

function detectType(url) {
  if (!url) return null
  const u = url.toLowerCase()
  if (u.match(/\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)(\?|#|$)/) || u.includes('image'))
    return 'image'
  if (u.match(/\.(mp4|webm|ogg|mov|avi|mkv)(\?|#|$)/) || u.includes('video'))
    return 'video'
  if (u.match(/\.(mp3|wav|ogg|aac|flac|m4a)(\?|#|$)/) || u.includes('audio'))
    return 'audio'
  if (u.includes('youtube.com') || u.includes('youtu.be') || u.includes('vimeo.com'))
    return 'youtube'
  return null
}

function getYoutubeEmbed(url) {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
}

function getVimeoEmbed(url) {
  const match = url.match(/vimeo\.com\/(\d+)/)
  return match ? `https://player.vimeo.com/video/${match[1]}` : null
}

export default function MediaRenderer({ url, type: explicitType, className = '' }) {
  const [lightbox, setLightbox] = useState(false)
  const type = explicitType || detectType(url)
  if (!url || !type) return null

  if (type === 'image') {
    return (
      <>
        <img
          src={url}
          alt="Course media"
          loading="lazy"
          onClick={() => setLightbox(true)}
          className={`max-w-full rounded-xl cursor-zoom-in object-contain my-3 ${className}`}
          style={{ maxHeight: '400px' }}
        />
        {lightbox && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setLightbox(false)}>
            <img src={url} alt="Course media" className="max-w-full max-h-full rounded-xl object-contain" />
          </div>
        )}
      </>
    )
  }

  if (type === 'youtube' || type === 'video') {
    const embedUrl = getYoutubeEmbed(url) || getVimeoEmbed(url)
    if (embedUrl) {
      return (
        <div className={`relative my-3 rounded-xl overflow-hidden ${className}`} style={{ paddingBottom: '56.25%' }}>
          <iframe src={embedUrl} title="Video"
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen />
        </div>
      )
    }
    return (
      <video controls preload="metadata" className={`max-w-full rounded-xl my-3 ${className}`} style={{ maxHeight: '400px' }}>
        <source src={url} />
      </video>
    )
  }

  if (type === 'audio') {
    return (
      <div className={`my-3 p-3 bg-surface-container-low rounded-xl ${className}`}>
        <audio controls preload="metadata" className="w-full h-10">
          <source src={url} />
        </audio>
      </div>
    )
  }

  return null
}
