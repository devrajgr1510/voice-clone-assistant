import { Wifi } from 'lucide-react'
import LiveClock from './LiveClock.jsx'
import LanguageSwitcher from './LanguageSwitcher.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function Topbar({ title, subtitle, children }) {
  const { t } = useLanguage()
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-8 py-6">
      <div className="flex items-center gap-4">
        <LiveClock className="hidden sm:block" />
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {children}
        <LanguageSwitcher />
        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-risk-low/15 text-risk-low border border-risk-low/30">
          <Wifi size={13} /> {t('systemOnline')}
        </span>
      </div>
    </header>
  )
}
