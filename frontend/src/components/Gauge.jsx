function levelForScore(score) {
  if (score >= 80) return { label: 'Very High', color: '#F87171' }
  if (score >= 60) return { label: 'High', color: '#FB923C' }
  if (score >= 30) return { label: 'Medium', color: '#FBBF24' }
  return { label: 'Low', color: '#34D399' }
}

export default function Gauge({ label, score, size = 84 }) {
  const { label: level, color } = levelForScore(score)
  const r = (size - 10) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - score / 100)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#E4E9F3" strokeWidth="7" fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-slate-900">
          {score}%
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs text-slate-400 leading-tight">{label}</div>
        <div className="text-xs font-semibold" style={{ color }}>{level}</div>
      </div>
    </div>
  )
}
