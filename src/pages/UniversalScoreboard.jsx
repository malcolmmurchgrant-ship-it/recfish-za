// ─── UniversalScoreboard.jsx ─────────────────────────────────────────────────
// Universal scoreboard — works for all SADSAA competition types.
// Reads scoring method from competition_templates.scoring_config.
// Can be used standalone (public URL) or embedded in CompetitionAdmin tab 4.
//
// Usage (standalone):  <UniversalScoreboard competitionId="uuid" />
// Usage (embedded):    <UniversalScoreboard competitionId="uuid" embedded={true} isAdmin={true} />

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { computeStandings, calcPoints, getFishingHours, getTotalFishingHours, getDayNumber, calcMultipliedPoints } from '../utils/standings'
import ScoreboardTV from '../components/ScoreboardTV'
import { getSponsorLogos } from '../utils/sponsorLogos'
import PublishedResultsDownload from '../components/PublishedResultsDownload'
import { divisionLabel } from '../utils/anglerDivisions'
import { applyDailyBiggestTunaExclusion } from '../utils/dailyBiggestTunaExclusion'
import WeighInReports from '../components/WeighInReports'
import { tracksWeighInReports, buildReportStatus, localToday } from '../utils/noCatch'

const NAVY  = '#1e3a8a'
const GOLD  = '#d97706'
const GREEN = '#16a34a'
const GREY  = '#6b7280'
const RED   = '#dc2626'

const S = {
  card:   { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '1rem' },
  tab:    (a) => ({ flex: 1, padding: '0.6rem 0.4rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', background: a ? NAVY : 'white', color: a ? 'white' : '#374151', whiteSpace: 'nowrap' }),
  medal:  (p) => p === 1 ? { background: '#fef9c3', border: '2px solid #ca8a04' } : p === 2 ? { background: '#f3f4f6', border: '2px solid #9ca3af' } : p === 3 ? { background: '#fff7ed', border: '2px solid #c2410c' } : { background: 'white', border: '1px solid #e5e7eb' },
  icon:   (p) => p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : `${p}.`,
  badge:  (col) => ({ background: col, color: 'white', padding: '0.15rem 0.55rem', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, display: 'inline-block' }),
  stat:   (col) => ({ textAlign: 'center', minWidth: 60 }),
}

// Scoring helpers and the standings calculation live in src/utils/standings.js
// (shared with the Nomination Pack, so both rank anglers identically).

// ── Main component ────────────────────────────────────────────────────────────
export default function UniversalScoreboard({ competitionId, embedded = false, isAdmin = false }) {
  const [competition,  setCompetition]  = useState(null)
  const [template,     setTemplate]     = useState(null)
  const [catches,      setCatches]      = useState([])
  const [participants, setParticipants] = useState([])
  const [teams,        setTeams]        = useState([])
  const [boats,        setBoats]        = useState([])
  const [days,         setDays]         = useState([])
  const [loading,      setLoading]      = useState(true)
  const [lastRefresh,  setLastRefresh]  = useState(null)
  const [activeTab,    setActiveTab]    = useState('team')
  const [dayFilter,    setDayFilter]    = useState('all')

  // Big-screen TV display (ScoreboardTV): every angler on one screen, no
  // scrolling. Opened with the "📺 TV display" button or a ?tv=1 link, so a
  // clubhouse TV can be bookmarked straight to it. Never in embedded use.
  const urlParams = (() => { try { return new URLSearchParams(window.location.search) } catch { return new URLSearchParams() } })()
  const [tvMode, setTvMode] = useState(!embedded && urlParams.get('tv') === '1')
  const [tvInitialView] = useState(urlParams.get('view') || 'angler')
  function openTv() {
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('tv', '1')
      window.history.replaceState(null, '', url.toString())
    } catch { /* address bar update is a convenience only */ }
    setTvMode(true)
  }
  function exitTv() {
    try {
      if (document.fullscreenElement) document.exitFullscreen()
      const url = new URL(window.location.href)
      url.searchParams.delete('tv'); url.searchParams.delete('view')
      window.history.replaceState(null, '', url.toString())
    } catch { /* ignore */ }
    setTvMode(false)
  }

  const load = useCallback(async () => {
    if (!competitionId) return
    setLoading(true)
    const [
      { data: compData },
      { data: catchData },
      { data: partData },
      { data: teamData },
      { data: boatData },
      { data: dayData },
    ] = await Promise.all([
      supabase.from('competitions')
        .select('*, competition_templates(discipline, level, category, scoring_config, team_config, session_structure, species_config)')
        .eq('id', competitionId).single(),
      supabase.from('competition_catches')
        .select('*, competition_teams(id, team_name, province), competition_days(id, day_number, date)')
        .eq('competition_id', competitionId)
        .order('fishing_date')
        // PostgREST silently caps at 1000 rows with no error when exceeded.
        // A competition with one row per individual fish can easily exceed this
        // (All Coastal IP 2026 has 2,196 rows). Without this, the scoreboard
        // silently computes from a truncated dataset and zeros out many anglers.
        // The dashboard Max Rows setting was raised to 5000 (confirmed 2026-06-27)
        // so .range(0, 4999) is safe; 9999 gives headroom above that ceiling too.
        .range(0, 9999),
      supabase.from('competition_participants')
        .select('*, competition_teams(id, team_name, province)')
        .eq('competition_id', competitionId),
      supabase.from('competition_teams')
        .select('*').eq('competition_id', competitionId).order('team_name'),
      supabase.from('competition_boats')
        .select('*').eq('competition_id', competitionId),
      supabase.from('competition_days')
        .select('*').eq('competition_id', competitionId).order('day_number'),
    ])
    setCompetition(compData)
    setTemplate(compData?.competition_templates)
    setCatches(catchData || [])
    setParticipants(partData || [])
    setTeams(teamData || [])
    setBoats(boatData || [])
    setDays(dayData || [])
    setLastRefresh(new Date())
    setLoading(false)
  }, [competitionId])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 60 seconds when not embedded
  useEffect(() => {
    if (embedded) return
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [load, embedded])

  // CBSC Invitational: each day's Daily Biggest Tuna scores 0 towards totals
  // here, the same as on the Prizegiving tab (TD's request, 22 Oct 2026).
  // Other competitions are returned unchanged.
  const standingCatches = applyDailyBiggestTunaExclusion(catches, {
    participants, teams, boats, days,
    scoringConfig: template?.scoring_config, speciesConfig: template?.species_config,
  })
  const dailyBiggestCount = standingCatches.filter(c => c.daily_biggest_excluded).length

  // Weigh-in reporting (live competitions): tells "No catch reported" apart
  // from "not reported yet" instead of a bare 0 / NC. Finished competitions
  // keep their original display. See utils/noCatch.js.
  const trackReports = tracksWeighInReports(competition, catches)
  const reportStatus = trackReports ? buildReportStatus(catches, participants, days) : null
  const today = localToday()

  const { scoringConfig, teamConfig, discipline, isPublished, isSplitBoat, teamMap, anglerMap, boatMap, dayMap, dateToDay, fishingDays, totalHours, cancelledDays, scoringCatches, filteredCatches, useMultiplier, teamPercentageMap, teamParticipantIds, userIdToParticipantId, teamStandings, anglerPercentageMap, anglerStandings } =
    computeStandings({ competition, template, catches: standingCatches, participants, teams, boats, days, dayFilter })

  // ── Skipper standings ─────────────────────────────────────────────────────
  // Match catches directly by their own boat_id — every catch always
  // carries the correct boat_id regardless of competition format. The
  // previous approach matched via competition_teams.boat_id, which assumes
  // a FIXED team-to-boat relationship — true for 'full_boat' format
  // competitions (Gamefish, Tuna: a team stays on one boat all event), but
  // wrong for 'split_boat' format ones (e.g. Junior Bottomfish Nationals,
  // where teams rotate across different boats each day per the daily boat
  // draw). competition_teams.boat_id is never populated at all for
  // split-boat competitions — there's no single fixed boat to assign a
  // rotating team to — so every skipper's stats silently zeroed out for
  // this entire competition type until this fix.
  // (isSplitBoat itself is now defined earlier, in Derived config, so Team
  // and Angler standings above can use it too — not redeclared here.)
  // Resolves a catch's boat the same defensive way as everything else in
  // this codebase: use the catch's own boat_id where it's actually set
  // (true for live-scored, split-boat catches — the catch logger writes
  // it directly). Full-boat historical imports (Gamefish, both Billfish
  // competitions) never got a per-catch boat_id written at all — for
  // those, fall back to the participant's team's fixed boat_id
  // (competition_teams.boat_id), which is what this format actually
  // guarantees. Confirmed via SADSAA Gamefish Nationals 2026: 0 of 60
  // catches had boat_id set, while every team correctly had its own
  // fixed boat_id.
  const boatIdByTeamId = Object.fromEntries(teams.filter(t => t.boat_id).map(t => [t.id, t.boat_id]))
  const teamIdByParticipantId = Object.fromEntries(participants.map(p => [p.id, p.team_id]))
  function resolveBoatId(c) {
    if (c.boat_id) return c.boat_id
    const participantId = (c.angler_id && userIdToParticipantId[c.angler_id]) || c.participant_id
    const teamId = participantId && teamIdByParticipantId[participantId]
    return teamId ? boatIdByTeamId[teamId] : null
  }

  const skipperStandings = boats.map(b => {
    const tc = filteredCatches.filter(c => resolveBoatId(c) === b.id)
    // Points: calcMultipliedPoints(tc, ...) on this boat's pooled catches
    // for the day — same official formula as Team Standings (see the note
    // there), applied per boat instead of per team. resolveBoatId() above
    // already handles a mid-tournament boat/skipper swap correctly (catch's
    // own boat_id first, falling back to the team's usual boat only when
    // it's genuinely not set) — confirmed via SADSAA Gamefish Nationals
    // 2026: Northern Gauteng's boat changed from WALAALAHA (Riaan Odendaal)
    // to Captain Fine (Michael Fourie) for Day 4 only; once that day's
    // catches carry Captain Fine's boat_id directly, this pooled
    // calculation correctly splits credit exactly the way the official
    // Skippers Ranking sheet does — no special-casing needed for
    // full-boat vs split-boat, the resolution chain already covers both.
    const pts = useMultiplier
      ? calcMultipliedPoints(tc, scoringConfig, dateToDay)
      : tc.reduce((s, c) => s + calcPoints(c, scoringConfig), 0)
    const kg   = tc.reduce((s, c) => s + parseFloat(c.weight_kg || 0), 0)
    return {
      id: b.id,
      skipper: b.skipper_name || '',
      boat: b.boat_name || '',
      // A boat's crew changes team by the day in split-boat formats, so
      // there's no single accurate team name to show at the boat level —
      // leave it blank there rather than showing an arbitrary/misleading
      // one. Full-boat formats keep the original behavior (a team really
      // is fixed to one boat all event, so this remains meaningful).
      team: isSplitBoat ? '' : (teams.find(t => t.boat_id === b.id)?.team_name || ''),
      fish: tc.length,
      kg: Math.round(kg * 1000) / 1000,
      points: Math.round(pts * 100) / 100,
      kghr: totalHours > 0 ? Math.round(kg / totalHours * 100) / 100 : 0,
      fhr:  totalHours > 0 ? Math.round(tc.length / totalHours * 100) / 100 : 0,
    }
  }).sort((a, b) => b.points - a.points)

  // ── Top catches ───────────────────────────────────────────────────────────
  const topCatches = [...filteredCatches]
    .map(c => ({
      ...c,
      anglerName: anglerMap[c.angler_id || c.participant_id]?.full_name || '',
      teamName:   c.competition_teams?.team_name || teamMap[c.team_id]?.team_name || '',
      dayNum:     c.competition_days?.day_number || dateToDay[c.fishing_date] || '?',
      // The Daily Biggest Tuna still shows here with its real points (it is
      // still one of the top fish), marked as left out of the totals.
      pts:        c.daily_biggest_excluded ? parseFloat(c.original_points || 0) : calcPoints(c, scoringConfig),
    }))
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 10)

  // ── Stats ─────────────────────────────────────────────────────────────────
  const speciesCounts = filteredCatches.reduce((acc, c) => {
    if (!c.species_name) return acc
    acc[c.species_name] = (acc[c.species_name] || 0) + 1
    return acc
  }, {})
  const topSpecies = Object.entries(speciesCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const totalKg    = filteredCatches.reduce((s, c) => s + parseFloat(c.weight_kg || 0), 0)

  // ── Tabs available ────────────────────────────────────────────────────────
  const hasTeams    = teamConfig?.has_teams || teams.length > 0
  const hasBoats    = teamConfig?.has_boats || boats.length > 0
  const hasSkipper  = scoringConfig?.skipper_competition || hasBoats
  const hasCpue     = totalHours > 0
  // Catch-release competitions (both Billfish formats) never weigh a fish —
  // it's released, not brought to the scale — so kg/hr is always 0 and
  // meaningless there; fish/hr is the metric that actually reflects effort.
  // Confirmed via SADSAA Light Tackle Billfish Nationals 2026.
  const catchReleaseFormat = !!competition?.catch_release_enabled

  const TABS = [
    hasTeams          && { id: 'team',    label: '🏆 Teams'     },
                         { id: 'angler',  label: '🎣 Anglers'   },
    hasSkipper        && { id: 'skipper', label: '⚓ Skippers'  },
                         { id: 'top10',   label: '🐟 Top Catches'},
                         { id: 'daily',   label: '📅 Daily'     },
    hasCpue           && { id: 'cpue',    label: '📊 CPUE'      },
                         { id: 'stats',   label: '📈 Stats'     },
  ].filter(Boolean)

  // ── Stat pill ─────────────────────────────────────────────────────────────
  function StatPill({ label, val, col = NAVY }) {
    return (
      <div style={S.stat()}>
        <div style={{ fontSize: '0.68rem', color: GREY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: col }}>{val}</div>
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading && !competition) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: GREY, fontFamily: 'system-ui' }}>
        Loading scoreboard…
      </div>
    )
  }

  const name = competition?.name || 'Scoreboard'
  const sponsorLogos = getSponsorLogos(competition)

  if (tvMode) {
    return (
      <ScoreboardTV
        competitionName={name}
        venue={competition?.venue}
        days={days}
        dayFilter={dayFilter}
        onDayFilter={setDayFilter}
        lastRefresh={lastRefresh}
        anglers={anglerStandings}
        teams={teamStandings}
        boats={skipperStandings}
        hasTeams={!!hasTeams && teamStandings.length > 0}
        hasBoats={!!hasSkipper && skipperStandings.length > 0}
        isSplitBoat={isSplitBoat}
        catchReleaseFormat={catchReleaseFormat}
        initialView={tvInitialView}
        onExit={exitTv}
        sponsorLogos={sponsorLogos}
      />
    )
  }

  return (
    <div style={{ maxWidth: embedded ? '100%' : 960, margin: '0 auto', padding: embedded ? 0 : '1rem', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      {!embedded && (
        <div style={{ ...S.card, background: NAVY, color: 'white', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap-reverse', justifyContent: 'space-between', alignItems: 'flex-end', gap: '0.75rem' }}>
          <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '1.3rem' }}>{name}</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: 4 }}>
            {competition?.venue} · {competition?.start_date}
            {competition?.end_date !== competition?.start_date ? ` – ${competition?.end_date}` : ''}
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <StatPill label="Teams"      val={teams.length}                    col="#93c5fd" />
            <StatPill label="Anglers"    val={participants.length}             col="#93c5fd" />
            <StatPill label="Catches"    val={filteredCatches.length}          col="#86efac" />
            <StatPill label="Total Kg"   val={totalKg.toFixed(1)}              col={GOLD}    />
            {totalHours > 0 && <StatPill label="Hours"  val={totalHours.toFixed(1)} col="#c4b5fd" />}
          </div>
          </div>
          {/* Sponsor logos (Reports tab → Sponsor / Branding), on white tiles
              so dark logos stay visible on the navy header. Beside the title
              on wide screens; above it on a phone (wrap-reverse). */}
          {sponsorLogos.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: '0 0 auto' }}>
              {sponsorLogos.map((l, i) => (
                <div key={i} style={{ background: 'white', borderRadius: 6, padding: '0.3rem 0.5rem', height: 56, boxSizing: 'border-box', display: 'flex', alignItems: 'center' }}>
                  <img src={l.dataUrl} alt={l.name || 'Sponsor'} style={{ height: '100%', maxWidth: 140, objectFit: 'contain', display: 'block' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Cancelled days banner ─────────────────────────────────────────── */}
      {cancelledDays.length > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, padding: '0.5rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.82rem', color: '#92400e' }}>
          ⚠ Day{cancelledDays.length > 1 ? 's' : ''} cancelled: {cancelledDays.map(d => `Day ${d.day_number}${d.cancellation_reason ? ` (${d.cancellation_reason})` : ''}`).join(', ')}
        </div>
      )}

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {days.length > 1 && (
          <select
            value={dayFilter}
            onChange={e => setDayFilter(e.target.value)}
            style={{ padding: '0.45rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem', background: 'white' }}>
            <option value="all">All Days</option>
            {days.map(d => (
              <option key={d.id} value={d.day_number}>
                Day {d.day_number}{d.date ? ` — ${d.date}` : ''}{d.cancelled ? ' (Cancelled)' : ''}
              </option>
            ))}
          </select>
        )}

        {!embedded && (
          <button onClick={openTv} title="Full-screen display for a TV: every angler on one screen"
            style={{ marginLeft: 'auto', background: NAVY, color: 'white', border: 'none', borderRadius: 6, padding: '0.4rem 0.85rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            📺 TV display
          </button>
        )}
        <button onClick={load} style={{ marginLeft: embedded ? 'auto' : 0, background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.78rem', color: GREY }}>
          🔄 {lastRefresh ? lastRefresh.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : 'Refresh'}
        </button>
      </div>

      {/* ── Official results download (published results, logged-in users) ── */}
      {isPublished && !embedded && <PublishedResultsDownload competitionId={competitionId} />}

      {dailyBiggestCount > 0 && (
        <div style={{ fontSize: '0.8rem', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.5rem 0.75rem', marginBottom: '0.75rem' }}>
          🏆 Each day's Daily Biggest Tuna wins its prize, so that fish's points are left out of the totals below, as in the prize standings.
        </div>
      )}

      {trackReports && !embedded && (
        <WeighInReports catches={catches} participants={participants} teams={teams} boats={boats} days={days} />
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={S.tab(activeTab === t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '1rem', color: GREY, fontSize: '0.85rem' }}>Refreshing…</div>
      )}

      {/* ── TEAM STANDINGS ───────────────────────────────────────────────── */}
      {activeTab === 'team' && (
        <div>
          {teamStandings.length === 0 && (
            <div style={{ ...S.card, color: GREY, fontStyle: 'italic', textAlign: 'center' }}>No team data yet.</div>
          )}
          {teamStandings.map((t, i) => {
            const pos = i + 1
            // Match anglers to THIS team by team id, not by name: provinces can
            // field several teams with the same team_name (e.g. Border Red and
            // Border White), and a name match listed both teams' anglers here.
            const teamAnglers = anglerStandings.filter(a => a.teamId === t.id)
            return (
              <div key={t.id} style={{ ...S.medal(pos), borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, minWidth: 28, fontSize: '1.1rem' }}>{S.icon(pos)}</span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{t.displayName}</div>
                    <div style={{ fontSize: '0.78rem', color: GREY }}>
                      {t.boat && `🚤 ${t.boat}`}{t.skipper && ` · ${t.skipper}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {isSplitBoat && <StatPill label="Team %" val={`${t.percentage.toFixed(2)}%`} col={NAVY} />}
                    <StatPill label="Points" val={t.points.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} col={isSplitBoat ? GREY : NAVY} />
                    <StatPill label="Fish"   val={t.fish}   col={GREEN} />
                    <StatPill label="Kg"     val={t.kg.toFixed(2)} col={GOLD} />
                    {hasCpue && (
                      catchReleaseFormat
                        ? <StatPill label="fish/hr" val={t.fhr.toFixed(2)} col={GREEN} />
                        : <StatPill label="kg/hr" val={t.kghr.toFixed(2)} col="#7c3aed" />
                    )}
                  </div>
                </div>
                {/* Angler breakdown */}
                {teamAnglers.length > 0 && (
                  <div style={{ marginTop: '0.5rem', paddingLeft: '2.25rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {teamAnglers.sort((a, b) => b.points - a.points).map(a => (
                      <span key={a.id} style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#374151', padding: '0.15rem 0.5rem', borderRadius: 4 }}>
                        {a.name}: {a.points.toFixed(2)}pts ({a.fish}🐟)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── ANGLER STANDINGS ─────────────────────────────────────────────── */}
      {activeTab === 'angler' && (
        <div>
          {anglerStandings.length === 0 && (
            <div style={{ ...S.card, color: GREY, fontStyle: 'italic', textAlign: 'center' }}>No catches recorded yet.</div>
          )}
          {anglerStandings.map((a, i) => {
            const pos = i + 1
            return (
              <div key={a.id} style={{ ...S.medal(pos), borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, minWidth: 28 }}>{S.icon(pos)}</span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 700 }}>
                      {a.name}
                      {a.number && <span style={{ color: GREY, fontWeight: 400, fontSize: '0.82rem' }}> #{a.number}</span>}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: GREY }}>
                      {a.team}
                      {a.lineClass && ` · ${a.lineClass}kg LC`}
                      {divisionLabel(a) && ` · ${divisionLabel(a)}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {isSplitBoat && <StatPill label="Angler %" val={`${a.percentage.toFixed(2)}%`} col={NAVY} />}
                    <StatPill label="Points"  val={a.points.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} col={isSplitBoat ? GREY : NAVY}  />
                    <StatPill label="Fish"    val={a.fish}              col={GREEN} />
                    <StatPill label="Kg"      val={a.kg.toFixed(2)}     col={GOLD}  />
                    <StatPill label="Species" val={a.speciesCount}       col={GREY}  />
                  </div>
                </div>
                {/* Per-day breakdown */}
                {fishingDays.length > 1 && (
                  <div style={{ marginTop: '0.4rem', paddingLeft: '2.25rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {fishingDays.map(d => {
                      const dc   = a.byDay[d.day_number] || []
                      const dRaw = dc.reduce((s, c) => s + calcPoints(c, scoringConfig), 0)
                      const dSp  = new Set(dc.map(c => c.species_name).filter(Boolean)).size
                      const dMult= Math.max(1, dSp - 1)
                      const dPts = useMultiplier ? dRaw * dMult : dRaw
                      const dKg  = dc.reduce((s, c) => s + parseFloat(c.weight_kg || 0), 0)
                      // Live competitions: say whether a day with no fish was
                      // reported as No Catch, or not reported yet.
                      const rep  = reportStatus && dc.length === 0 ? reportStatus(a.id, d.id) : null
                      const future = d.date && String(d.date).slice(0, 10) > today
                      const empty = !reportStatus ? 'NC'
                        : future ? '—'
                        : rep === 'no_catch' ? '🚫 No catch'
                        : rep === 'weighed' ? '0 pts'
                        : '⏳ Not reported'
                      return (
                        <span key={d.id} style={{ fontSize: '0.73rem', background: dc.length > 0 ? '#eff6ff' : '#f9fafb', color: dc.length > 0 ? NAVY : GREY, padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                          D{d.day_number}: {dc.length > 0
                            ? useMultiplier
                              ? `${dc.length}🐟 ${dKg.toFixed(1)}kg ${dRaw.toFixed(1)}×${dMult}=${dPts.toFixed(0)}pts`
                              : `${dc.length}🐟 ${dKg.toFixed(1)}kg ${dPts.toFixed(0)}pts`
                            : empty}
                        </span>
                      )
                    })}
                  </div>
                )}
                {/* Best fish */}
                {a.bestFish && (
                  <div style={{ marginTop: '0.3rem', paddingLeft: '2.25rem', fontSize: '0.75rem', color: GREY }}>
                    Best: {a.bestFish.species_name} {a.bestFish.weight_kg ? `${parseFloat(a.bestFish.weight_kg).toFixed(2)}kg` : '(released)'}
                    {a.bestFish.line_class_kg && ` · ${a.bestFish.line_class_kg}kg LC`}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── SKIPPER STANDINGS ─────────────────────────────────────────────── */}
      {activeTab === 'skipper' && (
        <div>
          {skipperStandings.length === 0 ? (
            <div style={{ ...S.card, color: GREY, fontStyle: 'italic', textAlign: 'center' }}>No boat data recorded.</div>
          ) : skipperStandings.map((s, i) => {
            const pos = i + 1
            return (
              <div key={s.id} style={{ ...S.medal(pos), borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, minWidth: 28 }}>{S.icon(pos)}</span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 700 }}>{s.skipper || 'Unknown Skipper'}</div>
                    <div style={{ fontSize: '0.78rem', color: GREY }}>🚤 {s.boat}{s.team && ` · ${s.team}`}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <StatPill label="Points"  val={s.points.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} col={NAVY}  />
                    {catchReleaseFormat ? null : <StatPill label="kg/hr" val={s.kghr.toFixed(2)} col={GOLD} />}
                    <StatPill label="fish/hr" val={s.fhr.toFixed(2)}  col={GREEN} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── TOP CATCHES ──────────────────────────────────────────────────── */}
      {activeTab === 'top10' && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>Top 10 Individual Catches</div>
          {topCatches.length === 0 ? (
            <div style={{ color: GREY, fontStyle: 'italic' }}>No catches recorded yet.</div>
          ) : topCatches.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: 8, background: i === 0 ? '#fef9c3' : i < 3 ? '#f9fafb' : 'white', border: '1px solid #e5e7eb', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, minWidth: 28, color: GREY }}>{i + 1}.</span>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontWeight: 700 }}>{c.anglerName || '—'}</div>
                <div style={{ fontSize: '0.78rem', color: GREY }}>{c.teamName} · Day {c.dayNum}</div>
                {c.daily_biggest_excluded && <div style={{ fontSize: '0.72rem', color: GOLD, fontWeight: 700 }}>🏆 Daily Biggest Tuna — points not in totals</div>}
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.68rem', color: GREY, textTransform: 'uppercase' }}>Species</div>
                  <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{c.species_name}</div>
                </div>
                <StatPill label="Weight" val={c.weight_kg ? `${parseFloat(c.weight_kg).toFixed(2)} kg` : 'Released'} col={GOLD} />
                {c.line_class_kg && <StatPill label="Line" val={`${c.line_class_kg}kg`} col={GREY} />}
                <StatPill label="Points" val={c.pts.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} col={NAVY} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── DAILY BREAKDOWN ──────────────────────────────────────────────── */}
      {activeTab === 'daily' && (
        <div>
          {fishingDays.length === 0 ? (
            <div style={{ ...S.card, color: GREY, fontStyle: 'italic', textAlign: 'center' }}>No fishing days recorded.</div>
          ) : fishingDays.map(d => {
            const dc = scoringCatches.filter(c =>
              c.competition_days?.day_number === d.day_number || dateToDay[c.fishing_date] === d.day_number
            )
            const dPts = dc.reduce((s, c) => s + calcPoints(c, scoringConfig), 0)
            const dKg  = dc.reduce((s, c) => s + parseFloat(c.weight_kg || 0), 0)
            return (
              <div key={d.id} style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ fontWeight: 700, color: NAVY }}>
                    Day {d.day_number}{d.date ? ` — ${d.date}` : ''}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <StatPill label="Catches" val={dc.length}        col={NAVY}  />
                    <StatPill label="Kg"      val={dKg.toFixed(1)}   col={GOLD}  />
                    <StatPill label="Points"  val={dPts.toFixed(0)}  col={GREEN} />
                  </div>
                </div>
                {dc.length === 0 ? (
                  <div style={{ color: GREY, fontStyle: 'italic', fontSize: '0.85rem' }}>No catches this day.</div>
                ) : [...dc].sort((a, b) => calcPoints(b, scoringConfig) - calcPoints(a, scoringConfig)).map((c, ci) => (
                  <div key={c.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.35rem 0.5rem', borderRadius: 5, background: ci % 2 === 0 ? '#f8fafc' : 'white', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600 }}>{anglerMap[c.angler_id || c.participant_id]?.full_name || '—'}</span>
                      <span style={{ color: GREY, marginLeft: '0.4rem', fontSize: '0.78rem' }}>
                        {c.competition_teams?.team_name || teamMap[c.team_id]?.team_name || ''}
                      </span>
                    </div>
                    <span style={S.badge('#374151')}>{c.species_name}</span>
                    <span style={{ fontWeight: 600, color: GOLD, fontSize: '0.85rem' }}>{c.weight_kg ? `${parseFloat(c.weight_kg).toFixed(2)}kg` : '📸 Released'}</span>
                    {c.line_class_kg && <span style={{ fontSize: '0.78rem', color: GREY }}>{c.line_class_kg}kg LC</span>}
                    {c.daily_biggest_excluded && <span style={{ fontSize: '0.72rem', color: GOLD, fontWeight: 700 }} title={`${parseFloat(c.original_points || 0).toFixed(2)} pts left out of the totals`}>🏆 Daily Biggest Tuna</span>}
                    <span style={{ fontWeight: 700, color: NAVY, minWidth: 60, textAlign: 'right', fontSize: '0.85rem' }}>
                      {calcPoints(c, scoringConfig).toFixed(2)}pts
                    </span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* ── CPUE ─────────────────────────────────────────────────────────── */}
      {activeTab === 'cpue' && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.25rem' }}>CPUE — Catch Per Unit Effort</div>
          <div style={{ fontSize: '0.78rem', color: GREY, marginBottom: '1rem' }}>
            Based on {totalHours.toFixed(1)} total fishing hours across {fishingDays.length} fishing day{fishingDays.length !== 1 ? 's' : ''}.
          </div>
          {anglerStandings.length === 0 ? (
            <div style={{ color: GREY, fontStyle: 'italic' }}>No data yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: NAVY, color: 'white' }}>
                    {['#', 'Angler', 'Team', 'Fish', 'Kg', 'Points', ...(catchReleaseFormat ? [] : ['kg/hr']), 'fish/hr'].map(h => (
                      <th key={h} style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 600, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...anglerStandings].sort((a, b) => catchReleaseFormat ? (b.fhr - a.fhr) : (b.kghr - a.kghr)).map((a, i) => (
                    <tr key={a.id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                      <td style={{ padding: '0.4rem 0.6rem', color: GREY }}>{i + 1}</td>
                      <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600 }}>{a.name}</td>
                      <td style={{ padding: '0.4rem 0.6rem', color: GREY, fontSize: '0.78rem' }}>{a.team}</td>
                      <td style={{ padding: '0.4rem 0.6rem' }}>{a.fish}</td>
                      <td style={{ padding: '0.4rem 0.6rem' }}>{a.kg.toFixed(2)}</td>
                      <td style={{ padding: '0.4rem 0.6rem' }}>{a.points.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                      {!catchReleaseFormat && <td style={{ padding: '0.4rem 0.6rem', fontWeight: 700, color: GOLD }}>{a.kghr.toFixed(2)}</td>}
                      <td style={{ padding: '0.4rem 0.6rem', fontWeight: 700, color: GREEN }}>{a.fhr.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── STATS ────────────────────────────────────────────────────────── */}
      {activeTab === 'stats' && (
        <div>
          <div style={S.card}>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>Competition Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
              {[
                { label: 'Participants',  val: participants.length },
                { label: 'Teams',         val: teams.length        },
                { label: 'Total Catches', val: filteredCatches.length },
                { label: 'Total Kg',      val: totalKg.toFixed(1)  },
                { label: 'Species',       val: topSpecies.length   },
                { label: 'Fishing Hrs',   val: totalHours.toFixed(1) },
              ].map(({ label, val }) => (
                <div key={label} style={{ background: '#f8fafc', borderRadius: 6, padding: '0.6rem 0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: GREY, textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: '1.1rem', marginTop: 2 }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={S.card}>
            <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>Top Species by Count</div>
            {topSpecies.length === 0 && <div style={{ color: GREY, fontStyle: 'italic' }}>No data yet.</div>}
            {topSpecies.map(([sp, count], i) => {
              const pct = count / (topSpecies[0]?.[1] || 1) * 100
              return (
                <div key={sp} style={{ marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{sp}</span>
                    <span style={{ fontSize: '0.85rem', color: GREY }}>{count} fish</span>
                  </div>
                  <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: i === 0 ? GOLD : NAVY, borderRadius: 4 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Published notice ─────────────────────────────────────────────── */}
      {isPublished && !embedded && (
        <div style={{ textAlign: 'center', fontSize: '0.78rem', color: GREY, marginTop: '1rem' }}>
          ✅ Final results — published {new Date(competition.results_published_at).toLocaleString('en-ZA')}
        </div>
      )}

    </div>
  )
}
