import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
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
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Don't show navigation on login/register pages
  if (window.location.pathname === '/login' || window.location.pathname === '/register') {
    return null
  }

  return (
    <nav style={{
      background: '#1e3a8a',
      padding: '1rem',
      marginBottom: '2rem',
      overflowX: 'auto'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        gap: '1.5rem',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <Link to="/dashboard" style={{ color: 'white', textDecoration: 'none', fontWeight: '600', whiteSpace: 'nowrap' }}>
          Dashboard
        </Link>
        <Link to="/log-catch" style={{ color: 'white', textDecoration: 'none', fontWeight: '600', whiteSpace: 'nowrap' }}>
          Log Catch
        </Link>
        <Link to="/my-catches" style={{ color: 'white', textDecoration: 'none', fontWeight: '600', whiteSpace: 'nowrap' }}>
          My Catches
        </Link>
        <Link to="/sessions" style={{ color: 'white', textDecoration: 'none', fontWeight: '600', whiteSpace: 'nowrap' }}>
          Sessions
        </Link>
        <Link to="/species" style={{ color: 'white', textDecoration: 'none', fontWeight: '600', whiteSpace: 'nowrap' }}>
          Species Lookup
        </Link>
        <a 
          href="https://safishid.netlify.app" 
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'white', textDecoration: 'none', fontWeight: '600', whiteSpace: 'nowrap' }}
        >
          Fish ID ↗
        </a>
        
        {user && (
          <button
            onClick={handleLogout}
            style={{
              marginLeft: 'auto',
              padding: '0.5rem 1rem',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '4px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Logout
          </button>
        )}
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
