import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Delete, Play, Pause,
  Trash2, Save, X, Loader2, Disc, ShieldAlert, Info, Link2, Copy, Check,
  Users, ArrowRight, Clock, ShieldCheck, ShieldQuestion,
} from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import Gauge from '../components/Gauge.jsx'
import Waveform from '../components/Waveform.jsx'
import Avatar from '../components/Avatar.jsx'
import { riskColor } from '../components/RiskBadge.jsx'
import { dialerApi, roomApi, recordingsApi, liveCallSocket } from '../api/client.js'
import { playDtmf, MicRecorder, StreamRecorder } from '../lib/audio.js'
import { WebRTCCall, createCallMixer } from '../lib/rtc.js'
import { formatDateTime } from '../lib/time.js'

const DIAL_KEYS = [
  ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
  ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ['*', ''], ['0', '+'], ['#', ''],
]

function formatTimer(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}

/** Live, ticking date + time — updates every second, like a phone's status bar / an incoming-call screen. */
function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const date = now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-mono tabular-nums">
      <Clock size={13} /> {date} · {time}
    </span>
  )
}

/** Truecaller-style caller-ID label: a colored pill naming what's known about this number/call. */
function spamLabel(score) {
  if (score == null) return { text: 'Unverified number', Icon: ShieldQuestion, color: '#8B8B9E' }
  if (score < 30) return { text: 'Likely safe', Icon: ShieldCheck, color: riskColor(score) }
  if (score < 60) return { text: 'Suspicious activity', Icon: ShieldAlert, color: riskColor(score) }
  return { text: 'High risk · Likely spam', Icon: ShieldAlert, color: riskColor(score) }
}

function CallerIdBadge({ score }) {
  const { text, Icon, color } = spamLabel(score)
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold mt-2"
      style={{ color, background: `${color}1A`, border: `1px solid ${color}40` }}
    >
      <Icon size={12} /> {text}
    </span>
  )
}

export default function Dialer() {
  const { roomId } = useParams()
  return (
    <>
      <Topbar title="Dialer" subtitle="Place a simulated call, or start a real live call with another person">
        <div className="flex items-center gap-4 flex-wrap">
          <LiveClock />
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Info size={13} /> "Dial Number" is simulated telephony — "Real Call" is genuine live two-way audio
          </span>
        </div>
      </Topbar>
      <div className="px-4 md:px-8 pb-10 grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">
        <div className="xl:col-span-2">
          <CallCard joinRoomId={roomId} />
        </div>
        <div className="xl:col-span-3 space-y-5">
          <VoiceStudio />
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Call card: mode switcher between simulated dialing and a real call  */
/* ------------------------------------------------------------------ */

function CallCard({ joinRoomId }) {
  const [mode, setMode] = useState(joinRoomId ? 'real' : 'sim')

  return (
    <div>
      <div className="flex p-1 mb-3 rounded-2xl bg-base-800 border border-black/5">
        <button
          onClick={() => setMode('sim')}
          className={`focus-ring flex-1 py-2 rounded-xl text-xs font-semibold transition ${
            mode === 'sim' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-800'
          }`}
        >
          Dial Number
        </button>
        <button
          onClick={() => setMode('real')}
          className={`focus-ring flex-1 py-2 rounded-xl text-xs font-semibold transition ${
            mode === 'real' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-800'
          }`}
        >
          Real Call
        </button>
      </div>
      {mode === 'sim' ? <SimCallCard /> : <RealCallCard joinRoomId={joinRoomId} />}
    </div>
  )
}

function SimCallCard() {
  const [number, setNumber] = useState('')
  const [label, setLabel] = useState('')
  const [phase, setPhase] = useState('idle') // idle | ringing | connected | ended | error
  const [call, setCall] = useState(null)
  const [message, setMessage] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [muted, setMuted] = useState(false)
  const [speaker, setSpeaker] = useState(true)
  const [liveScores, setLiveScores] = useState(null)
  const [waveform, setWaveform] = useState([])
  const [finalCall, setFinalCall] = useState(null)
  const [isRecordingCall, setIsRecordingCall] = useState(false)
  const [callRecordingId, setCallRecordingId] = useState(null)

  const timerRef = useRef(null)
  const ringTimeoutRef = useRef(null)
  const wsRef = useRef(null)
  const micRef = useRef(null)

  useEffect(() => () => cleanupAll(), []) // eslint-disable-line

  function cleanupAll() {
    clearInterval(timerRef.current)
    clearTimeout(ringTimeoutRef.current)
    wsRef.current?.close()
    micRef.current?.stop().catch(() => {})
  }

  const pressKey = (k) => {
    playDtmf(k)
    if (phase === 'idle') setNumber((n) => n + k)
  }

  const backspace = () => setNumber((n) => n.slice(0, -1))

  const startCall = async () => {
    if (!number.trim()) return
    setMessage('')
    setFinalCall(null)
    setPhase('ringing')
    try {
      const res = await dialerApi.startCall({
        to_number: number.trim(),
        contact_label: label.trim() || null,
      })
      setCall(res.call)
      setMessage(res.message)
      if (res.call.call_state === 'failed') {
        setPhase('error')
        return
      }
      // Simulate the callee answering after a short ring (in live mode this
      // would instead be driven by the provider's status webhook).
      ringTimeoutRef.current = setTimeout(() => connectCall(res.call.id), 2200)
    } catch (e) {
      setMessage(e.message || 'Failed to start call')
      setPhase('error')
    }
  }

  const connectCall = async (callId) => {
    try {
      await dialerApi.answerCall(callId)
    } catch { /* ignore, proceed optimistically */ }
    setPhase('connected')
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)

    const ws = liveCallSocket((msg) => {
      setLiveScores(msg.scores)
      setWaveform(msg.waveform)
    })
    wsRef.current = ws
  }

  const toggleCallRecording = async () => {
    if (!isRecordingCall) {
      try {
        micRef.current = new MicRecorder({})
        await micRef.current.start()
        setIsRecordingCall(true)
      } catch {
        setMessage('Microphone permission is required to record this call.')
      }
    } else {
      const result = await micRef.current.stop()
      setIsRecordingCall(false)
      if (result?.blob?.size) {
        try {
          const fd = new FormData()
          fd.append('audio', result.blob, `call-${call.id}${result.mimeType.includes('webm') ? '.webm' : ''}`)
          fd.append('label', `Call recording — ${call.expected_speaker_label || call.to_number}`)
          fd.append('kind', 'call')
          fd.append('duration_seconds', String(elapsed))
          fd.append('call_id', call.id)
          const rec = await recordingsApi.upload(fd)
          setCallRecordingId(rec.id)
        } catch { /* non-fatal */ }
      }
    }
  }

  const endCall = async () => {
    clearInterval(timerRef.current)
    clearTimeout(ringTimeoutRef.current)
    wsRef.current?.close()
    if (isRecordingCall) await toggleCallRecording()
    setPhase('ended')
    try {
      const finished = await dialerApi.endCall(call.id, {
        duration_seconds: elapsed,
        recording_id: callRecordingId,
      })
      setFinalCall(finished)
    } catch { /* keep UI in ended state regardless */ }
  }

  const reset = () => {
    setPhase('idle')
    setCall(null)
    setFinalCall(null)
    setNumber('')
    setLabel('')
    setElapsed(0)
    setLiveScores(null)
    setCallRecordingId(null)
    setMessage('')
  }

  if (phase === 'idle') {
    return (
      <div className="card p-6">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Contact name (optional)"
          className="focus-ring w-full bg-base-800 border border-black/10 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder:text-slate-500 mb-3"
        />
        <div className="relative mb-5">
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/[^\d+*#\s-]/g, ''))}
            placeholder="Enter mobile number"
            className="focus-ring w-full bg-base-800 border border-black/10 rounded-xl px-4 py-3 text-xl text-center font-mono tracking-wider text-slate-900 placeholder:text-slate-500 placeholder:text-sm"
          />
          {number && (
            <button
              onClick={backspace}
              className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-2"
            >
              <Delete size={18} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {DIAL_KEYS.map(([k, sub]) => (
            <button
              key={k}
              onClick={() => pressKey(k)}
              className="focus-ring aspect-square rounded-2xl bg-base-800 hover:bg-base-700 border border-black/5 flex flex-col items-center justify-center text-slate-900 transition-colors active:scale-95"
            >
              <span className="text-xl font-semibold">{k}</span>
              <span className="text-[9px] text-slate-500 tracking-widest">{sub}</span>
            </button>
          ))}
        </div>

        <button
          onClick={startCall}
          disabled={!number.trim()}
          className="focus-ring w-full py-3.5 rounded-2xl bg-risk-low hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-base-950 font-bold text-sm flex items-center justify-center gap-2 transition"
        >
          <Phone size={18} fill="currentColor" /> Call
        </button>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="card p-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-risk-critical/15 border border-risk-critical/30 flex items-center justify-center mb-4">
          <PhoneOff size={26} className="text-risk-critical" />
        </div>
        <h3 className="text-slate-900 font-bold mb-1">Call failed</h3>
        <p className="text-sm text-slate-400 mb-5">{message || 'Unable to place this call.'}</p>
        <button onClick={reset} className="focus-ring w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold">
          Try again
        </button>
      </div>
    )
  }

  // ringing / connected / ended
  const displayName = label || call?.expected_speaker_label || number
  const overall = liveScores?.risk_score
  const color = overall != null ? riskColor(overall) : '#7C5CFC'

  return (
    <div className="card p-6 flex flex-col items-center text-center">
      <Avatar name={displayName || '?'} seed={displayName} size={72} />
      <h3 className="text-lg font-bold text-slate-900 mt-3">{displayName || 'Unknown'}</h3>
      <p className="text-sm text-slate-500 font-mono">{call?.to_number || number}</p>
      <CallerIdBadge score={phase === 'connected' ? overall : null} />

      {phase === 'ringing' && (
        <div className="mt-6 flex items-center gap-2 text-brand-400 text-sm font-semibold">
          <Loader2 size={16} className="animate-spin" /> Ringing…
        </div>
      )}

      {phase === 'connected' && (
        <>
          <div className="mt-5 text-3xl font-mono font-bold text-slate-900">{formatTimer(elapsed)}</div>
          <div className="mt-4 w-full">
            <Waveform bars={waveform} color="#7C5CFC" height={60} />
          </div>
          {overall != null && (
            <div className="mt-3">
              <Gauge label="Live Impersonation Risk" score={overall} size={92} />
            </div>
          )}
          <div className="grid grid-cols-4 gap-3 mt-6 w-full">
            <CallIconButton active={muted} onClick={() => setMuted((m) => !m)} icon={muted ? MicOff : Mic} label={muted ? 'Unmute' : 'Mute'} />
            <CallIconButton active={!speaker} onClick={() => setSpeaker((s) => !s)} icon={speaker ? Volume2 : VolumeX} label="Speaker" />
            <CallIconButton
              active={isRecordingCall}
              onClick={toggleCallRecording}
              icon={Disc}
              label={isRecordingCall ? 'Stop rec.' : 'Record'}
              danger={isRecordingCall}
            />
            <button
              onClick={endCall}
              className="focus-ring flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-risk-critical hover:brightness-110 text-slate-900 transition"
            >
              <PhoneOff size={18} />
              <span className="text-[10px] font-semibold">End</span>
            </button>
          </div>
        </>
      )}

      {phase === 'ended' && (
        <div className="mt-5 w-full">
          <p className="text-sm text-slate-400 mb-4">Call ended · {formatTimer(elapsed)}</p>
          {finalCall ? (
            <div className="rounded-xl p-4 border" style={{ borderColor: `${riskColor(finalCall.risk_score)}55`, background: `${riskColor(finalCall.risk_score)}12` }}>
              <div className="flex items-center justify-center gap-2 text-sm font-bold" style={{ color: riskColor(finalCall.risk_score) }}>
                <ShieldAlert size={16} /> Risk score: {finalCall.risk_score}/100
              </div>
              <p className="text-xs text-slate-400 mt-1">Recommended action: {finalCall.recommended_action}</p>
              <p className="text-xs text-slate-600 mt-2">Saved to Call History as {finalCall.id}</p>
            </div>
          ) : (
            <Loader2 size={20} className="animate-spin mx-auto text-slate-500" />
          )}
          <button onClick={reset} className="focus-ring w-full mt-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold">
            New call
          </button>
        </div>
      )}

      {message && phase === 'ringing' && (
        <p className="text-[11px] text-slate-600 mt-4 max-w-[85%]">{message}</p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Real call: genuine live two-way WebRTC audio between two app users  */
/* ------------------------------------------------------------------ */

function extractRoomId(input) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    const parts = url.pathname.split('/').filter(Boolean)
    const idx = parts.indexOf('join')
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1]
  } catch {
    /* not a URL, treat as a raw id/code */
  }
  return trimmed
}

function RealCallCard({ joinRoomId }) {
  const [name, setName] = useState('')
  const [codeInput, setCodeInput] = useState(joinRoomId || '')
  const [phase, setPhase] = useState('menu') // menu | hosting | connecting | connected | ended | error
  const [role, setRole] = useState(null) // 'caller' | 'responder'
  const [room, setRoom] = useState(null)
  const [status, setStatus] = useState('')
  const [message, setMessage] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [muted, setMuted] = useState(false)
  const [remoteMuted, setRemoteMuted] = useState(false)
  const [liveScores, setLiveScores] = useState(null)
  const [waveform, setWaveform] = useState([])
  const [finalCall, setFinalCall] = useState(null)
  const [isRecordingCall, setIsRecordingCall] = useState(false)
  const [callRecordingId, setCallRecordingId] = useState(null)
  const [copied, setCopied] = useState(false)

  const rtcRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const timerRef = useRef(null)
  const wsScoreRef = useRef(null)
  const mixerRef = useRef(null)
  const recorderRef = useRef(null)

  useEffect(() => () => cleanupAll(), []) // eslint-disable-line

  function cleanupAll() {
    clearInterval(timerRef.current)
    wsScoreRef.current?.close()
    rtcRef.current?.hangup()
    mixerRef.current?.close()
  }

  const beginTimerAndScoreFeed = () => {
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    wsScoreRef.current = liveCallSocket((msg) => {
      setLiveScores(msg.scores)
      setWaveform(msg.waveform)
    })
  }

  const attachCall = (call, myRole) => {
    setRoom(call)
    setRole(myRole)
    const rtc = new WebRTCCall({
      roomId: call.id,
      role: myRole,
      onStatus: (s) => {
        setStatus(s)
        if (s === 'connected') {
          setPhase((p) => (p === 'connected' ? p : 'connected'))
          beginTimerAndScoreFeed()
        }
        if (s === 'failed' || s === 'disconnected') {
          setMessage('The connection dropped.')
        }
      },
      onRemoteStream: (stream) => {
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream
      },
      onPeerLeft: () => {
        endRealCall()
      },
      onError: (msg) => {
        setMessage(msg)
        setPhase('error')
      },
    })
    rtcRef.current = rtc
    rtc.start().catch(() => {
      setMessage('Microphone access is required for a real call.')
      setPhase('error')
    })
  }

  const startHosting = async () => {
    setMessage('')
    try {
      const call = await roomApi.create({ caller_label: name.trim() || null })
      setPhase('hosting')
      attachCall(call, 'caller')
    } catch (e) {
      setMessage(e.message || 'Could not start the call.')
      setPhase('error')
    }
  }

  const joinCall = async () => {
    const id = extractRoomId(codeInput)
    if (!id) return
    setMessage('')
    try {
      const call = await roomApi.join(id, { responder_label: name.trim() || null })
      setPhase('connecting')
      attachCall(call, 'responder')
    } catch (e) {
      setMessage(e.message || 'That call code or link is not valid.')
      setPhase('error')
    }
  }

  const copyLink = async () => {
    if (!room) return
    const link = `${window.location.origin}/dialer/join/${room.id}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard may be unavailable — code is still shown for manual sharing */
    }
  }

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    rtcRef.current?.setMuted(next)
  }

  const toggleCallRecording = async () => {
    if (!isRecordingCall) {
      try {
        const mixer = createCallMixer(rtcRef.current?.localStream, rtcRef.current?.remoteStream)
        mixerRef.current = mixer
        recorderRef.current = new StreamRecorder(mixer.stream)
        recorderRef.current.start()
        setIsRecordingCall(true)
      } catch {
        setMessage('Could not start recording this call.')
      }
    } else {
      const result = await recorderRef.current?.stop()
      mixerRef.current?.close()
      setIsRecordingCall(false)
      if (result?.blob?.size) {
        try {
          const fd = new FormData()
          fd.append('audio', result.blob, `call-${room.id}${result.mimeType.includes('webm') ? '.webm' : ''}`)
          fd.append('label', `Real call recording — ${room.expected_speaker_label || room.room_code}`)
          fd.append('kind', 'call')
          fd.append('duration_seconds', String(elapsed))
          fd.append('call_id', room.id)
          const rec = await recordingsApi.upload(fd)
          setCallRecordingId(rec.id)
        } catch { /* non-fatal */ }
      }
    }
  }

  const endRealCall = async () => {
    clearInterval(timerRef.current)
    wsScoreRef.current?.close()
    if (isRecordingCall) await toggleCallRecording()
    rtcRef.current?.hangup()
    setPhase((p) => (p === 'ended' ? p : 'ended'))
    if (!room) return
    try {
      const finished = await dialerApi.endCall(room.id, {
        duration_seconds: elapsed,
        recording_id: callRecordingId,
      })
      setFinalCall(finished)
    } catch { /* keep UI in ended state regardless */ }
  }

  const reset = () => {
    cleanupAll()
    setPhase('menu')
    setRoom(null)
    setRole(null)
    setFinalCall(null)
    setElapsed(0)
    setLiveScores(null)
    setCallRecordingId(null)
    setMessage('')
    setCodeInput('')
  }

  if (phase === 'menu') {
    return (
      <div className="card p-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          className="focus-ring w-full bg-base-800 border border-black/10 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder:text-slate-500 mb-4"
        />

        <button
          onClick={startHosting}
          className="focus-ring w-full py-3.5 rounded-2xl bg-risk-low hover:brightness-110 text-base-950 font-bold text-sm flex items-center justify-center gap-2 transition mb-5"
        >
          <Phone size={18} fill="currentColor" /> Start a Real Call
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="h-px flex-1 bg-black/10" />
          <span className="text-[11px] text-slate-500 font-semibold">OR JOIN ONE</span>
          <div className="h-px flex-1 bg-black/10" />
        </div>

        <label className="text-xs text-slate-500 mb-1.5 block">Call code or link</label>
        <div className="flex gap-2">
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="e.g. A7K9QZ"
            className="focus-ring flex-1 bg-base-800 border border-black/10 rounded-xl px-3 py-2.5 text-sm font-mono tracking-widest text-slate-900 placeholder:text-slate-500 placeholder:tracking-normal"
          />
          <button
            onClick={joinCall}
            disabled={!codeInput.trim()}
            className="focus-ring px-4 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white flex items-center justify-center transition"
          >
            <ArrowRight size={18} />
          </button>
        </div>

        {message && <p className="text-xs text-risk-critical mt-4">{message}</p>}
        <p className="text-[11px] text-slate-600 mt-4 flex items-start gap-1.5">
          <Users size={13} className="mt-0.5 shrink-0" /> Real live audio between two people with this app open — one starts the call, the other joins with the code or link.
        </p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="card p-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-risk-critical/15 border border-risk-critical/30 flex items-center justify-center mb-4">
          <PhoneOff size={26} className="text-risk-critical" />
        </div>
        <h3 className="text-slate-900 font-bold mb-1">Couldn't connect</h3>
        <p className="text-sm text-slate-400 mb-5">{message || 'Something went wrong with this call.'}</p>
        <button onClick={reset} className="focus-ring w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold">
          Try again
        </button>
      </div>
    )
  }

  if (phase === 'hosting') {
    const link = room ? `${window.location.origin}/dialer/join/${room.id}` : ''
    return (
      <div className="card p-6 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center mb-4">
          <Loader2 size={24} className="animate-spin text-brand-400" />
        </div>
        <h3 className="text-slate-900 font-bold mb-1">Waiting for the other person…</h3>
        <p className="text-sm text-slate-500 mb-5">Share this code or link to connect a real call.</p>

        <div className="rounded-xl bg-base-800 border border-black/10 p-4 mb-3">
          <div className="text-2xl font-mono font-bold tracking-[0.3em] text-slate-900">{room?.room_code}</div>
        </div>

        <button
          onClick={copyLink}
          className="focus-ring w-full py-2.5 rounded-xl bg-base-800 hover:bg-base-700 border border-black/10 text-slate-800 text-sm font-semibold flex items-center justify-center gap-2 mb-5"
        >
          {copied ? <Check size={14} className="text-risk-low" /> : <Copy size={14} />}
          {copied ? 'Link copied' : 'Copy invite link'}
        </button>
        <p className="text-[11px] text-slate-600 truncate mb-5 flex items-center justify-center gap-1">
          <Link2 size={11} /> {link}
        </p>

        <button onClick={reset} className="focus-ring w-full py-2.5 rounded-xl border border-black/10 text-slate-700 hover:bg-black/5 text-sm font-semibold">
          Cancel
        </button>
      </div>
    )
  }

  // connecting / connected / ended
  const displayName = role === 'caller' ? (room?.responder_label || 'Responder') : (room?.expected_speaker_label || 'Caller')

  return (
    <div className="card p-6 flex flex-col items-center text-center">
      <audio ref={remoteAudioRef} autoPlay muted={remoteMuted} />
      <Avatar name={displayName} seed={displayName} size={72} />
      <h3 className="text-lg font-bold text-slate-900 mt-3">{displayName}</h3>
      <p className="text-sm text-slate-500">{room?.room_code}</p>
      <CallerIdBadge score={phase === 'connected' ? liveScores?.risk_score : null} />

      {phase === 'connecting' && (
        <div className="mt-6 flex items-center gap-2 text-brand-400 text-sm font-semibold">
          <Loader2 size={16} className="animate-spin" /> {status === 'peer-joined' ? 'Connecting…' : 'Joining…'}
        </div>
      )}

      {phase === 'connected' && (
        <>
          <div className="mt-5 text-3xl font-mono font-bold text-slate-900">{formatTimer(elapsed)}</div>
          <div className="mt-4 w-full">
            <Waveform bars={waveform} color="#7C5CFC" height={60} />
          </div>
          {liveScores?.risk_score != null && (
            <div className="mt-3">
              <Gauge label="Live Impersonation Risk" score={liveScores.risk_score} size={92} />
            </div>
          )}
          <div className="grid grid-cols-4 gap-3 mt-6 w-full">
            <CallIconButton active={muted} onClick={toggleMute} icon={muted ? MicOff : Mic} label={muted ? 'Unmute' : 'Mute'} />
            <CallIconButton active={remoteMuted} onClick={() => setRemoteMuted((m) => !m)} icon={remoteMuted ? VolumeX : Volume2} label="Speaker" />
            <CallIconButton
              active={isRecordingCall}
              onClick={toggleCallRecording}
              icon={Disc}
              label={isRecordingCall ? 'Stop rec.' : 'Record'}
              danger={isRecordingCall}
            />
            <button
              onClick={endRealCall}
              className="focus-ring flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-risk-critical hover:brightness-110 text-slate-900 transition"
            >
              <PhoneOff size={18} />
              <span className="text-[10px] font-semibold">End</span>
            </button>
          </div>
        </>
      )}

      {phase === 'ended' && (
        <div className="mt-5 w-full">
          <p className="text-sm text-slate-400 mb-4">Call ended · {formatTimer(elapsed)}</p>
          {finalCall ? (
            <div className="rounded-xl p-4 border" style={{ borderColor: `${riskColor(finalCall.risk_score)}55`, background: `${riskColor(finalCall.risk_score)}12` }}>
              <div className="flex items-center justify-center gap-2 text-sm font-bold" style={{ color: riskColor(finalCall.risk_score) }}>
                <ShieldAlert size={16} /> Risk score: {finalCall.risk_score}/100
              </div>
              <p className="text-xs text-slate-400 mt-1">Recommended action: {finalCall.recommended_action}</p>
              <p className="text-xs text-slate-600 mt-2">Saved to Call History as {finalCall.id}</p>
            </div>
          ) : (
            <Loader2 size={20} className="animate-spin mx-auto text-slate-500" />
          )}
          <button onClick={reset} className="focus-ring w-full mt-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold">
            New call
          </button>
        </div>
      )}

      {message && <p className="text-[11px] text-risk-critical mt-4 max-w-[85%]">{message}</p>}
    </div>
  )
}

function CallIconButton({ icon: Icon, label, active, danger, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`focus-ring flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition ${
        danger
          ? 'bg-risk-critical/20 border-risk-critical/40 text-risk-critical'
          : active
          ? 'bg-brand-600 border-brand-500 text-white'
          : 'bg-base-800 border-black/5 text-slate-700 hover:bg-base-700'
      }`}
    >
      <Icon size={18} />
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Voice studio: record + play back demo voice, recordings library     */
/* ------------------------------------------------------------------ */

function VoiceStudio() {
  const [recording, setRecording] = useState(false)
  const [level, setLevel] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [preview, setPreview] = useState(null) // { blob, url, mimeType }
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [recordings, setRecordings] = useState([])
  const [micError, setMicError] = useState('')

  const micRef = useRef(null)
  const timerRef = useRef(null)

  const loadRecordings = () => recordingsApi.list().then(setRecordings).catch(() => {})
  useEffect(() => { loadRecordings() }, [])

  const startRecording = async () => {
    setMicError('')
    setPreview(null)
    try {
      micRef.current = new MicRecorder({ onLevel: setLevel })
      await micRef.current.start()
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch {
      setMicError('Microphone access was denied or is unavailable. Check your browser/site permissions.')
    }
  }

  const stopRecording = async () => {
    clearInterval(timerRef.current)
    setRecording(false)
    const result = await micRef.current?.stop()
    setLevel(0)
    if (result?.blob) {
      setPreview({ blob: result.blob, url: URL.createObjectURL(result.blob), mimeType: result.mimeType })
    }
  }

  const discardPreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url)
    setPreview(null)
    setSeconds(0)
    setLabel('')
  }

  const savePreview = async () => {
    if (!preview) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('audio', preview.blob, `demo${preview.mimeType.includes('webm') ? '.webm' : '.wav'}`)
      fd.append('label', label.trim() || `Demo voice — ${new Date().toLocaleString()}`)
      fd.append('kind', 'demo')
      fd.append('duration_seconds', String(seconds))
      await recordingsApi.upload(fd)
      discardPreview()
      await loadRecordings()
    } catch {
      setMicError('Could not save the recording — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const removeRecording = async (id) => {
    await recordingsApi.remove(id).catch(() => {})
    setRecordings((rs) => rs.filter((r) => r.id !== id))
  }

  return (
    <>
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Voice Studio</h3>
        <p className="text-xs text-slate-500 mb-4">Record a demo voice sample from your microphone, then play it back or save it to the library.</p>

        <div className="flex items-center gap-4">
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`focus-ring shrink-0 w-14 h-14 rounded-full flex items-center justify-center transition ${
              recording ? 'bg-risk-critical hover:brightness-110' : 'bg-brand-600 hover:bg-brand-500'
            } text-slate-900`}
          >
            {recording ? <Disc size={22} /> : <Mic size={22} />}
          </button>

          <div className="flex-1 min-w-0">
            {recording ? (
              <>
                <div className="flex items-center gap-2 text-sm text-risk-critical font-semibold mb-1">
                  <span className="w-2 h-2 rounded-full bg-risk-critical animate-pulse" /> Recording… {formatTimer(seconds)}
                </div>
                <div className="h-2 rounded-full bg-base-800 overflow-hidden">
                  <div className="h-full bg-brand-500 transition-all duration-100" style={{ width: `${Math.min(100, level * 220)}%` }} />
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">{preview ? 'Recording ready — preview below.' : 'Tap the mic to start recording.'}</p>
            )}
          </div>
        </div>

        {micError && <p className="text-xs text-risk-critical mt-3">{micError}</p>}

        {preview && (
          <div className="mt-4 p-4 rounded-xl bg-base-800 border border-black/5 space-y-3">
            <audio controls src={preview.url} className="w-full h-9" />
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label this recording (e.g. “Enrollment sample”)"
              className="focus-ring w-full bg-base-900 border border-black/10 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-500"
            />
            <div className="flex gap-2">
              <button
                onClick={savePreview}
                disabled={saving}
                className="focus-ring flex-1 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
              </button>
              <button
                onClick={discardPreview}
                className="focus-ring px-4 py-2 rounded-lg border border-black/10 text-slate-700 hover:bg-black/5 text-sm font-semibold flex items-center gap-1.5"
              >
                <X size={14} /> Discard
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Recordings Library</h3>
        <div className="space-y-2 max-h-[360px] overflow-y-auto">
          {recordings.map((r) => (
            <RecordingRow key={r.id} recording={r} onDelete={() => removeRecording(r.id)} />
          ))}
          {recordings.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-6">No recordings yet — record a demo voice above or record a call.</p>
          )}
        </div>
      </div>
    </>
  )
}

function RecordingRow({ recording, onDelete }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch(() => {})
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-base-800 border border-black/5">
      <button
        onClick={toggle}
        className="focus-ring w-9 h-9 rounded-full bg-brand-600 hover:bg-brand-500 flex items-center justify-center text-white shrink-0 transition-colors"
      >
        {playing ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />}
      </button>
      <audio
        ref={audioRef}
        src={recordingsApi.audioUrl(recording.id)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        preload="none"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-800 font-medium truncate">{recording.label}</div>
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${recording.kind === 'call' ? 'bg-brand-500/20 text-brand-400' : 'bg-risk-low/15 text-risk-low'}`}>
            {recording.kind}
          </span>
          {recording.size_kb} KB · {recording.duration_seconds}s · {formatDateTime(recording.created_at)}
        </div>
      </div>
      <button onClick={onDelete} className="focus-ring text-slate-500 hover:text-risk-critical p-1.5 shrink-0">
        <Trash2 size={15} />
      </button>
    </div>
  )
}
