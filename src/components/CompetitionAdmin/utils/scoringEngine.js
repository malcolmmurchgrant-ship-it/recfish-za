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

// ── Individual standings ──────────────────────────────────────────────────────
export function buildIndividualStandings(catches, participants) {
  const byParticipant = {}

  for (const p of participants) {
    // Key by user_id (matches angler_id in competition_catches)
    // Fall back to p.id for new-style participants
    const key = p.user_id || p.id
    byParticipant[key] = {
      participantId:  p.id,
      anglerNumber:   p.angler_number,
      displayName:    p.full_name,
      teamId:         p.team_id,
      lineClass:      p.line_class_kg,
      category:       p.category,
      totalPoints:    0,
      totalWeightKg:  0,
      catchCount:     0,
      speciesCount:   0,
      bestFish:       null,
      catches:        [],
    }
  }

  for (const c of catches) {
    if (c.data_quality === 'rejected') continue
    const p = byParticipant[c.angler_id]
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

  return Object.values(byParticipant)
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((p, i) => ({ ...p, rank: i + 1 }))
}
