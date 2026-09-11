import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PhoneCall, ShieldAlert, Ban, IndianRupee, ArrowRight } from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import StatCard from '../components/StatCard.jsx'
import { StatusBadge, SeverityBadge, riskColor } from '../components/RiskBadge.jsx'
import { api } from '../api/client.js'
import { formatTime } from '../lib/time.js'

function formatINR(n) {
  if (!n) return '\u20b90'
  if (n >= 100000) return `\u20b9${(n / 100000).toFixed(1)}L`
  return `\u20b9${n.toLocaleString('en-IN')}`
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [calls, setCalls] = useState([])
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    api.getAnalyticsSummary().then(setSummary).catch(() => {})
    api.getCalls({ limit: 5 }).then(setCalls).catch(() => {})
    api.getAlerts({ unread_only: 'true' }).then((a) => setAlerts(a.slice(0, 4))).catch(() => {})
  }, [])

  return (
    <>
      <Topbar title="Security Dashboard" subtitle="Real-time overview of voice fraud protection" />

      <div className="px-4 md:px-8 pb-10 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <StatCard label="Total Calls Analyzed" value={summary?.total_calls_analyzed ?? '—'} delta={summary?.total_calls_delta_pct} icon={PhoneCall} accent="#7C5CFC" />
          <StatCard label="High Risk Calls" value={summary?.high_risk_calls ?? '—'} delta={summary?.high_risk_delta_pct} icon={ShieldAlert} accent="#FB923C" />
          <StatCard label="Blocked Transactions" value={summary?.blocked_transactions ?? '—'} delta={summary?.blocked_delta_pct} icon={Ban} accent="#F87171" />
          <StatCard label="Prevented Loss" value={formatINR(summary?.prevented_loss_inr)} delta={summary?.prevented_loss_delta_pct} icon={IndianRupee} accent="#34D399" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">Recent Calls</h3>
              <Link to="/call-history" className="text-xs text-brand-400 font-medium inline-flex items-center gap-1 hover:text-brand-300">
                View all <ArrowRight size={13} />
              </Link>
            </div>
            <div className="space-y-1">
              {calls.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-black/5 last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{c.expected_speaker_label || c.caller_number}</div>
                    <div className="text-xs text-slate-500">{c.id} · {c.caller_number}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold" style={{ color: riskColor(c.risk_score) }}>{c.risk_score}/100</span>
                    <StatusBadge status={c.status} />
                  </div>
                </div>
              ))}
              {calls.length === 0 && <p className="text-sm text-slate-500 py-4">No calls recorded yet.</p>}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">Unread Alerts</h3>
              <Link to="/alerts" className="text-xs text-brand-400 font-medium inline-flex items-center gap-1 hover:text-brand-300">
                View all <ArrowRight size={13} />
              </Link>
            </div>
            <div className="space-y-3">
              {alerts.map((a) => (
                <div key={a.id} className="flex items-start gap-2.5">
                  <SeverityBadge severity={a.severity} />
                  <div className="min-w-0">
                    <div className="text-sm text-slate-800 leading-tight">{a.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{formatTime(a.created_at)}</div>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && <p className="text-sm text-slate-500">You're all caught up.</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
