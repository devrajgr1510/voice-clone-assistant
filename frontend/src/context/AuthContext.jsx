import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { authApi } from '../api/client.js'

const AuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('vs_admin_token'))
  const [admin, setAdmin] = useState(() => {
    const raw = localStorage.getItem('vs_admin_profile')
    return raw ? JSON.parse(raw) : null
  })

  const login = useCallback(async (username, password) => {
    const res = await authApi.login(username, password)
    localStorage.setItem('vs_admin_token', res.access_token)
    const profile = { username: res.username, full_name: res.full_name, role: res.role }
    localStorage.setItem('vs_admin_profile', JSON.stringify(profile))
    setToken(res.access_token)
    setAdmin(profile)
    return profile
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('vs_admin_token')
    localStorage.removeItem('vs_admin_profile')
    setToken(null)
    setAdmin(null)
  }, [])

  const value = useMemo(() => ({
    token, admin, isAuthenticated: !!token, login, logout,
  }), [token, admin, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAdminAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return ctx
}
