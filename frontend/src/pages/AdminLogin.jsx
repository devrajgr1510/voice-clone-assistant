import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Lock } from 'lucide-react'
import { useAdminAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function AdminLogin() {
  const { login } = useAdminAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/admin')
    } catch {
      setError('Incorrect username or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-base-950">
      <form onSubmit={onSubmit} className="card w-full max-w-sm p-7">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center mb-3">
            <ShieldCheck size={26} className="text-brand-400" />
          </div>
          <div className="text-lg font-bold text-slate-900">Admin Panel</div>
          <div className="text-xs text-slate-500 mt-1">VAANEE SHIELD administrator access</div>
        </div>

        <label className="block text-xs font-medium text-slate-400 mb-1">{t('username')}</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          className="focus-ring w-full mb-4 bg-base-800 border border-black/10 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-600"
          placeholder="admin"
        />

        <label className="block text-xs font-medium text-slate-400 mb-1">{t('password')}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="focus-ring w-full mb-2 bg-base-800 border border-black/10 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-600"
          placeholder="••••••••"
        />

        {error && <div className="text-xs text-risk-critical mb-3">{error}</div>}

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="focus-ring w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white"
        >
          <Lock size={15} /> {loading ? 'Signing in…' : t('login')}
        </button>

        <div className="text-[11px] text-slate-600 mt-4 text-center">
          Default credentials are printed in the backend logs on first run — see README.
        </div>
      </form>
    </div>
  )
}
