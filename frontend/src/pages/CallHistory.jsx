import { useEffect, useState } from 'react'
import { Search, Filter, Download } from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import { StatusBadge, riskColor } from '../components/RiskBadge.jsx'
import { api } from '../api/client.js'
import { formatTime } from '../lib/time.js'

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'verify', label: 'Verify' },
  { key: 'allowed', label: 'Allowed' },
]

export default function CallHistory() {
  const [calls, setCalls] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    const params = {}
    if (status) params.status = status
    if (search) params.search = search
    const t = setTimeout(() => {
      api.getCalls(params).then(setCalls).catch(() => {})
    }, 200)
    return () => clearTimeout(t)
  }, [search, status])

  return (
    <>
      <Topbar title="Call History" subtitle="View and search call records" />

      <div className="px-4 md:px-8 pb-10">
        <div className="card p-5">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search calls…"
                className="focus-ring w-full bg-base-800 border border-black/10 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-800 placeholder:text-slate-500"
              />
            </div>
            <div className="flex items-center gap-1 bg-base-800 border border-black/10 rounded-xl p-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatus(f.key)}
                  className={`focus-ring px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    status === f.key ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button className="focus-ring inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-black/10 text-sm text-slate-700 hover:bg-black/5">
              <Filter size={14} /> Filters
            </button>
            <button className="focus-ring inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-black/10 text-sm text-slate-700 hover:bg-black/5">
              <Download size={14} /> Export
            </button>
          </div>

          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-black/5">
                  <th className="font-medium px-2 py-2">Call ID</th>
                  <th className="font-medium px-2 py-2">Caller</th>
                  <th className="font-medium px-2 py-2">Expected Speaker</th>
                  <th className="font-medium px-2 py-2">Duration</th>
                  <th className="font-medium px-2 py-2">Risk Score</th>
                  <th className="font-medium px-2 py-2">Status</th>
                  <th className="font-medium px-2 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <tr key={c.id} className="border-b border-black/5 last:border-0 hover:bg-black/5">
                    <td className="px-2 py-3 font-medium text-slate-800 whitespace-nowrap">{c.id}</td>
                    <td className="px-2 py-3 text-slate-400 whitespace-nowrap">{c.caller_number}</td>
                    <td className="px-2 py-3 text-slate-400 whitespace-nowrap">{c.expected_speaker_label || '—'}</td>
                    <td className="px-2 py-3 text-slate-400">{String(Math.floor(c.duration_seconds / 60)).padStart(2, '0')}:{String(c.duration_seconds % 60).padStart(2, '0')}</td>
                    <td className="px-2 py-3 font-bold" style={{ color: riskColor(c.risk_score) }}>{c.risk_score}/100</td>
                    <td className="px-2 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-2 py-3 text-slate-500 whitespace-nowrap">{formatTime(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {calls.length === 0 && <p className="text-sm text-slate-500 py-8 text-center">No matching calls found.</p>}
          </div>
        </div>
      </div>
    </>
  )
}
