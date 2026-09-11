import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import Topbar from '../components/Topbar.jsx'

const ENDPOINTS = [
  { method: 'GET', path: '/api/calls', desc: 'List recent calls, with optional status/search filters.' },
  { method: 'GET', path: '/api/calls/latest', desc: 'Fetch the most recent call for the Live Protection view.' },
  { method: 'POST', path: '/api/calls', desc: 'Submit a new call for real-time impersonation analysis.' },
  { method: 'POST', path: '/api/calls/{id}/action', desc: 'Execute the recommended action (block / verify / allow).' },
  { method: 'GET', path: '/api/alerts', desc: 'List security alerts, optionally filtered by severity.' },
  { method: 'GET', path: '/api/speakers', desc: 'List enrolled speakers and their verification status.' },
  { method: 'GET', path: '/api/analytics/summary', desc: 'Aggregate metrics for the analytics dashboard.' },
  { method: 'WS', path: '/ws/live-call', desc: 'Streams live risk sub-scores + waveform data during a call.' },
]

const SAMPLE = `curl -X POST https://your-domain.com/api/calls \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk_live_vaanee_xxxxxxxx" \\
  -d '{
    "caller_number": "+91 98765 43210",
    "expected_speaker_label": "CFO - Rajesh Kumar",
    "language": "English",
    "transaction_amount": 250000
  }'`

const METHOD_COLOR = {
  GET: 'text-risk-low bg-risk-low/15 border-risk-low/30',
  POST: 'text-brand-400 bg-brand-500/15 border-brand-500/30',
  WS: 'text-risk-medium bg-risk-medium/15 border-risk-medium/30',
}

export default function ApiConsole() {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard?.writeText(SAMPLE)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <Topbar title="API Console" subtitle="Integrate VAANEE SHIELD with your telephony & banking systems" />

      <div className="px-4 md:px-8 pb-10 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Available Endpoints</h3>
          <div className="space-y-2">
            {ENDPOINTS.map((e) => (
              <div key={e.path + e.method} className="flex items-start gap-3 p-3 rounded-xl bg-base-800 border border-black/5">
                <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-bold border ${METHOD_COLOR[e.method]}`}>{e.method}</span>
                <div className="min-w-0">
                  <div className="text-sm font-mono text-slate-800 truncate">{e.path}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{e.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Sample Request</h3>
            <button onClick={copy} className="focus-ring inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-800">
              {copied ? <Check size={13} className="text-risk-low" /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="text-xs font-mono text-slate-700 bg-base-800 border border-black/5 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap">
{SAMPLE}
          </pre>

          <h3 className="text-sm font-semibold text-slate-700 mt-6 mb-2">Response</h3>
          <pre className="text-xs font-mono text-slate-400 bg-base-800 border border-black/5 rounded-xl p-4 overflow-x-auto">
{`{
  "id": "VS-2026-05-20-A1B2",
  "risk_score": 87,
  "status": "blocked",
  "recommended_action": "Block / Pause Transaction",
  ...
}`}
          </pre>
        </div>
      </div>
    </>
  )
}
