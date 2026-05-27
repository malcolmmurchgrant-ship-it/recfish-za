import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
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

// ─── NAV LINK STYLE ───────────────────────────────────────────────────────────
const navLinkStyle = (active = false) => ({
  color: 'white',
  textDecoration: 'none',
  fontWeight: '600',
  fontSize: '0.8rem',
  padding: '0.5rem 0.75rem',
  borderRadius: '20px',
  background: active ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  display: 'inline-block',
})

// ─── DROPDOWN MENU ────────────────────────────────────────────────────────────
function DropdownMenu({ label, items, activePrefix }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const location = useLocation()
  const isActive = items.some(i => location.pathname.startsWith(i.to))

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          ...navLinkStyle(isActive || open),
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
        }}
      >
        {label}
        <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          background: 'white',
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          minWidth: 210,
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          {items.map(item => (
            item.divider ? (
              <div key={item.key} style={{ height: 1, background: '#e5e7eb', margin: '0.25rem 0' }} />
            ) : item.external ? (
              <a
                key={item.to}
                href={item.to}
                target='_blank'
                rel='noopener noreferrer'
                onClick={() => setOpen(false)}
                style={{
                  display: 'block',
                  padding: '0.6rem 1rem',
                  color: '#374151',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                style={{
                  display: 'block',
                  padding: '0.6rem 1rem',
                  color: location.pathname.startsWith(item.to) ? '#1e3a8a' : '#374151',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  fontWeight: location.pathname.startsWith(item.to) ? 700 : 500,
                  background: location.pathname.startsWith(item.to) ? '#eff6ff' : 'transparent',
                }}
                onMouseEnter={e => { if (!location.pathname.startsWith(item.to)) e.currentTarget.style.background = '#f3f4f6' }}
                onMouseLeave={e => { if (!location.pathname.startsWith(item.to)) e.currentTarget.style.background = location.pathname.startsWith(item.to) ? '#eff6ff' : 'transparent' }}
              >
                {item.label}
              </Link>
            )
          ))}
        </div>
      )}
    </div>
  )
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function Navigation() {
  const location = useLocation()

  const competitionItems = [
    { to: '/competitions',          label: '🏆 Competitions Hub' },
    { to: '/competition-admin-v2',  label: '⚙️ Competition Admin' },
    { divider: true, key: 'div1' },
    { to: '/allcoastals-teams',     label: '🏅 All Coastals — Teams' },
    { to: '/allcoastals',           label: '🎣 All Coastals — Logger' },
    { to: '/allcoastals-scores',    label: '📊 All Coastals — Scores' },
    { to: '/allcoastals-admin',     label: '🔧 All Coastals — Admin' },
  ]

  const toolItems = [
    { to: '/species',               label: '🐟 Species Lookup' },
    { to: '/catch-map',             label: '🗺️ Catch Map' },
    { to: 'https://safishid.netlify.app', label: '🔍 Fish ID ↗', external: true },
  ]

  return (
    <nav style={{ background: '#1e3a8a', padding: '0.75rem 1rem', marginBottom: '2rem' }}>
      <div style={{
        display: 'flex',
        gap: '0.4rem',
        alignItems: 'center',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {/* Core links */}
        <Link to='/dashboard' style={navLinkStyle(location.pathname === '/dashboard')}>🏠 Home</Link>
        <Link to='/log-catch' style={navLinkStyle(location.pathname === '/log-catch')}>🎣 Log Catch</Link>
        <Link to='/my-catches' style={navLinkStyle(location.pathname === '/my-catches')}>📋 My Catches</Link>
        <Link to='/sessions' style={navLinkStyle(location.pathname === '/sessions')}>⏱ Sessions</Link>

        {/* Competitions dropdown */}
        <DropdownMenu label='🏆 Competitions' items={competitionItems} />

        {/* Tools dropdown */}
        <DropdownMenu label='🔧 Tools' items={toolItems} />

        {/* Profile */}
        <Link to='/profile' style={navLinkStyle(location.pathname === '/profile')}>👤 Profile</Link>
      </div>
    </nav>
  )
}

// ─── APP CONTENT ──────────────────────────────────────────────────────────────
function AppContent() {
  const { lastEndedSession, clearLastEndedSession } = useSession()
  return (
    <>
      <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
        <Navigation />
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
          <Routes>
            <Route path='/login'                element={<Login />} />
            <Route path='/register'             element={<Register />} />
            <Route path='/dashboard'            element={<Dashboard />} />
            <Route path='/log-catch'            element={<LogCatch />} />
            <Route path='/my-catches'           element={<MyCatches />} />
            <Route path='/sessions'             element={<Sessions />} />
            <Route path='/catch-map'            element={<CatchMap />} />
            <Route path='/species'              element={<SpeciesLookup />} />
            <Route path='/competitions'         element={<Competitions />} />
            <Route path='/competition-admin'    element={<CompetitionAdmin />} />
            <Route path='/competition'          element={<CompetitionCatchLogger />} />
            <Route path='/allcoastals'          element={<AllCoastalsCatchLogger />} />
            <Route path='/allcoastals-scores'   element={<AllCoastalsScoreboard />} />
            <Route path='/allcoastals-admin'    element={<AllCoastalsAdmin />} />
            <Route path='/allcoastals-teams'    element={<AllCoastalsTeams />} />
            <Route path='/competition-admin-v2' element={<CompetitionAdmin />} />
            <Route path='/competition-admin-v2/:competitionId' element={<CompetitionAdmin />} />
            <Route path='/profile'              element={<Profile />} />
            <Route path='/'                     element={<Navigate to='/dashboard' replace />} />
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

// ─── APP ──────────────────────────────────────────────────────────────────────
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
