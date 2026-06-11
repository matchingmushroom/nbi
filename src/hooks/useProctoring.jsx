import { useState, useRef, useEffect, useCallback } from 'react'

const TAB_SWITCH_MAX = 4
const FULLSCREEN_EXIT_MAX = 2
const NO_FACE_MAX_SEC = 30
const MULTI_FACE_MAX_SEC = 15
const FACE_CHECK_INTERVAL = 2000
const AUDIO_CHECK_INTERVAL = 1000
const AUDIO_THRESHOLD = 40

export default function useProctoring({ active, onAutoSubmit }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const audioSourceRef = useRef(null)
  const analyserRef = useRef(null)
  const faceIntervalRef = useRef(null)
  const audioIntervalRef = useRef(null)
  const noFaceSecRef = useRef(0)
  const multiFaceSecRef = useRef(0)
  const tabWarnRef = useRef(0)
  const fsWarnRef = useRef(0)
  const submittedRef = useRef(false)
  const violationsRef = useRef([])

  const [camReady, setCamReady] = useState(false)
  const [micReady, setMicReady] = useState(false)
  const [violations, setViolations] = useState([])
  const [faceStatus, setFaceStatus] = useState({ count: 0, looking: true })
  const [noiseLevel, setNoiseLevel] = useState(0)
  const [showWarning, setShowWarning] = useState(null)

  const logViolation = useCallback((type) => {
    if (submittedRef.current) return
    violationsRef.current = [...violationsRef.current, { type, timestamp: new Date().toISOString() }]
    setViolations(violationsRef.current)
  }, [])

  const showWarningOverlay = useCallback((type, count, max) => {
    setShowWarning({ type, count, max })
    setTimeout(() => setShowWarning(null), 3000)
  }, [])

  const handleTabSwitch = useCallback(() => {
    logViolation('tab_switch')
    tabWarnRef.current++
    showWarningOverlay('Tab switch detected', tabWarnRef.current, TAB_SWITCH_MAX)
    if (tabWarnRef.current >= TAB_SWITCH_MAX) onAutoSubmit?.()
  }, [logViolation, showWarningOverlay, onAutoSubmit])

  const handleFullscreenExit = useCallback(() => {
    logViolation('fullscreen_exit')
    fsWarnRef.current++
    showWarningOverlay('Fullscreen exited', fsWarnRef.current, FULLSCREEN_EXIT_MAX)
    if (fsWarnRef.current >= FULLSCREEN_EXIT_MAX) onAutoSubmit?.()
  }, [logViolation, showWarningOverlay, onAutoSubmit])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCamReady(true)
    } catch { setCamReady(false) }
  }, [])

  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      audioCtxRef.current = ctx
      audioSourceRef.current = src
      analyserRef.current = analyser
      setMicReady(true)
    } catch { setMicReady(false) }
  }, [])

  const startFaceDetection = useCallback(async () => {
    try {
      const faceapi = await import('@vladmandic/face-api')
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models')
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models')
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })

      faceIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || !videoRef.current.videoWidth) return
        try {
          const detections = await faceapi.detectAllFaces(videoRef.current, options).withFaceLandmarks()
          const count = detections.length
          setFaceStatus((prev) => ({ ...prev, count }))

          if (count === 0) {
            noFaceSecRef.current += FACE_CHECK_INTERVAL / 1000
            if (noFaceSecRef.current >= NO_FACE_MAX_SEC) {
              logViolation('no_face')
              noFaceSecRef.current = 0
              if (!submittedRef.current) onAutoSubmit?.()
            }
          } else {
            noFaceSecRef.current = 0
          }

          if (count > 1) {
            multiFaceSecRef.current += FACE_CHECK_INTERVAL / 1000
            if (multiFaceSecRef.current >= MULTI_FACE_MAX_SEC) {
              logViolation('multiple_faces')
              multiFaceSecRef.current = 0
              if (!submittedRef.current) onAutoSubmit?.()
            }
          } else {
            multiFaceSecRef.current = 0
          }

          if (count > 0) {
            const landmarks = detections[0].landmarks
            const leftEye = landmarks.getLeftEye()
            const rightEye = landmarks.getRightEye()
            const eyeCenterY = (leftEye.reduce((s, p) => s + p.y, 0) / leftEye.length + rightEye.reduce((s, p) => s + p.y, 0) / rightEye.length) / 2
            const nose = landmarks.getNose()
            const noseY = nose.reduce((s, p) => s + p.y, 0) / nose.length
            setFaceStatus((prev) => ({ ...prev, looking: Math.abs(eyeCenterY - noseY) < 15 }))
          }
        } catch {}
      }, FACE_CHECK_INTERVAL)
    } catch {}
  }, [logViolation, onAutoSubmit])

  const startAudioMonitor = useCallback(() => {
    audioIntervalRef.current = setInterval(() => {
      const analyser = analyserRef.current
      if (!analyser) return
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteTimeDomainData(dataArray)
      const rms = Math.sqrt(dataArray.reduce((sum, val) => sum + (val - 128) ** 2, 0) / dataArray.length)
      setNoiseLevel(Math.round(rms))
      if (rms > AUDIO_THRESHOLD) logViolation('loud_noise')
    }, AUDIO_CHECK_INTERVAL)
  }, [logViolation])

  useEffect(() => {
    if (!active) return
    const onVis = () => { if (document.hidden) handleTabSwitch() }
    const onBlur = () => handleTabSwitch()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      document.removeEventListener('blur', onBlur)
    }
  }, [active, handleTabSwitch])

  useEffect(() => {
    if (!active) return
    const onKey = (e) => {
      if (e.ctrlKey && ['c', 'v', 'p', 'x', 'a', 's'].includes(e.key.toLowerCase())) e.preventDefault()
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['i', 'j'].includes(e.key.toLowerCase()))) e.preventDefault()
    }
    const onCtx = (e) => e.preventDefault()
    document.addEventListener('keydown', onKey)
    document.addEventListener('contextmenu', onCtx)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('contextmenu', onCtx)
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    const iv = setInterval(() => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        handleFullscreenExit()
        document.documentElement.requestFullscreen?.() || document.documentElement.webkitRequestFullscreen?.()
      }
    }, 3000)
    return () => clearInterval(iv)
  }, [active, handleFullscreenExit])

  const startProctoring = useCallback(() => {
    submittedRef.current = false
    startCamera()
    startMic()
    startFaceDetection()
    startAudioMonitor()
    setTimeout(() => { try { document.documentElement.requestFullscreen?.() || document.documentElement.webkitRequestFullscreen?.() } catch {} }, 500)
  }, [startCamera, startMic, startFaceDetection, startAudioMonitor])

  const stopProctoring = useCallback(() => {
    submittedRef.current = true
    clearInterval(faceIntervalRef.current)
    clearInterval(audioIntervalRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
    if (audioCtxRef.current) audioCtxRef.current.close()
    try { document.exitFullscreen?.() } catch {}
  }, [])

  const ProctorPiP = () => (
    <div className="fixed bottom-4 right-4 z-40 w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden border-2 border-white/40 shadow-xl glass-dark">
      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-full text-[9px] text-white">
        <span className={`w-1.5 h-1.5 rounded-full ${faceStatus.count > 0 ? 'bg-success' : 'bg-error'}`} />
        {faceStatus.count > 0 ? `${faceStatus.count} face${faceStatus.count > 1 ? 's' : ''}` : 'No face'}
      </div>
    </div>
  )

  const WarningOverlay = () => showWarning ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowWarning(null)}>
      <div className="glass-dark rounded-2xl p-6 max-w-sm w-full mx-4 text-center border border-white/20 shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-error/20 flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-error text-[28px]">warning</span>
        </div>
        <h3 className="text-base font-bold text-on-surface mb-1 capitalize">{showWarning.type}</h3>
        <p className="text-sm text-on-surface-variant mb-3">Warning {showWarning.count} of {showWarning.max}</p>
        <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-error rounded-full transition-all" style={{ width: `${(showWarning.count / showWarning.max) * 100}%` }} />
        </div>
        {showWarning.count >= showWarning.max && <p className="text-xs text-error font-semibold mt-3">Auto-submitting...</p>}
      </div>
    </div>
  ) : null

  const AudioIndicator = () => noiseLevel > 0 ? (
    <div className="fixed bottom-4 left-4 z-40 glass-dark rounded-full px-3 py-1.5 border border-white/20 flex items-center gap-1.5">
      <span className="material-symbols-outlined text-[14px]" style={{fontVariationSettings: noiseLevel > AUDIO_THRESHOLD ? "'FILL' 1" : "'FILL' 0"}}>
        {noiseLevel > AUDIO_THRESHOLD ? 'mic' : 'mic_none'}
      </span>
      <div className="w-12 h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${noiseLevel > AUDIO_THRESHOLD ? 'bg-error' : 'bg-success'}`}
          style={{ width: `${Math.min(100, (noiseLevel / 80) * 100)}%` }} />
      </div>
    </div>
  ) : null

  return {
    camReady, micReady, violations, faceStatus, noiseLevel, showWarning,
    violationsRef, submittedRef, videoRef, streamRef, audioCtxRef,
    startCamera, startMic, startProctoring, stopProctoring,
    ProctorPiP, WarningOverlay, AudioIndicator,
  }
}
