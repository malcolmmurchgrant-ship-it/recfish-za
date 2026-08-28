// ─── scoringEngine.js ────────────────────────────────────────────────────────
// Universal scoring calculator.
// Reads scoring_config from the competition template and applies
// the correct formula for each competition type.
//
// Supported methods:
//   'percentage'  — Bottomfish / Gamefish / Billfish
//                   points = (weight_kg / line_class_kg)² × 32
//   'cpue'        — Tuna: Catch Per Unit Effort
//                   points = weight_kg (raw weight; CPUE applied at aggregation)
//   'points'      — Club / Shore / Spearfishing
//                   points = pointsPerFish + speciesBonus + overLineBonus
//   'weight'      — Raw weight only (no formula)

// ── Percentage scoring (Bottomfish / Gamefish / Billfish) ─────────────────────
export function calcPercentagePoints(weightKg, lineClassKg) {
  if (!weightKg || weightKg <= 0 || !lineClassKg || lineClassKg <= 0) return 0
  return parseFloat(((weightKg / lineClassKg) ** 2 * 32).toFixed(4))
}

// ── Points scoring (Bottomfish All Coastals / Club / Shore) ───────────────────
// pointsPerFish:   from species_config per_species_rules or scoring_config default
// speciesBonus:    flat bonus per species entered (default 3)
// overLineBonus:   bonus for fish over a threshold length (default 5)
export function calcPointsScoring({
  fishCount       = 0,
  pointsPerFish   = 3,
  speciesBonus    = 3,
  overLineCount   = 0,
  overLineBonus   = 5,
  // Explicit total over-line bonus, in points. When provided (not null/
  // undefined), this REPLACES overLineCount × overLineBonus entirely —
  // used for species with a variable, weight-derived over-line bonus (e.g.
  // Red Steenbras: bonus = floor(weight_kg), not a flat 5) rather than the
  // usual fixed-per-fish bonus every other species gets.
  overLineBonusPoints = null,
  isFirstFish     = false,  // first fish of a species gets speciesBonus
}) {
  if (!fishCount || fishCount <= 0) return 0
  // First fish: pointsPerFish + speciesBonus
  // Additional fish of same species: pointsPerFish only
  const base = isFirstFish
    ? pointsPerFish + speciesBonus
    : pointsPerFish
  const additional = fishCount > 1 ? pointsPerFish * (fishCount - 1) : 0
  const overLine   = overLineBonusPoints != null ? overLineBonusPoints : overLineCount * overLineBonus
  return base + additional + overLine
}

// ── Kingfish photo-measure-release ────────────────────────────────────────────
export function calcKingfishRelease(scoringConfig) {
  return scoringConfig?.photo_release_fixed_points ?? 5
}

// ── Billfish on-board points (multiplier, no weight score) ────────────────────
// SADSAA Gamefish: billfish score is percentage × multiplier, recorded separately
export function calcBillfishPoints(weightKg, lineClassKg, multiplier = 1) {
  return calcPercentagePoints(weightKg, lineClassKg) * multiplier
}

// ── CPUE (Tuna) ───────────────────────────────────────────────────────────────
// Raw weight recorded; CPUE ratio applied at team/session aggregation level
// Individual catch points = weight_kg
export function calcCpuePoints(weightKg) {
  return weightKg || 0
}

// ── Master dispatcher ─────────────────────────────────────────────────────────
// Call this from the catch logger and admin scoring tab.
// Returns { points, method, detail } for display and storage.
export function calculateCatchPoints({
  scoringConfig,
  speciesRule,      // from species_config.per_species_rules for this species
  weightKg,
  lineClassKg,
  fishCount,
  overLineCount,
  isFirstFish,
  isBillfish,
  isKingfishRelease,
  isMeasured400mm,  // Kingfish must be >= 400mm to qualify for release points
}) {
  const method = scoringConfig?.method || 'points'

  // Billfish — no weight score, percentage × multiplier
  if (isBillfish) {
    const pts = calcBillfishPoints(weightKg, lineClassKg || scoringConfig?.line_class?.default_kg || 10)
    return { points: pts, method: 'billfish_percentage', detail: `${weightKg}kg OB` }
  }

  // Kingfish photo-measure-release
  if (isKingfishRelease) {
    if (!isMeasured400mm) return { points: 0, method: 'kingfish_release_invalid', detail: 'Under 400mm — no points' }
    const pts = calcKingfishRelease(scoringConfig)
    return { points: pts, method: 'kingfish_release', detail: `📸 ${pts}pts` }
  }

  if (method === 'percentage') {
    const lc = lineClassKg || scoringConfig?.line_class?.default_kg || 10
    const pts = calcPercentagePoints(weightKg, lc)
    return { points: pts, method: 'percentage', detail: `${weightKg}kg / ${lc}kg LC` }
  }

  if (method === 'cpue') {
    const pts = calcCpuePoints(weightKg)
    return { points: pts, method: 'cpue', detail: `${weightKg}kg` }
  }

  if (method === 'weight') {
    return { points: weightKg || 0, method: 'weight', detail: `${weightKg}kg` }
  }

  // Default: points method
  const pPerFish   = speciesRule?.bonus_points ?? speciesRule?.points_per_fish ?? 3
  const sBonus     = scoringConfig?.species_bonus_points ?? 3
  const olBonus    = scoringConfig?.over_line_bonus ?? 5
  const pts = calcPointsScoring({
    fishCount,
    pointsPerFish: pPerFish,
    speciesBonus:  sBonus,
    overLineCount: overLineCount || 0,
    overLineBonus: olBonus,
    isFirstFish,
  })
  return { points: pts, method: 'points', detail: `${fishCount} fish × ${pPerFish}pts + ${sBonus} species bonus` }
}

// ── Daily boat percentages (per angler, per day) ────────────────────────────
// The building block behind team scoring, but exposed on its own since raw
// points AND percentage both matter independently: raw points decide the
// daily top-angler award, percentage is what feeds into team totals. Returns
// one record per angler per day they fished, so callers can show both
// figures side by side without re-deriving anything.
export function buildDailyAnglerPercentages(catches, participants, days, boats) {
  const activeCatches = catches.filter(c => c.data_quality !== 'rejected')

  // Total points per participant, per boat, per day
  const byBoatDay = {}
  for (const c of activeCatches) {
    if (!c.boat_id || !c.competition_day_id) continue
    const key = `${c.boat_id}|${c.competition_day_id}`
    const pid = c.participant_id || participants.find(p => p.user_id === c.angler_id)?.id
    if (!pid) continue
    if (!byBoatDay[key]) byBoatDay[key] = {}
    const pts = c.data_quality === 'disqualified' ? 0 : parseFloat(c.points || 0)
    byBoatDay[key][pid] = (byBoatDay[key][pid] || 0) + pts
  }

  const records = []
  for (const [key, anglerPoints] of Object.entries(byBoatDay)) {
    const [boatId, dayId] = key.split('|')
    const max = Math.max(...Object.values(anglerPoints), 0)
    const day  = days?.find(d => d.id === dayId)
    const boat = boats?.find(b => b.id === boatId)
    for (const [pid, pts] of Object.entries(anglerPoints)) {
      const p = participants.find(pp => pp.id === pid)
      records.push({
        participantId: pid,
        displayName:   p?.full_name || 'Unknown',
        teamId:        p?.team_id || null,
        teamName:      p?.competition_teams?.team_name || p?.competition_teams?.province || null,
        boatId,
        boatName:      boat?.boat_name || 'Unknown',
        dayId,
        dayNumber:     day?.day_number ?? null,
        rawPoints:     pts,
        percentage:    max > 0 ? (pts / max) * 100 : 0,
      })
    }
  }
  return records
}

// ── Team aggregation ──────────────────────────────────────────────────────────
// Aggregates individual catch points into team scores.
// method: 'sum_all' | 'sum_top_n' | 'ip_provincial_sum'
export function aggregateTeamScores(catches, participants, teamConfig, scoringConfig) {
  const method = scoringConfig?.team_aggregation || teamConfig?.aggregation_method || 'sum_all'

  // Group catches by team
  const byTeam = {}
  for (const c of catches) {
    if (c.data_quality === 'rejected' || c.data_quality === 'disqualified') continue
    const teamId = c.team_id
    if (!teamId) continue
    if (!byTeam[teamId]) byTeam[teamId] = { catches: [], points: 0 }
    byTeam[teamId].catches.push(c)
    byTeam[teamId].points += parseFloat(c.points || 0)
  }

  return byTeam
}

// ── Boat-percentage team standings ──────────────────────────────────────────
// Confirmed methodology (split-boat formats where boats rotate between
// teams, e.g. Junior Bottomfish Nationals): within each boat, on each day,
// the highest-scoring angler on that boat that day gets 100% — everyone
// else on that same boat that day (regardless of which team they're from)
// is scored as their raw points ÷ that boat's top score for the day. A
// team's total is the sum of each of its 3 anglers' daily boat-percentages
// across every fishing day. This is distinct from aggregateTeamScores
// above (a plain raw-points sum) and from individual standings (which
// stay raw-points-based — this percentage conversion is specifically a
// team-scoring mechanism, not how individual prizes are decided).
//
// For competitions NOT scored on boat-relative percentage (confirmed via
// scoring_config.boat_percentage_scoring), totalPercentage has no meaning
// and is always 0 for every team — ranking primarily on it silently
// degraded to a fish-count tiebreak, same underlying bug already fixed in
// buildIndividualStandings. Confirmed via SADSAA Gamefish Nationals 2026:
// every team showed 0.00% and was ordered by fish count instead of points.
// Per-participant points here now come from buildIndividualStandings
// (species-multiplier-aware) rather than a separate raw-points sum, so
// team and individual totals can't disagree the way they did before.
export function buildBoatPercentageTeamStandings(catches, participants, teams, days, boats, scoringConfig = null) {
  const daily = buildDailyAnglerPercentages(catches, participants, days, boats)
  const usesBoatPercentage = scoringConfig?.boat_percentage_scoring === true

  // Multiplier-aware per-participant totals (same figures individual
  // standings uses) — avoids a second, inconsistent points calculation.
  const individual = buildIndividualStandings(catches, participants, days, boats, scoringConfig)
  const fishAndPointsByParticipant = Object.fromEntries(
    individual.map(p => [p.participantId, { fishCount: p.catchCount, points: p.totalPoints }])
  )

  const byTeam = {}
  for (const p of participants) {
    if (!p.team_id) continue
    const entries = daily.filter(d => d.participantId === p.id)
    const percentageSum = entries.reduce((s, e) => s + e.percentage, 0)
    const fp = fishAndPointsByParticipant[p.id] || { fishCount: 0, points: 0 }
    if (!byTeam[p.team_id]) {
      const team = teams?.find(t => t.id === p.team_id)
      byTeam[p.team_id] = {
        teamId:   p.team_id,
        teamName: team?.team_name || team?.province || 'Unknown',
        totalPercentage: 0,
        totalFishCount: 0,
        totalPoints: 0,
        members: [],
      }
    }
    byTeam[p.team_id].totalPercentage += percentageSum
    byTeam[p.team_id].totalFishCount  += fp.fishCount
    byTeam[p.team_id].totalPoints     += fp.points
    byTeam[p.team_id].members.push({
      participantId: p.id,
      displayName:   p.full_name,
      percentageSum,
      points:        fp.points,
      daysCounted:   entries.length,
    })
  }

  // Ranking rule: for boat-percentage competitions (confirmed), total %
  // first, tie broken by total fish count, tie broken again by total
  // points. For every other scoring method, rank directly by total points —
  // percentage is meaningless (always 0) there.
  return Object.values(byTeam)
    .sort((a, b) => usesBoatPercentage
      ? (b.totalPercentage - a.totalPercentage || b.totalFishCount - a.totalFishCount || b.totalPoints - a.totalPoints)
      : (b.totalPoints - a.totalPoints || b.totalFishCount - a.totalFishCount))
    .map((t, i) => ({ ...t, rank: i + 1 }))
}

// ── Individual standings ──────────────────────────────────────────────────────
// Ranked by Angler % first (sum of daily boat percentages, same figure used
// for Team totals), raw points as the tiebreaker — confirmed methodology:
// anglers who hit 100% on their boat any day cluster at the top together,
// ranked among themselves by points; everyone else follows sorted by their
// own percentage. A higher raw-points total can still rank below someone
// with fewer points but a better percentage — that's intentional, per the
// confirmed ranking rule, not a bug.
export function buildIndividualStandings(catches, participants, days, boats, scoringConfig = null) {
  const byParticipant = {}
  const byUserId = {}   // user_id -> participant.id, for registered anglers
  const byPartId = {}   // participant.id -> participant.id (self-map, for clarity below)

  for (const p of participants) {
    // Keyed by participant.id always now — this is the one identifier every
    // participant has, registered or not. user_id only exists for anglers
    // with a RecFish ZA account.
    const key = p.id
    byParticipant[key] = {
      participantId:  p.id,
      anglerNumber:   p.angler_number,
      displayName:    p.full_name,
      teamId:         p.team_id,
      teamName:       p.competition_teams?.team_name || p.competition_teams?.province || null,
      lineClass:      p.line_class_kg,
      category:       p.category,
      totalPoints:    0,
      totalWeightKg:  0,
      catchCount:     0,
      speciesCount:   0,
      anglerPercentage: 0,
      bestFish:       null,
      catches:        [],
    }
    if (p.user_id) byUserId[p.user_id] = key
    byPartId[p.id] = key
  }

  // Tracks each participant's catches grouped by day — only used below for
  // species-multiplier scoring, but harmless to always build.
  const byParticipantDay = {}

  for (const c of catches) {
    if (c.data_quality === 'rejected') continue
    // Registered anglers are matched via angler_id (== user_id). Unregistered
    // anglers (no RecFish ZA account — the common case for junior anglers)
    // have angler_id = null on their catches and must be matched via
    // participant_id instead — same fallback useCatchLoggerData already uses
    // when loading an angler's catches for the logger's draft card. Matching
    // on angler_id alone silently dropped every unregistered angler's
    // catches from standings entirely.
    const key = (c.angler_id && byUserId[c.angler_id]) || byPartId[c.participant_id]
    const p = byParticipant[key]
    if (!p) continue
    const pts = c.data_quality === 'disqualified' ? 0 : parseFloat(c.points || 0)
    p.totalPoints   += pts   // raw sum — overwritten below for species-multiplier competitions
    p.totalWeightKg += parseFloat(c.weight_kg || 0)
    p.catchCount    += 1
    p.catches.push(c)
    // "Best fish" = the single catch that earned the most points, not the
    // heaviest — weight_kg is always null for unit-count competitions
    // (species tallied, not weighed), so comparing on weight there never
    // actually updated past the first catch encountered. Points exists on
    // every catch regardless of scoring method, and for weight-based
    // competitions it still tracks closely with weight anyway (percentage
    // scoring is itself a function of weight), so this is a strictly more
    // correct comparison across every competition type, not just this one.
    if (!p.bestFish || pts > (p.bestFish.data_quality === 'disqualified' ? 0 : parseFloat(p.bestFish.points || 0))) {
      p.bestFish = c
    }

    const dayKey = c.competition_day_id || c.fishing_date || 'unknown'
    if (!byParticipantDay[key]) byParticipantDay[key] = {}
    if (!byParticipantDay[key][dayKey]) byParticipantDay[key][dayKey] = []
    byParticipantDay[key][dayKey].push(c)
  }

  // Species-multiplier scoring (SADSAA Gamefish format): each day's raw
  // points are multiplied by max(1, distinct species that day - 1), then
  // days are summed — overrides the flat sum above. Matches the formula
  // documented in scoring_config.species_multiplier_logic, and the one
  // already proven correct in the public /scoreboard page
  // (UniversalScoreboard.jsx's calcMultipliedPoints); brings this function —
  // and everything downstream of it (the Admin Scoreboard tab, CSV, XLSX,
  // PDF) — in line with that, instead of silently under-counting any angler
  // who caught more than 2 distinct species on a single day. Confirmed via
  // SADSAA Gamefish Nationals 2026: Francois Rossouw's true total is 466.17
  // (3 species on one day → ×2 multiplier that day), not the flat 252.18
  // every report was previously showing.
  if (scoringConfig?.species_multiplier) {
    for (const [key, byDay] of Object.entries(byParticipantDay)) {
      const p = byParticipant[key]
      if (!p) continue
      let total = 0
      for (const dayCatches of Object.values(byDay)) {
        const raw = dayCatches.reduce((s, c) => s + (c.data_quality === 'disqualified' ? 0 : parseFloat(c.points || 0)), 0)
        const speciesThatDay = new Set(dayCatches.map(c => c.species_name).filter(Boolean)).size
        const mult = Math.max(1, speciesThatDay - 1)
        total += raw * mult
      }
      p.totalPoints = total
    }
  }

  // Count unique species per angler
  for (const p of Object.values(byParticipant)) {
    p.speciesCount = new Set(p.catches.map(c => c.species_name)).size
  }

  // Angler % is only meaningful for competitions actually scored on a
  // boat-relative daily percentage (confirmed via
  // scoring_config.boat_percentage_scoring) — computing it unconditionally
  // for every competition made it silently come out as 0 for every angler
  // in formats never meant to use it (e.g. Gamefish's species-multiplier
  // scoring), which then became the PRIMARY sort key below, quietly
  // reordering standings by fish count instead of by points. Confirmed via
  // SADSAA Gamefish Nationals 2026: Dirk Rosslee (9 low-value catches) was
  // outranking Francois Rossouw (5 catches worth far more) in every report.
  const usesBoatPercentage = scoringConfig?.boat_percentage_scoring === true
  if (usesBoatPercentage && days && boats) {
    const daily = buildDailyAnglerPercentages(catches, participants, days, boats)
    for (const d of daily) {
      if (byParticipant[d.participantId]) {
        byParticipant[d.participantId].anglerPercentage += d.percentage
      }
    }
  }

  // Ranking rule: for boat-percentage competitions (confirmed), Angler %
  // first, tie broken by total fish count, tie broken again by total points
  // scored. For every other scoring method, rank directly by total points —
  // anglerPercentage is meaningless (always 0) there, so it's excluded from
  // the sort entirely rather than left in as a no-op primary key that
  // silently falls through to fish count.
  return Object.values(byParticipant)
    .sort((a, b) => usesBoatPercentage
      ? (b.anglerPercentage - a.anglerPercentage || b.catchCount - a.catchCount || b.totalPoints - a.totalPoints)
      : (b.totalPoints - a.totalPoints || b.catchCount - a.catchCount))
    .map((p, i) => ({ ...p, rank: i + 1 }))
}

// ── Species summary grouping ──────────────────────────────────────────────
// Collapses raw catch rows into one row per species: how many fish, total
// points. A multi-fish catch of the same species is saved as several rows
// (only one carries the real points total — see CompetitionAdminScoring.jsx
// for why those aren't safe to hand-edit); this grouping is purely a
// display/reporting concern and never touches the underlying rows. Pass
// already-scoped catches in (e.g. one angler's one day, one boat's one day,
// or the whole competition) to get that scope's summary.
export function groupCatchesBySpecies(catches) {
  const bySpecies = {}
  for (const c of catches) {
    if (c.data_quality === 'rejected') continue
    const key = c.species_name || 'Unknown'
    if (!bySpecies[key]) bySpecies[key] = { speciesName: key, fishCount: 0, totalPoints: 0, rows: [] }
    bySpecies[key].fishCount += 1
    bySpecies[key].totalPoints += c.data_quality === 'disqualified' ? 0 : parseFloat(c.points || 0)
    bySpecies[key].rows.push(c)
  }
  return Object.values(bySpecies).sort((a, b) => b.totalPoints - a.totalPoints)
}

// ── CPUE — Fish Per Hour ─────────────────────────────────────────────────
// "CPUE" (Catch Per Unit Effort) traditionally uses weight/hour, but this
// competition doesn't track weight (species are tallied, not weighed) — so
// this uses fish count/hour instead, labelled plainly as "Fish Per Hour"
// alongside the CPUE name so newer anglers can connect the two.
//
// Hours come from competition_fishing_sessions, keyed by (day_number,
// boat_name) — a different key shape than competition_catches (which uses
// competition_day_id/boat_id), so this resolves through days/boats to
// bridge the two. An angler's hours for a given day are simply their
// boat's hours that day (everyone on a boat shares the same session).
// Returns { byBoatDay: [...], byAnglerDay: [...], byAngler: [...] } —
// byAngler sums fish and hours across every day that day's boat had hours
// recorded, so it only reflects days where Lines In/Up were actually
// captured, not the whole competition by default.
export function buildCpueData(catches, participants, days, boats, fishingSessions) {
  const activeCatches = catches.filter(c => c.data_quality !== 'rejected')

  // hours lookup: "dayNumber|boatName" -> fishing_hours
  const hoursLookup = {}
  for (const s of (fishingSessions || [])) {
    if (s.fishing_hours == null) continue
    hoursLookup[`${s.day_number}|${s.boat_name}`] = parseFloat(s.fishing_hours)
  }

  // Fish counts per boat/day and per angler/day
  const boatDayFish = {}   // "dayNumber|boatName" -> { fishCount, boatId, dayId }
  const anglerDayFish = {} // "participantId|dayNumber" -> { fishCount, boatName, dayNumber }

  for (const c of activeCatches) {
    if (!c.boat_id || !c.competition_day_id) continue
    const day  = days?.find(d => d.id === c.competition_day_id)
    const boat = boats?.find(b => b.id === c.boat_id)
    if (!day || !boat) continue
    const pid = c.participant_id || participants.find(p => p.user_id === c.angler_id)?.id
    if (!pid) continue

    const bdKey = `${day.day_number}|${boat.boat_name}`
    if (!boatDayFish[bdKey]) boatDayFish[bdKey] = { fishCount: 0, dayNumber: day.day_number, boatName: boat.boat_name }
    boatDayFish[bdKey].fishCount += 1

    const adKey = `${pid}|${day.day_number}`
    if (!anglerDayFish[adKey]) anglerDayFish[adKey] = { fishCount: 0, dayNumber: day.day_number, boatName: boat.boat_name, participantId: pid }
    anglerDayFish[adKey].fishCount += 1
  }

  const byBoatDay = Object.values(boatDayFish).map(b => {
    const hours = hoursLookup[`${b.dayNumber}|${b.boatName}`] ?? null
    return { ...b, hours, cpue: hours ? b.fishCount / hours : null }
  })

  const byAnglerDay = Object.values(anglerDayFish).map(a => {
    const hours = hoursLookup[`${a.dayNumber}|${a.boatName}`] ?? null
    const p = participants.find(pp => pp.id === a.participantId)
    return {
      ...a,
      displayName: p?.full_name || 'Unknown',
      hours,
      cpue: hours ? a.fishCount / hours : null,
    }
  })

  // Overall per-angler: sum fish and hours only across days that had hours
  // recorded, so a competition with hours logged for some days but not
  // others still gives an honest rate rather than silently under-counting.
  const byAnglerMap = {}
  for (const a of byAnglerDay) {
    if (!byAnglerMap[a.participantId]) {
      byAnglerMap[a.participantId] = { participantId: a.participantId, displayName: a.displayName, fishCount: 0, hours: 0, daysWithHours: 0 }
    }
    byAnglerMap[a.participantId].fishCount += a.fishCount
    if (a.hours != null) {
      byAnglerMap[a.participantId].hours += a.hours
      byAnglerMap[a.participantId].daysWithHours += 1
    }
  }
  const byAngler = Object.values(byAnglerMap).map(a => ({
    ...a,
    cpue: a.hours > 0 ? a.fishCount / a.hours : null,
  }))

  return { byBoatDay, byAnglerDay, byAngler }
}

// ── Skipper / Boat ranking ───────────────────────────────────────────────
// A distinct format from individual/team scoring: each day, every boat's
// AVERAGE points per angler (total points on that boat ÷ number of anglers
// drawn to it that day) gets ranked 1st, 2nd, 3rd... — then a boat's final
// score is the SUM of its daily positions (grand prix style), lower is
// better, not the sum of raw points.
//
// Confirmed rules:
//   - Averaging (not summing) exists specifically to keep the format fair
//     if a boat ever carries 4 anglers instead of the usual 3 — without it,
//     a 4-angler boat would be structurally favoured just by having an
//     extra rod in the water. Confirmed with Malcolm: implement this even
//     though every boat at East London 2026 happens to carry exactly 3
//     anglers (no boat's ranking changes today, dividing every boat by the
//     same constant), so it's ready for the day a mixed-crew tournament
//     actually shows up.
//   - Tiebreak: lowest total position wins; ties broken by most fish
//     caught for the competition; still tied, by total points scored
//     (raw total, not average — matches the original tiebreak rule).
//   - Absent skipper: a boat with no catches recorded for a day it should
//     have fished gets a position of (number of boats that DID fish that
//     day) + 1 for that day, rather than being left unscored.
//
// Crew size source: competition_boat_draws (participant_id × boat_id ×
// competition_day_id) is the authoritative roster — it correctly counts an
// angler who was on the boat but blanked that day, unlike counting distinct
// anglers with catches recorded. boatDraws is optional; if it's not passed
// (or has no rows for a given boat/day), this falls back to counting
// distinct anglers who have catches recorded for that boat/day, so older
// competitions without boat_draws data still rank sensibly.
//
// One real limitation, flagged rather than silently assumed: "absence" is
// inferred here purely from having zero catches recorded for a boat on a
// day other boats fished. A boat that genuinely went out and caught
// nothing at all that day (e.g. every catch DQ'd) would be
// indistinguishable from a true no-show with catch data alone. Worth
// flagging to Malcolm/John if a specific day's ranking looks wrong for this
// reason.
export function buildSkipperRanking(catches, boats, days, boatDraws = []) {
  // 'rejected' catches never count anywhere — they represent a data-entry
  // mistake, not a real catch. 'disqualified' is different: the fish was
  // genuinely caught, the angler incurred a rules penalty for something
  // like an equipment infraction — confirmed with Malcolm/John that this
  // does NOT reduce the skipper's daily total, unlike angler/team scoring
  // (buildIndividualStandings/buildBoatPercentageTeamStandings), which
  // correctly still zero a disqualified angler's own points. Verified
  // against the official U16 Skipper Ranking sheet: Black Magic's Day 2
  // total only matched once Marinus van der Merwe's disqualified 65 points
  // were included rather than zeroed.
  const activeCatches = catches.filter(c => c.data_quality !== 'rejected')

  const byBoatDay = {}       // "dayNumber|boatId" -> summed points, all anglers on the boat
  const fishCountByBoat = {} // boatId -> total fish count, whole competition
  const catchAnglersByBoatDay = {} // "dayNumber|boatId" -> Set(participant_id) — fallback crew source
  for (const c of activeCatches) {
    if (!c.boat_id || !c.competition_day_id) continue
    const day = days?.find(d => d.id === c.competition_day_id)
    if (!day) continue
    const pts = parseFloat(c.points || 0)
    const key = `${day.day_number}|${c.boat_id}`
    byBoatDay[key] = (byBoatDay[key] || 0) + pts
    fishCountByBoat[c.boat_id] = (fishCountByBoat[c.boat_id] || 0) + 1
    if (!catchAnglersByBoatDay[key]) catchAnglersByBoatDay[key] = new Set()
    if (c.participant_id) catchAnglersByBoatDay[key].add(c.participant_id)
  }

  const drawCrewByBoatDay = {} // "dayNumber|boatId" -> Set(participant_id), from the boat draw roster
  for (const draw of (boatDraws || [])) {
    if (!draw.boat_id || !draw.competition_day_id) continue
    const day = days?.find(d => d.id === draw.competition_day_id)
    if (!day) continue
    const key = `${day.day_number}|${draw.boat_id}`
    if (!drawCrewByBoatDay[key]) drawCrewByBoatDay[key] = new Set()
    if (draw.participant_id) drawCrewByBoatDay[key].add(draw.participant_id)
  }
  function crewSizeFor(key) {
    if (drawCrewByBoatDay[key]?.size) return drawCrewByBoatDay[key].size
    if (catchAnglersByBoatDay[key]?.size) return catchAnglersByBoatDay[key].size
    return 1 // no roster and no catches to infer from — avoid divide-by-zero
  }

  const dayNumbers = [...new Set((days || []).map(d => d.day_number))].sort((a, b) => a - b)
  const boatIds = [...new Set((boats || []).map(b => b.id))]

  // Rank boats within each day by that day's AVERAGE points per angler
  // (highest = position 1), then apply the absent-skipper penalty to any
  // boat with no catch record that day, on days where at least one other
  // boat did fish.
  const averageByBoatDay = {}  // "dayNumber|boatId" -> average points
  const positionByBoatDay = {} // "dayNumber|boatId" -> position
  for (const dayNum of dayNumbers) {
    const participatingBoatIds = boatIds.filter(id => byBoatDay[`${dayNum}|${id}`] != null)
    const numParticipating = participatingBoatIds.length
    if (numParticipating === 0) continue // nobody fished this day at all — nothing to rank

    participatingBoatIds
      .map(boatId => {
        const key = `${dayNum}|${boatId}`
        const avg = byBoatDay[key] / crewSizeFor(key)
        averageByBoatDay[key] = avg
        return { boatId, avg }
      })
      .sort((a, b) => b.avg - a.avg)
      // Standard competition ranking: boats tied on average share the same
      // position, and the next distinct position skips ahead by the number
      // of boats tied at it (1,2,2,4 — not 1,2,3,4). Previously this assigned
      // strictly sequential positions with no tie-sharing at all, which
      // silently bumped one boat in every tied pair to the wrong position —
      // confirmed against the SADSAA East London 2026 official Skippers
      // sheet, e.g. Hooligan/Fish Trax tied 201-201 on Day 2 (official: both
      // rank 4) came out as ranks 4/5 in the app, shifting Hooligan's total
      // position from the correct 5 to 6.
      .forEach((e, i, arr) => {
        const position = i > 0 && arr[i - 1].avg === e.avg
          ? positionByBoatDay[`${dayNum}|${arr[i - 1].boatId}`]
          : i + 1
        positionByBoatDay[`${dayNum}|${e.boatId}`] = position
      })

    for (const boatId of boatIds) {
      if (!participatingBoatIds.includes(boatId)) {
        positionByBoatDay[`${dayNum}|${boatId}`] = numParticipating + 1
      }
    }
  }

  const results = (boats || []).map(boat => {
    const dailyPoints = {}
    const dailyAverage = {}
    const dailyPosition = {}
    let totalPoints = 0
    let totalPosition = 0
    let daysFished = 0
    for (const dayNum of dayNumbers) {
      const key = `${dayNum}|${boat.id}`
      const pts = byBoatDay[key] ?? null
      const avg = averageByBoatDay[key] ?? null
      const pos = positionByBoatDay[key] ?? null
      dailyPoints[dayNum] = pts
      dailyAverage[dayNum] = avg
      dailyPosition[dayNum] = pos
      if (pts != null) { totalPoints += pts; daysFished += 1 }
      if (pos != null) totalPosition += pos
    }
    return {
      boatId: boat.id,
      boatName: boat.boat_name,
      skipperName: boat.skipper_name,
      dailyPoints,
      dailyAverage,
      dailyPosition,
      totalPoints,
      totalFishCount: fishCountByBoat[boat.id] || 0,
      totalPosition,
      daysFished,
    }
  })

  // Only boats that actually fished at least one real day appear in the
  // ranking at all — a boat that never fished the whole tournament isn't a
  // genuine competing entry, distinct from a boat that fished some days
  // and was absent on others (which IS ranked, with the penalty above).
  return results
    .filter(r => r.daysFished > 0)
    .sort((a, b) => a.totalPosition - b.totalPosition || b.totalFishCount - a.totalFishCount || b.totalPoints - a.totalPoints)
    .map((r, i) => ({ ...r, rank: i + 1 }))
}
