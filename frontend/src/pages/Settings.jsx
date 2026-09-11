import { useEffect, useState } from 'react'
import { Cpu, ShieldCheck, Bell, KeyRound, SlidersHorizontal } from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import { api } from '../api/client.js'

const TABS = [
  { key: 'general', label: 'General', icon: SlidersHorizontal },
  { key: 'ai-models', label: 'AI Models', icon: Cpu },
  { key: 'security', label: 'Security', icon: ShieldCheck },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'api', label: 'API Settings', icon: KeyRound },
]

export default function Settings() {
  const [tab, setTab] = useState('ai-models')
  const [models, setModels] = useState([])

  useEffect(() => {
    api.getModelConfigs().then(setModels).catch(() => {})
  }, [])

  const toggleModel = async (id, active) => {
    const updated = await api.updateModelConfig(id, { active: !active })
    setModels((m) => m.map((x) => (x.id === id ? updated : x)))
  }

  return (
    <>
      <Topbar title="Settings" subtitle="Configure system settings and preferences" />

      <div className="px-4 md:px-8 pb-10 grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="card p-2 lg:col-span-1 h-fit">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`focus-ring w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                tab === key ? 'bg-brand-600 text-white' : 'text-slate-400 hover:bg-black/5 hover:text-slate-800'
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        <div className="card p-6 lg:col-span-3">
          {tab === 'ai-models' && (
            <>
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Model Configuration</h3>
              <p className="text-xs text-slate-500 mb-5">Manage detection models and confidence thresholds.</p>
              <div className="space-y-3">
                {models.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-4 rounded-xl bg-base-800 border border-black/5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-brand-500/15 text-brand-400 flex items-center justify-center shrink-0">
                        <Cpu size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{m.name}</div>
                        <div className="text-xs text-slate-500">{m.version} · Threshold: {(m.threshold * 100).toFixed(0)}%</div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleModel(m.id, m.active)}
                      className={`focus-ring shrink-0 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                        m.active
                          ? 'bg-risk-low/15 text-risk-low border-risk-low/30'
                          : 'bg-slate-600/15 text-slate-400 border-slate-600/30'
                      }`}
                    >
                      {m.active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                ))}
                {models.length === 0 && <p className="text-sm text-slate-500">No models configured.</p>}
              </div>
            </>
          )}

          {tab === 'general' && (
            <div className="space-y-4 text-sm text-slate-400">
              <h3 className="text-sm font-semibold text-slate-700">General</h3>
              <p>Organization name, default language, and timezone preferences for VAANEE SHIELD.</p>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <LabeledInput label="Organization Name" defaultValue="Acme Bank Ltd." />
                <LabeledInput label="Default Language" defaultValue="English" />
                <LabeledInput label="Timezone" defaultValue="Asia/Kolkata (IST)" />
                <LabeledInput label="Support Email" defaultValue="security@acmebank.com" />
              </div>
            </div>
          )}

          {tab === 'security' && (
            <div className="space-y-4 text-sm text-slate-400">
              <h3 className="text-sm font-semibold text-slate-700">Security</h3>
              <p>Two-factor authentication, session policy, and audio retention controls.</p>
              <ToggleRow label="Require MFA for admin console" defaultOn />
              <ToggleRow label="On-device / edge inference (minimize central audio storage)" defaultOn />
              <ToggleRow label="Auto-escalate critical alerts to security team" defaultOn />
            </div>
          )}

          {tab === 'notifications' && (
            <div className="space-y-4 text-sm text-slate-400">
              <h3 className="text-sm font-semibold text-slate-700">Notifications</h3>
              <ToggleRow label="Email alerts for high & critical risk calls" defaultOn />
              <ToggleRow label="SMS alerts for blocked transactions" defaultOn />
              <ToggleRow label="Slack / Teams webhook notifications" />
            </div>
          )}

          {tab === 'api' && (
            <div className="space-y-4 text-sm text-slate-400">
              <h3 className="text-sm font-semibold text-slate-700">API Settings</h3>
              <p>Manage API keys used to integrate VAANEE SHIELD with your telephony and core banking systems.</p>
              <div className="p-4 rounded-xl bg-base-800 border border-black/5 font-mono text-xs text-slate-700 break-all">
                sk_live_vaanee_•••••••••••••••••••••••4f2a
              </div>
              <button className="focus-ring px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-colors">
                Regenerate Key
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function LabeledInput({ label, defaultValue }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500 mb-1 block">{label}</span>
      <input defaultValue={defaultValue} className="focus-ring w-full bg-base-800 border border-black/10 rounded-xl px-3 py-2 text-sm text-slate-800" />
    </label>
  )
}

function ToggleRow({ label, defaultOn = false }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-base-800 border border-black/5">
      <span className="text-slate-700">{label}</span>
      <button
        onClick={() => setOn(!on)}
        className={`focus-ring w-10 h-6 rounded-full relative transition-colors ${on ? 'bg-brand-600' : 'bg-base-700'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}
