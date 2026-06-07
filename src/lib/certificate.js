export async function downloadCertificate({ userName, courseTitle, score, date }) {
  const canvas = document.createElement('canvas')
  canvas.width = 1000
  canvas.height = 707
  const ctx = canvas.getContext('2d')

  const primary = '#00288e'
  const gold = '#d4a843'
  const light = '#f8f6f1'

  // Background
  ctx.fillStyle = light
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Outer border
  ctx.strokeStyle = primary
  ctx.lineWidth = 8
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40)

  // Inner border
  ctx.strokeStyle = gold
  ctx.lineWidth = 2
  ctx.strokeRect(35, 35, canvas.width - 70, canvas.height - 70)

  // Corner decorations
  const cornerSize = 40
  ctx.strokeStyle = gold
  ctx.lineWidth = 3
  ;[[20, 20], [canvas.width - 20, 20], [20, canvas.height - 20], [canvas.width - 20, canvas.height - 20]].forEach(([x, y]) => {
    ctx.beginPath()
    const dirX = x < canvas.width / 2 ? 1 : -1
    const dirY = y < canvas.height / 2 ? 1 : -1
    ctx.moveTo(x + dirX * cornerSize, y)
    ctx.lineTo(x, y)
    ctx.lineTo(x, y + dirY * cornerSize)
    ctx.stroke()
  })

  // Gold line under title
  const centerX = canvas.width / 2

  // Header
  ctx.fillStyle = primary
  ctx.font = 'bold 42px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText('Certificate of Completion', centerX, 140)

  // Gold divider
  ctx.strokeStyle = gold
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(centerX - 120, 160)
  ctx.lineTo(centerX + 120, 160)
  ctx.stroke()

  // Subtitle
  ctx.fillStyle = '#555'
  ctx.font = '16px Georgia, serif'
  ctx.fillText('This is to certify that', centerX, 210)

  // User name
  ctx.fillStyle = primary
  ctx.font = 'bold 36px Georgia, serif'
  ctx.fillText(userName || 'Student', centerX, 270)

  // Course text
  ctx.fillStyle = '#555'
  ctx.font = '16px Georgia, serif'
  ctx.fillText('has successfully completed the course', centerX, 320)

  // Course title
  ctx.fillStyle = primary
  ctx.font = 'bold 24px Georgia, serif'
  ctx.fillText(courseTitle || 'Course', centerX, 365)

  // Score
  ctx.fillStyle = '#333'
  ctx.font = '18px Georgia, serif'
  ctx.fillText(`Final Score: ${score}%`, centerX, 420)

  // Date
  ctx.fillStyle = '#777'
  ctx.font = '14px Georgia, serif'
  ctx.fillText(`Date: ${date}`, centerX, 470)

  // Gold divider
  ctx.strokeStyle = gold
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(centerX - 80, 495)
  ctx.lineTo(centerX + 80, 495)
  ctx.stroke()

  // Seal
  ctx.beginPath()
  ctx.arc(centerX, 560, 35, 0, Math.PI * 2)
  ctx.fillStyle = gold
  ctx.fill()
  ctx.strokeStyle = primary
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = 'white'
  ctx.font = 'bold 20px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText('✓', centerX, 568)

  // Convert to blob
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Certificate_${courseTitle?.replace(/\s+/g, '_') || 'Course'}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
