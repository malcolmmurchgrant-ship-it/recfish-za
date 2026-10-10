// ─── CompetitionAdmin/index.jsx ───────────────────────────────────────────────
// Universal Competition Admin — entry point.
// Loads competition, config, catches, participants, days and routes to tabs.
//
// Usage:
//   import CompetitionAdmin from './components/CompetitionAdmin'
//   <CompetitionAdmin competitionId="uuid-here" />
//
// Replaces: GamefishAdmin.jsx, AllCoastalsAdmin.jsx, and all future per-competition admins.

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useCompetitionConfig } from './hooks/useCompetitionConfig'
import { useCompetitionRoles  } from './hooks/useCompetitionRoles'
import { useCompetitionCatches} from './hooks/useCompetitionCatches'
import { isPredatorCatch } from './utils/catchLoggerScoring'

import CompetitionAdminSetup        from './CompetitionAdminSetup'
import CompetitionAdminParticipants from './CompetitionAdminParticipants'
import CompetitionAdminScoring      from './CompetitionAdminScoring'
import CompetitionAdminScoreboard   from './CompetitionAdminScoreboard'
import CompetitionAdminReports      from './CompetitionAdminReports'
import RolesTab                     from './CompetitionAdminRoles'
import CompetitionAdminVideoReview  from './CompetitionAdminVideoReview'

const NAVY = '#1e3a8a'
const GREY = '#6b7280'
const RED  = '#dc2626'

const TABS = [
  { id: 'setup',        label: '⚙️ Setup',        minRole: 'admin'  },
  { id: 'participants', label: '👥 Participants',  minRole: 'scorer' },
  { id: 'scoring',      label: '📋 Scoring',       minRole: 'scorer' },
  { id: 'scoreboard',   label: '🏆 Scoreboard',   minRole: 'viewer' },
  { id: 'video-review', label: '🎥 Video Review', minRole: 'video_verifier' },
  { id: 'reports',      label: '📊 Reports',       minRole: 'admin'  },
  { id: 'roles',        label: '🔐 Roles',         minRole: 'admin'  },
]

export default function CompetitionAdmin({ competitionId }) {
  const VALID_TABS = ['setup', 'participants', 'scoring', 'scoreboard', 'video-review', 'reports', 'roles']
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab,     setActiveTab]     = useState(VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'scoring')
  const [participants,  setParticipants]  = useState([])
  const [days,          setDays]          = useState([])
  const [teams,         setTeams]         = useState([])
  const [boats,         setBoats]         = useState([])
  const [loadingMeta,   setLoadingMeta]   = useState(true)

  // ── Core hooks ───────────────────────────────────────────────────────────
  const {
    competition, config, loading: configLoading, error: configError, reload: reloadConfig,
  } = useCompetitionConfig(competitionId)

  const {
    isPlatformAdmin, isAdmin, isScorer, isVideoVerifier, canView, loading: rolesLoading,
    grantRole, revokeRole, recheckRoles,
  } = useCompetitionRoles(competitionId)

  const {
    catches, loading: catchesLoading, stats, reload: reloadCatches,
    updateCatch, rejectCatch, verifyCatch,
  } = useCompetitionCatches(competitionId)

  // Fish taken or mutilated by predators (SADSAA rule 8.2.6) are recorded for
  // adjudication and stay visible on the Scoring tab, but they are not catches:
  // the Scoreboard and Reports never see them, so no fish count, tie-break or
  // report can include one. Memoised so the list keeps a stable identity.
  const standingsCatches = useMemo(() => catches.filter(c => !isPredatorCatch(c)), [catches])

  // ── Load participants, days, teams ────────────────────────────────────────
  useEffect(() => {
    if (!competitionId) return
    loadMeta()
  }, [competitionId])

  async function loadMeta() {
    setLoadingMeta(true)
    const [{ data: parts }, { data: ds }, { data: tms }, { data: bts }] = await Promise.all([
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
      supabase.from('competition_boats')
        .select('*')
        .eq('competition_id', competitionId)
        .order('boat_name'),
    ])
    setParticipants(parts || [])
    setDays(ds || [])
    setTeams(tms || [])
    setBoats(bts || [])
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

  // A Video Verifier holds none of the other roles, so they must be let in
  // explicitly - otherwise they could never reach their own Video Review tab.
  if (!canView && !isScorer && !isAdmin && !isVideoVerifier) {
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
    // Deliberately NOT combined with isAdmin - Tournament Director must
    // not get video review authority automatically, per the approved
    // proposal. isVideoVerifier already covers platform admins on its own.
    if (t.minRole === 'video_verifier') return isVideoVerifier
    return true
  })

  // The tab actually shown: the chosen one if this person may see it,
  // otherwise their first permitted tab (e.g. Video Review for a Video
  // Verifier). Content is rendered from this, never from activeTab
  // directly, so a tab someone isn't allowed - whether the default
  // 'scoring' or one typed into the address bar (?tab=...) - is never shown.
  const shownTab = visibleTabs.some(t => t.id === activeTab) ? activeTab : (visibleTabs[0]?.id || null)

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
              background: shownTab === t.id ? NAVY : 'white',
              color: shownTab === t.id ? 'white' : '#374151',
              borderRight: '1px solid #e5e7eb',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ───────────────────────────────────────────────── */}
      {shownTab === 'setup' && (
        <CompetitionAdminSetup
          competition={competition}
          config={config}
          days={days}
          boats={boats}
          isAdmin={isAdmin}
          onReload={reloadAll}
        />
      )}

      {shownTab === 'participants' && (
        <CompetitionAdminParticipants
          competition={competition}
          config={config}
          days={days}
          isAdmin={isAdmin}
          isScorer={isScorer}
        />
      )}

      {shownTab === 'scoring' && (
        <CompetitionAdminScoring
          competition={competition}
          config={config}
          catches={catches}
          participants={participants}
          days={days}
          boats={boats}
          isAdmin={isAdmin}
          isScorer={isScorer}
          onCatchUpdate={reloadCatches}
        />
      )}

      {shownTab === 'scoreboard' && (
        <CompetitionAdminScoreboard
          competition={competition}
          config={config}
          catches={standingsCatches}
          participants={participants}
          teams={teams}
          days={days}
          boats={boats}
          isAdmin={isAdmin}
        />
      )}

      {shownTab === 'video-review' && (
        <CompetitionAdminVideoReview
          competitionId={competitionId}
          isVideoVerifier={isVideoVerifier}
          onReload={reloadCatches}
        />
      )}

      {shownTab === 'reports' && (
        <CompetitionAdminReports
          competition={competition}
          config={config}
          catches={standingsCatches}
          participants={participants}
          teams={teams}
          days={days}
          boats={boats}
          isAdmin={isAdmin}
        />
      )}

      {shownTab === 'roles' && (
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
