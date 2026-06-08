export async function downloadCertificate({ userName, courseTitle, score, date }) {
  const canvas = document.createElement('canvas')
  canvas.width = 1000
  canvas.height = 707
  const ctx = canvas.getContext('2d')

  const primary = '#00288e'
  const gold = '#c9a84c'
  const goldLight = '#e8d5a3'
  const light = '#faf8f5'
  const dark = '#1a1a2e'

  // Background
  ctx.fillStyle = light
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Subtle decorative background lines
  ctx.strokeStyle = 'rgba(201, 168, 76, 0.06)'
  ctx.lineWidth = 1
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke()
  }

  // Outer border — double line
  ctx.strokeStyle = primary
  ctx.lineWidth = 6
  ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48)

  ctx.strokeStyle = gold
  ctx.lineWidth = 2
  ctx.strokeRect(34, 34, canvas.width - 68, canvas.height - 68)

  ctx.strokeStyle = primary
  ctx.lineWidth = 1
  ctx.strokeRect(42, 42, canvas.width - 84, canvas.height - 84)

  // Corner ornaments
  const drawCorner = (x, y, dx, dy) => {
    ctx.strokeStyle = gold
    ctx.lineWidth = 2.5
    // Outer L
    ctx.beginPath(); ctx.moveTo(x + dx * 50, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * 50); ctx.stroke()
    // Inner parallel
    ctx.beginPath(); ctx.moveTo(x + dx * 38, y + dy * 12); ctx.lineTo(x + dy * 12, y + dy * 12); ctx.lineTo(x + dy * 12, y + dy * 38); ctx.stroke()
    // Small dot
    ctx.beginPath(); ctx.arc(x + dx * 20, y + dy * 20, 3, 0, Math.PI * 2); ctx.fillStyle = gold; ctx.fill()
  }
  drawCorner(24, 24, 1, 1)
  drawCorner(canvas.width - 24, 24, -1, 1)
  drawCorner(24, canvas.height - 24, 1, -1)
  drawCorner(canvas.width - 24, canvas.height - 24, -1, -1)

  const cx = canvas.width / 2

  // ── Institution Header ──
  ctx.fillStyle = primary
  ctx.font = 'bold 18px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText('BANKMASTERY', cx, 80)

  ctx.fillStyle = gold
  ctx.font = 'italic 11px Georgia, serif'
  ctx.fillText('Learn. Practice. Master.', cx, 98)

  // Gold divider
  ctx.strokeStyle = gold
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(cx - 160, 110); ctx.lineTo(cx + 160, 110); ctx.stroke()

  // Small diamonds on divider
  for (let x = -160; x <= 160; x += 40) {
    ctx.beginPath(); ctx.arc(cx + x, 110, 2, 0, Math.PI * 2); ctx.fillStyle = gold; ctx.fill()
  }

  // ── Title ──
  ctx.fillStyle = primary
  ctx.font = 'bold 38px Georgia, serif'
  ctx.fillText('Certificate of Completion', cx, 172)

  // Ornamental line under title
  ctx.strokeStyle = gold
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(cx - 140, 190); ctx.lineTo(cx + 140, 190); ctx.stroke()

  // ── Body ──
  ctx.fillStyle = '#555'
  ctx.font = '16px Georgia, serif'
  ctx.fillText('This is to certify that', cx, 232)

  ctx.fillStyle = dark
  ctx.font = 'bold 34px Georgia, serif'
  ctx.fillText(userName || 'Student', cx, 288)

  ctx.fillStyle = '#555'
  ctx.font = '16px Georgia, serif'
  ctx.fillText('has successfully completed the course', cx, 328)

  ctx.fillStyle = primary
  ctx.font = 'bold 22px Georgia, serif'
  ctx.fillText(courseTitle || 'Course', cx, 372)

  // Score line
  ctx.fillStyle = '#444'
  ctx.font = '17px Georgia, serif'
  ctx.fillText(`Final Score: ${score}%`, cx, 422)

  // Date
  ctx.fillStyle = '#888'
  ctx.font = '13px Georgia, serif'
  ctx.fillText(`Issued: ${date}`, cx, 452)

  // Bottom divider
  ctx.strokeStyle = gold
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cx - 100, 472); ctx.lineTo(cx + 100, 472); ctx.stroke()

  // ── Professional Golden Seal ──
  const sealCx = cx
  const sealCy = 575
  const outerR = 48
  const innerR = 38

  // Outer gold ring
  ctx.beginPath()
  ctx.arc(sealCx, sealCy, outerR, 0, Math.PI * 2)
  ctx.fillStyle = gold
  ctx.fill()
  ctx.strokeStyle = primary
  ctx.lineWidth = 2
  ctx.stroke()

  // Inner ring (darker gold)
  ctx.beginPath()
  ctx.arc(sealCx, sealCy, innerR, 0, Math.PI * 2)
  ctx.fillStyle = '#b8923a'
  ctx.fill()
  ctx.strokeStyle = goldLight
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Curved text around seal — "BANKMASTERY" on top arc
  ctx.save()
  ctx.translate(sealCx, sealCy)
  const text = 'BANKMASTERY'
  const arcR = innerR - 4
  const startAngle = -Math.PI - 0.45
  const endAngle = -0.55
  const totalAngle = endAngle - startAngle
  const textWidth = ctx.measureText(text).width
  const charCount = text.length
  const angleStep = totalAngle / (charCount - 1)

  ctx.font = 'bold 9px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = goldLight

  for (let i = 0; i < charCount; i++) {
    const angle = startAngle + i * angleStep
    const x = Math.cos(angle) * arcR
    const y = Math.sin(angle) * arcR
    ctx.save()
    ctx.translate(x, -y)
    ctx.rotate(angle + Math.PI / 2)
    ctx.fillText(text[i], 0, 0)
    ctx.restore()
  }
  ctx.restore()

  // Year at bottom of seal
  ctx.fillStyle = goldLight
  ctx.font = 'bold 8px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('2024', sealCx, sealCy + innerR - 16)

  // Center star
  ctx.beginPath()
  const spikes = 5
  const outerStarR = 14
  const innerStarR = 6
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerStarR : innerStarR
    const angle = (i * Math.PI) / spikes - Math.PI / 2
    const sx = sealCx + r * Math.cos(angle)
    const sy = sealCy + r * Math.sin(angle)
    i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy)
  }
  ctx.closePath()
  ctx.fillStyle = goldLight
  ctx.fill()
  ctx.strokeStyle = primary
  ctx.lineWidth = 0.5
  ctx.stroke()

  // ── Footer ──
  ctx.fillStyle = '#aaa'
  ctx.font = '9px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText('BankMastery — Excellence in Banking Education', cx, 670)

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
