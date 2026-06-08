import { useRef, useCallback } from 'react'

const W = 900, H = 640
const M = 30

export default function Certificate({ userName, courseTitle, score, overallMax, date, onClose }) {
  const canvasRef = useRef(null)

  const draw = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, W, H)

    // Background
    const grad = ctx.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, '#fefefe')
    grad.addColorStop(1, '#f0f4ff')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // Outer border
    ctx.strokeStyle = '#00288e'
    ctx.lineWidth = 4
    ctx.strokeRect(M, M, W - 2 * M, H - 2 * M)

    // Inner border
    ctx.strokeStyle = '#00288e'
    ctx.lineWidth = 1.5
    const i = 10
    ctx.strokeRect(M + i, M + i, W - 2 * (M + i), H - 2 * (M + i))

    // Corner decorations
    const cs = 40
    ctx.strokeStyle = '#00288e'
    ctx.lineWidth = 3
    ;[[M, M], [W - M, M], [M, H - M], [W - M, H - M]].forEach(([x, y]) => {
      ctx.beginPath()
      const dx = x === M ? 1 : -1
      const dy = y === M ? 1 : -1
      ctx.moveTo(x + dx * cs, y)
      ctx.lineTo(x, y)
      ctx.lineTo(x, y + dy * cs)
      ctx.stroke()
    })

    // Top bar
    ctx.fillStyle = '#00288e'
    ctx.fillRect(M + i, M + i, W - 2 * (M + i), 6)

    // Title
    ctx.fillStyle = '#00288e'
    ctx.font = 'bold 36px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('Certificate of Completion', W / 2, 140)

    // Decorative line under title
    ctx.strokeStyle = '#00288e'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(W / 2 - 120, 155)
    ctx.lineTo(W / 2 + 120, 155)
    ctx.stroke()

    // "This is to certify that"
    ctx.fillStyle = '#444'
    ctx.font = '18px Georgia, serif'
    ctx.fillText('This is to certify that', W / 2, 205)

    // User name
    ctx.fillStyle = '#00288e'
    ctx.font = 'bold 32px Georgia, serif'
    ctx.fillText(userName || 'User', W / 2, 265)

    // Completion text
    ctx.fillStyle = '#444'
    ctx.font = '18px Georgia, serif'
    ctx.fillText('has successfully completed the course', W / 2, 320)

    // Course title
    ctx.fillStyle = '#00288e'
    ctx.font = 'bold 22px Georgia, serif'
    ctx.fillText(courseTitle || 'Course', W / 2, 370)

    // Score
    ctx.fillStyle = '#555'
    ctx.font = '16px Georgia, serif'
    ctx.fillText(`Final Score: ${score}${overallMax ? ` / ${overallMax}` : ''}`, W / 2, 430)

    // Date
    ctx.fillStyle = '#777'
    ctx.font = '14px Georgia, serif'
    ctx.fillText(`Date: ${date || new Date().toLocaleDateString()}`, W / 2, 480)

    // Bottom bar
    ctx.fillStyle = '#00288e'
    ctx.fillRect(M + i, H - M - i - 6, W - 2 * (M + i), 6)
  }, [userName, courseTitle, score, overallMax, date])

  const downloadPNG = () => {
    draw()
    const c = canvasRef.current
    if (!c) return
    const link = document.createElement('a')
    link.download = `Certificate_${courseTitle?.replace(/\s+/g, '_') || 'Course'}.png`
    link.href = c.toDataURL('image/png')
    link.click()
  }

  const downloadPDF = () => {
    draw()
    const c = canvasRef.current
    if (!c) return
    const w = window.open('')
    if (!w) return
    w.document.write(`
      <html><head><title>Certificate</title>
      <style>body{margin:0;display:flex;justify-content:center;align-items:center;height:100vh}
      img{max-width:100%;height:auto}</style></head>
      <body><img src="${c.toDataURL('image/png')}" onload="window.print()" /></body></html>
    `)
    w.document.close()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl p-6 shadow-xl max-w-3xl w-full">
        <canvas ref={canvasRef} width={W} height={H} className="w-full rounded-lg border border-outline-variant" />
        <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
          <button onClick={downloadPNG}
            className="px-5 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer">
            <span className="material-symbols-outlined text-[18px] align-middle mr-1">download</span>
            Download PNG
          </button>
          <button onClick={downloadPDF}
            className="px-5 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer">
            <span className="material-symbols-outlined text-[18px] align-middle mr-1">picture_as_pdf</span>
            Download PDF
          </button>
          <button onClick={onClose}
            className="px-5 py-2.5 bg-surface-container-low text-on-surface rounded-xl text-sm font-semibold hover:bg-surface-container-high transition-all cursor-pointer">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
