import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { StayPage } from './pages/StayPage'
import { BackendHome } from './pages/portal/BackendHome'
import { PortalLogin } from './pages/portal/PortalLogin'
import { PortalLayout } from './pages/portal/PortalLayout'
import { AdminDashboard } from './pages/portal/AdminDashboard'
import { AdminListingsPage } from './pages/portal/AdminListingsPage'
import { AdminListingDetail } from './pages/portal/AdminListingDetail'
import { AdminHostsPage } from './pages/portal/AdminHostsPage'
import { AdminHostDetail } from './pages/portal/AdminHostDetail'
import { AdminAnalyticsPage } from './pages/portal/AdminAnalyticsPage'
import { AdminActivityPage } from './pages/portal/AdminActivityPage'
import { AdminSettingsPage } from './pages/portal/AdminSettingsPage'
import { HostDashboard } from './pages/portal/HostDashboard'
import { HostListingForm } from './pages/portal/HostListingForm'
import { PasswordReset } from './pages/portal/PasswordReset'
import { AuthProvider } from './lib/auth'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/stay/:id" element={<StayPage />} />
          <Route path="/reset-password" element={<PasswordReset />} />
          <Route path="/backend" element={<BackendHome />} />

          <Route
            path="/admin/login"
            element={
              <PortalLogin
                role="admin"
                title="Admin sign in"
                subtitle="Full platform console — listings, hosts, analytics."
                redirectTo="/admin"
              />
            }
          />
          <Route
            path="/admin"
            element={
              <PortalLayout
                role="admin"
                links={[
                  { to: '/admin', label: 'Dashboard' },
                  { to: '/admin/listings', label: 'Listings' },
                  { to: '/admin/listings/new', label: 'Add listing' },
                  { to: '/admin/hosts', label: 'Hosts' },
                  { to: '/admin/analytics', label: 'Analytics' },
                  { to: '/admin/activity', label: 'Activity' },
                  { to: '/admin/settings', label: 'Settings' },
                ]}
              />
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="listings" element={<AdminListingsPage />} />
            <Route path="listings/new" element={<HostListingForm audience="admin" />} />
            <Route path="listings/:id" element={<AdminListingDetail />} />
            <Route path="hosts" element={<AdminHostsPage />} />
            <Route path="hosts/:id" element={<AdminHostDetail />} />
            <Route path="analytics" element={<AdminAnalyticsPage />} />
            <Route path="activity" element={<AdminActivityPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>

          <Route
            path="/host/login"
            element={
              <PortalLogin
                role="host"
                title="Host sign in"
                subtitle="List and manage your properties."
                redirectTo="/host"
                allowRegister
              />
            }
          />
          <Route
            path="/host"
            element={
              <PortalLayout
                role="host"
                links={[
                  { to: '/host', label: 'Dashboard' },
                  { to: '/host/new', label: 'Add property' },
                ]}
              />
            }
          >
            <Route index element={<HostDashboard />} />
            <Route path="new" element={<HostListingForm />} />
            <Route path="edit/:id" element={<HostListingForm />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
