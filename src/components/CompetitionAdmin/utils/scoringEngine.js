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
  isFirstFish     = false,  // first fish of a species gets speciesBonus
}) {
  if (!fishCount || fishCount <= 0) return 0
  // First fish: pointsPerFish + speciesBonus
  // Additional fish of same species: pointsPerFish only
  const base = isFirstFish
    ? pointsPerFish + speciesBonus
    : pointsPerFish
  const additional = fishCount > 1 ? pointsPerFish * (fishCount - 1) : 0
  const overLine   = overLineCount * overLineBonus
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
export function buildBoatPercentageTeamStandings(catches, participants, teams, days, boats) {
  const daily = buildDailyAnglerPercentages(catches, participants, days, boats)

  // Total fish count + points per participant, for the competition — needed
  // for the confirmed team tiebreak (fish count, then points), same
  // participant_id/angler_id resolution used throughout.
  const activeCatches = catches.filter(c => c.data_quality !== 'rejected')
  const byUserId = {}, byPartId = {}
  for (const p of participants) {
    if (p.user_id) byUserId[p.user_id] = p.id
    byPartId[p.id] = p.id
  }
  const fishAndPointsByParticipant = {}
  for (const c of activeCatches) {
    const pid = (c.angler_id && byUserId[c.angler_id]) || byPartId[c.participant_id]
    if (!pid) continue
    if (!fishAndPointsByParticipant[pid]) fishAndPointsByParticipant[pid] = { fishCount: 0, points: 0 }
    fishAndPointsByParticipant[pid].fishCount += 1
    fishAndPointsByParticipant[pid].points += c.data_quality === 'disqualified' ? 0 : parseFloat(c.points || 0)
  }

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
      daysCounted:   entries.length,
    })
  }

  // Ranking rule (confirmed): total % first, tie broken by total fish count
  // for the competition, tie broken again by total points scored for the
  // competition.
  return Object.values(byTeam)
    .sort((a, b) => b.totalPercentage - a.totalPercentage || b.totalFishCount - a.totalFishCount || b.totalPoints - a.totalPoints)
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
export function buildIndividualStandings(catches, participants, days, boats) {
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
    p.totalPoints   += pts
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
  }

  // Count unique species per angler
  for (const p of Object.values(byParticipant)) {
    p.speciesCount = new Set(p.catches.map(c => c.species_name)).size
  }

  // Angler % — same daily boat-percentage sum used for Team standings,
  // computed here too so ranking (and every consumer of this function) is
  // consistent without each caller separately re-deriving it.
  if (days && boats) {
    const daily = buildDailyAnglerPercentages(catches, participants, days, boats)
    for (const d of daily) {
      if (byParticipant[d.participantId]) {
        byParticipant[d.participantId].anglerPercentage += d.percentage
      }
    }
  }

  // Ranking rule (confirmed): Angler % first, tie broken by total fish
  // count, tie broken again by total points scored. catchCount already
  // counts one per fish (including multi-fish "padding" rows, one row per
  // fish caught), so it's already the right figure for "total fish count."
  return Object.values(byParticipant)
    .sort((a, b) => b.anglerPercentage - a.anglerPercentage || b.catchCount - a.catchCount || b.totalPoints - a.totalPoints)
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
// TOTAL points (every angler on that boat, summed) gets ranked 1st, 2nd,
// 3rd... — then a boat's final score is the SUM of its daily positions
// (grand prix style), lower is better, not the sum of raw points.
//
// Confirmed rules:
//   - Tiebreak: lowest total position wins; ties broken by most fish
//     caught for the competition; still tied, by total points scored.
//   - Absent skipper: a boat with no catches recorded for a day it should
//     have fished gets a position of (number of boats that DID fish that
//     day) + 1 for that day, rather than being left unscored.
//
// One real limitation, flagged rather than silently assumed: "absence" is
// inferred here purely from having zero catches recorded for a boat on a
// day other boats fished. A boat that genuinely went out and caught
// nothing at all that day (e.g. every catch DQ'd) would be
// indistinguishable from a true no-show with catch data alone. If that
// distinction ever matters, this would need to check the boat draw
// (competition_boat_draws) instead — worth flagging to Malcolm/John if a
// specific day's ranking looks wrong for this reason.
export function buildSkipperRanking(catches, boats, days) {
  const activeCatches = catches.filter(c => c.data_quality !== 'rejected')

  const byBoatDay = {}      // "dayNumber|boatId" -> points
  const fishCountByBoat = {} // boatId -> total fish count, whole competition
  for (const c of activeCatches) {
    if (!c.boat_id || !c.competition_day_id) continue
    const day = days?.find(d => d.id === c.competition_day_id)
    if (!day) continue
    const pts = c.data_quality === 'disqualified' ? 0 : parseFloat(c.points || 0)
    const key = `${day.day_number}|${c.boat_id}`
    byBoatDay[key] = (byBoatDay[key] || 0) + pts
    fishCountByBoat[c.boat_id] = (fishCountByBoat[c.boat_id] || 0) + 1
  }

  const dayNumbers = [...new Set((days || []).map(d => d.day_number))].sort((a, b) => a - b)
  const boatIds = [...new Set((boats || []).map(b => b.id))]

  // Rank boats within each day by that day's points (highest = position 1),
  // then apply the absent-skipper penalty to any boat with no catch record
  // that day, on days where at least one other boat did fish.
  const positionByBoatDay = {} // "dayNumber|boatId" -> position
  for (const dayNum of dayNumbers) {
    const participatingBoatIds = boatIds.filter(id => byBoatDay[`${dayNum}|${id}`] != null)
    const numParticipating = participatingBoatIds.length
    if (numParticipating === 0) continue // nobody fished this day at all — nothing to rank

    participatingBoatIds
      .map(boatId => ({ boatId, points: byBoatDay[`${dayNum}|${boatId}`] }))
      .sort((a, b) => b.points - a.points)
      .forEach((e, i) => { positionByBoatDay[`${dayNum}|${e.boatId}`] = i + 1 })

    for (const boatId of boatIds) {
      if (!participatingBoatIds.includes(boatId)) {
        positionByBoatDay[`${dayNum}|${boatId}`] = numParticipating + 1
      }
    }
  }

  const results = (boats || []).map(boat => {
    const dailyPoints = {}
    const dailyPosition = {}
    let totalPoints = 0
    let totalPosition = 0
    let daysFished = 0
    for (const dayNum of dayNumbers) {
      const key = `${dayNum}|${boat.id}`
      const pts = byBoatDay[key] ?? null
      const pos = positionByBoatDay[key] ?? null
      dailyPoints[dayNum] = pts
      dailyPosition[dayNum] = pos
      if (pts != null) { totalPoints += pts; daysFished += 1 }
      if (pos != null) totalPosition += pos
    }
    return {
      boatId: boat.id,
      boatName: boat.boat_name,
      skipperName: boat.skipper_name,
      dailyPoints,
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
