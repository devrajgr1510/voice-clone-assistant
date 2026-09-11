import { useState, useRef, useEffect } from 'react'
import { Globe } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function LanguageSwitcher() {
  const { lang, setLang, languages } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const current = languages.find((l) => l.code === lang) || languages[0]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="focus-ring flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-base-800 border border-black/10 text-slate-700 hover:text-slate-900 transition-colors"
      >
        <Globe size={13} /> {current.label}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 max-h-72 overflow-y-auto card p-1 z-50">
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                l.code === lang ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-black/5'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
