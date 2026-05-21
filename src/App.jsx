import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SessionProvider, useSession } from './contexts/SessionContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import LogCatch from './pages/LogCatch'
import MyCatches from './pages/MyCatches'
import CatchMap from './pages/CatchMap'
import Sessions from './pages/Sessions'
import SpeciesLookup from './pages/SpeciesLookup'
import Competitions from './pages/Competitions'
import CompetitionAdmin from './pages/CompetitionAdmin'
import CompetitionCatchLogger from './pages/CompetitionCatchLogger'
import AllCoastalsCatchLogger from './pages/AllCoastalsCatchLogger'
import AllCoastalsScoreboard from './pages/AllCoastalsScoreboard'
import AllCoastalsAdmin from './pages/AllCoastalsAdmin'
import AllCoastalsTeams from './pages/AllCoastalsTeams'
import Profile from './pages/Profile'
import SessionEndSummaryModal from './components/SessionEndSummaryModal'

function Navigation() {
  return (
    <nav style={{
      background: '#1e3a8a',
      padding: '0.75rem 1rem',
      marginBottom: '2rem'
    }}>
      <div style={{
        display: 'flex',
        gap: '0.4rem',
        alignItems: 'center',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {[
          { to: '/dashboard',        label: '🏠 Home' },
          { to: '/log-catch',        label: '🎣 Log' },
          { to: '/my-catches',       label: '📋 Catches' },
          { to: '/sessions',         label: '⏱ Sessions' },
          { to: '/catch-map',        label: '🗺 Map' },
          { to: '/species',          label: '🐟 Species' },
          { to: '/competitions',     label: '🏆 Competitions' },
          { to: '/allcoastals-admin',label: '⚙️ AC Admin' },
          { to: '/allcoastals-teams',label: '🏅 AC Teams' },
          { to: '/profile',          label: '👤 Profile' },
        ].map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            style={{
              color: 'white',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '0.8rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.15)',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            {label}
          </Link>
        ))}
        <a
          href="https://safishid.netlify.app"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'white',
            textDecoration: 'none',
            fontWeight: '600',
            fontSize: '0.8rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '20px',
            background: 'rgba(255,255,255,0.15)',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          🔍 Fish ID ↗
        </a>
      </div>
    </nav>
  )
}

function AppContent() {
  const { lastEndedSession, clearLastEndedSession } = useSession()
  return (
    <>
      <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
        <Navigation />
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
          <Routes>
            <Route path="/login"               element={<Login />} />
            <Route path="/register"            element={<Register />} />
            <Route path="/dashboard"           element={<Dashboard />} />
            <Route path="/log-catch"           element={<LogCatch />} />
            <Route path="/my-catches"          element={<MyCatches />} />
            <Route path="/sessions"            element={<Sessions />} />
            <Route path="/catch-map"           element={<CatchMap />} />
            <Route path="/species"             element={<SpeciesLookup />} />
            <Route path="/competitions"        element={<Competitions />} />
            <Route path="/competition-admin"   element={<CompetitionAdmin />} />
            <Route path="/competition"         element={<CompetitionCatchLogger />} />
            <Route path="/allcoastals"         element={<AllCoastalsCatchLogger />} />
            <Route path="/allcoastals-scores"  element={<AllCoastalsScoreboard />} />
            <Route path="/allcoastals-admin"   element={<AllCoastalsAdmin />} />
            <Route path="/allcoastals-teams"   element={<AllCoastalsTeams />} />
            <Route path="/profile"             element={<Profile />} />
            <Route path="/"                    element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
      {lastEndedSession && (
        <SessionEndSummaryModal
          session={lastEndedSession}
          onClose={clearLastEndedSession}
        />
      )}
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <SessionProvider>
        <Router>
          <AppContent />
        </Router>
      </SessionProvider>
    </AuthProvider>
  )
}

export default App
