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

  const byTeam = {}
  for (const p of participants) {
    if (!p.team_id) continue
    const entries = daily.filter(d => d.participantId === p.id)
    const percentageSum = entries.reduce((s, e) => s + e.percentage, 0)
    if (!byTeam[p.team_id]) {
      const team = teams?.find(t => t.id === p.team_id)
      byTeam[p.team_id] = {
        teamId:   p.team_id,
        teamName: team?.team_name || team?.province || 'Unknown',
        totalPercentage: 0,
        members: [],
      }
    }
    byTeam[p.team_id].totalPercentage += percentageSum
    byTeam[p.team_id].members.push({
      participantId: p.id,
      displayName:   p.full_name,
      percentageSum,
      daysCounted:   entries.length,
    })
  }

  return Object.values(byTeam)
    .sort((a, b) => b.totalPercentage - a.totalPercentage)
    .map((t, i) => ({ ...t, rank: i + 1 }))
}

// ── Individual standings ──────────────────────────────────────────────────────
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
    if (!p.bestFish || parseFloat(c.weight_kg) > parseFloat(p.bestFish.weight_kg)) {
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

  return Object.values(byParticipant)
    .sort((a, b) => b.anglerPercentage - a.anglerPercentage || b.totalPoints - a.totalPoints)
    .map((p, i) => ({ ...p, rank: i + 1 }))
}
