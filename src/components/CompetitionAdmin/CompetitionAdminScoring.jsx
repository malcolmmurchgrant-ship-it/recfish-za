// ─── CompetitionAdminScoring.jsx ─────────────────────────────────────────────
// Tab 3 — Scoring
// Live catch overview by day, catch entry, verification, full edit including DQ'd.

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { calculateCatchPoints, groupCatchesBySpecies, buildCpueData } from './utils/scoringEngine'
import { disqualifyParticipant } from './utils/disqualificationActions'

const NAVY  = '#1e3a8a'
const GREY  = '#6b7280'
const GREEN = '#16a34a'
const RED   = '#dc2626'
const GOLD  = '#d97706'

const S = {
  card:   { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '1rem' },
  label:  { fontSize: '0.78rem', fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' },
  input:  { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' },
  select: { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', background: 'white', boxSizing: 'border-box' },
  btn:    (bg = NAVY, col = 'white') => ({ background: bg, color: col, border: 'none', padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }),
  badge:  (col) => ({ background: col, color: 'white', padding: '0.15rem 0.5rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700 }),
  section:{ fontWeight: 700, color: NAVY, fontSize: '0.95rem', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '2px solid #e5e7eb' },
}

const DQ_COLORS = {
  verified:     GREEN,
  unverified:   GOLD,
  flagged:      '#f59e0b',
  disqualified: RED,
  rejected:     '#9ca3af',
}

export default function CompetitionAdminScoring({
  competition, config, catches, participants, days, boats,
  isAdmin, isScorer, onCatchUpdate, initialFilter,
}) {
  const [dayFilter,    setDayFilter]    = useState('all')
  const [teamFilter,   setTeamFilter]   = useState('all')
  const [anglerFilter, setAnglerFilter] = useState('all')
  const [editing,      setEditing]      = useState(null)
  const [error,        setError]        = useState('')
  const [expandedGroups, setExpandedGroups] = useState({}) // species key -> bool, per-group raw-row reveal
  const [showBoatSummary, setShowBoatSummary] = useState(false)
  const [showCompSummary, setShowCompSummary] = useState(false)
  // Bulk "disqualify this angler's day" — right here in Scoring, where a
  // data capturer actually has the day+angler already in view while
  // tabulating results, instead of needing to go find them in the
  // Participants tab. See disqualificationActions.js for why this shares
  // one implementation with Participants' DQ button rather than being a
  // fourth copy of the same logic.
  const [dqDayModal, setDqDayModal] = useState(false)
  const [dqDayReason, setDqDayReason] = useState('')
  const [dqDaySaving, setDqDaySaving] = useState(false)

  // Moved up from much further down the file (2026-07-20) -- it used to be
  // declared right before the JSX return, but canBulkDqDay (below) started
  // referencing it before that line ever ran. A const referenced before its
  // own declaration line executes throws a real, uncatchable
  // ReferenceError at runtime (the "temporal dead zone") -- valid syntax,
  // so it doesn't show up in any build or lint check, only when the
  // component actually renders. That's exactly what broke production:
  // white screen on every page, since App.jsx statically imports this file
  // regardless of which tab is active.
  const isLocked = !!competition?.results_published_at

  // CPUE ("Fish Per Hour") needs Lines In/Up hours from
  // competition_fishing_sessions — not previously fetched on this tab.
  const [fishingSessions, setFishingSessions] = useState([])
  useEffect(() => {
    if (!competition?.id) return
    supabase.from('competition_fishing_sessions')
      .select('*')
      .eq('competition_id', competition.id)
      .then(({ data }) => setFishingSessions(data || []))
  }, [competition?.id])

  const cpueData = buildCpueData(catches.filter(c => c.data_quality !== 'rejected'), participants, days, boats, fishingSessions)

  const scoringMethod = config?.scoring?.method || 'percentage'

  // Arriving here from a Scoreboard angler click (see index.jsx) — jump
  // straight to that team + angler instead of making them reselect manually.
  useEffect(() => {
    if (!initialFilter) return
    if (initialFilter.teamName)     setTeamFilter(initialFilter.teamName)
    if (initialFilter.participantId) setAnglerFilter(initialFilter.participantId)
  }, [initialFilter])

  const teams = [...new Map(
    participants.filter(p => p.competition_teams)
      .map(p => [p.team_id, p.competition_teams])
  ).values()]

  // Anglers scoped to the currently selected team — this is what makes the
  // dropdown actually useful instead of scrolling/typing through everyone.
  const anglersInScope = participants
    .filter(p => teamFilter === 'all' || p.competition_teams?.team_name === teamFilter)
    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))

  // If the team filter changes and the currently selected angler isn't in
  // the new scope, reset rather than silently filtering to nothing.
  useEffect(() => {
    if (anglerFilter === 'all') return
    if (!anglersInScope.some(p => p.id === anglerFilter)) setAnglerFilter('all')
  }, [teamFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filter catches ───────────────────────────────────────────────────────
  const filtered = catches.filter(c => {
    if (dayFilter !== 'all' && c.competition_days?.day_number !== parseInt(dayFilter)) return false
    if (teamFilter !== 'all' && c.competition_teams?.team_name !== teamFilter) return false
    if (anglerFilter !== 'all' && c.participant_id !== anglerFilter && c.angler_id !== anglerFilter) return false
    return true
  })

  // ── Bulk DQ: the angler + day currently selected in the filters above ────
  // dayFilter is a day_number (matches the <select> options), but
  // competition_catches.competition_day_id is a UUID FK — resolve it here
  // rather than passing the wrong kind of value through.
  const selectedDay = dayFilter !== 'all' ? days.find(d => String(d.day_number) === String(dayFilter)) : null
  const selectedAngler = anglerFilter !== 'all' ? participants.find(p => p.id === anglerFilter) : null
  const canBulkDqDay = (isAdmin || isScorer) && !isLocked && selectedDay && selectedAngler

  async function handleDqDay() {
    if (!dqDayReason.trim()) return
    setDqDaySaving(true)
    try {
      await disqualifyParticipant({
        participantId: selectedAngler.id,
        competitionId: competition.id,
        reason: dqDayReason,
        competitionDayId: selectedDay.id,
      })
    } catch (err) {
      setError(err.message)
      setDqDaySaving(false)
      return
    }
    setDqDaySaving(false)
    setDqDayModal(false)
    setDqDayReason('')
    onCatchUpdate()
  }

  const totalFish   = filtered.filter(c => c.data_quality !== 'rejected').length
  const totalPoints = filtered.reduce((s, c) =>
    c.data_quality === 'disqualified' || c.data_quality === 'rejected'
      ? s : s + parseFloat(c.points || 0), 0)
  const dqCount     = filtered.filter(c => c.data_quality === 'disqualified').length

  // Same participant-resolution fix used throughout today — the catches
  // query never actually joins competition_participants.
  function resolveParticipant(c) {
    return participants.find(p => p.id === c.participant_id || (c.angler_id && p.user_id === c.angler_id))
  }

  // Species tally for whatever's currently filtered (angler/day/team) —
  // this is the main clutter fix: one row per species instead of one row
  // per raw catch (including the 0-point padding rows).
  const filteredSpeciesGroups = groupCatchesBySpecies(filtered)

  // Whole-scope DQ notice — if every catch in the current filter is
  // disqualified (the common case: an angler DQ'd for a whole day), show
  // one clear banner with the reason instead of repeating a badge on every
  // species card. Falls back to per-species badges below for a partial DQ
  // (only some species affected), so nothing gets missed either way.
  const nonRejectedFiltered = filtered.filter(c => c.data_quality !== 'rejected')
  const allFilteredDQd = nonRejectedFiltered.length > 0 && nonRejectedFiltered.every(c => c.data_quality === 'disqualified')
  const dqReason = allFilteredDQd ? (nonRejectedFiltered.find(c => c.notes)?.notes || 'No reason recorded') : null

  // Per boat — species tally for a single day (unchanged shape when a
  // specific day is picked), or per boat broken down by day underneath
  // when "All Days" is selected. A boat carries different anglers/teams on
  // different days (rotation), so an "All Days" boat total on its own
  // would blur together unrelated crews — nesting by day keeps that
  // distinction visible while still not forcing a day to be picked first.
  const boatSummaryData = (() => {
    const activeCatches = catches.filter(c => c.data_quality !== 'rejected')

    if (dayFilter !== 'all') {
      const dayCatches = activeCatches.filter(c => c.competition_days?.day_number === parseInt(dayFilter))
      const byBoat = {}
      for (const c of dayCatches) {
        const boatName = boats?.find(b => b.id === c.boat_id)?.boat_name || 'Unknown Boat'
        if (!byBoat[boatName]) byBoat[boatName] = []
        byBoat[boatName].push(c)
      }
      return Object.entries(byBoat)
        .map(([boatName, boatCatches]) => ({ boatName, days: null, species: groupCatchesBySpecies(boatCatches) }))
        .sort((a, b) => a.boatName.localeCompare(b.boatName))
    }

    // All Days — group by boat, then by day within each boat
    const byBoatDay = {}
    for (const c of activeCatches) {
      const boatName = boats?.find(b => b.id === c.boat_id)?.boat_name || 'Unknown Boat'
      const dayNum   = c.competition_days?.day_number ?? '?'
      if (!byBoatDay[boatName]) byBoatDay[boatName] = {}
      if (!byBoatDay[boatName][dayNum]) byBoatDay[boatName][dayNum] = []
      byBoatDay[boatName][dayNum].push(c)
    }
    return Object.entries(byBoatDay)
      .map(([boatName, byDay]) => ({
        boatName,
        species: null,
        days: Object.entries(byDay)
          .map(([dayNum, dayCatches]) => ({ dayNumber: dayNum, species: groupCatchesBySpecies(dayCatches) }))
          .sort((a, b) => Number(a.dayNumber) - Number(b.dayNumber)),
      }))
      .sort((a, b) => a.boatName.localeCompare(b.boatName))
  })()

  // Whole competition, every angler, every day, every boat — the overall
  // species tally for the event so far. groupCatchesBySpecies sorts by
  // points by default (right for most of the other places it's used in
  // this file), but the Competition Summary is specifically about "most
  // common fish caught" — re-sorted by fish count here so it actually
  // answers that question, without changing the shared helper's default
  // for its other callers (the per-boat/per-day breakdowns below).
  const competitionSpeciesGroups = [...groupCatchesBySpecies(catches.filter(c => c.data_quality !== 'rejected'))]
    .sort((a, b) => b.fishCount - a.fishCount)

  return (
    <div>
      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <div style={{ ...S.card, background: NAVY, color: 'white' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Total Catches', val: totalFish },
              { label: 'Total Points',  val: totalPoints.toFixed(2) },
              { label: 'DQs',          val: dqCount, color: dqCount > 0 ? '#fca5a5' : 'rgba(255,255,255,0.7)' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{ fontWeight: 700, color: s.color || 'white', fontSize: '1.1rem' }}>{s.val}</div>
              </div>
            ))}
          </div>
          {(isAdmin || isScorer) && !isLocked && (
            // Routes to the real catch logger (UniversalCatchLogger) instead of
            // opening a local modal. The old NewCatchModal wrote straight to
            // competition_catches with an angler_id (registered-user id) even
            // for unregistered participants, and always scored via the
            // weight/percentage method — silently wrong for any 'points' /
            // unit_count competition (e.g. bottomfish), and invisible to the
            // real logger's participant_id-based lookups. Removed rather than
            // patched, since the correct home for catch entry is the
            // dedicated /competition-catch-logger page, not a second parallel
            // form on the admin Scoring tab.
            <a href={`/competition-catch-logger/${competition.id}${(() => {
              const params = new URLSearchParams()
              if (anglerFilter !== 'all') params.set('participantId', anglerFilter)
              if (dayFilter !== 'all') params.set('day', dayFilter)
              const qs = params.toString()
              return qs ? `?${qs}` : ''
            })()}`}
              style={{ background: GREEN, color: 'white', border: 'none', padding: '0.4rem 0.9rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
              + Log Catch
            </a>
          )}
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={S.label}>Day</label>
          <select style={S.select} value={dayFilter} onChange={e => setDayFilter(e.target.value)}>
            <option value="all">All Days</option>
            {days.map(d => <option key={d.day_number} value={d.day_number}>Day {d.day_number} — {d.date}</option>)}
          </select>
        </div>
        {teams.length > 0 && (
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={S.label}>Team</label>
            <select style={S.select} value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
              <option value="all">All Teams</option>
              {teams.map(t => <option key={t.id} value={t.team_name}>{t.team_name || t.province}</option>)}
            </select>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={S.label}>Angler</label>
          <select style={S.select} value={anglerFilter} onChange={e => setAnglerFilter(e.target.value)}>
            <option value="all">All Anglers</option>
            {anglersInScope.map(p => (
              <option key={p.id} value={p.id}>{p.full_name}{p.is_captain ? ' (Captain)' : ''}</option>
            ))}
          </select>
        </div>
        {canBulkDqDay && (
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button onClick={() => setDqDayModal(true)}
              style={{ ...S.btn(RED), padding: '0.6rem 0.9rem', fontSize: '0.85rem' }}>
              🚫 Disqualify {selectedAngler.full_name} — Day {selectedDay.day_number}
            </button>
          </div>
        )}
      </div>

      {dqDayModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: 10, padding: '1.5rem', maxWidth: 480, width: '100%', marginTop: '4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, color: NAVY }}>
                Disqualify {selectedAngler?.full_name} — Day {selectedDay?.day_number}
              </div>
              <button onClick={() => { setDqDayModal(false); setDqDayReason('') }}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: GREY }}>✕</button>
            </div>
            <div style={{ fontSize: '0.82rem', color: GREY, marginBottom: '0.75rem' }}>
              Only this day's catches will be zeroed — {selectedAngler?.full_name}'s other days and their
              standing overall are untouched, and they will not show as disqualified anywhere else.
              To disqualify the whole competition instead, use the Participants tab.
            </div>
            <label style={S.label}>Reason for disqualification *</label>
            <textarea style={{ ...S.input, minHeight: 80, marginBottom: '0.75rem', resize: 'vertical' }}
              placeholder="Enter DQ reason…"
              value={dqDayReason} onChange={e => setDqDayReason(e.target.value)} />
            {error && <div style={{ color: RED, fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</div>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleDqDay} disabled={dqDaySaving || !dqDayReason.trim()}
                style={{ ...S.btn(RED), opacity: !dqDayReason.trim() ? 0.5 : 1 }}>
                {dqDaySaving ? 'Processing…' : '🚫 Confirm DQ'}
              </button>
              <button onClick={() => { setDqDayModal(false); setDqDayReason('') }} style={S.btn(GREY)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Species summary (points-method competitions) ─────────────────── */}
      {scoringMethod === 'points' ? (
        filteredSpeciesGroups.length === 0 ? (
          <div style={{ ...S.card, color: GREY, textAlign: 'center', fontStyle: 'italic' }}>
            No catches found for selected filters.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem', padding: '0 0.25rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: GREY, textTransform: 'uppercase' }}>Total Fish Caught: </span>
                <strong style={{ color: NAVY }}>{filteredSpeciesGroups.reduce((s, g) => s + g.fishCount, 0)}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: GREY, textTransform: 'uppercase' }}>Total Species Caught: </span>
                <strong style={{ color: NAVY }}>{filteredSpeciesGroups.length}</strong>
              </div>
              {anglerFilter !== 'all' && dayFilter !== 'all' && (() => {
                const rec = cpueData.byAnglerDay.find(a => a.participantId === anglerFilter && String(a.dayNumber) === String(dayFilter))
                return (
                  <div>
                    <span style={{ fontSize: '0.7rem', color: GREY, textTransform: 'uppercase' }}>CPUE (Fish Per Hour): </span>
                    {rec?.cpue != null
                      ? <strong style={{ color: NAVY }}>{rec.cpue.toFixed(2)}</strong>
                      : <span style={{ color: GREY, fontStyle: 'italic' }}>— add this boat's hours in Setup to see this</span>}
                  </div>
                )
              })()}
            </div>
            {allFilteredDQd && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={S.badge(RED)}>🚫 DQ</span>
                <span style={{ color: RED, fontSize: '0.88rem' }}><strong>Disqualified</strong> — {dqReason}</span>
              </div>
            )}
            {filteredSpeciesGroups.map(g => {
          const groupKey = g.speciesName
          const isExpanded = !!expandedGroups[groupKey]
          const hasClaim = g.rows.some(r => r.notes && r.data_quality !== 'rejected' && r.data_quality !== 'disqualified')
          const groupIsDQd = !allFilteredDQd && g.rows.length > 0 && g.rows.every(r => r.data_quality === 'disqualified')
          return (
            <div key={groupKey} style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 700, color: NAVY, display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {g.speciesName}
                    {hasClaim && <span style={S.badge(GOLD)}>🏆 Claim</span>}
                    {groupIsDQd && <span style={S.badge(RED)}>🚫 DQ</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: GREY, marginTop: 2 }}>
                    {g.fishCount} fish
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.68rem', color: GREY, textTransform: 'uppercase' }}>Points</div>
                    <div style={{ fontWeight: 700, color: NAVY, fontSize: '1.05rem' }}>{g.totalPoints.toFixed(2)}</div>
                  </div>
                  <button onClick={() => setExpandedGroups(p => ({ ...p, [groupKey]: !p[groupKey] }))}
                    style={{ ...S.btn(GREY), fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}>
                    {isExpanded ? '▲ Hide entries' : '▼ View entries'}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb', display: 'grid', gap: '0.4rem' }}>
                  {g.rows.map(c => {
                    const qColor = DQ_COLORS[c.data_quality] || GREY
                    const participant = resolveParticipant(c)
                    return (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', background: '#f8fafc', borderLeft: `3px solid ${qColor}`, borderRadius: 6, padding: '0.5rem 0.75rem' }}>
                        <div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: NAVY }}>{participant?.full_name}</span>
                          <span style={{ fontSize: '0.78rem', color: GREY }}>
                            {' · '}Day {c.competition_days?.day_number || '?'}
                            {c.data_quality === 'disqualified' && ' · 🚫 DQ'}
                            {c.data_quality === 'rejected' && ' · Rejected'}
                          </span>
                          {c.notes && <div style={{ fontSize: '0.75rem', color: GOLD, fontStyle: 'italic' }}>📌 {c.notes}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: c.data_quality === 'disqualified' ? RED : NAVY }}>
                            {c.data_quality === 'disqualified' ? '0' : parseFloat(c.points || 0).toFixed(2)}
                          </span>
                          {(isAdmin || isScorer) && !isLocked && (
                            <button onClick={() => setEditing(c)}
                              style={{ ...S.btn(), fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}>
                              ✏️ Edit
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
          </>
        )
      ) : (
        /* ── Catch cards (measured-mode competitions — no padding-row clutter, keep as-is) ── */
        filtered.length === 0 ? (
          <div style={{ ...S.card, color: GREY, textAlign: 'center', fontStyle: 'italic' }}>
            No catches found for selected filters.
          </div>
        ) : filtered.map(c => {
        const qColor = DQ_COLORS[c.data_quality] || GREY
        const participant = resolveParticipant(c)
        const team = c.competition_teams
        return (
          <div key={c.id} style={{ ...S.card, borderLeft: `4px solid ${qColor}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 700, color: NAVY, display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {c.data_quality === 'disqualified' && <span style={S.badge(RED)}>🚫 DQ</span>}
                  {c.data_quality === 'rejected'     && <span style={S.badge('#9ca3af')}>Rejected</span>}
                  {c.data_quality === 'verified'     && <span style={S.badge(GREEN)}>✓ Verified</span>}
                  {c.notes && c.data_quality !== 'rejected' && c.data_quality !== 'disqualified' && (
                    <span style={S.badge(GOLD)} title={c.notes}>🏆 Claim</span>
                  )}
                  {c.species_name}
                  {c.weight_kg && <span style={{ fontWeight: 400, color: GREY }}>{parseFloat(c.weight_kg).toFixed(2)} kg</span>}
                </div>
                <div style={{ fontSize: '0.8rem', color: GREY, marginTop: 2 }}>
                  {participant?.full_name}
                  {team && ` · ${team.team_name || team.province}`}
                  {` · Day ${c.competition_days?.day_number || '?'}`}
                  {c.line_class_kg && ` · ${c.line_class_kg}kg LC`}
                </div>
                {c.notes && (
                  <div style={{ fontSize: '0.78rem', color: GOLD, marginTop: 2, fontStyle: 'italic' }}>
                    📌 {c.notes}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.68rem', color: GREY, textTransform: 'uppercase' }}>Points</div>
                  <div style={{ fontWeight: 700, color: c.data_quality === 'disqualified' ? RED : NAVY, fontSize: '1.05rem' }}>
                    {c.data_quality === 'disqualified' ? '0' : parseFloat(c.points || 0).toFixed(2)}
                  </div>
                </div>
                {(isAdmin || isScorer) && !isLocked && (
                  <button onClick={() => setEditing(c)}
                    style={{ ...S.btn(), fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}>
                    ✏️ Edit
                  </button>
                )}
              </div>
            </div>
          </div>
        )
        })
      )}

      {/* ── Boat Summary (per boat, per day) ──────────────────────────────── */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setShowBoatSummary(p => !p)}>
          <div style={{ fontWeight: 700, color: NAVY, fontSize: '0.95rem' }}>📊 Boat Summary</div>
          <button style={{ ...S.btn(GREY), fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}>
            {showBoatSummary ? '▲ Hide' : '▼ Show'}
          </button>
        </div>
        {showBoatSummary && (
          !boatSummaryData || boatSummaryData.length === 0 ? (
            <div style={{ color: GREY, fontStyle: 'italic', fontSize: '0.85rem', marginTop: '0.75rem' }}>
              No catches logged yet.
            </div>
          ) : (
            <div style={{ marginTop: '0.75rem', display: 'grid', gap: '1.25rem' }}>
              {boatSummaryData.map(b => (
                <div key={b.boatName}>
                  <div style={{ fontWeight: 700, color: NAVY, fontSize: '0.92rem', marginBottom: '0.4rem' }}>{b.boatName}</div>
                  {dayFilter !== 'all' ? (
                    (() => {
                      const totalFish    = b.species.reduce((s, g) => s + g.fishCount, 0)
                      const totalSpecies = b.species.length
                      const boatCpue = cpueData.byBoatDay.find(bd => bd.boatName === b.boatName && String(bd.dayNumber) === String(dayFilter))
                      return (
                        <>
                          <div style={{ fontSize: '0.78rem', color: GREY, marginBottom: '0.35rem' }}>
                            <strong style={{ color: NAVY }}>{totalFish}</strong> total fish · <strong style={{ color: NAVY }}>{totalSpecies}</strong> species
                            {boatCpue?.cpue != null && <> · CPUE (Fish Per Hour): <strong style={{ color: NAVY }}>{boatCpue.cpue.toFixed(2)}</strong></>}
                          </div>
                          <div style={{ display: 'grid', gap: '0.25rem' }}>
                            {b.species.map(g => (
                              <div key={g.speciesName} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', background: '#f8fafc', borderRadius: 6, padding: '0.35rem 0.65rem' }}>
                                <span>{g.speciesName}</span>
                                <span style={{ color: GREY }}>{g.fishCount} fish · <strong style={{ color: NAVY }}>{g.totalPoints.toFixed(2)} pts</strong></span>
                              </div>
                            ))}
                          </div>
                        </>
                      )
                    })()
                  ) : (
                    <div style={{ display: 'grid', gap: '0.6rem', paddingLeft: '0.5rem', borderLeft: '2px solid #e5e7eb' }}>
                      {b.days.map(d => {
                        const totalFish    = d.species.reduce((s, g) => s + g.fishCount, 0)
                        const totalSpecies = d.species.length
                        const boatCpue = cpueData.byBoatDay.find(bd => bd.boatName === b.boatName && String(bd.dayNumber) === String(d.dayNumber))
                        return (
                          <div key={d.dayNumber}>
                            <div style={{ fontSize: '0.82rem', color: NAVY, fontWeight: 600, marginBottom: '0.3rem' }}>
                              Day {d.dayNumber}
                              <span style={{ fontWeight: 400, color: GREY, marginLeft: 6 }}>
                                — {totalFish} total fish · {totalSpecies} species
                                {boatCpue?.cpue != null && ` · CPUE: ${boatCpue.cpue.toFixed(2)}`}
                              </span>
                            </div>
                            <div style={{ display: 'grid', gap: '0.25rem' }}>
                              {d.species.map(g => (
                                <div key={g.speciesName} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', background: '#f8fafc', borderRadius: 6, padding: '0.35rem 0.65rem' }}>
                                  <span>{g.speciesName}</span>
                                  <span style={{ color: GREY }}>{g.fishCount} fish · <strong style={{ color: NAVY }}>{g.totalPoints.toFixed(2)} pts</strong></span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── Competition Summary (whole event, all anglers/days/boats) ────── */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setShowCompSummary(p => !p)}>
          <div style={{ fontWeight: 700, color: NAVY, fontSize: '0.95rem' }}>🏆 Competition Summary</div>
          <button style={{ ...S.btn(GREY), fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}>
            {showCompSummary ? '▲ Hide' : '▼ Show'}
          </button>
        </div>
        {showCompSummary && (
          competitionSpeciesGroups.length === 0 ? (
            <div style={{ color: GREY, fontStyle: 'italic', fontSize: '0.85rem', marginTop: '0.75rem' }}>
              No catches logged yet.
            </div>
          ) : (() => {
            const totalFish    = competitionSpeciesGroups.reduce((s, g) => s + g.fishCount, 0)
            const totalSpecies = competitionSpeciesGroups.length
            const maxFish      = Math.max(...competitionSpeciesGroups.map(g => g.fishCount), 1)
            return (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: GREY, textTransform: 'uppercase' }}>Total Fish Caught</div>
                    <div style={{ fontWeight: 700, color: NAVY, fontSize: '1.3rem' }}>{totalFish}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: GREY, textTransform: 'uppercase' }}>Total Species Caught</div>
                    <div style={{ fontWeight: 700, color: NAVY, fontSize: '1.3rem' }}>{totalSpecies}</div>
                  </div>
                </div>

                {/* Simple inline bar chart — no charting library dependency,
                    just proportional div widths, consistent with how the
                    rest of this codebase is built (inline styles only). */}
                <div style={{ display: 'grid', gap: '0.4rem', marginBottom: '1rem' }}>
                  {competitionSpeciesGroups.map(g => (
                    <div key={g.speciesName} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 70px', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.78rem', color: NAVY, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.speciesName}</span>
                      <div style={{ background: '#eef2ff', borderRadius: 4, height: 16, position: 'relative' }}>
                        <div style={{ background: NAVY, borderRadius: 4, height: '100%', width: `${(g.fishCount / maxFish) * 100}%`, minWidth: 2 }} />
                      </div>
                      <span style={{ fontSize: '0.78rem', color: GREY, textAlign: 'right' }}>{g.fishCount} fish</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gap: '0.25rem' }}>
                  {competitionSpeciesGroups.map(g => (
                    <div key={g.speciesName} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', background: '#f8fafc', borderRadius: 6, padding: '0.4rem 0.75rem' }}>
                      <span style={{ fontWeight: 600, color: NAVY }}>{g.speciesName}</span>
                      <span style={{ color: GREY }}>{g.fishCount} fish · <strong style={{ color: NAVY }}>{g.totalPoints.toFixed(2)} pts</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()
        )}
      </div>

      {/* ── Edit Modal ───────────────────────────────────────────────────── */}
      {editing && (
        <CatchEditModal
          catch_={editing}
          config={config}
          participants={participants}
          days={days}
          onSave={() => { setEditing(null); onCatchUpdate() }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ── CatchEditModal ────────────────────────────────────────────────────────────
function CatchEditModal({ catch_, config, participants, days, onSave, onClose }) {
  const scoringMethod = config?.scoring?.method || 'percentage'
  const [form,   setForm]   = useState({
    species_name:   catch_.species_name   || '',
    weight_kg:      catch_.weight_kg      || '',
    length_cm:      catch_.length_cm      || '',
    line_class_kg:  catch_.line_class_kg  || '',
    data_quality:   catch_.data_quality   || 'unverified',
    notes:          catch_.notes          || '',
    retained:       catch_.retained       ?? true,
    scoring:        catch_.scoring        ?? true,
    is_over_line:   catch_.is_over_line   ?? false,
    competition_day_id: catch_.competition_day_id || '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleSave() {
    setSaving(true); setError('')
    const scoringConfig = config?.scoring || {}
    let points

    if (scoringMethod === 'points') {
      // Real-world data showed species_sequence is null on every row the
      // catch logger writes, not 1/2/3 as originally assumed — and a
      // multi-fish unit_count catch (e.g. "2 Yellowtail") is saved as
      // MULTIPLE rows, with only the first carrying the real total
      // (SUM(points) across the group is the source of truth) and every
      // additional row intentionally holding points = 0 as a placeholder.
      // Recomputing "as if" this row is exactly 1 fish with no sibling
      // context — which is all this modal has — either zeroes out a
      // legitimate multi-fish total or re-inflates an intentional zero
      // padding row. Both happened in testing. So: never recompute a
      // 'points'-method score here. The only safe, unambiguous change is
      // zeroing it on Disqualified; everything else preserves whatever the
      // catch logger originally calculated with full context.
      points = form.data_quality === 'disqualified' ? 0 : parseFloat(catch_.points ?? 0)
    } else {
      const result = calculateCatchPoints({
        scoringConfig,
        weightKg:    parseFloat(form.weight_kg) || 0,
        lineClassKg: parseInt(form.line_class_kg) || scoringConfig?.line_class?.default_kg || 10,
        fishCount:   1,
        isBillfish:  false,
        isKingfishRelease: false,
        isFirstFish: true,
      })
      points = result.points
    }

    const { error: err } = await supabase
      .from('competition_catches')
      .update({
        ...form,
        weight_kg:     parseFloat(form.weight_kg) || null,
        length_cm:     parseFloat(form.length_cm) || null,
        line_class_kg: parseInt(form.line_class_kg) || null,
        is_over_line:  !!form.is_over_line,
        points:        form.data_quality === 'disqualified' ? 0 : points,
        scored_at:     new Date().toISOString(),
      })
      .eq('id', catch_.id)

    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false)
    onSave()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: 10, padding: '1.5rem', maxWidth: 600, width: '100%', marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 700, color: NAVY }}>Edit Catch</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: GREY }}>✕</button>
        </div>

        {scoringMethod === 'points' && (
          <div style={{ fontSize: '0.8rem', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '0.6rem 0.75rem', marginBottom: '0.75rem' }}>
            ⚠ Points are preserved as originally logged and are not recalculated here — a multi-fish catch (e.g. "2 Yellowtail") is saved as several rows where only one carries the real total, so recomputing in isolation can silently corrupt it. To fix a wrong species or fish count, set Data Quality to Rejected below and have it re-logged through the Catch Logger instead of editing it here.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={S.label}>Species</label>
            <input style={S.input} value={form.species_name}
              onChange={e => setForm(f => ({ ...f, species_name: e.target.value }))} />
          </div>
          <div>
            <label style={S.label}>Weight (kg)</label>
            <input style={S.input} type="number" step="0.001" value={form.weight_kg}
              onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))} />
          </div>
          <div>
            <label style={S.label}>Length (cm)</label>
            <input style={S.input} type="number" step="0.1" value={form.length_cm}
              onChange={e => setForm(f => ({ ...f, length_cm: e.target.value }))} />
          </div>
          {config?.scoring?.line_class?.enabled && (
            <div>
              <label style={S.label}>Line Class (kg)</label>
              <select style={S.select} value={form.line_class_kg}
                onChange={e => setForm(f => ({ ...f, line_class_kg: e.target.value }))}>
                <option value="">— Select —</option>
                {(config.scoring.line_class.available_classes || []).map(lc => (
                  <option key={lc} value={lc}>{lc} kg</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label style={S.label}>Day</label>
            <select style={S.select} value={form.competition_day_id}
              onChange={e => setForm(f => ({ ...f, competition_day_id: e.target.value }))}>
              {days.map(d => <option key={d.id} value={d.id}>Day {d.day_number} — {d.date}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Data Quality</label>
            <select style={S.select} value={form.data_quality}
              onChange={e => setForm(f => ({ ...f, data_quality: e.target.value }))}>
              <option value="unverified">Unverified</option>
              <option value="verified">Verified</option>
              <option value="flagged">Flagged</option>
              <option value="disqualified">Disqualified (score = 0)</option>
              <option value="rejected">Rejected (excluded)</option>
            </select>
          </div>
          {scoringMethod === 'points' && (
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.6rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={form.is_over_line}
                  onChange={e => setForm(f => ({ ...f, is_over_line: e.target.checked }))} />
                Over Line Class (record only — doesn't recalculate points here)
              </label>
            </div>
          )}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={S.label}>Notes</label>
            <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        {error && <div style={{ color: RED, fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleSave} disabled={saving} style={S.btn(GREEN)}>
            {saving ? 'Saving…' : '✓ Save Changes'}
          </button>
          <button onClick={onClose} style={S.btn(GREY)}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
