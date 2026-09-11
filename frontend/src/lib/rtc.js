// Real, live, two-way audio calling between two browser tabs (a "caller"
// and a "responder"), using WebRTC for the actual media and our own
// WebSocket relay (backend/app/routers/webrtc.py) purely to exchange
// signaling messages. Public STUN servers are used for NAT traversal — no
// external account or paid service is required. Once connected, audio
// flows directly between the two browsers.

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export class WebRTCCall {
  /**
   * @param {{
   *   roomId: string,
   *   role: 'caller' | 'responder',
   *   onRemoteStream?: (stream: MediaStream) => void,
   *   onStatus?: (status: 'waiting'|'peer-joined'|'connected'|'disconnected'|'failed') => void,
   *   onPeerLeft?: () => void,
   *   onError?: (message: string) => void,
   * }} opts
   */
  constructor(opts) {
    this.roomId = opts.roomId
    this.role = opts.role
    this.onRemoteStream = opts.onRemoteStream || (() => {})
    this.onStatus = opts.onStatus || (() => {})
    this.onPeerLeft = opts.onPeerLeft || (() => {})
    this.onError = opts.onError || (() => {})

    this.ws = null
    this.pc = null
    this.localStream = null
    this.remoteStream = null
  }

  /** Requests mic access and opens the signaling socket. Real user gesture required for getUserMedia in most browsers. */
  async start() {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this._connectSocket()
    return this.localStream
  }

  _connectSocket() {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    this.ws = new WebSocket(`${proto}://${window.location.host}/ws/webrtc/${this.roomId}?role=${this.role}`)

    this.ws.onopen = () => this.onStatus('waiting')
    this.ws.onerror = () => this.onError('Could not reach the signaling server.')

    this.ws.onmessage = async (event) => {
      let msg
      try {
        msg = JSON.parse(event.data)
      } catch {
        return
      }

      switch (msg.type) {
        case 'room-full':
          this.onError(msg.message || 'This call already has two people on it.')
          break
        case 'peer-joined':
          this.onStatus('peer-joined')
          this._ensurePeerConnection()
          if (this.role === 'caller') await this._makeOffer()
          break
        case 'peer-left':
          this.onPeerLeft()
          break
        case 'offer':
          this._ensurePeerConnection()
          await this.pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp })
          {
            const answer = await this.pc.createAnswer()
            await this.pc.setLocalDescription(answer)
            this._send({ type: 'answer', sdp: answer.sdp })
          }
          break
        case 'answer':
          if (this.pc) await this.pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp })
          break
        case 'ice-candidate':
          if (this.pc && msg.candidate) {
            try {
              await this.pc.addIceCandidate(msg.candidate)
            } catch {
              /* candidates arriving before remote description is set are safe to drop */
            }
          }
          break
        default:
          break
      }
    }
  }

  _ensurePeerConnection() {
    if (this.pc) return
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    this.pc = pc

    this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream))

    this.remoteStream = new MediaStream()
    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => this.remoteStream.addTrack(track))
      this.onRemoteStream(this.remoteStream)
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) this._send({ type: 'ice-candidate', candidate: event.candidate.toJSON() })
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') this.onStatus('connected')
      else if (pc.connectionState === 'failed') this.onStatus('failed')
      else if (pc.connectionState === 'disconnected') this.onStatus('disconnected')
    }
  }

  async _makeOffer() {
    this._ensurePeerConnection()
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    this._send({ type: 'offer', sdp: offer.sdp })
  }

  _send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload))
  }

  setMuted(muted) {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted
    })
  }

  hangup() {
    try {
      this.ws?.close()
    } catch {
      /* noop */
    }
    try {
      this.pc?.close()
    } catch {
      /* noop */
    }
    this.localStream?.getTracks().forEach((track) => track.stop())
    this.ws = null
    this.pc = null
  }
}

/**
 * Mixes local mic audio + the remote peer's audio into a single recordable
 * MediaStream, so a call recording captures both sides — not just this
 * browser's mic. Call `close()` when done to free the AudioContext.
 */
export function createCallMixer(localStream, remoteStream) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  const dest = ctx.createMediaStreamDestination()
  if (localStream) ctx.createMediaStreamSource(localStream).connect(dest)
  if (remoteStream) ctx.createMediaStreamSource(remoteStream).connect(dest)
  return {
    stream: dest.stream,
    close: () => ctx.close().catch(() => {}),
  }
}
