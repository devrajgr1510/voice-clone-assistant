const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  health: () => request('/health'),

  getCalls: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/calls${qs ? `?${qs}` : ''}`)
  },
  getLatestCall: () => request('/calls/latest'),
  getCall: (id) => request(`/calls/${id}`),
  createCall: (payload) => request('/calls', { method: 'POST', body: JSON.stringify(payload) }),
  executeCallAction: (id) => request(`/calls/${id}/action`, { method: 'POST' }),

  getAlerts: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/alerts${qs ? `?${qs}` : ''}`)
  },
  markAlertRead: (id) => request(`/alerts/${id}/read`, { method: 'POST' }),
  markAllAlertsRead: () => request('/alerts/read-all', { method: 'POST' }),

  getSpeakers: () => request('/speakers'),
  getSpeaker: (id) => request(`/speakers/${id}`),
  createSpeaker: (payload) => request('/speakers', { method: 'POST', body: JSON.stringify(payload) }),

  getAnalyticsSummary: () => request('/analytics/summary'),

  getModelConfigs: () => request('/settings/models'),
  updateModelConfig: (id, params) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/settings/models/${id}?${qs}`, { method: 'PATCH' })
  },
}

export const dialerApi = {
  startCall: (payload) => request('/dialer/call', { method: 'POST', body: JSON.stringify(payload) }),
  answerCall: (id) => request(`/dialer/${id}/answer`, { method: 'POST' }),
  endCall: (id, payload) => request(`/dialer/${id}/end`, { method: 'POST', body: JSON.stringify(payload) }),
  getCall: (id) => request(`/dialer/${id}`),
}

export const roomApi = {
  create: (payload) => request('/dialer/room', { method: 'POST', body: JSON.stringify(payload || {}) }),
  get: (id) => request(`/dialer/room/${id}`),
  join: (id, payload) => request(`/dialer/room/${id}/join`, { method: 'POST', body: JSON.stringify(payload || {}) }),
}

export const recordingsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/recordings${qs ? `?${qs}` : ''}`)
  },
  // Uses raw fetch (not the JSON `request` helper) so the browser sets the
  // multipart/form-data boundary itself.
  upload: async (formData) => {
    const res = await fetch(`${BASE}/recordings`, { method: 'POST', body: formData })
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
    return res.json()
  },
  audioUrl: (id) => `${BASE}/recordings/${id}/audio`,
  remove: (id) => request(`/recordings/${id}`, { method: 'DELETE' }),
}

function adminHeaders() {
  const token = localStorage.getItem('vs_admin_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function adminRequest(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const authApi = {
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => adminRequest('/auth/me'),
}

export const adminApi = {
  stats: () => adminRequest('/admin/stats'),
  listAdmins: () => adminRequest('/admin/admins'),
  createAdmin: (payload) => adminRequest('/admin/admins', { method: 'POST', body: JSON.stringify(payload) }),
  toggleAdminActive: (id) => adminRequest(`/admin/admins/${id}/toggle-active`, { method: 'PATCH' }),
  listBlockedNumbers: () => adminRequest('/admin/blocked-numbers'),
  blockNumber: (number, reason) =>
    adminRequest('/admin/blocked-numbers', { method: 'POST', body: JSON.stringify({ number, reason }) }),
  unblockNumber: (id) => adminRequest(`/admin/blocked-numbers/${id}`, { method: 'DELETE' }),
  helpdeskSessions: () => adminRequest('/admin/helpdesk/sessions'),
  helpdeskTranscript: (sessionId) => adminRequest(`/admin/helpdesk/sessions/${sessionId}`),
}

export const helpdeskApi = {
  ask: (message, sessionId, language) =>
    request('/helpdesk/ask', {
      method: 'POST',
      body: JSON.stringify({ message, session_id: sessionId, language }),
    }),
  languages: () => request('/helpdesk/languages'),
}

export const analyzeApi = {
  uploadAudio: async (fileOrBlob, filename = 'clip.wav') => {
    const fd = new FormData()
    fd.append('audio', fileOrBlob, fileOrBlob.name || filename)
    const res = await fetch(`${BASE}/analyze/audio`, { method: 'POST', body: fd })
    if (!res.ok) throw new Error(`Analyze failed: ${res.status}`)
    return res.json()
  },
  // `wavBlob` is optional — pass a browser-converted PCM WAV (see
  // lib/audioConvert.js) so the server always gets a format it can fully
  // analyze, even though the original recording is webm/opus/mp4. Omit it
  // to let the server analyze whatever's already stored on disk as-is.
  analyzeRecording: async (recordingId, wavBlob) => {
    const fd = new FormData()
    if (wavBlob) fd.append('audio', wavBlob, 'converted.wav')
    const res = await fetch(`${BASE}/analyze/recording/${recordingId}`, { method: 'POST', body: fd })
    if (!res.ok) throw new Error(`Analyze failed: ${res.status}`)
    return res.json()
  },
}

export function liveCallSocket(onMessage) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${proto}://${window.location.host}/ws/live-call`)
  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data))
    } catch {
      /* ignore malformed frame */
    }
  }
  return ws
}
