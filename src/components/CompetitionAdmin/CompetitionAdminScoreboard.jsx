// ─── CompetitionAdminScoreboard.jsx ──────────────────────────────────────────
// Tab 4 — Scoreboard
// Embedded live scoreboard with admin controls.
// Delegates to UniversalScoreboard when it's built (Phase 4).
// For now renders standings directly from catches + participants.

import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { buildIndividualStandings, aggregateTeamScores, buildBoatPercentageTeamStandings, buildDailyAnglerPercentages, buildCpueData, buildSkipperRanking } from './utils/scoringEngine'

const NAVY  = '#1e3a8a'
const GREY  = '#6b7280'
const GREEN = '#16a34a'
const GOLD  = '#d97706'
const RED   = '#dc2626'

const S = {
  card:   { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '1rem' },
  label:  { fontSize: '0.78rem', fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' },
  select: { padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.88rem', background: 'white' },
  btn:    (bg = NAVY, col = 'white', active = true) => ({ background: active ? bg : '#f3f4f6', color: active ? col : '#374151', border: 'none', padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }),
  badge:  (col) => ({ background: col, color: 'white', padding: '0.15rem 0.5rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700 }),
}

const RANK_COLORS = { 1: GOLD, 2: '#9ca3af', 3: '#b45309' }

export default function CompetitionAdminScoreboard({
  competition, config, catches, participants, teams, days, boats, isAdmin,
}) {
  const navigate = useNavigate()
  // Takes you straight to that angler's real scorecard on the Catch Logger
  // page ("Lutz's Card" style view), not a same-page tab switch — that's
  // the actual page editing happens on.
  function goToAnglersCard(participantId) {
    navigate(`/competition-catch-logger/${competition.id}?participantId=${participantId}`)
  }
  const [viewMode,        setViewMode]        = useState('individual')
  const [showPending,     setShowPending]      = useState(true)
  const [categoryFilter,  setCategoryFilter]   = useState('all')

  // ── Build standings ──────────────────────────────────────────────────────
  const activeCatches = useMemo(() =>
    catches.filter(c => showPending ? c.data_quality !== 'rejected' : c.data_quality === 'verified'),
    [catches, showPending]
  )

  const individualStandings = useMemo(() =>
    buildIndividualStandings(activeCatches, participants, days, boats, config?.scoring),
    [activeCatches, participants, days, boats, config?.scoring]
  )

  const filteredStandings = useMemo(() => {
    if (categoryFilter === 'all') return individualStandings
    return individualStandings
      .filter(s => s.category === categoryFilter)
      .map((s, i) => ({ ...s, rank: i + 1 }))
  }, [individualStandings, categoryFilter])

  // Team standings — boat-percentage based (see buildBoatPercentageTeamStandings
  // in scoringEngine.js for the full methodology). This was previously a
  // plain sum of raw points per team, which didn't match the actual scoring
  // rules for this format (top scorer on each boat/day = 100%, others scored
  // relative to them, regardless of which team they're from).
  const teamStandings = useMemo(() =>
    buildBoatPercentageTeamStandings(activeCatches, participants, teams, days, boats, config?.scoring),
    [activeCatches, participants, teams, days, boats, config?.scoring]
  )

  // SADSAA runs two separate team competitions from the same field —
  // confirmed with Malcolm/John: ladies' teams (tagged via
  // competition_teams.team_type = 'ladies') compete for their own team
  // medals, separate from every other team (the general/open field, which
  // includes any Mixed teams) — even though everyone fishes together and is
  // individually ranked together in one open field (see the Individual
  // Category filter for the equivalent "Top Lady" individual split).
  // Re-ranking a subset of the already-correctly-ordered combined list
  // (rather than recomputing standings from scratch) preserves the exact
  // same ranking/tiebreak logic — splitting is purely "which teams appear
  // in which table," nothing about how a team's own score is calculated.
  const ladiesTeamIds = useMemo(() =>
    new Set((teams || []).filter(t => t.team_type === 'ladies').map(t => t.id)),
    [teams]
  )
  const hasLadiesDivision = ladiesTeamIds.size > 0
  const generalTeamStandings = useMemo(() =>
    teamStandings.filter(t => !ladiesTeamIds.has(t.teamId)).map((t, i) => ({ ...t, rank: i + 1 })),
    [teamStandings, ladiesTeamIds]
  )
  const ladiesTeamStandings = useMemo(() =>
    teamStandings.filter(t => ladiesTeamIds.has(t.teamId)).map((t, i) => ({ ...t, rank: i + 1 })),
    [teamStandings, ladiesTeamIds]
  )

  // Per-day, per-angler raw points + boat percentage, for the new Daily view
  // and for anyone wanting to see "who was top on this boat, this day"
  // directly (raw points decide the daily award, percentage is what feeds
  // team totals — both matter, shown side by side rather than collapsed
  // into a single figure).
  const dailyRecords = useMemo(() =>
    buildDailyAnglerPercentages(activeCatches, participants, days, boats),
    [activeCatches, participants, days, boats]
  )
  const [dailyDayFilter, setDailyDayFilter] = useState('all')
  const filteredDaily = useMemo(() => {
    const rows = dailyDayFilter === 'all'
      ? dailyRecords
      : dailyRecords.filter(d => String(d.dayNumber) === String(dailyDayFilter))
    // Raw points first — that's what decides the daily top-angler award
    return [...rows].sort((a, b) => b.rawPoints - a.rawPoints)
  }, [dailyRecords, dailyDayFilter])

  // CPUE ("Fish Per Hour") — not previously fetched on this tab
  const [fishingSessions, setFishingSessions] = useState([])
  useEffect(() => {
    if (!competition?.id) return
    supabase.from('competition_fishing_sessions')
      .select('*')
      .eq('competition_id', competition.id)
      .then(({ data }) => setFishingSessions(data || []))
  }, [competition?.id])
  const cpueData = useMemo(() =>
    buildCpueData(activeCatches, participants, days, boats, fishingSessions),
    [activeCatches, participants, days, boats, fishingSessions]
  )

  // Boat draws — the authoritative crew roster per boat/day, needed so
  // buildSkipperRanking can average a boat's points by the number of
  // anglers actually drawn to it that day, not just assume every boat
  // carries the same crew size.
  const [boatDraws, setBoatDraws] = useState([])
  useEffect(() => {
    if (!competition?.id) return
    supabase.from('competition_boat_draws')
      .select('*')
      .eq('competition_id', competition.id)
      .then(({ data }) => setBoatDraws(data || []))
  }, [competition?.id])

  const skipperRanking = useMemo(() =>
    buildSkipperRanking(activeCatches, boats, days, boatDraws),
    [activeCatches, boats, days, boatDraws]
  )
  const dayNumbersForSkipper = [...new Set((days || []).map(d => d.day_number))].sort((a, b) => a - b)

  const categories = ['all', ...new Set(participants.map(p => p.category).filter(Boolean))]
  const isLocked   = !!competition?.results_published_at
  // Weight isn't tracked at all in unit-count/'points' competitions (species
  // are tallied, not weighed) — showing a column of 0.00s for every angler
  // is just noise. Line class is fixed competition-wide here (not per
  // angler — competition_participants has no such column), so pull it from
  // the template's scoring_config rather than a per-row field that never
  // existed.
  const showWeight = config?.scoring?.method !== 'points'
  const lineClassKg = config?.scoring?.line_class_kg ?? competition?.default_line_class_kg ?? null

  return (
    <div>
      {/* ── Controls ────────────────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* View mode */}
          <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            {[
              { id: 'individual', label: '👤 Individual' },
              { id: 'daily',      label: '📅 Daily' },
              { id: 'teams',      label: '🏆 Teams' },
              { id: 'skipper',    label: '🚤 Boat/Skipper' },
            ].map(m => (
              <button key={m.id} onClick={() => setViewMode(m.id)}
                style={S.btn(NAVY, 'white', viewMode === m.id)}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Category filter */}
          {categories.length > 2 && (
            <select style={S.select} value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}>
              {categories.map(c => (
                <option key={c} value={c}>{c === 'all' ? 'All Categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          )}

          {/* Pending toggle (admin only) */}
          {isAdmin && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={showPending}
                onChange={e => setShowPending(e.target.checked)} />
              Include unverified catches
            </label>
          )}

          <div style={{ marginLeft: 'auto', fontSize: '0.78rem', color: GREY }}>
            {isLocked
              ? '🔒 Results published — final'
              : showPending
                ? '⚠ Includes unverified catches'
                : '✓ Verified catches only'}
          </div>
        </div>
      </div>

      {/* ── Individual standings ─────────────────────────────────────────── */}
      {viewMode === 'individual' && (
        <div style={S.card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: NAVY, color: 'white' }}>
                  {['Rank','Angler','Team','LC','Angler %','Points', ...(showWeight ? ['Weight'] : []), 'Species','Catches','CPUE'].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: h === 'Rank' ? 'center' : 'left', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStandings.map((s, i) => {
                  const anglerOverallCpue = cpueData.byAngler.find(a => a.participantId === s.participantId)
                  return (
                  <tr key={s.participantId}
                    style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700, color: RANK_COLORS[s.rank] || NAVY }}>
                      {s.rank <= 3 ? ['🥇','🥈','🥉'][s.rank - 1] : s.rank}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: NAVY, whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => goToAnglersCard(s.participantId)}
                        title="Open this angler's card in the Catch Logger"
                        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: NAVY, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}>
                        {s.displayName}
                      </button>
                      {s.anglerNumber && <span style={{ color: GREY, fontWeight: 400 }}> #{s.anglerNumber}</span>}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: GREY, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {s.teamName || '—'}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: GREY, fontSize: '0.82rem', textAlign: 'center' }}>
                      {lineClassKg ? `${lineClassKg}kg` : '—'}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: NAVY, textAlign: 'right' }}>
                      {(s.anglerPercentage || 0).toFixed(2)}%
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: GREY, textAlign: 'right' }}>
                      {s.totalPoints.toFixed(2)}
                    </td>
                    {showWeight && (
                      <td style={{ padding: '0.5rem 0.75rem', color: GREY, textAlign: 'right' }}>
                        {s.totalWeightKg.toFixed(2)}
                      </td>
                    )}
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: GREY }}>
                      {s.speciesCount}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: GREY }}>
                      {s.catchCount}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: GREY }}>
                      {anglerOverallCpue?.cpue != null ? anglerOverallCpue.cpue.toFixed(2) : '—'}
                    </td>
                  </tr>
                  )
                })}
                {filteredStandings.length === 0 && (
                  <tr><td colSpan={showWeight ? 10 : 9} style={{ padding: '1.5rem', textAlign: 'center', color: GREY, fontStyle: 'italic' }}>No catches recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Daily standings (raw points + boat %, side by side) ─────────── */}
      {viewMode === 'daily' && (
        <div style={S.card}>
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={S.label}>Day</label>
            <select style={S.select} value={dailyDayFilter} onChange={e => setDailyDayFilter(e.target.value)}>
              <option value="all">All Days</option>
              {[...new Set(dailyRecords.map(d => d.dayNumber))].filter(n => n != null).sort((a, b) => a - b).map(n => (
                <option key={n} value={n}>Day {n}</option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: '0.78rem', color: GREY, marginBottom: '0.75rem' }}>
            Sorted by raw points — that's what decides each day's top-angler award.
            Percentage is relative to the top scorer on that same boat that day (any team), and is what feeds into Team totals.
            CPUE is Fish Per Hour, based on that boat's Lines In/Up times (Setup tab).
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: NAVY, color: 'white' }}>
                  {['Day','Angler','Team','Boat','Raw Points','Boat %','CPUE'].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDaily.map((d, i) => {
                  const anglerCpue = cpueData.byAnglerDay.find(a => a.participantId === d.participantId && String(a.dayNumber) === String(d.dayNumber))
                  return (
                  <tr key={`${d.dayId}-${d.participantId}`}
                    style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>Day {d.dayNumber}</td>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: NAVY, whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => goToAnglersCard(d.participantId)}
                        title="Open this angler's card in the Catch Logger"
                        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: NAVY, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}>
                        {d.displayName}
                      </button>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: GREY, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{d.teamName || '—'}</td>
                    <td style={{ padding: '0.5rem 0.75rem', color: GREY, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{d.boatName}</td>
                    <td style={{ padding: '0.5rem 0.75rem', color: GREY, textAlign: 'right' }}>{d.rawPoints.toFixed(2)}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: d.percentage === 100 ? GREEN : NAVY, fontWeight: 700 }}>
                      {d.percentage.toFixed(2)}%{d.percentage === 100 ? ' 🥇' : ''}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: GREY }}>
                      {anglerCpue?.cpue != null ? anglerCpue.cpue.toFixed(2) : '—'}
                    </td>
                  </tr>
                  )
                })}
                {filteredDaily.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: GREY, fontStyle: 'italic' }}>No catches recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Team standings ───────────────────────────────────────────────── */}
      {viewMode === 'teams' && (
        <div>
          {hasLadiesDivision && (
            <div style={{ fontWeight: 700, color: NAVY, fontSize: '1.05rem', margin: '0.5rem 0 0.75rem' }}>Team Standings</div>
          )}
          {generalTeamStandings.map((t) => (
            <div key={t.teamId} style={{ ...S.card, borderLeft: `4px solid ${RANK_COLORS[t.rank] || '#e5e7eb'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: '1rem' }}>
                    {t.rank <= 3 ? ['🥇','🥈','🥉'][t.rank - 1] + ' ' : `${t.rank}. `}
                    {t.teamName}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: GREY }}>{t.members.length} anglers{usesBoatPercentage ? ' · sum of daily boat %' : ''}</div>
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.3rem', color: NAVY }}>{usesBoatPercentage ? `${t.totalPercentage.toFixed(2)}%` : (t.totalPoints || 0).toFixed(2)}</div>
              </div>
              {t.members.sort((a, b) => usesBoatPercentage ? (b.percentageSum - a.percentageSum) : ((b.points || 0) - (a.points || 0))).map(m => (
                <div key={m.participantId} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.3rem 0.5rem', background: '#f8fafc', borderRadius: 5, marginBottom: '0.25rem' }}>
                  <div style={{ flex: 1, fontSize: '0.85rem' }}>
                    <button
                      onClick={() => goToAnglersCard(m.participantId)}
                      title="Open this angler's card in the Catch Logger"
                      style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}>
                      {m.displayName}
                    </button>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: GREY }}>{m.daysCounted} day{m.daysCounted === 1 ? '' : 's'} fished</div>
                  <div style={{ fontWeight: 700, color: NAVY, minWidth: 60, textAlign: 'right' }}>{usesBoatPercentage ? `${m.percentageSum.toFixed(2)}%` : `${(m.points || 0).toFixed(2)}pts`}</div>
                </div>
              ))}
            </div>
          ))}
          {generalTeamStandings.length === 0 && (
            <div style={{ ...S.card, color: GREY, textAlign: 'center', fontStyle: 'italic' }}>No team data available.</div>
          )}

          {hasLadiesDivision && (
            <>
              <div style={{ fontWeight: 700, color: NAVY, fontSize: '1.05rem', margin: '1.5rem 0 0.75rem' }}>Ladies' Team Standings</div>
              {ladiesTeamStandings.map((t) => (
                <div key={t.teamId} style={{ ...S.card, borderLeft: `4px solid ${RANK_COLORS[t.rank] || '#e5e7eb'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: NAVY, fontSize: '1rem' }}>
                        {t.rank <= 3 ? ['🥇','🥈','🥉'][t.rank - 1] + ' ' : `${t.rank}. `}
                        {t.teamName}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: GREY }}>{t.members.length} anglers{usesBoatPercentage ? ' · sum of daily boat %' : ''}</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1.3rem', color: NAVY }}>{usesBoatPercentage ? `${t.totalPercentage.toFixed(2)}%` : (t.totalPoints || 0).toFixed(2)}</div>
                  </div>
                  {t.members.sort((a, b) => usesBoatPercentage ? (b.percentageSum - a.percentageSum) : ((b.points || 0) - (a.points || 0))).map(m => (
                    <div key={m.participantId} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.3rem 0.5rem', background: '#f8fafc', borderRadius: 5, marginBottom: '0.25rem' }}>
                      <div style={{ flex: 1, fontSize: '0.85rem' }}>
                        <button
                          onClick={() => goToAnglersCard(m.participantId)}
                          title="Open this angler's card in the Catch Logger"
                          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}>
                          {m.displayName}
                        </button>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: GREY }}>{m.daysCounted} day{m.daysCounted === 1 ? '' : 's'} fished</div>
                      <div style={{ fontWeight: 700, color: NAVY, minWidth: 60, textAlign: 'right' }}>{usesBoatPercentage ? `${m.percentageSum.toFixed(2)}%` : `${(m.points || 0).toFixed(2)}pts`}</div>
                    </div>
                  ))}
                </div>
              ))}
              {ladiesTeamStandings.length === 0 && (
                <div style={{ ...S.card, color: GREY, textAlign: 'center', fontStyle: 'italic' }}>No ladies' team data available.</div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Skipper / Boat ranking ──────────────────────────────────────── */}
      {viewMode === 'skipper' && (
        <div style={S.card}>
          <div style={{ fontSize: '0.78rem', color: GREY, marginBottom: '0.75rem' }}>
            Each day, boats are ranked 1st, 2nd, 3rd... by that day's <strong>average points
            per angler</strong> (total points on the boat, divided by the number of anglers
            actually drawn to it that day — disqualified anglers' points still count toward
            the total). Averaging keeps the ranking fair if a boat ever carries a different
            number of anglers than the rest (e.g. 4 instead of 3); with equal crew sizes
            across every boat, it produces the same ranking as a plain total. A boat's final
            ranking is the <strong>sum of its daily positions</strong> — lower is better, same
            as SADSAA's official Skipper Ranking sheet. Total points (raw sum, unaveraged) is
            shown for reference and as the second tiebreaker. Ties in total position are
            broken first by most fish caught for the competition, then by total points scored
            if still tied.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: NAVY, color: 'white' }}>
                  <th rowSpan={2} style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontSize: '0.72rem', textTransform: 'uppercase' }}>Rank</th>
                  <th rowSpan={2} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontSize: '0.72rem', textTransform: 'uppercase' }}>Skipper</th>
                  <th rowSpan={2} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontSize: '0.72rem', textTransform: 'uppercase' }}>Boat</th>
                  <th colSpan={dayNumbersForSkipper.length + 1} style={{ padding: '0.4rem 0.6rem', textAlign: 'center', fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.3)' }}>Points</th>
                  <th colSpan={dayNumbersForSkipper.length + 1} style={{ padding: '0.4rem 0.6rem', textAlign: 'center', fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.3)' }}>Position</th>
                </tr>
                <tr style={{ background: NAVY, color: 'white' }}>
                  {dayNumbersForSkipper.map(d => (
                    <th key={`pts-${d}`} style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontSize: '0.7rem' }}>Day {d}</th>
                  ))}
                  <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontSize: '0.7rem', color: '#fbbf24' }}>Total</th>
                  {dayNumbersForSkipper.map(d => (
                    <th key={`pos-${d}`} style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontSize: '0.7rem' }}>Day {d}</th>
                  ))}
                  <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontSize: '0.7rem', color: '#fbbf24' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {skipperRanking.map((s, i) => (
                  <tr key={s.boatId} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center', fontWeight: 700, color: RANK_COLORS[s.rank] || NAVY }}>
                      {s.rank <= 3 ? ['🥇','🥈','🥉'][s.rank - 1] : s.rank}
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem', fontWeight: 600, color: NAVY, whiteSpace: 'nowrap' }}>{s.skipperName}</td>
                    <td style={{ padding: '0.5rem 0.6rem', color: GREY, whiteSpace: 'nowrap' }}>{s.boatName}</td>
                    {dayNumbersForSkipper.map(d => (
                      <td key={`pts-${d}`} style={{ padding: '0.5rem 0.5rem', textAlign: 'center', color: GREY }}>
                        {s.dailyPoints[d] != null ? (
                          <>
                            {s.dailyPoints[d].toFixed(2)}
                            <div style={{ fontSize: '0.68rem', color: GOLD }}>avg {s.dailyAverage[d].toFixed(2)}</div>
                          </>
                        ) : '—'}
                      </td>
                    ))}
                    <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 700, color: NAVY }}>{s.totalPoints.toFixed(2)}</td>
                    {dayNumbersForSkipper.map(d => (
                      <td key={`pos-${d}`} style={{ padding: '0.5rem 0.5rem', textAlign: 'center', color: GREY }}>
                        {s.dailyPosition[d] ?? '—'}
                      </td>
                    ))}
                    <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 700, color: RED }}>{s.totalPosition}</td>
                  </tr>
                ))}
                {skipperRanking.length === 0 && (
                  <tr><td colSpan={5 + dayNumbersForSkipper.length * 2} style={{ padding: '1.5rem', textAlign: 'center', color: GREY, fontStyle: 'italic' }}>No catches recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
