import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ShieldAlert, History, Bell, BarChart3,
  Users, Settings, Terminal, Phone, Waves, MapPin, ShieldCheck,
} from 'lucide-react'
import Avatar from './Avatar.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

const NAV = [
  { to: '/', key: 'dashboard', icon: LayoutDashboard, end: true },
  { to: '/dialer', key: 'dialer', icon: Phone },
  { to: '/live-protection', key: 'liveProtection', icon: ShieldAlert },
  { to: '/call-history', key: 'callHistory', icon: History },
  { to: '/analyzer', key: 'analyzer', icon: Waves },
  { to: '/location', key: 'location', icon: MapPin },
  { to: '/alerts', key: 'alerts', icon: Bell },
  { to: '/analytics', key: 'analytics', icon: BarChart3 },
  { to: '/speakers', key: 'speakers', icon: Users },
  { to: '/settings', key: 'settings', icon: Settings },
  { to: '/api-console', key: 'apiConsole', icon: Terminal },
]

export default function Sidebar() {
  const { t } = useLanguage()
  return (
    <aside className="hidden md:flex md:w-64 shrink-0 flex-col border-r border-white/5 bg-navy-900 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-5 py-6">
        <img src="/logo.svg" alt="VAANEE SHIELD logo" className="w-9 h-9" />
        <div>
          <div className="text-white font-bold text-sm leading-tight tracking-wide">VAANEE SHIELD</div>
          <div className="text-[11px] text-slate-500 leading-tight">Voice Security Platform</div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {NAV.map(({ to, key, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `focus-ring flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-600/90 text-white shadow-glow'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`
            }
          >
            <Icon size={18} strokeWidth={2} />
            {t(key)}
          </NavLink>
        ))}

        <div className="pt-2 mt-2 border-t border-white/5">
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `focus-ring flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-600/90 text-white shadow-glow'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`
            }
          >
            <ShieldCheck size={18} strokeWidth={2} />
            {t('admin')}
          </NavLink>
        </div>
      </nav>

      <div className="px-3 py-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
          <Avatar name="Admin User" seed="admin" size={36} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">Admin</div>
            <div className="text-xs text-slate-500 truncate">Super Admin</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
