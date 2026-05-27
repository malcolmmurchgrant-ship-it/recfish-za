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
function DropdownMenu({ label, items, currentPath }) {
  const [open, setOpen]   = useState(false)
  const [pos,  setPos]    = useState({ top: 0, left: 0 })
  const btnRef            = useRef(null)
  const isActive          = items.some(i => i.to && currentPath.startsWith(i.to))

  // Position the dropdown exactly under the button using fixed positioning
  // This escapes any overflow:hidden/auto on parent elements
  const openMenu = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen(true)
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (btnRef.current && !btnRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on scroll/resize
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const btnStyle = {
    color: 'white',
    fontWeight: '600',
    fontSize: '0.8rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '20px',
    background: (isActive || open) ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
  }

  return (
    <>
      <button ref={btnRef} onClick={() => open ? setOpen(false) : openMenu()} style={btnStyle}>
        {label}
        <span style={{ fontSize: '0.6rem', opacity: 0.75 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          top:  pos.top,
          left: pos.left,
          background: 'white',
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.20)',
          minWidth: 230,
          zIndex: 9999,
          overflow: 'hidden',
        }}>
          {items.map((item, i) => {
            if (item.divider) return (
              <div key={`d${i}`} style={{ height: 1, background: '#e5e7eb', margin: '0.2rem 0' }} />
            )
            const active = item.to && currentPath.startsWith(item.to)
            const style = {
              display: 'block',
              padding: '0.65rem 1.1rem',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: active ? 700 : 500,
              color: active ? '#1e3a8a' : '#374151',
              background: active ? '#eff6ff' : 'white',
              cursor: 'pointer',
              borderLeft: active ? '3px solid #1e3a8a' : '3px solid transparent',
            }
            if (item.external) return (
              <a key={item.to} href={item.to} target='_blank' rel='noopener noreferrer'
                onClick={() => setOpen(false)} style={style}
                onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={e => e.currentTarget.style.background = active ? '#eff6ff' : 'white'}>
                {item.label}
              </a>
            )
            return (
              <Link key={item.to} to={item.to} onClick={() => setOpen(false)} style={style}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f3f4f6' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? '#eff6ff' : 'white' }}>
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function Navigation() {
  const location = useLocation()
  const path     = location.pathname

  const competitionItems = [
    { to: '/competitions',         label: '🏆 Competitions Hub' },
    { to: '/competition-admin-v2', label: '⚙️ Competition Admin' },
    { divider: true },
    { to: '/allcoastals-teams',    label: '🏅 All Coastals — Teams' },
    { to: '/allcoastals',          label: '🎣 All Coastals — Logger' },
    { to: '/allcoastals-scores',   label: '📊 All Coastals — Scores' },
    { to: '/allcoastals-admin',    label: '🔧 All Coastals — Admin' },
  ]

  const toolItems = [
    { to: '/species',   label: '🐟 Species Lookup' },
    { to: '/catch-map', label: '🗺️ Catch Map' },
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
        <Link to='/dashboard'  style={navLinkStyle(path === '/dashboard')}>🏠 Home</Link>
        <Link to='/log-catch'  style={navLinkStyle(path === '/log-catch')}>🎣 Log Catch</Link>
        <Link to='/my-catches' style={navLinkStyle(path === '/my-catches')}>📋 My Catches</Link>
        <Link to='/sessions'   style={navLinkStyle(path === '/sessions')}>⏱ Sessions</Link>

        <DropdownMenu label='🏆 Competitions' items={competitionItems} currentPath={path} />
        <DropdownMenu label='🔧 Tools'        items={toolItems}        currentPath={path} />

        <Link to='/profile' style={navLinkStyle(path === '/profile')}>👤 Profile</Link>
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
