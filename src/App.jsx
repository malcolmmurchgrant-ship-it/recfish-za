import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SessionProvider, useSession } from './contexts/SessionContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import LogCatch from './pages/LogCatch'
import MyCatches from './pages/MyCatches'
import Sessions from './pages/Sessions'
import SpeciesLookup from './pages/SpeciesLookup'
import SessionEndSummaryModal from './components/SessionEndSummaryModal'

function Navigation() {
  return (
    <nav style={{
      background: '#1e3a8a',
      padding: '1rem',
      marginBottom: '2rem'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        gap: '2rem',
        alignItems: 'center'
      }}>
        <Link to="/dashboard" style={{ color: 'white', textDecoration: 'none', fontWeight: '600' }}>
          Dashboard
        </Link>
        <Link to="/log-catch" style={{ color: 'white', textDecoration: 'none', fontWeight: '600' }}>
          Log Catch
        </Link>
        <Link to="/my-catches" style={{ color: 'white', textDecoration: 'none', fontWeight: '600' }}>
          My Catches
        </Link>
        <Link to="/sessions" style={{ color: 'white', textDecoration: 'none', fontWeight: '600' }}>
          Sessions
        </Link>
        <Link to="/species" style={{ color: 'white', textDecoration: 'none', fontWeight: '600' }}>
          Species Lookup
        </Link>
        <a 
          href="https://safishid.netlify.app" 
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'white', textDecoration: 'none', fontWeight: '600' }}
        >
          Fish ID ↗
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
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/log-catch" element={<LogCatch />} />
            <Route path="/my-catches" element={<MyCatches />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/species" element={<SpeciesLookup />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </div>

      {/* Global Session End Summary Modal */}
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
