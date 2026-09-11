import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Phone, ShieldAlert, History, Settings } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext.jsx'

const NAV = [
  { to: '/', icon: LayoutDashboard, key: 'dashboard', end: true },
  { to: '/dialer', icon: Phone, key: 'dialer' },
  { to: '/live-protection', icon: ShieldAlert, key: 'liveProtection' },
  { to: '/call-history', icon: History, key: 'callHistory' },
  { to: '/settings', icon: Settings, key: 'settings' },
]

export default function MobileNav() {
  const { t } = useLanguage()
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-base-900/95 border-t border-black/5 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-between px-1">
        {NAV.map(({ to, icon: Icon, key, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `focus-ring flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-brand-400' : 'text-slate-500'
              }`
            }
          >
            <Icon size={20} strokeWidth={2} />
            {t(key)}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
