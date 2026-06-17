// ─── UniversalScoreboard.jsx ─────────────────────────────────────────────────
// Universal scoreboard — works for all SADSAA competition types.
// Reads scoring method from competition_templates.scoring_config.
// Can be used standalone (public URL) or embedded in CompetitionAdmin tab 4.
//
// Usage (standalone):  <UniversalScoreboard competitionId="uuid" />
// Usage (embedded):    <UniversalScoreboard competitionId="uuid" embedded={true} isAdmin={true} />

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

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

// ── Scoring functions ─────────────────────────────────────────────────────────

function calcPoints(catch_, scoringConfig) {
  if (!catch_ || !scoringConfig) return parseFloat(catch_?.points || 0)
  // Use pre-calculated points if available
  if (catch_.points && parseFloat(catch_.points) > 0) return parseFloat(catch_.points)
  const method = scoringConfig.method || 'points'
  const w = parseFloat(catch_.weight_kg || 0)
  const lc = parseInt(catch_.line_class_kg || scoringConfig?.line_class?.default_kg || 10)
  if (method === 'percentage') {
    if (!w || w <= 0) return 0
    if (w < (scoringConfig.minimum_weight_kg || 0)) return 0
    return parseFloat(((w / lc) ** 2 * 32).toFixed(4))
  }
  if (method === 'cpue') return w
  if (method === 'weight') return w
  return parseFloat(catch_.points || 0)
}

function getFishingHours(day) {
  if (day?.fishing_start_time && day?.fishing_end_time) {
    const [sh, sm] = day.fishing_start_time.slice(0, 5).split(':').map(Number)
    const [eh, em] = day.fishing_end_time.slice(0, 5).split(':').map(Number)
    return ((eh * 60 + em) - (sh * 60 + sm)) / 60
  }
  return 8
}

function getTotalFishingHours(days) {
  const active = (days || []).filter(d => !d.cancelled)
  if (!active.length) return 0
  return active.reduce((s, d) => s + getFishingHours(d), 0)
}

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
  const [showPending,  setShowPending]  = useState(false)

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
        .select('*, competition_templates(discipline, level, category, scoring_config, team_config, session_structure)')
        .eq('id', competitionId).single(),
      supabase.from('competition_catches')
        .select('*, competition_teams(id, team_name, province), competition_days(id, day_number, date)')
        .eq('competition_id', competitionId)
        .order('created_at', { ascending: false }),
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

  // ── Derived config ────────────────────────────────────────────────────────
  const scoringConfig = competition?.pinned_config?.scoring || template?.scoring_config || {}
  const teamConfig    = competition?.pinned_config?.team    || template?.team_config    || {}
  const discipline    = template?.discipline || ''
  const isPublished   = !!competition?.results_published_at

  // ── Lookup maps ───────────────────────────────────────────────────────────
  const teamMap    = Object.fromEntries(teams.map(t => [t.id, t]))
  const anglerMap  = Object.fromEntries(participants.map(a => [a.user_id || a.id, a]))
  const boatMap    = Object.fromEntries(boats.map(b => [b.id, b]))
  const dayMap     = Object.fromEntries(days.map(d => [d.id, d]))
  const dateToDay  = Object.fromEntries(days.map(d => [d.date, d.day_number]))

  const fishingDays     = days.filter(d => !d.cancelled)
  const totalHours      = getTotalFishingHours(days)
  const cancelledDays   = days.filter(d => d.cancelled)

  // ── Filter catches ────────────────────────────────────────────────────────
  const scoringCatches = catches.filter(c => {
    if (c.data_quality === 'rejected') return false
    if (c.data_quality === 'disqualified') return false
    if (!showPending && c.data_quality === 'unverified' && !isAdmin) return false
    if (c.species_name === 'No Catch') return false
    if (!c.weight_kg || parseFloat(c.weight_kg) <= 0) return false
    return true
  })

  const filteredCatches = dayFilter === 'all'
    ? scoringCatches
    : scoringCatches.filter(c => {
        const dn = c.competition_days?.day_number || dateToDay[c.fishing_date]
        return String(dn) === String(dayFilter)
      })

  // ── Team standings ────────────────────────────────────────────────────────
  const teamStandings = teams
    .filter(t => !t.is_disqualified)
    .map(t => {
      const tc     = filteredCatches.filter(c => c.team_id === t.id)
      const pts    = tc.reduce((s, c) => s + calcPoints(c, scoringConfig), 0)
      const kg     = tc.reduce((s, c) => s + parseFloat(c.weight_kg || 0), 0)
      const boat   = boatMap[t.boat_id] || {}
      return {
        id: t.id,
        name: t.team_name,
        province: t.province || '',
        suffix: t.team_suffix || '',
        displayName: t.team_name + (t.team_suffix ? ` ${t.team_suffix}` : ''),
        boat: boat.boat_name || '',
        skipper: boat.skipper_name || t.captain_name || '',
        fish: tc.length,
        kg: Math.round(kg * 1000) / 1000,
        points: Math.round(pts * 100) / 100,
        kghr: totalHours > 0 ? Math.round(kg / totalHours * 100) / 100 : 0,
        fhr:  totalHours > 0 ? Math.round(tc.length / totalHours * 100) / 100 : 0,
      }
    })
    .sort((a, b) => b.points - a.points || b.fish - a.fish)

  // ── Angler standings ──────────────────────────────────────────────────────
  const anglerStandings = participants
    .filter(p => p.status !== 'disqualified')
    .map(p => {
      const uid  = p.user_id || p.id
      const ac   = filteredCatches.filter(c => c.angler_id === uid)
      const pts  = ac.reduce((s, c) => s + calcPoints(c, scoringConfig), 0)
      const kg   = ac.reduce((s, c) => s + parseFloat(c.weight_kg || 0), 0)
      const team = teamMap[p.team_id]
      const byDay = {}
      ac.forEach(c => {
        const dn = c.competition_days?.day_number || dateToDay[c.fishing_date]
        if (!dn) return
        if (!byDay[dn]) byDay[dn] = []
        byDay[dn].push(c)
      })
      return {
        id: p.id, uid,
        name: p.full_name,
        number: p.angler_number,
        team: team?.team_name || p.competition_teams?.team_name || p.province || '',
        lineClass: p.line_class_kg,
        category: p.category,
        fish: ac.length,
        kg: Math.round(kg * 1000) / 1000,
        points: Math.round(pts * 100) / 100,
        speciesCount: new Set(ac.map(c => c.species_name).filter(Boolean)).size,
        bestFish: [...ac].sort((a, b) => parseFloat(b.weight_kg) - parseFloat(a.weight_kg))[0],
        kghr: totalHours > 0 ? Math.round(kg / totalHours * 100) / 100 : 0,
        fhr:  totalHours > 0 ? Math.round(ac.length / totalHours * 100) / 100 : 0,
        byDay,
      }
    })
    .sort((a, b) => b.points - a.points || b.fish - a.fish)

  // ── Skipper standings ─────────────────────────────────────────────────────
  const skipperStandings = boats.map(b => {
    const tc   = filteredCatches.filter(c => c.boat_id === b.id || c.team_id === b.team_id)
    const pts  = tc.reduce((s, c) => s + calcPoints(c, scoringConfig), 0)
    const kg   = tc.reduce((s, c) => s + parseFloat(c.weight_kg || 0), 0)
    const team = teamMap[b.team_id]
    return {
      id: b.id,
      skipper: b.skipper_name || '',
      boat: b.boat_name || '',
      team: team?.team_name || '',
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
      anglerName: anglerMap[c.angler_id]?.full_name || '',
      teamName:   c.competition_teams?.team_name || teamMap[c.team_id]?.team_name || '',
      dayNum:     c.competition_days?.day_number || dateToDay[c.fishing_date] || '?',
      pts:        calcPoints(c, scoringConfig),
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

  return (
    <div style={{ maxWidth: embedded ? '100%' : 960, margin: '0 auto', padding: embedded ? 0 : '1rem', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      {!embedded && (
        <div style={{ ...S.card, background: NAVY, color: 'white', marginBottom: '1rem' }}>
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
        {isAdmin && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={showPending} onChange={e => setShowPending(e.target.checked)} />
            Show unverified
          </label>
        )}
        <button onClick={load} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.78rem', color: GREY }}>
          🔄 {lastRefresh ? lastRefresh.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : 'Refresh'}
        </button>
      </div>

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
            const teamAnglers = anglerStandings.filter(a => a.team === t.name)
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
                    <StatPill label="Points" val={t.points.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} col={NAVY} />
                    <StatPill label="Fish"   val={t.fish}   col={GREEN} />
                    <StatPill label="Kg"     val={t.kg.toFixed(2)} col={GOLD} />
                    {hasCpue && <StatPill label="kg/hr" val={t.kghr.toFixed(2)} col="#7c3aed" />}
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
                      {a.category && a.category !== 'open' && ` · ${a.category}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <StatPill label="Points"  val={a.points.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} col={NAVY}  />
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
                      const dPts = dc.reduce((s, c) => s + calcPoints(c, scoringConfig), 0)
                      const dKg  = dc.reduce((s, c) => s + parseFloat(c.weight_kg || 0), 0)
                      return (
                        <span key={d.id} style={{ fontSize: '0.73rem', background: dc.length > 0 ? '#eff6ff' : '#f9fafb', color: dc.length > 0 ? NAVY : GREY, padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                          D{d.day_number}: {dc.length > 0 ? `${dc.length}🐟 ${dKg.toFixed(1)}kg ${dPts.toFixed(0)}pts` : 'NC'}
                        </span>
                      )
                    })}
                  </div>
                )}
                {/* Best fish */}
                {a.bestFish && (
                  <div style={{ marginTop: '0.3rem', paddingLeft: '2.25rem', fontSize: '0.75rem', color: GREY }}>
                    Best: {a.bestFish.species_name} {parseFloat(a.bestFish.weight_kg).toFixed(2)}kg
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
                    <div style={{ fontSize: '0.78rem', color: GREY }}>🚤 {s.boat} · {s.team}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <StatPill label="Points"  val={s.points.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} col={NAVY}  />
                    <StatPill label="kg/hr"   val={s.kghr.toFixed(2)} col={GOLD}  />
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
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.68rem', color: GREY, textTransform: 'uppercase' }}>Species</div>
                  <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{c.species_name}</div>
                </div>
                <StatPill label="Weight" val={`${parseFloat(c.weight_kg).toFixed(2)} kg`} col={GOLD} />
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
                      <span style={{ fontWeight: 600 }}>{anglerMap[c.angler_id]?.full_name || '—'}</span>
                      <span style={{ color: GREY, marginLeft: '0.4rem', fontSize: '0.78rem' }}>
                        {c.competition_teams?.team_name || teamMap[c.team_id]?.team_name || ''}
                      </span>
                    </div>
                    <span style={S.badge('#374151')}>{c.species_name}</span>
                    <span style={{ fontWeight: 600, color: GOLD, fontSize: '0.85rem' }}>{parseFloat(c.weight_kg).toFixed(2)}kg</span>
                    {c.line_class_kg && <span style={{ fontSize: '0.78rem', color: GREY }}>{c.line_class_kg}kg LC</span>}
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
                    {['#', 'Angler', 'Team', 'Fish', 'Kg', 'Points', 'kg/hr', 'fish/hr'].map(h => (
                      <th key={h} style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 600, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...anglerStandings].sort((a, b) => b.kghr - a.kghr).map((a, i) => (
                    <tr key={a.id} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                      <td style={{ padding: '0.4rem 0.6rem', color: GREY }}>{i + 1}</td>
                      <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600 }}>{a.name}</td>
                      <td style={{ padding: '0.4rem 0.6rem', color: GREY, fontSize: '0.78rem' }}>{a.team}</td>
                      <td style={{ padding: '0.4rem 0.6rem' }}>{a.fish}</td>
                      <td style={{ padding: '0.4rem 0.6rem' }}>{a.kg.toFixed(2)}</td>
                      <td style={{ padding: '0.4rem 0.6rem' }}>{a.points.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '0.4rem 0.6rem', fontWeight: 700, color: GOLD }}>{a.kghr.toFixed(2)}</td>
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
