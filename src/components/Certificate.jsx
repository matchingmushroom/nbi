import { useRef, useCallback } from 'react'

const W = 900, H = 680
const M = 30

export default function Certificate({ userName, courseTitle, score, overallMax, date, courseDuration, onClose }) {
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

    // Institution name
    ctx.fillStyle = '#00288e'
    ctx.font = 'bold 28px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('BankMastery', W / 2, 105)

    // Tagline
    ctx.fillStyle = '#666'
    ctx.font = 'italic 14px Georgia, serif'
    ctx.fillText('Learn. Practice. Master.', W / 2, 130)

    // Title
    ctx.fillStyle = '#00288e'
    ctx.font = 'bold 32px Georgia, serif'
    ctx.fillText('Certificate of Completion', W / 2, 175)

    // Decorative line under title
    ctx.strokeStyle = '#00288e'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(W / 2 - 120, 190)
    ctx.lineTo(W / 2 + 120, 190)
    ctx.stroke()

    // "This is to certify that"
    ctx.fillStyle = '#444'
    ctx.font = '18px Georgia, serif'
    ctx.fillText('This is to certify that', W / 2, 240)

    // User name
    ctx.fillStyle = '#00288e'
    ctx.font = 'bold 32px Georgia, serif'
    ctx.fillText(userName || 'User', W / 2, 295)

    // Completion text
    ctx.fillStyle = '#444'
    ctx.font = '18px Georgia, serif'
    ctx.fillText('has successfully completed the course', W / 2, 345)

    // Course title
    ctx.fillStyle = '#00288e'
    ctx.font = 'bold 22px Georgia, serif'
    ctx.fillText(courseTitle || 'Course', W / 2, 390)

    // Duration
    ctx.fillStyle = '#555'
    ctx.font = '15px Georgia, serif'
    ctx.fillText(`Course Duration: ${courseDuration || 'N/A'}`, W / 2, 430)

    // Score
    ctx.fillStyle = '#555'
    ctx.font = '15px Georgia, serif'
    ctx.fillText(`Final Score: ${score}${overallMax ? ` / ${overallMax}` : ''}`, W / 2, 465)

    // Date
    ctx.fillStyle = '#777'
    ctx.font = '14px Georgia, serif'
    ctx.fillText(`Date: ${date || new Date().toLocaleDateString()}`, W / 2, 500)

    // Signature line
    const sigX = W / 2, sigY = 565
    ctx.strokeStyle = '#00288e'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(sigX - 80, sigY)
    ctx.lineTo(sigX + 80, sigY)
    ctx.stroke()

    // Signature "AnislamitR" drawn with cursive bezier curves
    ctx.strokeStyle = '#00288e'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const sx = sigX - 75, sy = sigY - 5

    // --- A (capital, elaborate) ---
    ctx.beginPath()
    ctx.moveTo(sx + 2, sy + 2)
    ctx.quadraticCurveTo(sx + 10, sy - 18, sx + 20, sy - 22)
    ctx.quadraticCurveTo(sx + 28, sy - 16, sx + 22, sy + 2)
    ctx.moveTo(sx + 6, sy - 8)
    ctx.quadraticCurveTo(sx + 14, sy - 11, sx + 22, sy - 8)
    ctx.stroke()

    // -- n --
    ctx.beginPath()
    ctx.moveTo(sx + 28, sy + 2)
    ctx.quadraticCurveTo(sx + 30, sy - 16, sx + 38, sy - 18)
    ctx.quadraticCurveTo(sx + 46, sy - 16, sx + 48, sy + 2)
    ctx.stroke()

    // -- i (dotted, cursive loop) --
    ctx.beginPath()
    ctx.moveTo(sx + 52, sy + 2)
    ctx.quadraticCurveTo(sx + 54, sy - 22, sx + 56, sy - 18)
    ctx.moveTo(sx + 52, sy + 2)
    ctx.quadraticCurveTo(sx + 54, sy - 6, sx + 56, sy + 2)
    ctx.stroke()
    // dot
    ctx.fillStyle = '#00288e'
    ctx.beginPath()
    ctx.arc(sx + 52, sy - 18, 2, 0, Math.PI * 2)
    ctx.fill()

    // -- s --
    ctx.beginPath()
    ctx.moveTo(sx + 62, sy + 2)
    ctx.quadraticCurveTo(sx + 60, sy - 6, sx + 64, sy - 10)
    ctx.quadraticCurveTo(sx + 68, sy - 6, sx + 66, sy + 2)
    ctx.stroke()

    // -- l --
    ctx.beginPath()
    ctx.moveTo(sx + 70, sy + 2)
    ctx.quadraticCurveTo(sx + 72, sy - 24, sx + 78, sy - 26)
    ctx.stroke()

    // -- a --
    ctx.beginPath()
    ctx.moveTo(sx + 80, sy + 2)
    ctx.quadraticCurveTo(sx + 78, sy - 6, sx + 82, sy - 10)
    ctx.quadraticCurveTo(sx + 88, sy - 8, sx + 86, sy + 2)
    ctx.stroke()

    // -- m --
    ctx.beginPath()
    ctx.moveTo(sx + 88, sy + 2)
    ctx.quadraticCurveTo(sx + 90, sy - 14, sx + 94, sy - 16)
    ctx.quadraticCurveTo(sx + 98, sy - 14, sx + 100, sy + 2)
    ctx.moveTo(sx + 100, sy + 2)
    ctx.quadraticCurveTo(sx + 102, sy - 14, sx + 106, sy - 16)
    ctx.quadraticCurveTo(sx + 110, sy - 14, sx + 112, sy + 2)
    ctx.stroke()

    // -- i (dotted) --
    ctx.beginPath()
    ctx.moveTo(sx + 114, sy + 2)
    ctx.quadraticCurveTo(sx + 116, sy - 22, sx + 118, sy - 18)
    ctx.moveTo(sx + 114, sy + 2)
    ctx.quadraticCurveTo(sx + 116, sy - 6, sx + 120, sy + 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(sx + 114, sy - 18, 2, 0, Math.PI * 2)
    ctx.fill()

    // -- t --
    ctx.beginPath()
    ctx.moveTo(sx + 122, sy + 2)
    ctx.quadraticCurveTo(sx + 124, sy - 22, sx + 130, sy - 24)
    ctx.moveTo(sx + 118, sy - 10)
    ctx.quadraticCurveTo(sx + 126, sy - 12, sx + 134, sy - 10)
    ctx.stroke()

    // -- R (capital, elaborate) --
    ctx.beginPath()
    ctx.moveTo(sx + 136, sy + 2)
    ctx.quadraticCurveTo(sx + 138, sy - 22, sx + 144, sy - 24)
    ctx.quadraticCurveTo(sx + 150, sy - 22, sx + 148, sy - 14)
    ctx.quadraticCurveTo(sx + 144, sy - 8, sx + 136, sy - 8)
    ctx.moveTo(sx + 140, sy - 8)
    ctx.quadraticCurveTo(sx + 144, sy - 4, sx + 150, sy + 2)
    ctx.stroke()

    // "Authorized Signature" label
    ctx.fillStyle = '#999'
    ctx.font = '10px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('Authorized Signature', sigX, sigY + 18)

    // Bottom bar
    ctx.fillStyle = '#00288e'
    ctx.fillRect(M + i, H - M - i - 6, W - 2 * (M + i), 6)
  }, [userName, courseTitle, score, overallMax, date, courseDuration])

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
