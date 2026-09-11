# VAANEE SHIELD — Voice Clone Assistant
### AI-assisted real-time voice-impersonation detection platform (web app, mobile-style UI)

VAANEE SHIELD analyzes phone-call audio for signs of AI-generated / cloned
speech, blends that with speaker/prosody/context signals into a risk score,
and recommends an action (allow / verify / block). This build adds a
mobile-app-style UI, a real signal-processing voice-analysis engine, an
admin panel with authentication, a multi-language interface + help-desk
chatbot, and blocked-number management on top of the original React +
FastAPI prototype.

**Please read "What's real vs. simulated" below before demoing or deploying
this — it's written so you never accidentally overstate what the app does.**

---

## 1. What's real vs. simulated (read this first)

| Piece | What it actually is |
|---|---|
| `backend/app/services/voice_analysis.py` — the "AI voice detection" engine used by the **Analyzer** page | **Real** digital-signal-processing analysis (pitch/jitter, amplitude/shimmer, spectral flatness, high-frequency roll-off, noise floor) computed from the *actual bytes* of the audio you upload or select. It is a hand-tuned heuristic, **not** a trained neural network. Building a true AASIST/RawNet2/ECAPA-TDNN-class model needs a licensed genuine-vs-AI-voice dataset and GPU training — outside what's possible to ship inside a demo repo. The API always reports `"engine": "dsp-heuristic-v1"` so callers can tell it apart from a certified model. |
| `backend/app/services/risk_engine.py` — background call simulation (seed data, `/ws/live-call`, new calls via `POST /api/calls`) | **Simulated.** Generates internally-consistent but random sub-scores, exactly as in the original prototype. This exists so the UI has realistic data to render without a live telephony/audio pipeline connected. |
| Analyzer page → "Run AI voice analysis" on a stored/uploaded recording | **Real** — calls the DSP engine above on that specific file and (optionally) blends the result into the linked call's risk score. |
| Admin login / JWT / password hashing | **Real.** PBKDF2-HMAC-SHA256 password hashing (stdlib `hashlib`, 200k iterations) + signed JWT sessions (PyJWT). No third-party auth service required. |
| Help desk chatbot | **Real, but rule-based.** A local keyword/topic-matching FAQ engine (`backend/app/services/helpdesk_kb.py`) — works fully offline, no external API key, but can only answer the topics it's been taught. It says so honestly when it doesn't know something, instead of inventing an answer. |
| Multi-language UI + chatbot answers | **Real**, hand-written short translations for 13 languages (English, Hindi, Kannada, Tamil, Telugu, Malayalam, Bengali, Marathi, Gujarati, Spanish, French, Arabic, Mandarin). Coverage is intentionally scoped to app UI strings and the chatbot's FAQ topics — not a general machine-translation engine. |
| Automatic call blocking for real cellular calls | **Not possible from a web app.** A browser/PWA cannot silently intercept or block arbitrary cellular calls at the OS level. This app can mark a number "blocked" in its own database (Admin Panel → Blocked Numbers) and refuse/flag calls placed *through its own dialer*, but stopping your phone from ringing for a real cellular call requires a native Android app using the Call Screening / Telecom APIs — a separate project from this web app. |

---

## 2. Project structure

```
voice-clone-assistant/
├── backend/                              # FastAPI service
│   └── app/
│       ├── main.py                       # App wiring, CORS, router registration
│       ├── database.py                   # SQLAlchemy engine/session (SQLite by default)
│       ├── schemas.py                    # Pydantic request/response models
│       ├── seed.py                       # Demo data + default admin account
│       ├── models/models.py              # ORM models (Call, Speaker, AdminUser, BlockedNumber, ChatMessage...)
│       ├── services/
│       │   ├── risk_engine.py            # Simulated multi-signal risk scoring
│       │   ├── voice_analysis.py         # REAL DSP-based synthetic-voice heuristic
│       │   ├── auth_service.py           # Password hashing + JWT
│       │   └── helpdesk_kb.py            # Local rule-based FAQ knowledge base
│       └── routers/
│           ├── calls.py, alerts.py, speakers.py, analytics.py, settings.py,
│           │   live.py, dialer.py, recordings.py, webrtc.py   # (original prototype)
│           ├── auth.py                   # POST /api/auth/login, GET /api/auth/me
│           ├── admin.py                  # Admin-only: stats, blocked numbers, admin accounts
│           ├── analyze.py                # POST /api/analyze/audio, /api/analyze/recording/{id}
│           └── helpdesk.py               # POST /api/helpdesk/ask
│
├── frontend/                             # React (Vite) SPA, mobile-app-style shell
│   └── src/
│       ├── App.jsx / main.jsx            # Routes + providers (Language, AdminAuth)
│       ├── context/
│       │   ├── LanguageContext.jsx       # UI language state (persisted)
│       │   └── AuthContext.jsx           # Admin JWT session state
│       ├── i18n/translations.js          # 13-language UI string dictionary
│       ├── components/
│       │   ├── Layout.jsx                # Sidebar (desktop) + MobileNav (bottom bar, mobile)
│       │   ├── MobileNav.jsx             # Mobile bottom navigation
│       │   ├── Topbar.jsx                # Live clock + language switcher + page title
│       │   ├── LiveClock.jsx             # Real-time device clock/date
│       │   ├── LanguageSwitcher.jsx
│       │   ├── HelpDesk.jsx              # Floating chat widget (all pages)
│       │   └── ProtectedAdminRoute.jsx
│       └── pages/
│           ├── Dashboard.jsx, Dialer.jsx, LiveProtection.jsx, CallHistory.jsx,
│           │   Alerts.jsx, Analytics.jsx, Speakers.jsx, Settings.jsx, ApiConsole.jsx  # (original)
│           ├── Analyzer.jsx              # NEW — recording playback + AI voice analysis
│           ├── LocationPage.jsx          # NEW — live geolocation + map
│           ├── AdminLogin.jsx            # NEW — admin sign-in
│           └── AdminPanel.jsx            # NEW — stats, blocked numbers, admin accounts
│
└── README.md
```

---

## 3. Running it

### Backend

```bash

cd voice-clone-assistant
cd backend
python3 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

```

API live at `http://localhost:8000` (Swagger docs at `/docs`). On first run
it creates `vaanee_shield.db` (SQLite), seeds demo speakers/calls/alerts,
**and creates a default admin account** — the username/password are printed
once to the console, e.g.:

```
[seed] Created default admin account -> username: 'admin'  password: 'VaaneeAdmin@123'  (CHANGE THIS after first login)
```

Override the defaults (recommended) with environment variables before first
run: `VAANEE_DEFAULT_ADMIN_USER`, `VAANEE_DEFAULT_ADMIN_PASSWORD`, and set a
real `VAANEE_SECRET_KEY` for JWT signing in any non-local deployment. See
`.env.example`.

### Frontend

```bash


cd voice-clone-assistant
cd frontend
npm install
npm run dev

```

Open `http://localhost:5173`. Vite proxies `/api/*` and `/ws/*` to the
backend on port 8000 — both must be running.

```bash
npm run build      # production build → frontend/dist
npm run preview    # serve it locally
```

The UI adapts to mobile widths automatically (bottom tab bar instead of the
sidebar) — no separate mobile build needed; it's a responsive web app / PWA-
style shell, not a native app (see the call-blocking limitation above).

---

## 4. Admin panel

1. Go to **Admin Login** (`/admin/login`), sign in with the default admin
   printed in the backend console on first run.
2. From **Admin Panel** (`/admin`) you can:
   - View live stats (total calls, blocked calls, critical alerts, enrolled speakers).
   - Add/remove **blocked numbers** (in-app blocking — see the limitation note above).
   - `super_admin` accounts can create/disable other admin accounts
     (roles: `super_admin`, `admin`, `analyst`).
3. **Change the default password immediately** — create a new `super_admin`
   account for yourself and disable/rotate the seeded one in production.

Auth model: `POST /api/auth/login` returns a JWT (`VAANEE_TOKEN_TTL_HOURS`,
default 12h) that the frontend stores in `localStorage` and sends as
`Authorization: Bearer <token>` on every `/api/admin/*` call. All admin
routes are protected by `get_current_admin` (see `routers/auth.py`).

---

## 5. Voice analysis engine

- **Analyzer page**: pick a stored call recording or upload any audio clip,
  play it back, and run "AI voice analysis". You'll get a synthetic-voice
  likelihood score, a confidence level, per-feature sub-scores, and a list
  of plain-language indicators (e.g. "Amplitude envelope unusually smooth
  frame-to-frame").
- Works natively on **PCM WAV** audio (best results). Other formats
  (webm/opus from a browser MediaRecorder, mp3, etc.) fall back to a
  lower-confidence byte-level heuristic and the response clearly sets
  `"format_supported": false` — convert to WAV first for a reliable read.
- `POST /api/analyze/recording/{id}` optionally blends the result back into
  the linked call's risk score (50/50 blend with the existing simulated
  `synthetic_voice_score`, so one short clip can't wildly swing an
  otherwise well-supported profile).
- To move to a real trained model later: swap the body of
  `analyze_pcm()`/`analyze_audio_bytes()` in `voice_analysis.py` for calls
  into your trained classifier — the router and API contract don't need to
  change.

---

## 6. Multi-language support

- UI chrome (nav labels, headings, buttons) is translated for 13 languages
  via `frontend/src/i18n/translations.js` — switch with the globe icon in
  the top bar. Missing keys fall back to English automatically.
- The help-desk chatbot answers in the selected language for topics it has
  translated content for, and falls back to English (flagging
  `used_fallback_language: true`) rather than guessing a translation.
- To add a language: add an entry to `LANGUAGES`/`TRANSLATIONS` in
  `translations.js`, and (optionally) to `SUPPORTED_LANGS` + each topic's
  `answers` dict in `helpdesk_kb.py`.

---

## 7. Help desk chatbot

- Floating widget (bottom-right) on every page, calls `POST
  /api/helpdesk/ask` with `{ message, session_id, language }`.
- **Fully local / offline-friendly** — no external LLM API key needed.
  It's a keyword-matching FAQ engine (`helpdesk_kb.py`) covering: what the
  app does, how the risk score works, how to block a number, whether the
  AI is "real", how to enroll a speaker, admin login, and location
  tracking. Unrecognized questions get an honest fallback answer instead of
  an invented one.
- Every turn is logged to the `chat_messages` table; admins can review
  transcripts by session at `GET /api/admin/helpdesk/sessions` /
  `/api/admin/helpdesk/sessions/{id}`.
- Want a general-purpose LLM instead of the rule-based engine? Swap the
  body of `helpdesk_kb.answer()` for a call to your LLM provider of choice
  (you'll need to supply your own API key/billing — none is bundled here).

---

## 8. Location tracking

The **Location** page uses the browser's Geolocation API (with the user's
explicit permission) to show live latitude/longitude, accuracy, and a
best-effort state/country lookup (OpenStreetMap Nominatim, best-effort —
requires internet access; fails silently if unreachable) plus an embedded
map. It only works if location access is granted when prompted, and only
tracks while the tab is open — there is no background/OS-level location
tracking, again because this is a web app, not a native app.

---

## 9. Dialer, recordings, and everything from the original prototype

Unchanged and still fully wired: DTMF dial pad, simulated/real (Twilio)
outbound calling, Voice Studio microphone recording, the Recordings
Library, WebRTC two-way calling, the live `/ws/live-call` risk feed, Call
History, Alerts, Analytics, Speakers directory, Settings (AI model
threshold config), and the API Console. See inline comments in
`backend/app/services/telephony.py` for wiring a real telephony provider.

---

## 10. Key API endpoints (new, on top of the original set)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Admin login → JWT |
| GET | `/api/auth/me` | Current admin profile |
| GET | `/api/admin/stats` | Admin dashboard KPIs |
| GET/POST/DELETE | `/api/admin/blocked-numbers` | Manage blocked numbers |
| GET/POST/PATCH | `/api/admin/admins` | Manage admin accounts (super_admin only) |
| POST | `/api/analyze/audio` | Run DSP voice analysis on an upload |
| POST | `/api/analyze/recording/{id}` | Run analysis on a stored recording, optionally update its call |
| POST | `/api/helpdesk/ask` | Ask the local FAQ chatbot |
| GET | `/api/helpdesk/languages` | Languages the chatbot has answers for |

Full interactive reference: `http://localhost:8000/docs`.

---

## 11. Environment variables (`backend/.env`, see `.env.example`)

| Variable | Default | Purpose |
|---|---|---|
| `VAANEE_SECRET_KEY` | dev key (insecure) | JWT signing secret — **set a real random value in production** |
| `VAANEE_TOKEN_TTL_HOURS` | `12` | Admin session length |
| `VAANEE_DEFAULT_ADMIN_USER` | `admin` | Seeded admin username |
| `VAANEE_DEFAULT_ADMIN_PASSWORD` | `VaaneeAdmin@123` | Seeded admin password — change immediately |

---

## 12. Privacy & compliance notes

`VoiceSample` stores only size/duration metadata, not raw audio. Uploaded
recordings for analysis are stored as files on disk under
`backend/app/media/recordings/` with only metadata in the DB — point that
at encrypted/object storage and add a retention policy before handling real
customer audio. Chatbot transcripts are stored in plaintext in the local
SQLite DB for admin review — treat `vaanee_shield.db` as sensitive data
once it holds real conversations, and add auth/encryption around it before
any production use.

---

## 13. Changelog — theme, timezone, and audio-analysis fixes

- **Theme**: switched to a light content area with a fixed navy sidebar
  (`tailwind.config.js` / `index.css` — the `base-*` tokens now resolve to
  light surfaces app-wide, while a new `navy-*` token keeps the sidebar
  dark). Semantic colors (risk/brand/status) are unchanged.
- **Timestamps**: the backend sends naive UTC datetimes with no timezone
  marker; `new Date(...)` on a marker-less string is parsed as *local* time
  by JS, not UTC — so History/Alerts/Recordings timestamps were off by your
  UTC offset compared to the live clock. Fixed with a shared parser
  (`frontend/src/lib/time.js`) that all timestamp displays now go through.
- **Analyzer audio import**: this app's own recordings are webm/opus/mp4
  (from the browser's `MediaRecorder`), which the backend can't decode
  without ffmpeg — so real analysis was silently falling back to the weak
  byte-entropy heuristic on almost every real recording. Fixed by decoding
  audio in the browser (`frontend/src/lib/audioConvert.js`, using the Web
  Audio API's native codec support) and uploading real PCM WAV instead, for
  both the "Upload clip" flow and the "Run AI voice analysis" button on
  stored recordings.
