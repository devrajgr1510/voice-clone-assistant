export default function Waveform({ bars = [], color = '#7C5CFC', height = 90 }) {
  const data = bars.length ? bars : Array.from({ length: 40 }, () => Math.random() * 0.7 + 0.15)
  return (
    <div className="flex items-center justify-center gap-[3px]" style={{ height }}>
      {data.map((v, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full transition-all duration-150"
          style={{
            height: `${Math.max(6, v * height)}px`,
            background: color,
            opacity: 0.55 + v * 0.45,
          }}
        />
      ))}
    </div>
  )
}
