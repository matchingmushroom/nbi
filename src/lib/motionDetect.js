const NUM_REGIONS = 8
const MOTION_THRESHOLD = 30
const COVERED_BRIGHTNESS = 25
const LOOK_AWAY_MARGIN = 0.15

let prevFrame = null
let prevGray = null

function toGrayscale(data, w, h) {
  const gray = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4
    gray[i] = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) | 0
  }
  return gray
}

function computeBrightness(data, w, h) {
  let sum = 0
  const len = w * h
  for (let i = 0; i < len; i++) {
    const idx = i * 4
    sum += data[idx] + data[idx + 1] + data[idx + 2]
  }
  return sum / (len * 3)
}

export function resetMotionDetect() {
  prevFrame = null
  prevGray = null
}

export function analyzeFrame(video) {
  if (!video?.videoWidth || !video?.videoHeight) {
    return { covered: false, hasMotion: false, faceCount: 0, looking: true, fallback: true }
  }

  const w = video.videoWidth
  const h = video.videoHeight
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return { covered: false, hasMotion: false, faceCount: 0, looking: true, fallback: true }

  ctx.drawImage(video, 0, 0)
  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data

  const brightness = computeBrightness(data, w, h)
  const covered = brightness < COVERED_BRIGHTNESS

  const gray = toGrayscale(data, w, h)

  let hasMotion = false
  let faceCount = 0
  let looking = true

  if (prevGray && prevGray.length === gray.length) {
    const diffMap = new Uint8Array(w * h)
    let changedPixels = 0
    for (let i = 0; i < w * h; i++) {
      const diff = Math.abs(gray[i] - prevGray[i])
      diffMap[i] = diff > MOTION_THRESHOLD ? 255 : 0
      if (diff > MOTION_THRESHOLD) changedPixels++
    }

    const motionRatio = changedPixels / (w * h)
    hasMotion = motionRatio > 0.02

    if (hasMotion) {
      const regionW = Math.ceil(w / NUM_REGIONS)
      const regionH = Math.ceil(h / NUM_REGIONS)
      const activeRegions = []
      for (let ry = 0; ry < NUM_REGIONS; ry++) {
        for (let rx = 0; rx < NUM_REGIONS; rx++) {
          let regionChanged = 0
          let regionTotal = 0
          for (let y = ry * regionH; y < Math.min((ry + 1) * regionH, h); y++) {
            for (let x = rx * regionW; x < Math.min((rx + 1) * regionW, w); x++) {
              regionTotal++
              if (diffMap[y * w + x] === 255) regionChanged++
            }
          }
          if (regionTotal > 0 && regionChanged / regionTotal > 0.1) {
            activeRegions.push({ rx, ry })
          }
        }
      }

      const clusters = []
      for (const r of activeRegions) {
        let merged = false
        for (const c of clusters) {
          if (Math.abs(c.rx - r.rx) <= 1 && Math.abs(c.ry - r.ry) <= 1) {
            merged = true
            break
          }
        }
        if (!merged) clusters.push(r)
      }

      faceCount = Math.min(clusters.length, 3)
      if (faceCount === 0 && motionRatio > 0.05) faceCount = 1

      const faceCenterX = activeRegions.length > 0
        ? activeRegions.reduce((s, r) => s + r.rx, 0) / activeRegions.length
        : NUM_REGIONS / 2
      const faceCenterY = activeRegions.length > 0
        ? activeRegions.reduce((s, r) => s + r.ry, 0) / activeRegions.length
        : NUM_REGIONS / 2

      const margin = NUM_REGIONS * LOOK_AWAY_MARGIN
      looking = faceCenterX >= margin && faceCenterX <= NUM_REGIONS - margin &&
                faceCenterY >= margin && faceCenterY <= NUM_REGIONS - margin
    }
  } else {
    hasMotion = true
    faceCount = 1
  }

  prevGray = gray
  prevFrame = data

  return { covered, hasMotion, faceCount, looking, fallback: true }
}
