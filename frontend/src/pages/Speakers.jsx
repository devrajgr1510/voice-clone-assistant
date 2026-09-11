import { useEffect, useState } from 'react'
import { Plus, Mail, Phone, Briefcase, BadgeCheck, Play, X } from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import Avatar from '../components/Avatar.jsx'
import { api } from '../api/client.js'
import { formatDate } from '../lib/time.js'

export default function Speakers() {
  const [speakers, setSpeakers] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ employee_id: '', name: '', role: '', department: '', email: '', phone: '' })

  const load = () => api.getSpeakers().then((s) => {
    setSpeakers(s)
    if (!selected && s.length) setSelected(s[0].id)
  })

  useEffect(() => { load() }, []) // eslint-disable-line

  useEffect(() => {
    if (selected) api.getSpeaker(selected).then(setDetail).catch(() => {})
  }, [selected])

  const submitAdd = async (e) => {
    e.preventDefault()
    const created = await api.createSpeaker(form)
    setShowAdd(false)
    setForm({ employee_id: '', name: '', role: '', department: '', email: '', phone: '' })
    await load()
    setSelected(created.id)
  }

  return (
    <>
      <Topbar title="Speaker Verification" subtitle="Manage and verify registered speakers">
        <button
          onClick={() => setShowAdd(true)}
          className="focus-ring inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors"
        >
          <Plus size={15} /> Add Speaker
        </button>
      </Topbar>

      <div className="px-4 md:px-8 pb-10 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card divide-y divide-black/5 lg:col-span-1 max-h-[70vh] overflow-y-auto">
          {speakers.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s.id)}
              className={`focus-ring w-full flex items-center gap-3 p-4 text-left transition-colors ${
                selected === s.id ? 'bg-brand-500/10' : 'hover:bg-black/5'
              }`}
            >
              <Avatar name={s.name} seed={s.avatar_seed} size={40} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900 truncate">{s.name}</div>
                <div className="text-xs text-slate-500 truncate">{s.role} · {s.department}</div>
              </div>
              {s.verified && <BadgeCheck size={16} className="text-brand-400 shrink-0" />}
            </button>
          ))}
          {speakers.length === 0 && <p className="text-sm text-slate-500 p-6 text-center">No speakers registered yet.</p>}
        </div>

        <div className="card p-6 lg:col-span-2">
          {detail ? (
            <>
              <div className="flex items-start gap-4 mb-6">
                <Avatar name={detail.name} seed={detail.avatar_seed} size={64} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">{detail.name}</h2>
                    {detail.verified && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-risk-low bg-risk-low/15 border border-risk-low/30 rounded-full px-2 py-0.5">
                        <BadgeCheck size={12} /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">{detail.role} · Employee ID: {detail.employee_id}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-6">
                <InfoRow icon={Briefcase} label="Department" value={detail.department} />
                <InfoRow icon={Mail} label="Email" value={detail.email} />
                <InfoRow icon={Phone} label="Phone" value={detail.phone} />
              </div>

              <h3 className="text-sm font-semibold text-slate-700 mb-3">Voice Samples</h3>
              <div className="space-y-2">
                {(detail.voice_samples || []).map((vs) => (
                  <div key={vs.id} className="flex items-center gap-3 p-3 rounded-xl bg-base-800 border border-black/5">
                    <button className="focus-ring w-8 h-8 rounded-full bg-brand-600 hover:bg-brand-500 flex items-center justify-center text-white shrink-0 transition-colors">
                      <Play size={13} fill="white" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-800 font-medium">{vs.label}</div>
                      <div className="text-xs text-slate-500">{vs.size_kb} MB · {formatDate(vs.recorded_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a speaker to view details.</p>
          )}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitAdd} className="card p-6 w-full max-w-md space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-slate-900">Add Speaker</h3>
              <button type="button" onClick={() => setShowAdd(false)} className="focus-ring text-slate-500 hover:text-slate-700"><X size={18} /></button>
            </div>
            {[
              ['employee_id', 'Employee ID'],
              ['name', 'Full Name'],
              ['role', 'Role'],
              ['department', 'Department'],
              ['email', 'Email'],
              ['phone', 'Phone'],
            ].map(([key, label]) => (
              <input
                key={key}
                required={key === 'employee_id' || key === 'name'}
                placeholder={label}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="focus-ring w-full bg-base-800 border border-black/10 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder:text-slate-500"
              />
            ))}
            <button type="submit" className="focus-ring w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors">
              Add Speaker
            </button>
          </form>
        </div>
      )}
    </>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-base-800 border border-black/5">
      <Icon size={15} className="text-slate-500 shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className="text-slate-800 truncate">{value || '—'}</div>
      </div>
    </div>
  )
}
