import { useEffect, useRef, useState } from 'react'
import { Play, Pause, UploadCloud, Waves as WavesIcon, AlertTriangle } from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import { recordingsApi, analyzeApi } from '../api/client.js'
import { formatDateTime } from '../lib/time.js'
import { convertToWav } from '../lib/audioConvert.js'

function riskColor(score) {
  if (score >= 70) return '#F87171'
  if (score >= 45) return '#FB923C'
  if (score >= 20) return '#FBBF24'
  return '#34D399'
}

export default function Analyzer() {
  const [recordings, setRecordings] = useState([])
  const [selected, setSelected] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const audioRef = useRef(null)
  const fileInputRef = useRef(null)

  async function loadRecordings() {
    try {
      const list = await recordingsApi.list({ kind: 'call' })
      setRecordings(list)
      if (list.length && !selected) setSelected(list[0])
    } catch {
      /* backend not reachable yet — keep empty state */
    }
  }

  useEffect(() => { loadRecordings() }, []) // eslint-disable-line

  useEffect(() => {
    setAnalysis(null)
    setError('')
    setProgress(0)
    setPlaying(false)
  }, [selected])

  function togglePlay() {
    const el = audioRef.current
    if (!el) return
    if (playing) el.pause()
    else el.play()
  }

  async function runAnalysis() {
    if (!selected) return
    setAnalyzing(true)
    setError('')
    try {
      // The stored recording is almost always webm/opus (from the browser's
      // MediaRecorder), which the server can't decode on its own. Fetch the
      // real bytes and re-encode them as PCM WAV right here in the browser
      // first, so the analysis engine gets real, fully-analyzable audio
      // instead of falling back to a low-confidence byte heuristic.
      let wavBlob = null
      try {
        const audioRes = await fetch(recordingsApi.audioUrl(selected.id))
        if (!audioRes.ok) throw new Error('Could not fetch recording audio')
        const originalBlob = await audioRes.blob()
        wavBlob = await convertToWav(originalBlob)
      } catch {
        // Decoding failed (unsupported/corrupt audio) — fall back to letting
        // the server analyze whatever's on disk as-is.
        wavBlob = null
      }
      const res = await analyzeApi.analyzeRecording(selected.id, wavBlob)
      setAnalysis(res)
    } catch (e) {
      setError('Could not reach the analysis engine — is the backend running?')
    } finally {
      setAnalyzing(false)
    }
  }

  async function onUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAnalyzing(true)
    setError('')
    setAnalysis(null)
    try {
      // Convert whatever the person picked (mp3, m4a, ogg, webm...) to PCM
      // WAV in-browser first, same reason as above — most audio files
      // aren't WAV, and the real analysis needs decoded PCM to work with.
      let toUpload = file
      try {
        toUpload = await convertToWav(file)
      } catch {
        // Fall back to uploading the original file — the server will still
        // attempt a WAV read and fall back to the byte heuristic if needed.
        toUpload = file
      }
      const res = await analyzeApi.uploadAudio(toUpload, file.name)
      setAnalysis(res)
    } catch (e) {
      setError('Upload/analysis failed — is the backend running?')
    } finally {
      setAnalyzing(false)
      e.target.value = ''
    }
  }

  const likelihood = analysis?.synthetic_voice_likelihood ?? null

  return (
    <div>
      <Topbar title="Analyzer" subtitle="Previous call recordings & AI voice-analysis">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="focus-ring inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-base-800 border border-black/10 text-slate-800 hover:text-slate-900"
        >
          <UploadCloud size={14} /> Upload clip
        </button>
        <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={onUpload} />
      </Topbar>

      <div className="px-4 md:px-8 pb-10 grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 card p-4">
          <div className="text-sm font-semibold text-slate-900 mb-3">Call recordings</div>
          {recordings.length === 0 && (
            <div className="text-xs text-slate-500 py-8 text-center">
              No stored call recordings yet. Record a call from the Dialer, or upload a clip above to analyze it directly.
            </div>
          )}
          <div className="space-y-1.5 max-h-[26rem] overflow-y-auto">
            {recordings.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  selected?.id === r.id ? 'bg-brand-600/20 border border-brand-500/40' : 'hover:bg-black/5 border border-transparent'
                }`}
              >
                <div className="text-slate-800 font-medium truncate">{r.label || 'Call recording'}</div>
                <div className="text-[11px] text-slate-500">
                  {formatDateTime(r.created_at)} · {r.duration_seconds?.toFixed?.(1) ?? '—'}s
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 card p-5">
          {!selected ? (
            <div className="text-sm text-slate-500 py-16 text-center">Select a recording, or upload a clip, to analyze it.</div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={togglePlay}
                  className="focus-ring w-11 h-11 rounded-full bg-brand-600 hover:bg-brand-500 text-white flex items-center justify-center shrink-0"
                >
                  {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-slate-900 font-medium truncate">{selected.label || 'Call recording'}</div>
                  <div className="text-xs text-slate-500">
                    {formatDateTime(selected.created_at)} · {selected.duration_seconds?.toFixed?.(1) ?? '—'}s
                  </div>
                </div>
              </div>
              <audio
                ref={audioRef}
                src={recordingsApi.audioUrl(selected.id)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                onTimeUpdate={(e) => setProgress(e.target.currentTime / (e.target.duration || 1))}
                className="hidden"
              />
              <div className="h-1.5 rounded-full bg-base-800 overflow-hidden mb-6">
                <div className="h-full bg-brand-500" style={{ width: `${progress * 100}%` }} />
              </div>

              <button
                onClick={runAnalysis}
                disabled={analyzing}
                className="focus-ring w-full mb-5 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-black/5 hover:bg-black/10 border border-black/10 text-slate-900 disabled:opacity-50"
              >
                <WavesIcon size={15} /> {analyzing ? 'Analyzing audio…' : 'Run AI voice analysis'}
              </button>

              {error && (
                <div className="mb-4 text-xs text-risk-critical flex items-center gap-2">
                  <AlertTriangle size={14} /> {error}
                </div>
              )}

              {analysis && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-slate-900">AI Detection Results</div>
                    <span className="text-[10px] uppercase tracking-wide text-slate-500">{analysis.engine}</span>
                  </div>

                  {analysis.format_supported === false && (
                    <div className="text-xs text-risk-medium mb-3">
                      Full pitch/spectral analysis needs PCM WAV audio — this clip's format limited the reading.
                    </div>
                  )}

                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
                      style={{
                        background: `${riskColor(likelihood)}22`,
                        color: riskColor(likelihood),
                        border: `2px solid ${riskColor(likelihood)}55`,
                      }}
                    >
                      {likelihood}%
                    </div>
                    <div>
                      <div className="text-sm text-slate-700">Synthetic-voice likelihood</div>
                      <div className="text-xs text-slate-500">Confidence: {analysis.confidence}</div>
                    </div>
                  </div>

                  {analysis.sub_scores && Object.keys(analysis.sub_scores).length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {Object.entries(analysis.sub_scores).map(([k, v]) => (
                        <div key={k} className="bg-base-800 rounded-xl px-3 py-2">
                          <div className="text-[10px] text-slate-500 capitalize truncate">{k.replaceAll('_', ' ')}</div>
                          <div className="text-sm font-semibold text-slate-900">{v}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-xs font-semibold text-slate-400 mb-1.5">Key indicators</div>
                  <ul className="space-y-1.5">
                    {(analysis.indicators || []).map((ind, i) => (
                      <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-slate-500 mt-1.5 shrink-0" />
                        {ind}
                      </li>
                    ))}
                  </ul>

                  {analysis.updated_call_risk_score !== undefined && (
                    <div className="mt-4 text-xs text-brand-400">
                      Linked call's risk score updated to {analysis.updated_call_risk_score}/100 ({analysis.updated_call_status}).
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
