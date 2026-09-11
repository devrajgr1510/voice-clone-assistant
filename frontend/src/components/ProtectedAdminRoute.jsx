import { Navigate } from 'react-router-dom'
import { useAdminAuth } from '../context/AuthContext.jsx'

export default function ProtectedAdminRoute({ children }) {
  const { isAuthenticated } = useAdminAuth()
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />
  return children
}
