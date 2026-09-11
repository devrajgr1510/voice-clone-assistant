// The backend's real DSP voice-analysis engine only understands PCM WAV.
// This app's own recordings (Dialer / Voice Studio) are captured via
// MediaRecorder as webm/opus, mp4, or ogg — none of which the backend can
// decode without an external tool like ffmpeg. Rather than require that on
// the server, we decode audio right here in the browser (which already has
// native codecs for all of those formats via the Web Audio API) and
// re-encode it as a plain 16-bit PCM WAV blob before uploading. This makes
// the *real* pitch/jitter/spectral analysis actually run on real app audio,
// instead of silently falling back to the low-confidence byte heuristic.

/** Decodes any browser-playable audio (webm/opus, mp4, ogg, mp3, wav...)
 * and re-encodes it as a 16-bit PCM WAV Blob. Throws if the browser can't
 * decode the given bytes (corrupt file, unsupported codec, etc). */
export async function convertToWav(arrayBufferOrBlob) {
  const arrayBuffer =
    arrayBufferOrBlob instanceof Blob ? await arrayBufferOrBlob.arrayBuffer() : arrayBufferOrBlob

  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) throw new Error('Web Audio API is not available in this browser')
  const ctx = new Ctx()
  let audioBuffer
  try {
    // Safari needs the callback form; the promise form covers everyone else.
    audioBuffer = await new Promise((resolve, reject) => {
      ctx.decodeAudioData(arrayBuffer.slice(0), resolve, reject)
    })
  } finally {
    ctx.close().catch(() => {})
  }

  return audioBufferToWavBlob(audioBuffer)
}

function audioBufferToWavBlob(audioBuffer) {
  const numChannels = 1 // downmix to mono — the analyzer only needs one channel
  const sampleRate = audioBuffer.sampleRate
  const numFrames = audioBuffer.length

  let mono
  if (audioBuffer.numberOfChannels === 1) {
    mono = audioBuffer.getChannelData(0)
  } else {
    mono = new Float32Array(numFrames)
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const data = audioBuffer.getChannelData(ch)
      for (let i = 0; i < numFrames; i++) mono[i] += data[i] / audioBuffer.numberOfChannels
    }
  }

  const bytesPerSample = 2 // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample
  const dataSize = numFrames * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true) // byte rate
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bytesPerSample * 8, true) // bits per sample
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < numFrames; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}
