// ─── HistoricalCompetitionView.jsx ───────────────────────────────────────────
// Read-only view for competitions imported from a standardized post-event
// catch return (e.g. SADSAA spreadsheets), rather than scored live through
// UniversalCatchLogger. These competitions have no points/scoring protocol
// applied — they exist so anglers can browse and claim their catches via
// MyCatches.jsx's existing "Claim My Record" flow.
//
// Deliberately does NOT show: points, rank, per-angler/per-team CPUE, or any
// "Edit" actions. Showing zeros for any of those would misrepresent records
// that were never meant to be scored in the first place — see the Tuna
// Interprovincial 2025 (Rumbly Bay) investigation that led to this page.
//
// Competition-wide CPUE (fish per angler-hour) IS shown, since that's a
// genuine, meaningful aggregate for this kind of record and is independently
// verifiable against the source spreadsheet's own summary tab.
//
// Usage:
//   <HistoricalCompetitionView competitionId="uuid-here" />

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const NAVY  = '#1e3a8a'
const GREY  = '#6b7280'
const GOLD  = '#d97706'

const S = {
  card:  { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '1rem' },
  label: { fontSize: '0.72rem', fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.05em' },
  th:    { padding: '0.5rem 0.7rem', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'white', whiteSpace: 'nowrap' },
  td:    { padding: '0.45rem 0.7rem', fontSize: '0.85rem' },
}

// "No Catch" rows represent an angler who fished but caught nothing that
// session — a real, meaningful record (confirms hours fished), but not a
// fish to count toward CPUE or show in the catch list itself.
const isRealCatch = (c) => c.species_name && !/no catch/i.test(c.species_name)

export default function HistoricalCompetitionView({ competitionId }) {
  const [competition, setCompetition] = useState(null)
  const [sessions,    setSessions]    = useState([])
  const [days,        setDays]        = useState([])
  const [catches,     setCatches]     = useState([])
  const [participants,setParticipants]= useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  useEffect(() => {
    if (!competitionId) return
    load()
  }, [competitionId])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [
        { data: comp,     error: compErr },
        { data: sess,     error: sessErr },
        { data: dayRows,  error: daysErr },
        { data: cs,       error: catchErr },
        { data: parts,    error: partsErr },
      ] = await Promise.all([
        supabase.from('competitions').select('*').eq('id', competitionId).single(),
        supabase.from('competition_fishing_sessions').select('*').eq('competition_id', competitionId).order('day_number'),
        supabase.from('competition_days').select('day_number, date').eq('competition_id', competitionId).order('day_number'),
        supabase
          .from('competition_catches')
          .select(`
            id, species_name, weight_kg, fishing_date,
            competition_participants ( id, full_name, competition_teams ( id, team_name ) ),
            competition_boats ( id, boat_name ),
            competition_days ( id, day_number )
          `)
          .eq('competition_id', competitionId),
        supabase
          .from('competition_participants')
          .select('id, full_name, competition_teams ( id, team_name )')
          .eq('competition_id', competitionId)
          .order('full_name'),
      ])

      if (compErr) throw compErr
      if (sessErr) throw sessErr
      if (daysErr) throw daysErr
      if (catchErr) throw catchErr
      if (partsErr) throw partsErr

      setCompetition(comp)
      setSessions(sess || [])
      setDays(dayRows || [])
      setCatches(cs || [])
      setParticipants(parts || [])
    } catch (err) {
      console.error('HistoricalCompetitionView load error:', err)
      setError(err.message || 'Failed to load competition data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem', textAlign: 'center', color: GREY }}>Loading historical record…</div>
  }

  if (error) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem' }}>
        <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: 8, color: '#dc2626' }}>
          Error loading competition: {error}
        </div>
      </div>
    )
  }

  // ── Competition-wide CPUE ───────────────────────────────────────────────
  // Real fish count across the whole competition, divided by total angler-
  // hours. Angler-hours per session = session's fishing_hours × number of
  // distinct anglers who logged a row (catch or "No Catch") for that boat
  // on that day — the only reliable source for "who was aboard," since
  // sessions themselves don't track a crew list separately.
  const realCatches = catches.filter(isRealCatch)
  const totalFish   = realCatches.length

  // Unit-count competitions (no weight recorded on any real catch) tally
  // distinct species caught, not individual measured fish — "13 species"
  // is the accurate description, not "13 fish". Detect by checking
  // whether every real catch lacks a weight; a measured/percentage-style
  // competition will have real weight_kg values throughout.
  const isUnitCountFormat = realCatches.length > 0 && realCatches.every(c => c.weight_kg == null)
  const catchUnitLabel = isUnitCountFormat ? 'species' : 'fish'

  const anglersPerBoatDay = {}
  for (const c of catches) {
    const boatName = c.competition_boats?.boat_name
    const dayNum   = c.competition_days?.day_number
    const angler   = c.competition_participants?.full_name
    if (!boatName || !dayNum || !angler) continue
    const key = `${boatName}|${dayNum}`
    if (!anglersPerBoatDay[key]) anglersPerBoatDay[key] = new Set()
    anglersPerBoatDay[key].add(angler)
  }

  let totalAnglerHours = 0
  for (const sess of sessions) {
    const key = `${sess.boat_name}|${sess.day_number}`
    const anglerCount = anglersPerBoatDay[key]?.size || 0
    totalAnglerHours += (parseFloat(sess.fishing_hours) || 0) * anglerCount
  }

  const cpue = totalAnglerHours > 0 ? totalFish / totalAnglerHours : null

  // ── Day number → real calendar date lookup, for the Fishing Sessions table ──
  const dateByDayNumber = {}
  for (const d of days) {
    dateByDayNumber[d.day_number] = d.date
  }
  function formatDate(isoDate) {
    if (!isoDate) return '—'
    const d = new Date(isoDate + 'T00:00:00')
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  // ── Total Species Caught — distinct species across the whole competition,
  // with fish counts, sorted most-caught first. Same isRealCatch filter as
  // everywhere else, so "No Catch" placeholder rows never appear here.
  const speciesCounts = {}
  for (const c of realCatches) {
    const sp = c.species_name || 'Unknown'
    speciesCounts[sp] = (speciesCounts[sp] || 0) + 1
  }
  const speciesSorted = Object.entries(speciesCounts).sort((a, b) => b[1] - a[1])

  // ── Group by team, then angler — starting from the FULL roster ──────────
  // Every participant must appear, even if they never caught anything —
  // selectors and the anglers themselves need to see who actually fished,
  // not just who scored a fish. An angler with zero real catches still
  // shows on their team, with an explicit "no catch recorded" note rather
  // than being silently omitted.
  const byTeam = {}
  for (const p of participants) {
    const teamName   = p.competition_teams?.team_name || 'Unassigned'
    const anglerName = p.full_name || 'Unknown angler'
    if (!byTeam[teamName]) byTeam[teamName] = {}
    if (!byTeam[teamName][anglerName]) byTeam[teamName][anglerName] = []
  }
  for (const c of realCatches) {
    const teamName   = c.competition_participants?.competition_teams?.team_name || 'Unassigned'
    const anglerName = c.competition_participants?.full_name || 'Unknown angler'
    if (!byTeam[teamName]) byTeam[teamName] = {}
    if (!byTeam[teamName][anglerName]) byTeam[teamName][anglerName] = []
    byTeam[teamName][anglerName].push(c)
  }
  const teamNames = Object.keys(byTeam).sort()

  const dateStr = competition?.start_date && competition?.end_date
    ? (competition.start_date === competition.end_date
        ? competition.start_date
        : `${competition.start_date} → ${competition.end_date}`)
    : (competition?.start_date || '')

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div style={{ background: NAVY, color: 'white', padding: '1.25rem 1.5rem', borderRadius: 8, marginBottom: '1rem' }}>
        <div style={{ fontWeight: 800, fontSize: '1.3rem' }}>{competition?.name}</div>
        <div style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: 3 }}>
          {competition?.venue}{dateStr ? ` · ${dateStr}` : ''}
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.9rem' }}>
          <div>
            <div style={{ ...S.label, color: 'rgba(255,255,255,0.7)' }}>Total Catches</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{totalFish}</div>
          </div>
          <div>
            <div style={{ ...S.label, color: 'rgba(255,255,255,0.7)' }}>Anglers</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{Object.values(byTeam).reduce((n, t) => n + Object.keys(t).length, 0)}</div>
          </div>
          <div>
            <div style={{ ...S.label, color: 'rgba(255,255,255,0.7)' }}>Competition CPUE</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24' }}>
              {cpue != null ? `${cpue.toFixed(4)} ${catchUnitLabel}/angler-hr` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Notice: historical record, no scoring ────────────────────── */}
      <div style={{ ...S.card, background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
        <div style={{ fontSize: '0.85rem', color: '#92400e' }}>
          This is a historical record imported from an official post-event catch return.
          No scoring protocol was applied to this competition, so no points or rankings
          are shown — only the catches themselves. Some original catch returns did not
          record anglers who fished but caught nothing ("blanked"), so a team showing
          fewer anglers than expected may not reflect its actual full roster — only the
          anglers who recorded a catch. Anglers can claim their catches from
          the <strong>My Catches</strong> page.
        </div>
      </div>

      {/* ── Fishing sessions ──────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>Fishing Sessions</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: NAVY }}>
                <th style={S.th}>Day</th>
                <th style={S.th}>Date</th>
                <th style={S.th}>Boat</th>
                <th style={S.th}>Skipper</th>
                <th style={S.th}>Hours</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr key={s.id} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                  <td style={S.td}>Day {s.day_number}</td>
                  <td style={S.td}>{formatDate(dateByDayNumber[s.day_number])}</td>
                  <td style={{ ...S.td, fontWeight: 600 }}>{s.boat_name}</td>
                  <td style={S.td}>{s.skipper_name || '—'}</td>
                  <td style={S.td}>{s.fishing_hours}</td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', color: GREY, fontStyle: 'italic' }}>No session data recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Total Species Caught ─────────────────────────────────────── */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
          <div style={{ fontWeight: 700, color: NAVY }}>Total Species Caught</div>
          <div style={{ fontSize: '0.8rem', color: GREY }}>{speciesSorted.length} species</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: NAVY }}>
                <th style={S.th}>Species</th>
                <th style={{ ...S.th, textAlign: 'right' }}>{isUnitCountFormat ? 'Fish' : 'Catches'}</th>
              </tr>
            </thead>
            <tbody>
              {speciesSorted.map(([species, count], i) => (
                <tr key={species} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                  <td style={S.td}>{species}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{count}</td>
                </tr>
              ))}
              {speciesSorted.length === 0 && (
                <tr><td colSpan={2} style={{ ...S.td, textAlign: 'center', color: GREY, fontStyle: 'italic' }}>No species recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Catches, grouped by team then angler ─────────────────────── */}
      {teamNames.map(teamName => {
        const anglers = byTeam[teamName]
        const anglerNames = Object.keys(anglers).sort()
        const teamFishCount = anglerNames.reduce((n, a) => n + anglers[a].length, 0)

        return (
          <div key={teamName} style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: NAVY }}>{teamName}</div>
              <div style={{ fontSize: '0.8rem', color: GREY }}>{anglerNames.length} anglers · {teamFishCount} {catchUnitLabel}</div>
            </div>

            {anglerNames.map(anglerName => {
              const anglerCatches = anglers[anglerName].sort((a, b) =>
                (a.competition_days?.day_number || 0) - (b.competition_days?.day_number || 0)
              )
              if (anglerCatches.length === 0) {
                return (
                  <div key={anglerName} style={{ marginBottom: '0.9rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#374151', marginBottom: '0.35rem' }}>
                      {anglerName}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: GREY, fontStyle: 'italic', padding: '0.4rem 0' }}>
                      Participated — no catch recorded.
                    </div>
                  </div>
                )
              }
              return (
                <div key={anglerName} style={{ marginBottom: '0.9rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#374151', marginBottom: '0.35rem' }}>
                    {anglerName}
                    <span style={{ fontWeight: 400, color: GREY, marginLeft: 6 }}>({anglerCatches.length} {catchUnitLabel})</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: '#f3f4f6' }}>
                          <th style={{ ...S.th, color: '#374151' }}>Day</th>
                          <th style={{ ...S.th, color: '#374151' }}>Species</th>
                          {!isUnitCountFormat && <th style={{ ...S.th, color: '#374151' }}>Weight (kg)</th>}
                          <th style={{ ...S.th, color: '#374151' }}>Boat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {anglerCatches.map(c => (
                          <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={S.td}>Day {c.competition_days?.day_number ?? '—'}</td>
                            <td style={S.td}>{c.species_name}</td>
                            {!isUnitCountFormat && <td style={S.td}>{c.weight_kg != null ? parseFloat(c.weight_kg).toFixed(2) : '—'}</td>}
                            <td style={{ ...S.td, color: GREY }}>{c.competition_boats?.boat_name || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {teamNames.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', color: GREY, fontStyle: 'italic' }}>
          No catches recorded for this competition.
        </div>
      )}
    </div>
  )
}
