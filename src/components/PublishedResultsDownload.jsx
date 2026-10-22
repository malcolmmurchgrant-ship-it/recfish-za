// ─── PublishedResultsDownload.jsx ────────────────────────────────────────────
// "Download official results" on the public Scoreboard. Shown ONLY once the
// organisers have pressed Publish Final Results, and only to logged-in users
// (anyone registered - no competition role needed). Live, provisional
// results stay with the competition's own team (Read Only and above, on the
// admin Reports tab) until then.
//
// The files are made by exactly the same code as the admin Reports tab
// (CompetitionAdminReports in downloadsOnly mode), from the same data, so a
// file downloaded here is identical to the organisers' own. The data is only
// loaded when someone opens the panel.

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useCompetitionConfig } from './CompetitionAdmin/hooks/useCompetitionConfig'
import { useCompetitionCatches } from './CompetitionAdmin/hooks/useCompetitionCatches'
import { isPredatorCatch } from './CompetitionAdmin/utils/catchLoggerScoring'
import { applyDailyBiggestTunaExclusion } from '../utils/dailyBiggestTunaExclusion'
import CompetitionAdminReports from './CompetitionAdmin/CompetitionAdminReports'

const NAVY = '#1e3a8a'
const GREY = '#6b7280'

export default function PublishedResultsDownload({ competitionId }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  if (!user) {
    return (
      <div data-testid="pub-dl-login" style={{ background: 'white', borderRadius: 8, padding: '0.7rem 1rem', marginBottom: '0.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', fontSize: '0.85rem', color: GREY }}>
        📥 <a href="/login" style={{ color: NAVY, fontWeight: 600 }}>Log in</a> to download the official results (PDF, Excel or CSV).
      </div>
    )
  }

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <button data-testid="pub-dl-open" onClick={() => setOpen(o => !o)}
        style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}>
        📥 {open ? 'Hide downloads' : 'Download official results'}
      </button>
      {open && <Downloads competitionId={competitionId} />}
    </div>
  )
}

function Downloads({ competitionId }) {
  const { competition, config, loading: cfgLoading, error: cfgError } = useCompetitionConfig(competitionId)
  const { catches, loading: catchesLoading } = useCompetitionCatches(competitionId)
  const [meta, setMeta] = useState(null)

  // Loaded exactly as the admin page loads them, so the reports match.
  useEffect(() => {
    let live = true
    Promise.all([
      supabase.from('competition_participants').select('*, competition_teams(id, team_name, province, team_type)').eq('competition_id', competitionId).order('full_name'),
      supabase.from('competition_days').select('*').eq('competition_id', competitionId).order('day_number'),
      supabase.from('competition_teams').select('*').eq('competition_id', competitionId).order('team_name'),
      supabase.from('competition_boats').select('*').eq('competition_id', competitionId).order('boat_name'),
    ]).then(([p, d, t, b]) => {
      if (!live) return
      setMeta({ participants: p.data || [], days: d.data || [], teams: t.data || [], boats: b.data || [] })
    })
    return () => { live = false }
  }, [competitionId])

  // Same as the admin Reports tab: predator rows out, and the CBSC
  // Invitational's Daily Biggest Tuna fish scored 0 towards totals.
  const standingsCatches = useMemo(() => applyDailyBiggestTunaExclusion(
    catches.filter(c => !isPredatorCatch(c)),
    { participants: meta?.participants, teams: meta?.teams, boats: meta?.boats, days: meta?.days,
      scoringConfig: config?.scoring, speciesConfig: config?.species },
  ), [catches, meta, config])

  if (cfgError) return <div style={{ marginTop: '0.5rem', color: '#dc2626', fontSize: '0.85rem' }}>Could not load the results: {cfgError}</div>
  if (cfgLoading || catchesLoading || !meta) return <div style={{ marginTop: '0.5rem', color: GREY, fontSize: '0.85rem' }}>Preparing the results…</div>
  if (!competition?.results_published_at) return null

  return (
    <div style={{ marginTop: '0.6rem' }}>
      <CompetitionAdminReports
        downloadsOnly
        competition={competition}
        config={config}
        catches={standingsCatches}
        participants={meta.participants}
        teams={meta.teams}
        days={meta.days}
        boats={meta.boats}
        isAdmin={false}
      />
    </div>
  )
}
