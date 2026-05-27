import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
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
import GamefishCatchLogger from './pages/GamefishCatchLogger'
import SessionEndSummaryModal from './components/SessionEndSummaryModal'

const NAVY = '#1e3a8a'

const pill = (active) => ({
  color: 'white',
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: '0.8rem',
  padding: '0.5rem 0.75rem',
  borderRadius: 20,
  background: active ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  display: 'inline-block',
  cursor: 'pointer',
  border: 'none',
})

// Simple expand/collapse group — no positioning, no portals, no z-index tricks
// The group label is a button; clicking expands an inline sub-menu below the nav bar
function NavGroup({ label, items, currentPath, openGroup, setOpenGroup, groupId }) {
  const isOpen   = openGroup === groupId
  const isActive = items.some(i => i.to && currentPath.startsWith(i.to))

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        onClick={() => setOpenGroup(isOpen ? null : groupId)}
        style={{ ...pill(isActive || isOpen) }}
      >
        {label} <span style={{ fontSize: '0.6rem' }}>{isOpen ? '▲' : '▼'}</span>
      </button>
    </div>
  )
}

function Navigation() {
  const location = useLocation()
  const path = location.pathname
  const [openGroup, setOpenGroup] = useState(null)

  const competitionItems = [
    { to: '/competitions',         label: '🏆 Competitions Hub' },
    { to: '/competition-admin-v2', label: '⚙️ Competition Admin' },
    { to: '/allcoastals-teams',    label: '🏅 All Coastals — Teams' },
    { to: '/allcoastals',          label: '🎣 All Coastals — Logger' },
    { to: '/allcoastals-scores',   label: '📊 All Coastals — Scores' },
    { to: '/allcoastals-admin',    label: '🔧 All Coastals — Admin' },
    { to: '/gamefish',             label: '🎣 Gamefish Nationals — Logger' },
  ]

  const toolItems = [
    { to: '/species',   label: '🐟 Species Lookup' },
    { to: '/catch-map', label: '🗺️ Catch Map' },
  ]

  const subMenuStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
    padding: '0.6rem 1rem',
    background: '#162d6e',
    borderTop: '1px solid rgba(255,255,255,0.1)',
  }

  const subLinkStyle = (active) => ({
    color: active ? '#fbbf24' : 'rgba(255,255,255,0.85)',
    textDecoration: 'none',
    fontWeight: active ? 700 : 500,
    fontSize: '0.8rem',
    padding: '0.35rem 0.7rem',
    borderRadius: 20,
    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
    whiteSpace: 'nowrap',
    border: '1px solid rgba(255,255,255,0.15)',
  })

  const activeItems = openGroup === 'competitions' ? competitionItems
                    : openGroup === 'tools'        ? toolItems
                    : []

  return (
    <nav style={{ background: NAVY, marginBottom: '2rem' }}>
      {/* Main bar */}
      <div style={{
        display: 'flex',
        gap: '0.4rem',
        alignItems: 'center',
        padding: '0.75rem 1rem',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}>
        <Link to='/dashboard'  style={pill(path === '/dashboard')}>🏠 Home</Link>
        <Link to='/log-catch'  style={pill(path === '/log-catch')}>🎣 Log Catch</Link>
        <Link to='/my-catches' style={pill(path === '/my-catches')}>📋 My Catches</Link>
        <Link to='/sessions'   style={pill(path === '/sessions')}>⏱ Sessions</Link>

        <NavGroup
          groupId='competitions'
          label='🏆 Competitions'
          items={competitionItems}
          currentPath={path}
          openGroup={openGroup}
          setOpenGroup={setOpenGroup}
        />
        <NavGroup
          groupId='tools'
          label='🔧 Tools'
          items={toolItems}
          currentPath={path}
          openGroup={openGroup}
          setOpenGroup={setOpenGroup}
        />

        <Link to='/profile' style={pill(path === '/profile')}>👤 Profile</Link>

        <a href='https://safishid.netlify.app' target='_blank' rel='noopener noreferrer'
          style={pill(false)}>🔍 Fish ID ↗</a>
      </div>

      {/* Inline sub-menu — appears below the nav bar, no positioning needed */}
      {openGroup && activeItems.length > 0 && (
        <div style={subMenuStyle}>
          {activeItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              style={subLinkStyle(path.startsWith(item.to))}
              onClick={() => setOpenGroup(null)}
            >
              {item.label}
            </Link>
          ))}
          <button
            onClick={() => setOpenGroup(null)}
            style={{ ...subLinkStyle(false), marginLeft: 'auto', cursor: 'pointer' }}
          >
            ✕ Close
          </button>
        </div>
      )}
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
            <Route path='/gamefish'             element={<GamefishCatchLogger />} />
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
