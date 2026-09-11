import { useEffect, useRef, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { AlertTriangle, CheckCircle2, PhoneCall, ShieldCheck } from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import Gauge from '../components/Gauge.jsx'
import Waveform from '../components/Waveform.jsx'
import { riskColor } from '../components/RiskBadge.jsx'
import { api, liveCallSocket } from '../api/client.js'
import { formatTime } from '../lib/time.js'

function actionForScore(score) {
  if (score >= 80) {
    return {
      label: 'Block / Pause Transaction',
      tone: 'critical',
      steps: [
        { text: 'Require MFA Verification', done: true },
        { text: 'Initiate Callback Verification', done: true },
        { text: 'Alert Security Team', done: false },
      ],
    }
  }
  if (score >= 60) {
    return {
      label: 'Require Secondary Verification',
      tone: 'high',
      steps: [
        { text: 'Prompt Callback Verification', done: true },
        { text: 'Notify Frontline Supervisor', done: false },
      ],
    }
  }
  if (score >= 30) {
    return {
      label: 'Monitor & Flag for Review',
      tone: 'medium',
      steps: [{ text: 'Log for post-call review', done: true }],
    }
  }
  return {
    label: 'Allow Call to Proceed',
    tone: 'low',
    steps: [{ text: 'No additional action required', done: true }],
  }
}

export default function LiveProtection() {
  const [call, setCall] = useState(null)
  const [liveScores, setLiveScores] = useState(null)
  const [waveform, setWaveform] = useState([])
  const [elapsed, setElapsed] = useState(0)
  const wsRef = useRef(null)

  useEffect(() => {
    api.getLatestCall().then(setCall).catch(() => {})

    const ws = liveCallSocket((msg) => {
      setLiveScores(msg.scores)
      setWaveform(msg.waveform)
      setElapsed(msg.t)
    })
    wsRef.current = ws
    return () => ws.close()
  }, [])

  if (!call) {
    return (
      <>
        <Topbar title="Live Call Protection" subtitle="Real-time AI analysis of incoming voice" />
        <div className="px-4 md:px-8 pb-8 text-slate-500">Waiting for call data…</div>
      </>
    )
  }

  const scores = liveScores || {
    risk_score: call.risk_score,
    synthetic_voice_score: call.synthetic_voice_score,
    speaker_mismatch_score: call.speaker_mismatch_score,
    prosody_anomaly_score: call.prosody_anomaly_score,
    acoustic_anomaly_score: call.acoustic_anomaly_score,
    context_risk_score: call.context_risk_score,
    transaction_risk_score: call.transaction_risk_score,
  }
  const overall = scores.risk_score
  const color = riskColor(overall)
  const action = actionForScore(overall)
  const duration = String(Math.floor(elapsed / 60)).padStart(2, '0') + ':' + String(elapsed % 60).padStart(2, '0')

  const chartData = (call.risk_points || []).map((p) => ({ t: `${p.t_seconds}s`, risk: p.risk_score }))
  if (liveScores) chartData.push({ t: `${elapsed}s`, risk: overall })

  return (
    <>
      <Topbar title="Live Call Protection" subtitle="Real-time AI analysis of incoming voice" />

      <div className="px-4 md:px-8 pb-10 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Call information */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Call Information</h3>
            <dl className="space-y-3 text-sm">
              <Row label="Call ID" value={call.id} icon={PhoneCall} />
              <Row label="Caller" value={call.caller_number} />
              <Row label="Expected Speaker" value={call.expected_speaker_label || '—'} />
              <Row label="Language" value={call.language} />
              <Row label="Duration" value={duration} />
              <Row label="Time" value={formatTime(call.created_at)} />
            </dl>
          </div>

          {/* Risk score */}
          <div className="card p-5 flex flex-col items-center justify-center text-center">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 self-start">Impersonation Risk Score</h3>
            <div className="text-6xl font-extrabold" style={{ color }}>
              {overall}
              <span className="text-2xl text-slate-500 font-semibold"> / 100</span>
            </div>
            <div
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
              style={{ color, borderColor: `${color}55`, background: `${color}18` }}
            >
              <AlertTriangle size={13} />
              {overall >= 80 ? 'CRITICAL RISK' : overall >= 60 ? 'HIGH RISK' : overall >= 30 ? 'MEDIUM RISK' : 'LOW RISK'}
            </div>
            <div className="w-full h-2.5 rounded-full bg-base-700 mt-5 relative overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${overall}%`, background: `linear-gradient(90deg, #34D399, #FBBF24, #FB923C, #F87171)` }}
              />
            </div>
            <div className="flex justify-between w-full text-[11px] text-slate-500 mt-1">
              <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
            </div>
          </div>

          {/* Waveform */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">Live Waveform</h3>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-brand-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" /> Analyzing…
              </span>
            </div>
            <Waveform bars={waveform} color="#7C5CFC" />
          </div>
        </div>

        {/* AI Analysis Scores */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-5">AI Analysis Scores</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 justify-items-center">
            <Gauge label="Synthetic Voice" score={scores.synthetic_voice_score} />
            <Gauge label="Speaker Mismatch" score={scores.speaker_mismatch_score} />
            <Gauge label="Prosody Anomaly" score={scores.prosody_anomaly_score} />
            <Gauge label="Acoustic Anomaly" score={scores.acoustic_anomaly_score} />
            <Gauge label="Context Risk" score={scores.context_risk_score} />
            <Gauge label="Transaction Risk" score={scores.transaction_risk_score} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Risk over time */}
          <div className="card p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Risk Score Over Time</h3>
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={chartData} margin={{ left: -20, right: 10, top: 10 }}>
                <defs>
                  <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F87171" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#F87171" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E4E9F3" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="t" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: '#FFFFFF', border: '1px solid #E4E9F3', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: '#94A3B8' }}
                />
                <Area type="monotone" dataKey="risk" stroke="#F87171" strokeWidth={2} fill="url(#riskFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Recommended action */}
          <div className="card p-5 flex flex-col">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Recommended Action</h3>
            <div
              className="rounded-xl p-3 mb-4 flex items-center gap-2 text-sm font-bold border"
              style={{ color, borderColor: `${color}55`, background: `${color}18` }}
            >
              <AlertTriangle size={16} /> {action.label.toUpperCase()}
            </div>
            <ul className="space-y-2.5 flex-1">
              {action.steps.map((s, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                  {s.done ? (
                    <CheckCircle2 size={16} className="text-risk-low shrink-0" />
                  ) : (
                    <AlertTriangle size={16} className="text-risk-medium shrink-0" />
                  )}
                  {s.text}
                </li>
              ))}
            </ul>
            <button
              onClick={() => api.executeCallAction(call.id)}
              className="focus-ring mt-5 w-full py-2.5 rounded-xl font-semibold text-sm text-slate-900 flex items-center justify-center gap-2 transition-colors"
              style={{ background: color }}
            >
              <ShieldCheck size={16} /> Execute Action
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function Row({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 flex items-center gap-1.5">
        {Icon && <Icon size={14} />}
        {label}
      </span>
      <span className="text-slate-800 font-medium truncate max-w-[55%] text-right">{value}</span>
    </div>
  )
}
