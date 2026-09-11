import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'
import { helpdeskApi } from '../api/client.js'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function HelpDesk() {
  const { lang, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('vs_help_session') || null)
  const [messages, setMessages] = useState(() => {
    const raw = localStorage.getItem('vs_help_messages')
    return raw ? JSON.parse(raw) : []
  })
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, open])

  useEffect(() => {
    localStorage.setItem('vs_help_messages', JSON.stringify(messages.slice(-40)))
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text }])
    setSending(true)
    try {
      const res = await helpdeskApi.ask(text, sessionId, lang)
      if (res.session_id) {
        setSessionId(res.session_id)
        localStorage.setItem('vs_help_session', res.session_id)
      }
      setMessages((m) => [...m, { role: 'assistant', text: res.reply }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: 'Sorry, the help desk is unreachable right now — check that the backend is running.' }])
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open help desk"
        className="focus-ring fixed z-50 bottom-20 md:bottom-6 right-4 md:right-6 w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-500 text-white shadow-glow flex items-center justify-center transition-colors"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {open && (
        <div className="fixed z-50 bottom-36 md:bottom-24 right-4 md:right-6 w-[calc(100vw-2rem)] max-w-sm h-[26rem] card flex flex-col overflow-hidden shadow-glow">
          <div className="px-4 py-3 border-b border-black/5 bg-base-850">
            <div className="text-sm font-semibold text-slate-900">{t('helpDesk')}</div>
            <div className="text-[11px] text-slate-500">Local FAQ assistant · offline-friendly</div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messages.length === 0 && (
              <div className="text-xs text-slate-500 px-1">
                Ask about risk scores, blocking numbers, voice detection, adding speakers, or the admin panel.
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                  m.role === 'user'
                    ? 'ml-auto bg-brand-600 text-white'
                    : 'mr-auto bg-base-800 text-slate-800'
                }`}
              >
                {m.text}
              </div>
            ))}
            {sending && <div className="mr-auto text-xs text-slate-500 px-1">{t('typing')}</div>}
          </div>

          <div className="p-2 border-t border-black/5 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={t('askAQuestion')}
              className="focus-ring flex-1 bg-base-800 border border-black/10 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500"
            />
            <button
              onClick={send}
              disabled={sending}
              className="focus-ring w-9 h-9 shrink-0 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white flex items-center justify-center"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
