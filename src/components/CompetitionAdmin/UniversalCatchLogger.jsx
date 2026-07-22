// ─── UniversalCatchLogger ────────────────────────────────────────────────────
// Angler-facing competition catch entry. Replaces GamefishCatchLogger.jsx and
// AllCoastalsCatchLogger.jsx with a single data-driven component that reads
// species_config / scoring_config / team_config from the competition's
// template (via useCompetitionConfig) instead of hardcoding teams, species,
// and scoring formulas per competition.
//
// Usage:
//   import UniversalCatchLogger from './components/CompetitionAdmin/UniversalCatchLogger'
//   <UniversalCatchLogger competitionId="uuid-here" />
//
// Two fundamentally different data shapes exist across competition types,
// per species_config.eligible_species[].entry_mode:
//   'measured'   — each fish is its own record: species + weight and/or
//                   length (Gamefish, Tuna, Billfish). One draft row per fish.
//                   Weight can be entered directly or auto-calculated from
//                   length via the species' length-weight formula.
//   'unit_count' — no weight or length, just a tally of how many of each
//                   species were landed, plus an optional over-line flag
//                   per fish (All Coastals). One draft row per ELIGIBLE
//                   SPECIES (not per fish) — bag limits are per-species.
//
// A single competition's species list can mix both modes in principle
// (e.g. trophy species measured, everything else counted), so the entry
// tab renders two sections when both modes are present in species_config.
//
// Flow (mirrors the old loggers' angler-facing UX):
//   1. Select day
//   2. Select team (traditional format) or boat (split_boat format)
//   3. Select angler
//   4. Draft card — add/edit/remove measured fish and/or adjust unit-count
//      species tallies, live points
//   5. Save — diffs draft against existing competition_catches rows for
//      this angler+day and inserts/updates/deletes only what changed
//   6. Team/Boat summary tab — live aggregation across teammates
//
// Replaces: GamefishCatchLogger.jsx, AllCoastalsCatchLogger.jsx (archive after
// this is verified against both Gamefish Nationals 2026 and All Coastal IP 2026
// historical data).

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useCompetitionConfig } from './hooks/useCompetitionConfig'
import { useCatchLoggerData } from './hooks/useCatchLoggerData'
import {
  buildSpeciesPicker,
  findSpeciesConfig,
  findSpeciesRowByName,
  estimateWeightFromLength,
  scoreDraftFish,
  validateDraftFish,
  computeSpeciesMultiplier,
} from './utils/catchLoggerScoring'

// ─── STYLES ───────────────────────────────────────────────────────────────────
const NAVY = '#1e3a8a'
const GOLD = '#d97706'
const GREEN = '#16a34a'
const RED = '#dc2626'
const PURPLE = '#7c3aed'
const BLUE = '#3b82f6'

const S = {
  page:   { maxWidth: 900, margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' },
  header: { background: NAVY, color: 'white', padding: '1rem 1.5rem', borderRadius: 8, marginBottom: '1.25rem' },
  card:   { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.10)', marginBottom: '1rem' },
  label:  { fontSize: '0.78rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' },
  select: { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.95rem', background: 'white', boxSizing: 'border-box' },
  input:  { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' },
  btn:    (bg = NAVY, color = 'white') => ({ background: bg, color, border: 'none', padding: '0.55rem 1.1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }),
  grid2:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  row:    { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
  badge:  (color) => ({ background: color, color: 'white', padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700 }),
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Every saved competition_catches row is one fish, regardless of mode:
//   measured   -> weight_kg/length_cm populated, one row per fish caught
//   unit_count -> weight_kg/length_cm null, is_over_line flagged where
//                 applicable; the UI aggregates these into a per-species
//                 count (see aggregateUnitCountRows below) but the database
//                 always stores one row per fish, consistent across modes.
function rowToMeasuredDraft(row) {
  return {
    _id: row.id,
    species: row.species_name || '',
    weight_kg: row.weight_kg != null ? String(row.weight_kg) : '',
    length_cm: row.length_cm != null ? String(row.length_cm) : '',
    line_class_kg: row.line_class_kg || '',
    // measured_min_size didn't exist as a column until the schema migration
    // that added it — every row saved before that defaults to false
    // regardless of what actually happened on the water. A row that
    // already has real points recorded was clearly scored as a valid
    // release under whatever rules applied at save time, so treat it as
    // confirmed rather than retroactively flagging historical catches as
    // unconfirmed. Only a genuinely fresh row (no points yet) needs the
    // angler to actively tick the box.
    measured_min_size: !!row.measured_min_size || (parseFloat(row.points) > 0),
    weightSource: 'saved',
    notes: row.notes || '',
  }
}

// Unit-count species are stored as one competition_catches row PER FISH
// (consistent with the rest of the table), with weight_kg/length_cm left
// null and is_over_line flagged per row. The UI aggregates these rows into
// a single stepper per species — this function does that aggregation,
// keeping the list of underlying row ids so the save logic can diff
// against them individually (rather than against one synthetic row).
function aggregateUnitCountRows(rows, speciesName) {
  const matching = rows.filter(r => r.species_name === speciesName)
  const overLineRows = matching.filter(r => r.is_over_line)
  return {
    species: speciesName,
    fishCount: matching.length,
    overLineCount: overLineRows.length,
    // Per-over-line-fish measured length (cm) — only populated/used for
    // weight-formula-bonus species (Red Steenbras); empty for everything
    // else, matching the old behaviour exactly.
    overLineLengths: overLineRows.map(r => (r.length_cm != null ? String(r.length_cm) : '')),
    _rowIds: matching.map(r => r.id),
  }
}

// competition_templates.team_format is constrained to one of:
// 'split_boat' | 'full_boat' | 'individual' | 'pairs'. The catch logger's
// only real branch is: does the team stay on one boat (full_boat —
// shows a Team picker) or get redrawn across boats daily (split_boat —
// shows a Boat picker)? 'individual'/'pairs' competitions have no boat
// concept either and are treated the same as full_boat here.
const isTeamBased = (teamConfig) => (teamConfig?.team_format || 'full_boat') !== 'split_boat'

export default function UniversalCatchLogger({ competitionId }) {
  const { user } = useAuth()

  const { competition, config, loading: configLoading, error: configError } = useCompetitionConfig(competitionId)
  const {
    participants, days, boats, loadingMeta, metaError,
    getBoatAnglersForDay, getAnglerBoatForDay,
    loadAnglerDayCatches, loadTeamDayCatches, loadBoatDayCatches,
  } = useCatchLoggerData(competitionId)

  const [searchParams] = useSearchParams()
  // Deep-link resolution (below) sets day, then boatId/teamId, then
  // participantId across several state updates in one go. Each of those
  // changes is exactly what the two reset-effects below normally watch for
  // to clear a person's in-progress manual selection — so a single shared
  // "skip resets" flag doesn't work here: whichever effect runs first on
  // the next render consumes it, leaving the second effect to fire
  // normally and wipe out what deep-link just set (this is exactly what
  // was happening — Marinus's boat was being resolved correctly, then
  // cleared one render later). Each effect gets its own one-shot flag,
  // armed together just before the deep-link's state changes, so neither
  // can be silently starved by the other firing first.
  const skipDayResetRef      = useRef(false)
  const skipTeamBoatResetRef = useRef(false)
  const didInitRef = useRef(false) // guards the deep-link effect itself from re-running

  const [day, setDay] = useState('')
  const [teamId, setTeamId] = useState('')
  const [boatId, setBoatId] = useState('')
  const [participantId, setParticipantId] = useState('')

  // Measured-mode draft: array of fish rows (one per fish)
  const [measuredDraft, setMeasuredDraft] = useState([])
  // Unit-count-mode draft: array of species rows (one per eligible species,
  // always fully populated from species_config — count starts at 0)
  const [unitCountDraft, setUnitCountDraft] = useState([])

  const [originalRows, setOriginalRows] = useState([])
  const [recordNote, setRecordNote] = useState('')
  const [loadingCard, setLoadingCard] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('entry')
  const [summaryRows, setSummaryRows] = useState([])

  const splitBoatFormat = !isTeamBased(config?.team)
  const speciesPicker = useMemo(() => buildSpeciesPicker(config?.species), [config])

  // Split eligible species by entry_mode once, since each draft array is
  // built/rendered independently.
  const measuredSpecies = useMemo(
    () => (config?.species?.eligible_species || []).filter(s => (s.entry_mode || 'measured') !== 'unit_count'),
    [config]
  )
  const unitCountSpecies = useMemo(
    () => (config?.species?.eligible_species || []).filter(s => s.entry_mode === 'unit_count'),
    [config]
  )
  const hasMeasured = measuredSpecies.length > 0
  const hasUnitCount = unitCountSpecies.length > 0

  const selectedDay = days.find(d => String(d.id) === String(day)) || null
  const teams = useMemo(() => {
    const map = new Map()
    for (const p of participants) {
      const t = p.competition_teams
      if (t && !map.has(t.id)) map.set(t.id, t)
    }
    return Array.from(map.values())
  }, [participants])

  const team = teams.find(t => t.id === teamId) || null
  const boat = boats.find(b => b.id === boatId) || null

  const availableAnglers = useMemo(() => {
    if (splitBoatFormat) {
      if (!boatId || !selectedDay) return []
      return getBoatAnglersForDay(boatId, selectedDay.id)
    }
    if (!teamId) return []
    return participants.filter(p => p.competition_teams?.id === teamId)
  }, [splitBoatFormat, boatId, teamId, selectedDay, participants, getBoatAnglersForDay])

  const participant = participants.find(p => p.id === participantId) || null

  useEffect(() => {
    if (skipDayResetRef.current) { skipDayResetRef.current = false; return }
    setTeamId(''); setBoatId(''); setParticipantId('')
  }, [day])
  useEffect(() => {
    if (skipTeamBoatResetRef.current) { skipTeamBoatResetRef.current = false; return }
    setParticipantId('')
  }, [teamId, boatId])

  // ── Deep-link resolution ─────────────────────────────────────────────────
  // Arriving via ?participantId=X (and optionally &day=N) jumps straight to
  // that angler's card instead of making the person click through
  // Day → Boat/Team → Angler manually. The Scoring tab's "+ Log Catch" link
  // carries both when a specific day is selected there; a Scoreboard name
  // click only ever carries participantId (standings aggregate across all
  // days, so there's no specific day to pass), in which case this falls
  // back to the earliest fishing day.
  useEffect(() => {
    if (didInitRef.current) return
    // Both loading flags matter here: loadingMeta (participants/days/boats/
    // draws) and configLoading (splitBoatFormat, derived from config, comes
    // from a completely separate hook). If config hadn't finished loading
    // yet at this exact moment, splitBoatFormat could be computed wrong
    // just this once — sending resolution down the wrong branch — and
    // since this effect never retries once didInitRef is set, it would
    // stay wrong permanently rather than self-correct when config arrived
    // a moment later. This was silently misrouting boat resolution.
    if (loadingMeta || configLoading || days.length === 0) return

    const linkParticipantId = searchParams.get('participantId')
    if (linkParticipantId) {
      const requestedDayNum = parseInt(searchParams.get('day'), 10)
      const sortedDays = [...days].sort((a, b) => a.day_number - b.day_number)
      const targetDay = (!Number.isNaN(requestedDayNum) && sortedDays.find(d => d.day_number === requestedDayNum))
        || sortedDays[0]

      skipDayResetRef.current = true
      skipTeamBoatResetRef.current = true
      setDay(targetDay.id)
      if (splitBoatFormat) {
        const matchedBoat = getAnglerBoatForDay(linkParticipantId, targetDay.id)
        if (matchedBoat) setBoatId(matchedBoat.id)
      } else {
        const p = participants.find(pp => pp.id === linkParticipantId)
        if (p?.competition_teams?.id) setTeamId(p.competition_teams.id)
      }
      setParticipantId(linkParticipantId)
    }

    didInitRef.current = true
  }, [loadingMeta, configLoading, days, participants, splitBoatFormat, getAnglerBoatForDay, searchParams])

  // ── Load existing card when angler + day selected ───────────────────────────
  useEffect(() => {
    if (!participant || !selectedDay) {
      setMeasuredDraft([]); setUnitCountDraft([]); setOriginalRows([]); setRecordNote('')
      return
    }
    let cancelled = false
    setLoadingCard(true)
    setSaved(false); setError('')
    loadAnglerDayCatches(participant, selectedDay.id).then(rows => {
      if (cancelled) return
      setOriginalRows(rows)

      // Measured rows: anything whose species name matches a measured-mode
      // species config entry (or has no config match at all — preserve it
      // rather than silently drop data if species_config changes later).
      const measuredRows = rows.filter(r => {
        const cfg = findSpeciesConfig(config?.species, r.species_name)
        return !cfg || (cfg.entry_mode || 'measured') !== 'unit_count'
      })
      setMeasuredDraft(measuredRows.map(rowToMeasuredDraft))

      // Unit-count rows: always rebuild the FULL eligible species list so
      // every species shows a stepper. Each species' count is the number
      // of individual competition_catches rows matching that species name
      // (one row per fish, consistent with the rest of the table).
      setUnitCountDraft(unitCountSpecies.map(sp => aggregateUnitCountRows(rows, sp.name)))

      // Only surface genuine free-text angler notes as the Record/PB claim —
      // not auto-generated scoring-detail text like the kingfish release
      // explainer, which lives in `notes` for historical rows because that
      // was the only text field available before this UI existed. A simple
      // heuristic: scoring-detail notes always start with the species hint
      // text pattern; anything else is treated as a real angler note.
      const realNote = rows.find(r => r.notes && !/^[A-Za-z]+ photo-release —/.test(r.notes))
      setRecordNote(realNote?.notes || '')
      setLoadingCard(false)
    })
    return () => { cancelled = true }
  }, [participant?.id, selectedDay?.id, loadAnglerDayCatches, unitCountSpecies, config])

  // ── Load team/boat summary ───────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedDay) { setSummaryRows([]); return }
    if (splitBoatFormat) {
      if (!boatId) { setSummaryRows([]); return }
      loadBoatDayCatches(boatId, selectedDay.id).then(setSummaryRows)
    } else {
      if (!teamId) { setSummaryRows([]); return }
      loadTeamDayCatches(teamId, selectedDay.id).then(setSummaryRows)
    }
  }, [splitBoatFormat, boatId, teamId, selectedDay, saved, loadBoatDayCatches, loadTeamDayCatches])

  // ── Measured draft mutators ──────────────────────────────────────────────────
  const measuredBagLimit = config?.scoring?.bag_limit || 10

  const addMeasuredFish = () => {
    if (measuredDraft.length >= measuredBagLimit) return
    setMeasuredDraft(prev => [...prev, {
      species: '', weight_kg: '', length_cm: '', line_class_kg: participant?.line_class_kg || '',
      measured_min_size: false, weightSource: 'manual', notes: '',
    }])
  }
  const updateMeasuredFish = (i, fish) => setMeasuredDraft(prev => prev.map((f, idx) => idx === i ? fish : f))
  const removeMeasuredFish = (i) => setMeasuredDraft(prev => prev.filter((_, idx) => idx !== i))

  const onMeasuredSpeciesChange = (i, speciesName) => {
    const cfg = findSpeciesConfig(config?.species, speciesName)
    updateMeasuredFish(i, {
      ...measuredDraft[i],
      species: speciesName,
      weight_kg: (cfg?.billfish || cfg?.kingfish_release) ? '' : measuredDraft[i].weight_kg,
      measured_min_size: false,
    })
  }

  // ── Weight-from-length auto-calc for measured rows ──────────────────────────
  const [autoWeights, setAutoWeights] = useState({}) // index -> { weightKg, source, reference }
  const [calculatingIndex, setCalculatingIndex] = useState(null)

  const tryAutoCalc = useCallback(async (index, fish) => {
    if (!fish.species || !fish.length_cm || fish.weightSource === 'manual_override') {
      setAutoWeights(prev => { const next = { ...prev }; delete next[index]; return next })
      return
    }
    setCalculatingIndex(index)
    const speciesRow = await findSpeciesRowByName(supabase, fish.species)
    if (!speciesRow) { setCalculatingIndex(null); return }
    const estimate = await estimateWeightFromLength(supabase, speciesRow, fish.length_cm, speciesRow.default_length_type)
    setCalculatingIndex(null)
    if (estimate) {
      setAutoWeights(prev => ({ ...prev, [index]: estimate }))
    } else {
      setAutoWeights(prev => { const next = { ...prev }; delete next[index]; return next })
    }
  }, [])

  useEffect(() => {
    // Re-run auto-calc whenever a measured row's species or length changes
    // and it doesn't already have a manually-entered weight.
    measuredDraft.forEach((fish, i) => {
      if (fish.length_cm && fish.species && !fish.weight_kg) {
        tryAutoCalc(i, fish)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measuredDraft.map(f => `${f.species}|${f.length_cm}|${f.weight_kg}`).join(',')])

  const useCalculatedWeight = (i) => {
    const est = autoWeights[i]
    if (!est) return
    updateMeasuredFish(i, { ...measuredDraft[i], weight_kg: est.weightKg.toFixed(2), weightSource: 'calculated' })
  }

  // ── Unit-count draft mutators ────────────────────────────────────────────────
  const updateUnitCount = (speciesName, patch) => {
    setUnitCountDraft(prev => prev.map(r => r.species === speciesName ? { ...r, ...patch } : r))
  }

  // ── Over-line weight-formula bonus (unit-count rows) ────────────────────────
  // For species with over_line_bonus_type === 'weight_formula' (currently
  // just Red Steenbras at East London 2026), each entered over-line fork
  // length is converted to weight via the same species-formula lookup
  // measured-mode rows already use (estimateWeightFromLength), then floored
  // to whole kilograms per fish and summed — matching the tournament rule
  // that this species' over-line bonus equals its converted weight in kg,
  // not the flat over_line_bonus every other species gets. Async (needs a
  // Supabase round trip for the formula), same pattern as tryAutoCalc below.
  const [weightFormulaBonuses, setWeightFormulaBonuses] = useState({}) // species -> { total, computing, error }

  useEffect(() => {
    let cancelled = false
    async function computeAll() {
      for (const row of unitCountDraft) {
        const cfg = findSpeciesConfig(config?.species, row.species)
        if (cfg?.over_line_bonus_type !== 'weight_formula') continue
        const lengths = (row.overLineLengths || []).filter(l => l !== '' && l != null)
        if (lengths.length === 0) {
          setWeightFormulaBonuses(prev => ({ ...prev, [row.species]: { total: 0, computing: false } }))
          continue
        }
        setWeightFormulaBonuses(prev => ({ ...prev, [row.species]: { ...(prev[row.species] || {}), computing: true } }))
        const speciesRow = await findSpeciesRowByName(supabase, row.species)
        if (cancelled) return
        if (!speciesRow) {
          setWeightFormulaBonuses(prev => ({ ...prev, [row.species]: { total: 0, computing: false, error: 'No formula found for this species' } }))
          continue
        }
        let total = 0
        for (const len of lengths) {
          const est = await estimateWeightFromLength(supabase, speciesRow, len, speciesRow.default_length_type)
          if (est) total += Math.floor(est.weightKg)
        }
        if (cancelled) return
        setWeightFormulaBonuses(prev => ({ ...prev, [row.species]: { total, computing: false } }))
      }
    }
    computeAll()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitCountDraft.map(r => `${r.species}|${(r.overLineLengths || []).join(',')}`).join(';'), config])

  // ── Live scoring ──────────────────────────────────────────────────────────────
  const scoringMethod = config?.scoring?.method || 'percentage'
  const usesMultiplier = !!config?.scoring?.species_multiplier

  const scoredMeasured = useMemo(() => {
    const seenSpecies = new Set()
    return measuredDraft.map(fish => {
      const cfg = findSpeciesConfig(config?.species, fish.species)
      const isFirstOfSpecies = fish.species && !seenSpecies.has(fish.species)
      if (fish.species) seenSpecies.add(fish.species)
      const scored = scoreDraftFish({ ...fish, isFirstOfSpecies }, cfg, config?.scoring)
      const warning = validateDraftFish(fish, cfg)
      return { ...fish, _cfg: cfg, _scored: scored, _warning: warning }
    })
  }, [measuredDraft, config])

  const scoredUnitCount = useMemo(() => {
    return unitCountDraft.map(row => {
      const cfg = findSpeciesConfig(config?.species, row.species)
      const isFirstOfSpecies = row.fishCount > 0 // each species is its own row here, so "first" = "has any"
      const bonusEntry = cfg?.over_line_bonus_type === 'weight_formula' ? weightFormulaBonuses[row.species] : null
      const scored = scoreDraftFish({ ...row, isFirstOfSpecies, overLineBonusPoints: bonusEntry?.total }, cfg, config?.scoring)
      const warning = validateDraftFish(row, cfg)
      return { ...row, _cfg: cfg, _scored: scored, _warning: warning, _overLineBonusComputing: !!bonusEntry?.computing, _overLineBonusError: bonusEntry?.error }
    })
  }, [unitCountDraft, config, weightFormulaBonuses])

  const { speciesCount, multiplier } = useMemo(() => {
    const combined = [
      ...measuredDraft,
      ...unitCountDraft.filter(r => r.fishCount > 0),
    ]
    return computeSpeciesMultiplier(combined, config?.species)
  }, [measuredDraft, unitCountDraft, config])

  const measuredRawPoints = scoredMeasured.reduce((sum, f) => sum + (f._warning ? 0 : f._scored.points), 0)
  const unitCountRawPoints = scoredUnitCount.reduce((sum, f) => sum + (f._warning ? 0 : f._scored.points), 0)
  const rawPoints = measuredRawPoints + unitCountRawPoints
  const finalPoints = usesMultiplier
    ? parseFloat((rawPoints * multiplier).toFixed(2))
    : parseFloat(rawPoints.toFixed(2))

  const validMeasuredCount = scoredMeasured.filter(f => f.species && !f._warning).length
  const validUnitCountTotal = scoredUnitCount.reduce((sum, r) => sum + (r._warning ? 0 : (r.fishCount || 0)), 0)
  const totalValidFish = validMeasuredCount + validUnitCountTotal

  // Blocks saving mid-calculation: without this, hitting Save while a
  // Red-Steenbras-style weight-formula bonus is still resolving would
  // persist that fish's over-line bonus as 0 (the not-yet-computed
  // default) instead of waiting for the real figure.
  const overLineBonusPending = scoredUnitCount.some(r => r._overLineBonusComputing)

  // ── Save: diff both drafts against originalRows ─────────────────────────────
  const handleSave = async () => {
    if (!participant || !selectedDay) return
    setSaving(true); setError('')

    try {
      const keptIds = new Set()
      const baseFields = {
        competition_id: competitionId,
        competition_day_id: selectedDay.id,
        angler_id: participant.user_id,
        participant_id: participant.id,
        team_id: teamId || participant.competition_teams?.id || null,
        boat_id: splitBoatFormat ? (boatId || null) : null,
        fishing_date: selectedDay.date || null,
        entered_by: user?.id,
      }
      // Only applied to brand-new rows (see insert branches below) — never
      // to updates of existing rows. Previously data_quality lived in
      // baseFields and got spread into every payload including updates,
      // which meant re-saving a scorecard silently overwrote any admin
      // Reject/Disqualify back to the default every time. Verified by
      // default here since John/Malcolm log catches directly themselves
      // rather than running a two-step angler-reports/official-verifies
      // flow — Rejected still requires an explicit edit afterward, and
      // that edit now sticks even if the scorecard is later re-saved.
      const newRowDataQuality = 'verified'

      // Measured rows: one row per fish
      let recordNoteAttached = false
      for (const fish of scoredMeasured) {
        if (!fish.species || fish._warning) continue
        // recordNote is a single card-level field (the angler's PB/record
        // claim for the day) — attach it to just the first fish rather than
        // overwriting every row's own notes with the same text, which would
        // both duplicate it and destroy any per-row notes already present.
        const noteForThisRow = !recordNoteAttached && recordNote ? recordNote : (fish.notes || null)
        if (!recordNoteAttached && recordNote) recordNoteAttached = true
        const payload = {
          ...baseFields,
          species_name: fish.species,
          weight_kg: fish.weight_kg ? parseFloat(fish.weight_kg) : null,
          length_cm: fish.length_cm ? parseFloat(fish.length_cm) : null,
          line_class_kg: fish.line_class_kg ? parseInt(fish.line_class_kg, 10) : (config?.scoring?.default_line_class_kg ?? config?.scoring?.line_class_kg ?? 0),
          retained: !fish._cfg?.kingfish_release,
          measured_min_size: !!fish.measured_min_size,
          points: fish._scored.points,
          notes: noteForThisRow,
        }
        if (fish._id) {
          const { error: err } = await supabase.from('competition_catches').update(payload).eq('id', fish._id)
          if (err) throw err
          keptIds.add(fish._id)
        } else {
          const { data, error: err } = await supabase.from('competition_catches')
            .insert({ ...payload, data_quality: newRowDataQuality }).select('id').single()
          if (err) throw err
          keptIds.add(data.id)
        }
      }

      // Unit-count rows: aggregate count/over-line shown in the UI expands
      // back into individual rows here — one row per fish, consistent with
      // the rest of the table. _rowIds holds the ids of rows already saved
      // for this species; we keep up to fishCount of them (flagging the
      // first overLineCount as over-line), insert new rows for any excess
      // count, and let the natural delete-pass below remove any leftover
      // rows beyond the new count (e.g. angler reduced the tally).
      //
      // Points: the species' total points (already computed correctly,
      // including the once-off species bonus and per-fish over-line bonus)
      // are recorded on the FIRST row for that species each save; the
      // remaining rows for that species get points = 0. This keeps
      // SUM(points) per angler/day correct without needing to guess how to
      // split a lump sum evenly across fish that aren't actually scored
      // individually.
      for (const row of scoredUnitCount) {
        if (!row.fishCount || row.fishCount <= 0 || row._warning) continue

        const existingIds = row._rowIds || []
        const overLineLengths = row.overLineLengths || []
        for (let i = 0; i < row.fishCount; i++) {
          const isOverLine = i < (row.overLineCount || 0)
          // Weight-formula species record the actual measured fork length
          // against the specific over-line fish it belongs to (audit trail,
          // and what the bonus was computed from) — null for everything
          // else, same as before.
          const measuredLength = isOverLine && overLineLengths[i] ? parseFloat(overLineLengths[i]) : null
          const noteForThisRow = !recordNoteAttached && recordNote ? recordNote : null
          if (!recordNoteAttached && recordNote) recordNoteAttached = true
          const payload = {
            ...baseFields,
            species_name: row.species,
            weight_kg: null,
            length_cm: measuredLength,
            line_class_kg: config?.scoring?.line_class_kg ?? 0,
            retained: true,
            is_over_line: isOverLine,
            points: i === 0 ? row._scored.points : 0,
            notes: noteForThisRow,
          }
          if (i < existingIds.length) {
            const { error: err } = await supabase.from('competition_catches').update(payload).eq('id', existingIds[i])
            if (err) throw err
            keptIds.add(existingIds[i])
          } else {
            const { data, error: err } = await supabase.from('competition_catches')
              .insert({ ...payload, data_quality: newRowDataQuality }).select('id').single()
            if (err) throw err
            keptIds.add(data.id)
          }
        }
      }

      const toDelete = originalRows.filter(r => !keptIds.has(r.id))
      if (toDelete.length > 0) {
        const { error: delErr } = await supabase.from('competition_catches').delete().in('id', toDelete.map(r => r.id))
        if (delErr) throw delErr
      }

      const fresh = await loadAnglerDayCatches(participant, selectedDay.id)
      setOriginalRows(fresh)
      const freshMeasured = fresh.filter(r => {
        const cfg = findSpeciesConfig(config?.species, r.species_name)
        return !cfg || (cfg.entry_mode || 'measured') !== 'unit_count'
      })
      setMeasuredDraft(freshMeasured.map(rowToMeasuredDraft))
      setUnitCountDraft(unitCountSpecies.map(sp => aggregateUnitCountRows(fresh, sp.name)))

      setSaving(false); setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Save error:', err)
      setError(err.message || 'Failed to save scorecard')
      setSaving(false)
    }
  }

  // ── Loading / error states ───────────────────────────────────────────────────
  if (configLoading || loadingMeta) {
    return <div style={S.page}><div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Loading…</div></div>
  }
  if (configError || metaError) {
    return <div style={S.page}><div style={{ ...S.card, color: RED }}>Error loading competition: {configError || metaError}</div></div>
  }

  const TABS = [
    { id: 'entry', label: `📝 ${participant ? participant.full_name.split(' ')[0] + "'s Card" : 'Catch Entry'}` },
    { id: 'summary', label: splitBoatFormat ? `🚤 ${boat?.boat_name || 'Boat'} Summary` : `👥 ${team?.team_name || 'Team'} Summary` },
  ]

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>🎣 {competition?.name || 'Competition'}</div>
        <div style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: 2 }}>{competition?.venue || ''} · Catch Logger</div>
      </div>

      <div style={S.card}>
        <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>Step 1 — Select Day</div>
        <select style={S.select} value={day} onChange={e => setDay(e.target.value)}>
          <option value=''>Select day…</option>
          {days.map(d => (
            <option key={d.id} value={d.id}>
              Day {d.day_number}{d.date ? ` — ${new Date(d.date).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}{d.cancelled ? ' (Cancelled)' : ''}
            </option>
          ))}
        </select>
      </div>

      {day && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>Step 2 — Select {splitBoatFormat ? 'Boat' : 'Team'}</div>
          {splitBoatFormat ? (
            <select style={S.select} value={boatId} onChange={e => setBoatId(e.target.value)}>
              <option value=''>Select boat…</option>
              {boats.map(b => <option key={b.id} value={b.id}>{b.boat_name}{b.skipper_name ? ` — ${b.skipper_name}` : ''}</option>)}
            </select>
          ) : (
            <select style={S.select} value={teamId} onChange={e => setTeamId(e.target.value)}>
              <option value=''>Select team…</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.display_name || t.team_name}</option>)}
            </select>
          )}
        </div>
      )}

      {(splitBoatFormat ? boatId : teamId) && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>Step 3 — Select Angler</div>
          <select style={S.select} value={participantId} onChange={e => setParticipantId(e.target.value)}>
            <option value=''>Select angler…</option>
            {availableAnglers.map(a => (
              <option key={a.id} value={a.id}>{a.is_captain ? `⚓ ${a.full_name} (Captain)` : a.full_name}</option>
            ))}
          </select>
        </div>
      )}

      {participant && !loadingCard && (
        <>
          <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{ flex: 1, padding: '0.65rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
                  background: activeTab === t.id ? NAVY : 'white', color: activeTab === t.id ? 'white' : '#374151' }}>
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'entry' && (
            <>
              <div style={{ ...S.card, background: '#f8fafc' }}>
                <div style={S.row}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{participant.full_name}{participant.is_captain ? ' ⚓' : ''}</div>
                    <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                      {splitBoatFormat ? boat?.boat_name : (team?.display_name || team?.team_name)} · {selectedDay?.label || `Day ${selectedDay?.day_number}`}
                    </div>
                  </div>
                  {usesMultiplier && (
                    <>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>RAW PTS</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#6b7280' }}>{rawPoints.toFixed(2)}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>×MULT</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: GOLD }}>×{multiplier}</div>
                      </div>
                    </>
                  )}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>SCORE</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: NAVY }}>{finalPoints.toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>FISH</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: GREEN }}>{totalValidFish}</div>
                  </div>
                  {usesMultiplier && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>SPECIES</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: PURPLE }}>{speciesCount}</div>
                    </div>
                  )}
                </div>
                {usesMultiplier && speciesCount > 1 && (
                  <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.75rem', background: '#fef3c7', borderRadius: 6, fontSize: '0.85rem', color: '#92400e', fontWeight: 600 }}>
                    ✨ Species multiplier ×{multiplier} — applied to total
                  </div>
                )}
              </div>

              {hasMeasured && (
                <div style={S.card}>
                  <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.5rem' }}>Record Catches</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                    Maximum {measuredBagLimit} qualifying fish per angler per day.
                  </div>

                  {scoredMeasured.length === 0 && (
                    <div style={{ color: '#9ca3af', fontStyle: 'italic', marginBottom: '0.75rem' }}>
                      No catches recorded yet — click + Add Fish below.
                    </div>
                  )}

                  {scoredMeasured.map((fish, i) => (
                    <MeasuredFishRow
                      key={i}
                      fish={fish}
                      index={i}
                      speciesPicker={{ groups: speciesPicker.groups.filter(g => g.species.some(s => (s.entry_mode || 'measured') !== 'unit_count')) }}
                      autoWeight={autoWeights[i]}
                      calculating={calculatingIndex === i}
                      onSpeciesChange={onMeasuredSpeciesChange}
                      onChange={updateMeasuredFish}
                      onRemove={removeMeasuredFish}
                      onUseCalculated={() => useCalculatedWeight(i)}
                    />
                  ))}

                  {measuredDraft.length < measuredBagLimit && (
                    <button onClick={addMeasuredFish} style={{ ...S.btn(GREEN), marginTop: '0.5rem' }}>+ Add Fish</button>
                  )}
                  {measuredDraft.length >= measuredBagLimit && (
                    <div style={{ fontSize: '0.82rem', color: GOLD, fontWeight: 600, marginTop: '0.5rem' }}>
                      ⚠ Maximum {measuredBagLimit} fish reached for this angler today.
                    </div>
                  )}
                </div>
              )}

              {hasUnitCount && (
                <div style={S.card}>
                  <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.5rem' }}>Record Catches by Species</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                    Tap + for each fish landed. Toggle Over Line if a fish exceeds the threshold length on the measuring mat.
                  </div>
                  {speciesPicker.groups
                    .filter(g => g.species.some(s => s.entry_mode === 'unit_count'))
                    .map(g => (
                      <div key={g.label} style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                          ── {g.label}
                        </div>
                        {scoredUnitCount
                          .filter(r => r._cfg?.group === g.label)
                          .map(row => (
                            <UnitCountSpeciesRow key={row.species} row={row} onChange={patch => updateUnitCount(row.species, patch)} />
                          ))}
                      </div>
                    ))}
                </div>
              )}

              <div style={S.card}>
                <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.5rem' }}>Record / PB Claims</div>
                <textarea
                  placeholder='e.g. Yellowfin 33.8kg — possible record'
                  value={recordNote}
                  onChange={e => setRecordNote(e.target.value)}
                  rows={2}
                  style={{ ...S.input, resize: 'vertical' }}
                />
              </div>

              {error && <div style={{ background: '#fef2f2', color: RED, padding: '0.75rem', borderRadius: 6, marginBottom: '0.75rem' }}>{error}</div>}
              {saved && <div style={{ background: '#f0fdf4', color: GREEN, padding: '0.75rem', borderRadius: 6, marginBottom: '0.75rem', fontWeight: 600 }}>✅ Saved successfully!</div>}

              {/* A scorecard with nothing entered and nothing previously saved
                  has nothing to save — block that. But an EXISTING scorecard
                  (originalRows.length > 0) reduced back to zero is a
                  legitimate "I logged this by mistake, remove it" action —
                  handleSave's delete-diff already correctly removes rows no
                  longer represented, so blocking the button here was the
                  only thing actually preventing that from working. */}
              {(() => {
                const isBlankNew = totalValidFish === 0 && originalRows.length === 0
                return (
                  <>
                    <button onClick={handleSave} disabled={saving || isBlankNew || overLineBonusPending}
                      style={{ ...S.btn(), padding: '0.75rem 2rem', fontSize: '1rem', opacity: (saving || isBlankNew || overLineBonusPending) ? 0.5 : 1 }}>
                      {saving ? 'Saving…' : overLineBonusPending ? '⏳ Calculating bonus…' : originalRows.length > 0 ? '💾 Update Scorecard' : '💾 Save Scorecard'}
                    </button>
                    {isBlankNew && (
                      <span style={{ fontSize: '0.82rem', color: '#9ca3af', marginLeft: '0.75rem' }}>Add at least 1 valid catch to save</span>
                    )}
                    {!isBlankNew && totalValidFish === 0 && originalRows.length > 0 && (
                      <span style={{ fontSize: '0.82rem', color: RED, marginLeft: '0.75rem' }}>⚠ Saving will remove all logged catches for this angler on this day</span>
                    )}
                    {overLineBonusPending && (
                      <span style={{ fontSize: '0.82rem', color: GOLD, marginLeft: '0.75rem' }}>Waiting for the over-line bonus calculation to finish…</span>
                    )}
                  </>
                )
              })()}
            </>
          )}

          {activeTab === 'summary' && (
            <SummaryTab
              splitBoatFormat={splitBoatFormat}
              team={team}
              boat={boat}
              selectedDay={selectedDay}
              anglers={availableAnglers}
              summaryRows={summaryRows}
              usesMultiplier={usesMultiplier}
            />
          )}
        </>
      )}

      {loadingCard && <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Loading…</div>}
    </div>
  )
}

// ─── MEASURED FISH ROW ────────────────────────────────────────────────────────
function MeasuredFishRow({ fish, index, speciesPicker, autoWeight, calculating, onSpeciesChange, onChange, onRemove, onUseCalculated }) {
  const pts = fish._scored?.points || 0

  return (
    <div style={{
      padding: '0.6rem',
      background: fish._cfg?.billfish ? '#fef3c7' : '#f9fafb',
      borderRadius: 6,
      marginBottom: '0.4rem',
      border: `1px solid ${fish._cfg?.billfish ? '#fcd34d' : '#e5e7eb'}`,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
        <select
          style={{ ...S.select, fontSize: '0.85rem', padding: '0.4rem 0.5rem' }}
          value={fish.species}
          onChange={e => onSpeciesChange(index, e.target.value)}
        >
          <option value=''>Select species…</option>
          {speciesPicker.groups.map(g => (
            <optgroup key={g.label} label={g.label}>
              {g.species.filter(s => (s.entry_mode || 'measured') !== 'unit_count').map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </optgroup>
          ))}
        </select>

        <input
          type='number' step='0.1' min='0' placeholder='length cm'
          value={fish.length_cm}
          disabled={fish._cfg?.billfish}
          onChange={e => onChange(index, { ...fish, length_cm: e.target.value, weightSource: 'manual' })}
          style={{ ...S.input, fontSize: '0.85rem', padding: '0.4rem 0.5rem' }}
        />

        <input
          type='number' step='0.1' min='0' placeholder='kg'
          value={fish.weight_kg}
          disabled={fish._cfg?.billfish || fish._cfg?.kingfish_release}
          onChange={e => onChange(index, { ...fish, weight_kg: e.target.value, weightSource: 'manual_override' })}
          style={{ ...S.input, fontSize: '0.85rem', padding: '0.4rem 0.5rem', background: (fish._cfg?.billfish || fish._cfg?.kingfish_release) ? '#f3f4f6' : 'white' }}
        />

        <div style={{ textAlign: 'center' }}>
          {fish._cfg?.billfish ? (
            <span style={S.badge(GOLD)}>Multiplier</span>
          ) : fish._cfg?.kingfish_release ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={S.badge(fish.measured_min_size ? PURPLE : '#9ca3af')}>{pts} pts 📸</span>
              <label style={{ fontSize: '0.68rem', color: fish.measured_min_size ? PURPLE : RED, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
                <input type='checkbox' checked={!!fish.measured_min_size}
                  onChange={e => onChange(index, { ...fish, measured_min_size: e.target.checked })} />
                Min size
              </label>
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 700, color: NAVY, fontSize: '1rem' }}>{pts > 0 ? pts.toFixed(2) : '—'}</div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>pts</div>
            </div>
          )}
        </div>

        <button onClick={() => onRemove(index)}
          style={{ background: '#fef2f2', color: RED, border: 'none', borderRadius: 4, padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.85rem' }}>
          ✕
        </button>
      </div>

      {calculating && (
        <div style={{ fontSize: '0.72rem', color: BLUE, marginTop: '0.3rem' }}>Calculating weight from length…</div>
      )}
      {!calculating && autoWeight && !fish.weight_kg && (
        <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', background: '#eff6ff', borderRadius: 6 }}>
          <span style={{ fontSize: '0.78rem', color: '#1e40af' }}>
            📐 Estimated {autoWeight.weightKg.toFixed(2)}kg from length ({autoWeight.source === 'jsonb' ? 'Visboekie' : 'FishBase'})
          </span>
          <button onClick={onUseCalculated} style={{ ...S.btn(BLUE), padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>Use This</button>
        </div>
      )}

      {fish._warning && (
        <div style={{ fontSize: '0.72rem', color: RED, marginTop: '0.3rem' }}>⚠ {fish._warning}</div>
      )}
    </div>
  )
}

// ─── UNIT-COUNT SPECIES ROW ───────────────────────────────────────────────────
function UnitCountSpeciesRow({ row, onChange }) {
  const cfg = row._cfg
  const maxReached = cfg?.bag_limit && row.fishCount >= cfg.bag_limit
  const isWeightFormula = cfg?.over_line_bonus_type === 'weight_formula'
  const overLineLengths = row.overLineLengths || []
  const canAddOverLine = cfg?.over_line_length_cm && row.overLineCount < row.fishCount

  const addFish = () => { if (!maxReached) onChange({ fishCount: row.fishCount + 1 }) }
  const removeFish = () => {
    if (row.fishCount === 0) return
    const newCount = row.fishCount - 1
    const cappedOverLine = Math.min(row.overLineCount, newCount)
    onChange({
      fishCount: newCount,
      overLineCount: cappedOverLine,
      overLineLengths: overLineLengths.slice(0, cappedOverLine),
    })
  }

  // Fixed-bonus species (everyone except Red Steenbras): unchanged simple counter.
  const addOverLine = () => { if (canAddOverLine) onChange({ overLineCount: row.overLineCount + 1 }) }
  const removeOverLine = () => { if (row.overLineCount > 0) onChange({ overLineCount: row.overLineCount - 1 }) }

  // Weight-formula species: each over-line fish needs its own measured
  // length, since the bonus is derived from that specific measurement, not
  // a flat per-fish value.
  const addOverLineLength = () => {
    if (!canAddOverLine) return
    onChange({ overLineCount: overLineLengths.length + 1, overLineLengths: [...overLineLengths, ''] })
  }
  const removeOverLineLength = (i) => {
    const next = overLineLengths.filter((_, idx) => idx !== i)
    onChange({ overLineCount: next.length, overLineLengths: next })
  }
  const setOverLineLength = (i, val) => {
    const next = [...overLineLengths]
    next[i] = val
    onChange({ overLineLengths: next })
  }

  const pts = row._scored?.points || 0
  const rowBg = row.fishCount > 0 ? '#f0fdf4' : 'white'
  const borderColor = row.fishCount > 0 ? '#86efac' : '#e5e7eb'

  return (
    <div style={{ background: rowBg, border: `1px solid ${borderColor}`, borderRadius: 8, padding: '0.6rem 0.75rem', marginBottom: '0.4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>{row.species}</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            Bag: {cfg?.bag_limit ?? '—'} {cfg?.min_size_cm ? `• Min: ${cfg.min_size_cm}cm` : ''} • {cfg?.points_per_fish}pts/fish • Sp.bonus: {cfg?.species_bonus}pts
            {cfg?.over_line_length_cm
              ? (isWeightFormula
                  ? ` • OL: >${cfg.over_line_length_cm}cm(${cfg.over_line_length_type}) — bonus = weight in kg`
                  : ` • OL: >${cfg.over_line_length_cm}cm(${cfg.over_line_length_type})+${cfg.over_line_bonus}pts`)
              : ''}
          </div>
          {row._overLineBonusError && (
            <div style={{ fontSize: '0.72rem', color: RED, marginTop: '0.2rem' }}>⚠ {row._overLineBonusError} — enter this fish's bonus points manually via Reports/SQL after saving</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: 2 }}>FISH</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={removeFish} disabled={row.fishCount === 0}
                style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #d1d5db', background: 'white', cursor: row.fishCount === 0 ? 'default' : 'pointer', opacity: row.fishCount === 0 ? 0.4 : 1 }}>−</button>
              <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700, fontSize: '1.1rem', color: row.fishCount > 0 ? GREEN : '#374151' }}>{row.fishCount}</span>
              <button onClick={addFish} disabled={maxReached}
                style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #d1d5db', background: maxReached ? '#f3f4f6' : '#dcfce7', cursor: maxReached ? 'default' : 'pointer', opacity: maxReached ? 0.4 : 1 }}>+</button>
            </div>
          </div>

          {cfg?.over_line_length_cm ? (
            isWeightFormula ? (
              <div style={{ minWidth: 190 }}>
                <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: 2 }}>
                  OVER LINE — {cfg.over_line_length_type || 'FL'} length (cm)
                </div>
                {overLineLengths.map((len, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <input
                      type="number" inputMode="decimal" value={len}
                      onChange={e => setOverLineLength(i, e.target.value)}
                      placeholder="cm"
                      style={{ width: 56, padding: '0.25rem 0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.8rem' }}
                    />
                    <button onClick={() => removeOverLineLength(i)}
                      style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '0.75rem', lineHeight: 1 }}>×</button>
                  </div>
                ))}
                <button onClick={addOverLineLength} disabled={!canAddOverLine}
                  style={{ fontSize: '0.72rem', color: canAddOverLine ? GOLD : '#9ca3af', background: 'none', border: 'none', cursor: canAddOverLine ? 'pointer' : 'default', padding: 0 }}>
                  + add over-line fish
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: 2 }}>OVER LINE</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={removeOverLine} disabled={row.overLineCount === 0}
                    style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #d1d5db', background: 'white', cursor: row.overLineCount === 0 ? 'default' : 'pointer', opacity: row.overLineCount === 0 ? 0.4 : 1 }}>−</button>
                  <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700, fontSize: '1.1rem', color: row.overLineCount > 0 ? GOLD : '#374151' }}>{row.overLineCount}</span>
                  <button onClick={addOverLine} disabled={!canAddOverLine}
                    style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #d1d5db', background: canAddOverLine ? '#fef3c7' : '#f3f4f6', cursor: canAddOverLine ? 'pointer' : 'default', opacity: canAddOverLine ? 1 : 0.4 }}>+</button>
                </div>
              </div>
            )
          ) : <div style={{ width: 80 }} />}

          <div style={{ minWidth: 44, textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: 2 }}>PTS</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: pts > 0 ? NAVY : '#9ca3af' }}>
              {row._overLineBonusComputing ? '…' : pts}
            </div>
          </div>
        </div>
      </div>
      {row._warning && (
        <div style={{ fontSize: '0.72rem', color: RED, marginTop: '0.3rem' }}>⚠ {row._warning}</div>
      )}
    </div>
  )
}

// ─── BADGE GROUPING ───────────────────────────────────────────────────────────
// Measured fish (weight_kg present) are distinct enough to show one badge
// each. Unit-count fish (weight_kg null) are individually-identical rows in
// the database, so they're grouped by species into a single "×N" badge —
// otherwise five Kob would render as five indistinguishable badges.
function groupRowsForBadges(rows) {
  const measured = rows.filter(r => r.weight_kg != null)
  const unitCount = rows.filter(r => r.weight_kg == null)

  const measuredBadges = measured.map(r => ({
    species: r.species_name,
    count: 1,
    weight_kg: r.weight_kg,
    points: parseFloat(r.points || 0),
    anyOverLine: false,
  }))

  const bySpecies = new Map()
  for (const r of unitCount) {
    if (!bySpecies.has(r.species_name)) {
      bySpecies.set(r.species_name, { species: r.species_name, count: 0, weight_kg: null, points: 0, anyOverLine: false })
    }
    const g = bySpecies.get(r.species_name)
    g.count += 1
    g.points += parseFloat(r.points || 0)
    if (r.is_over_line) g.anyOverLine = true
  }

  return [...measuredBadges, ...bySpecies.values()]
}


function SummaryTab({ splitBoatFormat, team, boat, selectedDay, anglers, summaryRows, usesMultiplier }) {
  // Group by angler_id when present (registered anglers); fall back to
  // participant_id for unregistered anglers, whose rows always have
  // angler_id = null. Without this fallback every unregistered angler's
  // catches would collapse into a single null bucket instead of being
  // correctly attributed per-person.
  const byAngler = new Map()
  for (const row of summaryRows) {
    const key = row.angler_id || row.participant_id
    if (!byAngler.has(key)) byAngler.set(key, [])
    byAngler.get(key).push(row)
  }
  const rowsForAngler = (angler) => byAngler.get(angler.user_id || angler.id) || []

  const teamTotalPts = summaryRows.reduce((s, r) => s + parseFloat(r.points || 0), 0)
  const teamSpeciesCount = new Set(summaryRows.map(r => r.species_name)).size
  const teamMultiplier = Math.max(1, teamSpeciesCount - 1)
  const teamFinalPts = usesMultiplier
    ? parseFloat((teamTotalPts * teamMultiplier).toFixed(2))
    : parseFloat(teamTotalPts.toFixed(2))

  return (
    <div style={S.card}>
      <div style={{ fontWeight: 700, color: NAVY, marginBottom: '0.5rem' }}>
        {splitBoatFormat ? `🚤 ${boat?.boat_name}` : `👥 ${team?.display_name || team?.team_name}`} — {selectedDay?.label || `Day ${selectedDay?.day_number}`} Summary
      </div>
      {splitBoatFormat && boat?.skipper_name && (
        <div style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '0.75rem' }}>Skipper: {boat.skipper_name}</div>
      )}

      {summaryRows.length === 0 ? (
        <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>No catches entered yet.</div>
      ) : (
        <>
          <div style={{ padding: '0.75rem', background: '#eff6ff', borderRadius: 8, marginBottom: '0.75rem' }}>
            <div style={S.row}>
              {[
                { label: 'Raw Pts', val: teamTotalPts.toFixed(2), color: NAVY },
                ...(usesMultiplier ? [
                  { label: 'Species', val: teamSpeciesCount, color: GOLD },
                  { label: 'Multiplier', val: `×${teamMultiplier}`, color: PURPLE },
                ] : []),
                { label: 'Final Pts', val: teamFinalPts.toFixed(2), color: GREEN },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '1.2rem', color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {anglers.map(angler => {
            const rows = rowsForAngler(angler)
            const anglerPts = rows.reduce((s, r) => s + parseFloat(r.points || 0), 0)
            return (
              <div key={angler.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 700 }}>{angler.is_captain ? '⚓ ' : ''}{angler.full_name}</span>
                  <span style={{ fontWeight: 800, color: NAVY }}>{rows.length > 0 ? `${anglerPts.toFixed(2)} pts` : '—'}</span>
                </div>
                {rows.length > 0 ? (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {groupRowsForBadges(rows).map((g, i) => (
                      <span key={i} style={S.badge(g.anyOverLine ? GOLD : '#374151')}>
                        {g.species} {g.count > 1 ? `×${g.count} · ` : g.weight_kg != null ? `${g.weight_kg}kg · ` : ''}{g.points.toFixed(1)}pts
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic' }}>Not yet entered</div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
