import { useEffect, useState } from 'react'
import {
  ShieldCheck, PhoneOff, UserPlus, LogOut, Trash2, ToggleLeft, ToggleRight,
  Users, Bell, Mic2, Phone,
} from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import StatCard from '../components/StatCard.jsx'
import { adminApi } from '../api/client.js'
import { useAdminAuth } from '../context/AuthContext.jsx'

export default function AdminPanel() {
  const { admin, logout } = useAdminAuth()
  const [stats, setStats] = useState(null)
  const [blocked, setBlocked] = useState([])
  const [admins, setAdmins] = useState([])
  const [newNumber, setNewNumber] = useState('')
  const [newReason, setNewReason] = useState('')
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '', full_name: '', role: 'admin' })
  const [error, setError] = useState('')
  const isSuperAdmin = admin?.role === 'super_admin'

  async function loadAll() {
    try {
      setStats(await adminApi.stats())
      setBlocked(await adminApi.listBlockedNumbers())
      if (isSuperAdmin) setAdmins(await adminApi.listAdmins())
    } catch (e) {
      setError('Could not load admin data — your session may have expired.')
    }
  }

  useEffect(() => { loadAll() }, []) // eslint-disable-line

  async function addBlockedNumber(e) {
    e.preventDefault()
    if (!newNumber.trim()) return
    await adminApi.blockNumber(newNumber.trim(), newReason.trim())
    setNewNumber(''); setNewReason('')
    loadAll()
  }

  async function removeBlockedNumber(id) {
    await adminApi.unblockNumber(id)
    loadAll()
  }

  async function createAdmin(e) {
    e.preventDefault()
    setError('')
    try {
      await adminApi.createAdmin(newAdmin)
      setNewAdmin({ username: '', password: '', full_name: '', role: 'admin' })
      loadAll()
    } catch {
      setError('Could not create admin — username may already be taken.')
    }
  }

  async function toggleActive(id) {
    await adminApi.toggleAdminActive(id)
    loadAll()
  }

  return (
    <div>
      <Topbar title="Admin Panel" subtitle={`Signed in as ${admin?.full_name || admin?.username} (${admin?.role})`}>
        <button
          onClick={logout}
          className="focus-ring inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-base-800 border border-black/10 text-slate-800 hover:text-slate-900"
        >
          <LogOut size={14} /> Logout
        </button>
      </Topbar>

      <div className="px-4 md:px-8 pb-10 space-y-6">
        {error && <div className="text-xs text-risk-critical">{error}</div>}

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Calls" value={stats.total_calls} icon={Phone} accent="#7C5CFC" />
            <StatCard label="Blocked Calls" value={stats.blocked_calls} icon={PhoneOff} accent="#F87171" />
            <StatCard label="Critical Alerts" value={stats.critical_alerts} icon={Bell} accent="#FB923C" />
            <StatCard label="Enrolled Speakers" value={stats.enrolled_speakers} icon={Users} accent="#34D399" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <PhoneOff size={16} className="text-risk-critical" />
              <div className="text-sm font-semibold text-slate-900">Blocked numbers</div>
            </div>

            <form onSubmit={addBlockedNumber} className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                placeholder="+91 98765 43210"
                className="focus-ring flex-1 bg-base-800 border border-black/10 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-600"
              />
              <input
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Reason (optional)"
                className="focus-ring flex-1 bg-base-800 border border-black/10 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-600"
              />
              <button className="focus-ring px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white shrink-0">
                Block
              </button>
            </form>

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {blocked.length === 0 && <div className="text-xs text-slate-500 py-4 text-center">No blocked numbers yet.</div>}
              {blocked.map((b) => (
                <div key={b.id} className="flex items-center justify-between bg-base-800 rounded-xl px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm text-slate-900 truncate">{b.number}</div>
                    <div className="text-[11px] text-slate-500 truncate">{b.reason || 'No reason given'} · by {b.blocked_by}</div>
                  </div>
                  <button onClick={() => removeBlockedNumber(b.id)} className="focus-ring text-slate-500 hover:text-risk-critical shrink-0 ml-2">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Mic2 size={16} className="text-brand-400" />
              <div className="text-sm font-semibold text-slate-900">AI model status</div>
            </div>
            <div className="text-xs text-slate-400 leading-relaxed space-y-2">
              <p>The synthetic-voice detector (<code className="text-slate-700">dsp-heuristic-v1</code>) runs real
                pitch/jitter/shimmer/spectral analysis on uploaded audio.</p>
              <p className="text-risk-medium">It is a hand-tuned signal-processing heuristic, not a trained neural
                network — see the Analyzer page and README for details before relying on it for high-stakes decisions.</p>
            </div>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={16} className="text-brand-400" />
              <div className="text-sm font-semibold text-slate-900">Admin accounts</div>
              <span className="text-[10px] text-slate-500 ml-auto">super_admin only</span>
            </div>

            <form onSubmit={createAdmin} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
              <input required value={newAdmin.username}
                onChange={(e) => setNewAdmin((s) => ({ ...s, username: e.target.value }))}
                placeholder="Username" className="focus-ring bg-base-800 border border-black/10 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-600" />
              <input required type="password" value={newAdmin.password}
                onChange={(e) => setNewAdmin((s) => ({ ...s, password: e.target.value }))}
                placeholder="Password" className="focus-ring bg-base-800 border border-black/10 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-600" />
              <input value={newAdmin.full_name}
                onChange={(e) => setNewAdmin((s) => ({ ...s, full_name: e.target.value }))}
                placeholder="Full name" className="focus-ring bg-base-800 border border-black/10 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-600" />
              <select value={newAdmin.role} onChange={(e) => setNewAdmin((s) => ({ ...s, role: e.target.value }))}
                className="focus-ring bg-base-800 border border-black/10 rounded-xl px-3 py-2 text-sm text-slate-900">
                <option value="analyst">analyst</option>
                <option value="admin">admin</option>
                <option value="super_admin">super_admin</option>
              </select>
              <button className="focus-ring inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white">
                <UserPlus size={14} /> Add
              </button>
            </form>

            <div className="space-y-1.5">
              {admins.map((a) => (
                <div key={a.id} className="flex items-center justify-between bg-base-800 rounded-xl px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm text-slate-900 truncate">{a.username} <span className="text-slate-500">· {a.role}</span></div>
                    <div className="text-[11px] text-slate-500 truncate">{a.full_name || '—'} · {a.active ? 'active' : 'disabled'}</div>
                  </div>
                  <button onClick={() => toggleActive(a.id)} className="focus-ring text-slate-400 hover:text-slate-900 shrink-0 ml-2">
                    {a.active ? <ToggleRight size={22} className="text-risk-low" /> : <ToggleLeft size={22} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
