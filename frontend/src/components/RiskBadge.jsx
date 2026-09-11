const STATUS_STYLES = {
  blocked: 'bg-risk-critical/15 text-risk-critical border-risk-critical/30',
  verify: 'bg-risk-medium/15 text-risk-medium border-risk-medium/30',
  allowed: 'bg-risk-low/15 text-risk-low border-risk-low/30',
  analyzing: 'bg-brand-500/15 text-brand-400 border-brand-500/30',
}

const STATUS_LABEL = {
  blocked: 'Blocked',
  verify: 'Verify',
  allowed: 'Allowed',
  analyzing: 'Analyzing',
}

export function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.analyzing
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${style}`}>
      {STATUS_LABEL[status] || status}
    </span>
  )
}

const SEVERITY_STYLES = {
  critical: 'bg-risk-critical/15 text-risk-critical border-risk-critical/30',
  high: 'bg-risk-high/15 text-risk-high border-risk-high/30',
  medium: 'bg-risk-medium/15 text-risk-medium border-risk-medium/30',
  low: 'bg-risk-low/15 text-risk-low border-risk-low/30',
}

export function SeverityBadge({ severity }) {
  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.medium
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide border ${style}`}>
      {severity.toUpperCase()}
    </span>
  )
}

export function riskColor(score) {
  if (score >= 80) return '#F87171'
  if (score >= 60) return '#FB923C'
  if (score >= 30) return '#FBBF24'
  return '#34D399'
}
