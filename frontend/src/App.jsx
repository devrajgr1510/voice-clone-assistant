import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Dialer from './pages/Dialer.jsx'
import LiveProtection from './pages/LiveProtection.jsx'
import CallHistory from './pages/CallHistory.jsx'
import Analyzer from './pages/Analyzer.jsx'
import LocationPage from './pages/LocationPage.jsx'
import Alerts from './pages/Alerts.jsx'
import Analytics from './pages/Analytics.jsx'
import Speakers from './pages/Speakers.jsx'
import Settings from './pages/Settings.jsx'
import ApiConsole from './pages/ApiConsole.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import ProtectedAdminRoute from './components/ProtectedAdminRoute.jsx'

export default function App() {
  return (
    <Routes>
      {/* Full-screen, no app chrome */}
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Everything else shares the mobile-app-style shell */}
      <Route
        path="*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dialer" element={<Dialer />} />
              <Route path="/dialer/join/:roomId" element={<Dialer />} />
              <Route path="/live-protection" element={<LiveProtection />} />
              <Route path="/call-history" element={<CallHistory />} />
              <Route path="/analyzer" element={<Analyzer />} />
              <Route path="/location" element={<LocationPage />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/speakers" element={<Speakers />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/api-console" element={<ApiConsole />} />
              <Route
                path="/admin"
                element={
                  <ProtectedAdminRoute>
                    <AdminPanel />
                  </ProtectedAdminRoute>
                }
              />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  )
}
