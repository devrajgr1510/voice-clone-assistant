import { useEffect, useState } from 'react'

export default function LiveClock({ className = '' }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const time = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const date = now.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className={className}>
      <div className="text-lg font-bold text-slate-900 tabular-nums">{time}</div>
      <div className="text-[11px] text-slate-500">{date}</div>
    </div>
  )
}
