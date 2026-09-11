import { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react'
import { TRANSLATIONS, LANGUAGES } from '../i18n/translations.js'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('vs_lang') || 'en')

  useEffect(() => {
    localStorage.setItem('vs_lang', lang)
    document.documentElement.setAttribute('lang', lang)
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr')
  }, [lang])

  const t = useCallback((key) => {
    return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key
  }, [lang])

  const value = useMemo(() => ({ lang, setLang, t, languages: LANGUAGES }), [lang, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
