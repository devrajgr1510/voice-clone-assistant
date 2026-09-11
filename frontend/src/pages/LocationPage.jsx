import { useEffect, useState } from 'react'
import { MapPin, Navigation, AlertTriangle } from 'lucide-react'
import Topbar from '../components/Topbar.jsx'

export default function LocationPage() {
  const [coords, setCoords] = useState(null)
  const [error, setError] = useState('')
  const [region, setRegion] = useState(null)
  const [watching, setWatching] = useState(false)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation isn\'t supported by this browser.')
      return
    }
    setWatching(true)
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
        setError('')
      },
      (err) => {
        setError(err.code === 1 ? 'Location access was denied — allow it in your browser settings to use this page.' : err.message)
        setWatching(false)
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  useEffect(() => {
    if (!coords) return
    const ctrl = new AbortController()
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}`,
      { signal: ctrl.signal, headers: { Accept: 'application/json' } },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.address) {
          const a = data.address
          setRegion({
            state: a.state || a.region || null,
            country: a.country || null,
            display: data.display_name,
          })
        }
      })
      .catch(() => { /* best-effort reverse geocode — fine to fail silently */ })
    return () => ctrl.abort()
  }, [coords])

  return (
    <div>
      <Topbar title="Location" subtitle="Live location during a call (browser Geolocation, with your permission)" />

      <div className="px-4 md:px-8 pb-10 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4 text-slate-900 font-semibold">
            <Navigation size={16} className={watching && coords ? 'text-risk-low' : 'text-slate-500'} />
            {watching && coords ? 'Live tracking active' : 'Waiting for location…'}
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-risk-critical bg-risk-critical/10 border border-risk-critical/20 rounded-xl p-3 mb-4">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {coords ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-base-800 rounded-xl p-4">
                <div className="text-[11px] text-slate-500 mb-1">Latitude</div>
                <div className="text-slate-900 font-semibold">{coords.lat.toFixed(4)}°</div>
              </div>
              <div className="bg-base-800 rounded-xl p-4">
                <div className="text-[11px] text-slate-500 mb-1">Longitude</div>
                <div className="text-slate-900 font-semibold">{coords.lng.toFixed(4)}°</div>
              </div>
              <div className="bg-base-800 rounded-xl p-4">
                <div className="text-[11px] text-slate-500 mb-1">State / Region</div>
                <div className="text-slate-900 font-semibold">{region?.state || '—'}</div>
              </div>
              <div className="bg-base-800 rounded-xl p-4">
                <div className="text-[11px] text-slate-500 mb-1">Country</div>
                <div className="text-slate-900 font-semibold">{region?.country || '—'}</div>
              </div>
              <div className="col-span-2 bg-base-800 rounded-xl p-4">
                <div className="text-[11px] text-slate-500 mb-1">Accuracy</div>
                <div className="text-slate-900 font-semibold">±{Math.round(coords.accuracy)} m</div>
              </div>
            </div>
          ) : !error ? (
            <div className="text-sm text-slate-500 py-10 text-center">Requesting location permission…</div>
          ) : null}
        </div>

        <div className="card p-4 flex flex-col">
          <div className="text-sm font-semibold text-slate-900 mb-3">Map</div>
          {coords ? (
            <iframe
              title="location-map"
              className="flex-1 min-h-[18rem] rounded-xl border border-black/5"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.02}%2C${coords.lat - 0.02}%2C${coords.lng + 0.02}%2C${coords.lat + 0.02}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`}
            />
          ) : (
            <div className="flex-1 min-h-[18rem] rounded-xl border border-black/5 bg-base-800 flex items-center justify-center text-slate-600">
              <MapPin size={28} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
