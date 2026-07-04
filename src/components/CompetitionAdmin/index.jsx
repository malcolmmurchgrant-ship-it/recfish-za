// ─── CompetitionAdmin/index.jsx ───────────────────────────────────────────────
// Universal Competition Admin — entry point.
// Loads competition, config, catches, participants, days and routes to tabs.
//
// Usage:
//   import CompetitionAdmin from './components/CompetitionAdmin'
//   <CompetitionAdmin competitionId="uuid-here" />
//
// Replaces: GamefishAdmin.jsx, AllCoastalsAdmin.jsx, and all future per-competition admins.

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useCompetitionConfig } from './hooks/useCompetitionConfig'
import { useCompetitionRoles  } from './hooks/useCompetitionRoles'
import { useCompetitionCatches} from './hooks/useCompetitionCatches'

import CompetitionAdminSetup        from './CompetitionAdminSetup'
import CompetitionAdminParticipants from './CompetitionAdminParticipants'
import CompetitionAdminScoring      from './CompetitionAdminScoring'
import CompetitionAdminScoreboard   from './CompetitionAdminScoreboard'
import CompetitionAdminReports      from './CompetitionAdminReports'
import RolesTab                     from './CompetitionAdminRoles'

const NAVY = '#1e3a8a'
const GREY = '#6b7280'
const RED  = '#dc2626'

const TABS = [
  { id: 'setup',        label: '⚙️ Setup',        minRole: 'admin'  },
  { id: 'participants', label: '👥 Participants',  minRole: 'scorer' },
  { id: 'scoring',      label: '📋 Scoring',       minRole: 'scorer' },
  { id: 'scoreboard',   label: '🏆 Scoreboard',   minRole: 'viewer' },
  { id: 'reports',      label: '📊 Reports',       minRole: 'admin'  },
  { id: 'roles',        label: '🔐 Roles',         minRole: 'admin'  },
]

export default function CompetitionAdmin({ competitionId }) {
  const [activeTab,     setActiveTab]     = useState('scoring')
  // Set when an angler is clicked on the Scoreboard — carries them straight
  // to that angler's catches in the Scoring tab instead of making them
  // reselect Day/Team manually.
  const [scoringFilter, setScoringFilter] = useState(null)

  function goToAnglerScoring(participantId, teamName) {
    setScoringFilter({ participantId, teamName })
    setActiveTab('scoring')
  }
  const [participants,  setParticipants]  = useState([])
  const [days,          setDays]          = useState([])
  const [teams,         setTeams]         = useState([])
  const [loadingMeta,   setLoadingMeta]   = useState(true)

  // ── Core hooks ───────────────────────────────────────────────────────────
  const {
    competition, config, loading: configLoading, error: configError, reload: reloadConfig,
  } = useCompetitionConfig(competitionId)

  const {
    isPlatformAdmin, isAdmin, isScorer, canView, loading: rolesLoading,
    grantRole, revokeRole, recheckRoles,
  } = useCompetitionRoles(competitionId)

  const {
    catches, loading: catchesLoading, stats, reload: reloadCatches,
    updateCatch, rejectCatch, verifyCatch,
  } = useCompetitionCatches(competitionId)

  // ── Load participants, days, teams ────────────────────────────────────────
  useEffect(() => {
    if (!competitionId) return
    loadMeta()
  }, [competitionId])

  async function loadMeta() {
    setLoadingMeta(true)
    const [{ data: parts }, { data: ds }, { data: tms }] = await Promise.all([
      supabase.from('competition_participants')
        .select('*, competition_teams(id, team_name, province, team_type)')
        .eq('competition_id', competitionId)
        .order('full_name'),
      supabase.from('competition_days')
        .select('*')
        .eq('competition_id', competitionId)
        .order('day_number'),
      supabase.from('competition_teams')
        .select('*')
        .eq('competition_id', competitionId)
        .order('team_name'),
    ])
    setParticipants(parts || [])
    setDays(ds || [])
    setTeams(tms || [])
    setLoadingMeta(false)
  }

  function reloadAll() {
    reloadConfig()
    reloadCatches()
    loadMeta()
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  const isLoading = configLoading || rolesLoading || loadingMeta
  if (isLoading) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem', textAlign: 'center', color: GREY }}>
        Loading competition…
      </div>
    )
  }

  if (configError) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem' }}>
        <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: 8, color: RED }}>
          Error loading competition: {configError}
        </div>
      </div>
    )
  }

  if (!canView && !isScorer && !isAdmin) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem', textAlign: 'center', color: GREY }}>
        You do not have access to this competition.
      </div>
    )
  }

  // ── Visible tabs based on role ────────────────────────────────────────────
  const visibleTabs = TABS.filter(t => {
    if (t.minRole === 'viewer') return canView || isScorer || isAdmin
    if (t.minRole === 'scorer') return isScorer || isAdmin
    if (t.minRole === 'admin')  return isAdmin
    return true
  })

  const discipline = competition?.competition_templates?.discipline || ''
  const level      = competition?.competition_templates?.level      || ''
  const category   = competition?.competition_templates?.category   || ''

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontWeight: 800, fontSize: '1.3rem', color: NAVY }}>
          {competition?.name || 'Competition Admin'}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.3rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', background: '#eff6ff', color: NAVY, padding: '0.15rem 0.5rem', borderRadius: 20, fontWeight: 600 }}>
            {discipline}
          </span>
          <span style={{ fontSize: '0.78rem', background: '#f0fdf4', color: '#15803d', padding: '0.15rem 0.5rem', borderRadius: 20, fontWeight: 600 }}>
            {level}
          </span>
          {category && (
            <span style={{ fontSize: '0.78rem', background: '#faf5ff', color: '#7c3aed', padding: '0.15rem 0.5rem', borderRadius: 20, fontWeight: 600 }}>
              {category}
            </span>
          )}
          <span style={{ fontSize: '0.78rem', color: GREY }}>
            {competition?.venue} · {competition?.start_date}
            {competition?.end_date !== competition?.start_date ? ` – ${competition?.end_date}` : ''}
          </span>
          {catchesLoading && <span style={{ fontSize: '0.75rem', color: GREY, fontStyle: 'italic' }}>Updating…</span>}
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1.25rem', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
        {visibleTabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              flex: 1, minWidth: 80, padding: '0.65rem 0.5rem', border: 'none',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
              background: activeTab === t.id ? NAVY : 'white',
              color: activeTab === t.id ? 'white' : '#374151',
              borderRight: '1px solid #e5e7eb',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ───────────────────────────────────────────────── */}
      {activeTab === 'setup' && (
        <CompetitionAdminSetup
          competition={competition}
          config={config}
          days={days}
          isAdmin={isAdmin}
          onReload={reloadAll}
        />
      )}

      {activeTab === 'participants' && (
        <CompetitionAdminParticipants
          competition={competition}
          config={config}
          isAdmin={isAdmin}
          isScorer={isScorer}
        />
      )}

      {activeTab === 'scoring' && (
        <CompetitionAdminScoring
          competition={competition}
          config={config}
          catches={catches}
          participants={participants}
          days={days}
          isAdmin={isAdmin}
          isScorer={isScorer}
          onCatchUpdate={reloadCatches}
          initialFilter={scoringFilter}
        />
      )}

      {activeTab === 'scoreboard' && (
        <CompetitionAdminScoreboard
          competition={competition}
          config={config}
          catches={catches}
          participants={participants}
          teams={teams}
          isAdmin={isAdmin}
          onSelectAngler={goToAnglerScoring}
        />
      )}

      {activeTab === 'reports' && (
        <CompetitionAdminReports
          competition={competition}
          config={config}
          catches={catches}
          participants={participants}
          isAdmin={isAdmin}
        />
      )}

      {activeTab === 'roles' && (
        <RolesTab
          competition={competition}
          competitionId={competitionId}
          isAdmin={isAdmin}
          isPlatformAdmin={isPlatformAdmin}
          grantRole={grantRole}
          revokeRole={revokeRole}
          onReload={recheckRoles}
        />
      )}
    </div>
  )
}
