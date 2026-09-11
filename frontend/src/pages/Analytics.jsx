import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { PhoneCall, ShieldAlert, Ban, IndianRupee } from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import StatCard from '../components/StatCard.jsx'
import { api } from '../api/client.js'

const RISK_COLORS = { low: '#34D399', medium: '#FBBF24', high: '#FB923C', critical: '#F87171' }

function formatINR(n) {
  if (!n) return '\u20b90'
  if (n >= 100000) return `\u20b9${(n / 100000).toFixed(1)}L`
  return `\u20b9${n.toLocaleString('en-IN')}`
}

export default function Analytics() {
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    api.getAnalyticsSummary().then(setSummary).catch(() => {})
  }, [])

  if (!summary) {
    return (
      <>
        <Topbar title="Analytics Dashboard" subtitle="Overview of security metrics and trends" />
        <div className="px-4 md:px-8 text-slate-500">Loading…</div>
      </>
    )
  }

  const pieData = [
    { name: 'Low Risk', value: summary.risk_distribution.low, color: RISK_COLORS.low },
    { name: 'Medium Risk', value: summary.risk_distribution.medium, color: RISK_COLORS.medium },
    { name: 'High Risk', value: summary.risk_distribution.high, color: RISK_COLORS.high },
    { name: 'Critical Risk', value: summary.risk_distribution.critical, color: RISK_COLORS.critical },
  ]

  return (
    <>
      <Topbar title="Analytics Dashboard" subtitle="Overview of security metrics and trends" />

      <div className="px-4 md:px-8 pb-10 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <StatCard label="Total Calls Analyzed" value={summary.total_calls_analyzed} delta={summary.total_calls_delta_pct} icon={PhoneCall} accent="#7C5CFC" />
          <StatCard label="High Risk Calls" value={summary.high_risk_calls} delta={summary.high_risk_delta_pct} icon={ShieldAlert} accent="#FB923C" />
          <StatCard label="Blocked Transactions" value={summary.blocked_transactions} delta={summary.blocked_delta_pct} icon={Ban} accent="#F87171" />
          <StatCard label="Prevented Loss" value={formatINR(summary.prevented_loss_inr)} delta={summary.prevented_loss_delta_pct} icon={IndianRupee} accent="#34D399" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Risk Distribution</h3>
            <p className="text-xs text-slate-500 mb-2">{summary.risk_distribution.total} total calls</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {pieData.map((d) => <Cell key={d.name} fill={d.color} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E4E9F3', borderRadius: 10, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  {d.name} · {d.value}%
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Risk Trend Over Time</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={summary.risk_trend} margin={{ left: -20, right: 10, top: 10 }}>
                <CartesianGrid stroke="#E4E9F3" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E4E9F3', borderRadius: 10, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="low" stroke={RISK_COLORS.low} strokeWidth={2} dot={false} name="Low Risk" />
                <Line type="monotone" dataKey="medium" stroke={RISK_COLORS.medium} strokeWidth={2} dot={false} name="Medium Risk" />
                <Line type="monotone" dataKey="high" stroke={RISK_COLORS.high} strokeWidth={2} dot={false} name="High Risk" />
                <Line type="monotone" dataKey="critical" stroke={RISK_COLORS.critical} strokeWidth={2} dot={false} name="Critical Risk" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  )
}
