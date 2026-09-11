const PALETTE = [
  ['#7C5CFC', '#4C34A8'],
  ['#22D3EE', '#0E7490'],
  ['#F59E0B', '#92400E'],
  ['#34D399', '#065F46'],
  ['#FB7185', '#9F1239'],
]

function hashSeed(seed = '') {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h
}

export default function Avatar({ name = '', seed, size = 40, className = '' }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const idx = hashSeed(seed || name) % PALETTE.length
  const [c1, c2] = PALETTE[idx]

  return (
    <div
      className={`flex items-center justify-center rounded-full font-semibold text-white shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
      }}
    >
      {initials || '?'}
    </div>
  )
}
