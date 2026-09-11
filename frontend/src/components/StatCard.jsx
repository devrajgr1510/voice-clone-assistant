import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

export default function StatCard({ label, value, delta, icon: Icon, accent = '#7C5CFC' }) {
  const positive = delta >= 0
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        {Icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${accent}22`, color: accent }}
          >
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className="text-2xl md:text-3xl font-bold text-slate-900">{value}</div>
      {typeof delta === 'number' && (
        <div className={`inline-flex items-center gap-1 text-xs font-semibold w-fit ${positive ? 'text-risk-low' : 'text-risk-critical'}`}>
          {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(delta)}%
        </div>
      )}
    </div>
  )
}
