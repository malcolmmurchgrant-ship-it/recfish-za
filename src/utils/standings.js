// ─── standings.js ────────────────────────────────────────────────────────────
// Team and angler standings for a competition - the SAME calculation the
// public Scoreboard (UniversalScoreboard.jsx) shows. Moved here unchanged so
// other features (e.g. the Nomination Pack's placings) rank anglers exactly
// as the Scoreboard does, instead of keeping a second copy that could drift.

import { buildIndividualStandings, buildBoatPercentageTeamStandings } from '../components/CompetitionAdmin/utils/scoringEngine'

// ── Scoring functions ─────────────────────────────────────────────────────────

export function calcPoints(catch_, scoringConfig) {
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

export function getFishingHours(day) {
  if (day?.fishing_start_time && day?.fishing_end_time) {
    const [sh, sm] = day.fishing_start_time.slice(0, 5).split(':').map(Number)
    const [eh, em] = day.fishing_end_time.slice(0, 5).split(':').map(Number)
    return ((eh * 60 + em) - (sh * 60 + sm)) / 60
  }
  return 8
}

export function getTotalFishingHours(days) {
  const active = (days || []).filter(d => !d.cancelled)
  if (!active.length) return 0
  return active.reduce((s, d) => s + getFishingHours(d), 0)
}

// ── Species multiplier scoring (SADSAA Gamefish) ─────────────────────────────
// Used when scoringConfig.species_multiplier === true.
// Raw points are summed per day, then multiplied by max(1, speciesCount - 1)
// for that day, then days are summed. Applied separately for teams and anglers.
export function getDayNumber(c, dateToDay) {
  return c.competition_days?.day_number || dateToDay[c.fishing_date] || null
}

// Calculates multiplied total points for a set of catches, grouped by day.
// catches: array of catch rows already scoped to one team or one angler.
export function calcMultipliedPoints(catches, scoringConfig, dateToDay) {
  const byDay = {}
  for (const c of catches) {
    const dn = getDayNumber(c, dateToDay)
    if (dn === null) continue
    if (!byDay[dn]) byDay[dn] = []
    byDay[dn].push(c)
  }
  let total = 0
  for (const dayCatches of Object.values(byDay)) {
    const raw = dayCatches.reduce((s, c) => s + calcPoints(c, scoringConfig), 0)
    const species = new Set(dayCatches.map(c => c.species_name).filter(Boolean)).size
    const mult = Math.max(1, species - 1)
    total += raw * mult
  }
  return total
}

// competition: competitions row (with competition_templates joined);
// catches / participants / teams / boats / days: that competition's rows,
// loaded as the Scoreboard loads them. dayFilter: 'all' or a day number.
export function computeStandings({ competition, template, catches = [], participants = [], teams = [], boats = [], days = [], dayFilter = 'all' }) {
  // ── Derived config ────────────────────────────────────────────────────────
  const scoringConfig = competition?.pinned_config?.scoring || template?.scoring_config || {}
  const teamConfig    = competition?.pinned_config?.team    || template?.team_config    || {}
  const discipline    = template?.discipline || ''
  const isPublished   = !!competition?.results_published_at

  // Confirmed methodology (split-boat formats where boats rotate between
  // teams/anglers day to day — e.g. WPDSAA Inshore League, Junior Bottomfish
  // Nationals): ranking uses each angler's summed daily boat-relative
  // percentage (buildIndividualStandings / buildBoatPercentageTeamStandings
  // in scoringEngine.js — the SAME functions that already correctly power
  // the Reports/XLS export), not raw points. Raw points alone can rank a
  // strong-boat angler above a weaker-boat angler who actually outperformed
  // their own boat's conditions that day. Moved up from the Skipper
  // standings section below (2026-07-16) so Team/Angler standings use the
  // identical, already-correct logic instead of a second, simpler, and
  // wrong points-only sort — see the U19 Nationals medal-position bug this
  // was fixing: Score-based official rank had Doman/Wasserman at #2/#3,
  // while the old points-only sort here wrongly showed Mocke/Hewison.
  const isSplitBoat = teamConfig?.team_format === 'split_boat'

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
  // Note: catches can have null weight_kg (e.g. photo-measure-release species
  // like Kingfish, scored on a flat points basis, not weight) — these must
  // still count as catches/species, just not toward total weight.
  const scoringCatches = catches.filter(c => {
    if (c.data_quality === 'rejected') return false
    if (c.scoring === false) return false
    if (c.species_name === 'No Catch') return false
    // For points-method competitions, zero-point rows are legitimate catch
    // records under the species-subtotal encoding (only the last fish of each
    // species per angler per day carries the full species total; all other
    // individual fish rows for that species have points = 0). Excluding them
    // would remove real catches and zero out every angler's score.
    // For weight/percentage competitions, genuinely empty rows (no weight,
    // no points) are safe to exclude.
    const method = scoringConfig?.method || 'points'
    if (method === 'points') {
      // Keep any row that has a real species name — it's a real catch
      return !!(c.species_name && c.species_name !== 'No Catch')
    }
    const hasWeight = c.weight_kg && parseFloat(c.weight_kg) > 0
    const hasPoints = c.points && parseFloat(c.points) > 0
    if (!hasWeight && !hasPoints) return false
    return true
  })

  const filteredCatches = dayFilter === 'all'
    ? scoringCatches
    : scoringCatches.filter(c => {
        const dn = c.competition_days?.day_number || dateToDay[c.fishing_date]
        return String(dn) === String(dayFilter)
      })

  // ── Team standings ────────────────────────────────────────────────────────
  const useMultiplier = !!scoringConfig?.species_multiplier

  // Confirmed-correct boat-relative daily percentage per team, computed via
  // the same scoringEngine function that already powers the Reports/XLS
  // export. Only meaningful (and only computed) for split-boat formats —
  // raw-points-based formats (e.g. Gamefish's species-multiplier scoring)
  // are untouched by this and keep their existing behavior below.
  const teamPercentageMap = isSplitBoat
    ? Object.fromEntries(
        buildBoatPercentageTeamStandings(filteredCatches, participants, teams, days, boats, scoringConfig)
          .map(t => [t.teamId, t.totalPercentage])
      )
    : {}

  // team_id -> Set(participant_id) — built once, used below instead of a
  // never-populated catch-level team_id (see the note in teamStandings).
  const teamParticipantIds = {}
  for (const p of participants) {
    if (!p.team_id) continue
    if (!teamParticipantIds[p.team_id]) teamParticipantIds[p.team_id] = new Set()
    teamParticipantIds[p.team_id].add(p.id)
  }
  const userIdToParticipantId = Object.fromEntries(
    participants.filter(p => p.user_id).map(p => [p.user_id, p.id])
  )

  const teamStandings = teams
    .filter(t => !t.is_disqualified)
    .map(t => {
      // Catches never carry their own team_id — every catch links to a team
      // indirectly, through participant_id (or angler_id for registered
      // anglers) → that participant's own team_id, same resolution used
      // throughout scoringEngine.js. Filtering by a catch-level c.team_id
      // silently matched nothing for every team on this page (confirmed via
      // SADSAA Light Tackle Billfish Nationals 2026: individual standings
      // showed Etienne de Jager's and Renier van Jaarsveld's real catches
      // correctly, but Team Standings showed everyone, including their own
      // teams, at zero) — not specific to that competition; any competition
      // using this non-split-boat path was affected. This part of the fix
      // is correct and stays.
      const tc = filteredCatches.filter(c => {
        const participantId = (c.angler_id && userIdToParticipantId[c.angler_id]) || c.participant_id
        return participantId && teamParticipantIds[t.id]?.has(participantId)
      })
      // Points: calcMultipliedPoints(tc, ...) on the POOLED team catch list
      // — confirmed correct against SADSAA Gamefish Nationals 2026's
      // official scoring spreadsheet (WEIGHSHEET tab): "TOTAL TEAM POINTS"
      // = (sum of every member's raw points that day) × a TEAM-wide
      // species-diversity multiplier, computed from the whole crew's
      // combined catch that day — not each angler's own multiplier. A
      // previous version of this file summed each member's own
      // individually-multiplied total instead, on the mistaken assumption
      // that the pooled figure was a bug — it wasn't; verified by hand
      // against SADSAA U21's Day 4 (645.0592) and the full tournament
      // total (713.0944), both matching the official spreadsheet exactly.
      const pts = useMultiplier
        ? calcMultipliedPoints(tc, scoringConfig, dateToDay)
        : tc.reduce((s, c) => s + calcPoints(c, scoringConfig), 0)
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
        // Angler %-sum equivalent for teams — the confirmed official
        // ranking metric for split-boat competitions. Null (not shown) for
        // non-split-boat formats, which rank on points as before.
        percentage: isSplitBoat ? Math.round((teamPercentageMap[t.id] || 0) * 100) / 100 : null,
        kghr: totalHours > 0 ? Math.round(kg / totalHours * 100) / 100 : 0,
        fhr:  totalHours > 0 ? Math.round(tc.length / totalHours * 100) / 100 : 0,
      }
    })
    .sort((a, b) => isSplitBoat
      ? (b.percentage - a.percentage) || (b.fish - a.fish)
      : (b.points - a.points) || (b.fish - a.fish)
    )

  // ── Angler standings ──────────────────────────────────────────────────────
  // Confirmed-correct boat-relative daily percentage per angler, computed
  // via the same scoringEngine function that already powers the
  // Reports/XLS export (buildIndividualStandings — see its own comments for
  // the confirmed ranking rule: percentage first, fish count tiebreak,
  // points tiebreak).
  const anglerPercentageMap = isSplitBoat
    ? Object.fromEntries(
        buildIndividualStandings(filteredCatches, participants, days, boats, scoringConfig, teams)
          .map(p => [p.participantId, p.anglerPercentage])
      )
    : {}

  const anglerStandings = participants
    .filter(p => p.status !== 'disqualified')
    .map(p => {
      const uid  = p.user_id || p.id
      const ac   = filteredCatches.filter(c => c.angler_id === uid || c.participant_id === p.id)
      const pts  = useMultiplier
        ? calcMultipliedPoints(ac, scoringConfig, dateToDay)
        : ac.reduce((s, c) => s + calcPoints(c, scoringConfig), 0)
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
        teamId: p.team_id,
        name: p.full_name,
        number: p.angler_number,
        team: team?.team_name || p.competition_teams?.team_name || p.province || '',
        // Team name WITH its suffix (e.g. "Western Province White"), for the TV
        // display, where several teams can come from one province. `team` above
        // stays as it was: the Teams tab matches anglers to teams by it.
        teamDisplay: team ? team.team_name + (team.team_suffix ? ` ${team.team_suffix}` : '') : (p.competition_teams?.team_name || p.province || ''),
        lineClass: p.line_class_kg,
        category: p.category,
        fish: ac.length,
        kg: Math.round(kg * 1000) / 1000,
        points: Math.round(pts * 100) / 100,
        // Angler % — the confirmed official ranking metric for split-boat
        // competitions. Null (not shown) for non-split-boat formats, which
        // rank on points as before — unchanged from prior behavior.
        percentage: isSplitBoat ? Math.round((anglerPercentageMap[p.id] || 0) * 100) / 100 : null,
        speciesCount: new Set(ac.map(c => c.species_name).filter(Boolean)).size,
        bestFish: [...ac].sort((a, b) => (parseFloat(b.weight_kg) || 0) - (parseFloat(a.weight_kg) || 0))[0],
        kghr: totalHours > 0 ? Math.round(kg / totalHours * 100) / 100 : 0,
        fhr:  totalHours > 0 ? Math.round(ac.length / totalHours * 100) / 100 : 0,
        byDay,
      }
    })
    .sort((a, b) => isSplitBoat
      ? (b.percentage - a.percentage) || (b.fish - a.fish)
      : (b.points - a.points) || (b.fish - a.fish)
    )


  return { scoringConfig, teamConfig, discipline, isPublished, isSplitBoat, teamMap, anglerMap, boatMap, dayMap, dateToDay, fishingDays, totalHours, cancelledDays, scoringCatches, filteredCatches, useMultiplier, teamPercentageMap, teamParticipantIds, userIdToParticipantId, teamStandings, anglerPercentageMap, anglerStandings }
}
