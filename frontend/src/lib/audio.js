// Small audio helpers for the Dialer: real DTMF dial-pad tones and a
// microphone recorder wrapper built on MediaRecorder + an AnalyserNode for
// a live level meter.

const DTMF_FREQS = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
}

let sharedCtx = null
function ctx() {
  if (!sharedCtx) sharedCtx = new (window.AudioContext || window.webkitAudioContext)()
  return sharedCtx
}

/** Plays a real dual-tone multi-frequency (DTMF) beep for a dial-pad key. */
export function playDtmf(key, durationMs = 130) {
  const freqs = DTMF_FREQS[key]
  if (!freqs) return
  const audioCtx = ctx()
  const now = audioCtx.currentTime
  const gain = audioCtx.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000)
  gain.connect(audioCtx.destination)

  freqs.forEach((f) => {
    const osc = audioCtx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = f
    osc.connect(gain)
    osc.start(now)
    osc.stop(now + durationMs / 1000)
  })
}

/** Picks a MediaRecorder mime type the browser actually supports. */
function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  for (const c of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) return c
  }
  return ''
}

/**
 * Wraps getUserMedia + MediaRecorder to record from the microphone, while
 * exposing a live 0..1 volume level (via requestAnimationFrame) so the UI
 * can draw a real waveform instead of a canned animation.
 */
export class MicRecorder {
  constructor({ onLevel } = {}) {
    this.onLevel = onLevel
    this.stream = null
    this.recorder = null
    this.chunks = []
    this.audioCtx = null
    this.analyser = null
    this.rafId = null
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = pickMimeType()
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined)
    this.chunks = []
    this.recorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data) }
    this.recorder.start()

    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const source = this.audioCtx.createMediaStreamSource(this.stream)
    this.analyser = this.audioCtx.createAnalyser()
    this.analyser.fftSize = 256
    source.connect(this.analyser)
    this._tickLevel()

    return true
  }

  _tickLevel() {
    if (!this.analyser) return
    const data = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(data)
    const avg = data.reduce((a, b) => a + b, 0) / data.length / 255
    this.onLevel?.(avg)
    this.rafId = requestAnimationFrame(() => this._tickLevel())
  }

  /** Stops recording and resolves with { blob, mimeType }. */
  stop() {
    return new Promise((resolve) => {
      if (!this.recorder) return resolve(null)
      this.recorder.onstop = () => {
        const mimeType = this.recorder.mimeType || 'audio/webm'
        const blob = new Blob(this.chunks, { type: mimeType })
        this._cleanup()
        resolve({ blob, mimeType })
      }
      this.recorder.stop()
    })
  }

  _cleanup() {
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.stream?.getTracks().forEach((t) => t.stop())
    this.audioCtx?.close().catch(() => {})
    this.stream = null
    this.analyser = null
  }
}

/**
 * Records from an already-obtained MediaStream (e.g. a mixed local+remote
 * WebRTC call stream from rtc.js's createCallMixer) instead of requesting
 * its own getUserMedia stream. Used to save a full two-way call recording.
 */
export class StreamRecorder {
  constructor(stream) {
    this.stream = stream
    this.recorder = null
    this.chunks = []
  }

  start() {
    const mimeType = pickMimeType()
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined)
    this.chunks = []
    this.recorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data) }
    this.recorder.start()
  }

  /** Stops recording and resolves with { blob, mimeType }. Does not stop the underlying stream's tracks — the caller owns those. */
  stop() {
    return new Promise((resolve) => {
      if (!this.recorder) return resolve(null)
      this.recorder.onstop = () => {
        const mimeType = this.recorder.mimeType || 'audio/webm'
        const blob = new Blob(this.chunks, { type: mimeType })
        resolve({ blob, mimeType })
      }
      this.recorder.stop()
    })
  }
}
