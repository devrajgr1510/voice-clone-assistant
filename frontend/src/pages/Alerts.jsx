import { useEffect, useState } from 'react'
import { AlertTriangle, ShieldAlert, Smartphone, MapPin, CheckCheck } from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import { SeverityBadge } from '../components/RiskBadge.jsx'
import { api } from '../api/client.js'
import { formatTime } from '../lib/time.js'

const ICONS = {
  'High Risk Voice Impersonation Detected': ShieldAlert,
  'Elevated Impersonation Risk Detected': ShieldAlert,
  'Unusual Transaction Request': AlertTriangle,
  'New Device Login Detected': Smartphone,
  'Multiple Failed Verifications': AlertTriangle,
  'Unusual Location Detected': MapPin,
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([])

  const load = () => api.getAlerts().then(setAlerts).catch(() => {})
  useEffect(() => { load() }, [])

  const markAllRead = async () => {
    await api.markAllAlertsRead()
    load()
  }

  return (
    <>
      <Topbar title="Alerts" subtitle="Security alerts and notifications">
        <button
          onClick={markAllRead}
          className="focus-ring inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-black/10 text-sm text-slate-700 hover:bg-black/5"
        >
          <CheckCheck size={14} /> Mark all as read
        </button>
      </Topbar>

      <div className="px-4 md:px-8 pb-10">
        <div className="card divide-y divide-black/5">
          {alerts.map((a) => {
            const Icon = ICONS[a.title] || AlertTriangle
            return (
              <div
                key={a.id}
                onClick={() => !a.read && api.markAlertRead(a.id).then(load)}
                className={`flex items-start gap-4 p-5 cursor-pointer transition-colors hover:bg-black/[0.03] ${!a.read ? 'bg-brand-500/[0.04]' : ''}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  a.severity === 'critical' ? 'bg-risk-critical/15 text-risk-critical' :
                  a.severity === 'high' ? 'bg-risk-high/15 text-risk-high' :
                  'bg-risk-medium/15 text-risk-medium'
                }`}>
                  <Icon size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={a.severity} />
                    <span className="text-sm font-semibold text-slate-900">{a.title}</span>
                    {!a.read && <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />}
                  </div>
                  {a.description && <p className="text-sm text-slate-400 mt-1">{a.description}</p>}
                  {a.call_id && <p className="text-xs text-slate-500 mt-1">Related call: {a.call_id}</p>}
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">{formatTime(a.created_at)}</span>
              </div>
            )
          })}
          {alerts.length === 0 && <p className="text-sm text-slate-500 p-8 text-center">No alerts yet.</p>}
        </div>
      </div>
    </>
  )
}
