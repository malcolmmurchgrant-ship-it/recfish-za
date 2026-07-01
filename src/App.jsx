import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import { SessionProvider, useSession } from './contexts/SessionContext'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import LogCatch from './pages/LogCatch'
import MyCatches from './pages/MyCatches'
import CatchMap from './pages/CatchMap'
import Sessions from './pages/Sessions'
import SpeciesLookup from './pages/SpeciesLookup'
import Competitions from './pages/Competitions'
import CompetitionAdmin from './components/CompetitionAdmin'
import CompetitionSetupWizard from './pages/CompetitionSetupWizard'
import HistoricalCompetitionView from './pages/HistoricalCompetitionView'
import UniversalScoreboard from './pages/UniversalScoreboard'
import UniversalCatchLogger from './components/CompetitionAdmin/UniversalCatchLogger'
import CompetitionCatchLogger from './pages/CompetitionCatchLogger'
import Profile from './pages/Profile'
import SessionEndSummaryModal from './components/SessionEndSummaryModal'

const NAVY = '#1e3a8a'

const OWNER_ID       = 'b9c5048a-b229-46af-9042-44551b162d75'
const CATCH_ROLES    = ['admin', 'tournament_director']
const GAMEFISH_ID    = '3855034f-ab39-4297-9be4-ba9a7e566ce0'

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
  const [openGroup,   setOpenGroup]   = useState(null)
  const [canEnterGamefish, setCanEnterGamefish] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id
      if (!uid) return
      if (uid === OWNER_ID) { setCanEnterGamefish(true); return }
      supabase
        .from('competition_user_roles')
        .select('role')
        .eq('user_id', uid)
        .eq('competition_id', GAMEFISH_ID)
        .then(({ data: roles }) => {
          if (roles?.some(r => CATCH_ROLES.includes(r.role)))
            setCanEnterGamefish(true)
        })
    })
  }, [])

  const competitionItems = [
    { to: '/competitions',  label: '🏆 Competitions Hub'     },
    { to: '/setup-wizard',  label: '🧭 Set Up a Competition' },
  ]

  const toolItems = [
    { to: '/species',   label: '🐟 Species Lookup' },
    { to: '/catch-map', label: '🗺️ Catch Map'       },
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

      {/* Inline sub-menu */}
      {openGroup && activeItems.length > 0 && (
        <div style={subMenuStyle}>
          {activeItems.filter(item => !item.divider).map(item => (
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

// Scoreboard wrapper
function ScoreboardPage() {
  const { competitionId } = useParams()
  return <UniversalScoreboard competitionId={competitionId} />
}

// Wrapper reads :competitionId from URL and decides which admin view to
// render: the full live-competition CompetitionAdmin suite, or the simple
// read-only HistoricalCompetitionView for competitions imported from a
// standardized post-event catch return (no scoring protocol applied).
function CompetitionAdminPage() {
  const { competitionId } = useParams()
  const [isHistorical, setIsHistorical] = useState(null) // null = still checking
  const [checkError,   setCheckError]   = useState(null)

  useEffect(() => {
    if (!competitionId) { setIsHistorical(false); return }
    let cancelled = false
    supabase
      .from('competitions')
      .select('is_historical_import')
      .eq('id', competitionId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          // If the flag can't be checked for any reason, fail safe to the
          // normal live-competition view rather than blocking the page —
          // a missing/unreadable flag should never be worse than the
          // pre-existing behavior.
          console.error('CompetitionAdminPage: could not check is_historical_import', error)
          setCheckError(error.message)
          setIsHistorical(false)
          return
        }
        setIsHistorical(!!data?.is_historical_import)
      })
    return () => { cancelled = true }
  }, [competitionId])

  if (isHistorical === null) {
    return <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading…</div>
  }

  return isHistorical
    ? <HistoricalCompetitionView competitionId={competitionId} />
    : <CompetitionAdmin competitionId={competitionId} />
}

// Catch Logger wrapper reads :competitionId from URL and passes it as a prop
function CatchLoggerPage() {
  const { competitionId } = useParams()
  return <UniversalCatchLogger competitionId={competitionId} />
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
            <Route path='/scoreboard/:competitionId' element={<ScoreboardPage />} />
            <Route path='/competition-admin-v2' element={<CompetitionAdminPage />} />
            <Route path='/competition-admin-v2/:competitionId' element={<CompetitionAdminPage />} />
            <Route path='/setup-wizard'         element={<CompetitionSetupWizard />} />
            <Route path='/setup-wizard/:competitionId' element={<CompetitionSetupWizard />} />
            <Route path='/competition-catch-logger/:competitionId' element={<CatchLoggerPage />} />
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
