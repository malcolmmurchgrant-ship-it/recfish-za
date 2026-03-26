// ============================================================
// RecFish ZA — Competition Scoring Engine
// Junior Gamefish Nationals 2026
// Rules: SADSAA Points Scoring System + Tournament Rules
// ============================================================

const LINE_CLASS_KG = 10
const SPECIES_FACTOR = 1
const BAG_LIMIT = 5 // 5 fish per angler per day (excluding baitfish)

const MIN_WEIGHT_TUNA_KG = 4    // All tuna species minimum
const MIN_WEIGHT_OTHER_KG = 3   // All other gamefish minimum
const MIN_LENGTH_GT_CM = 65     // Giant Kingfish fork length minimum
const MIN_LENGTH_KINGFISH_CM = 40 // Other kingfish fork length minimum

// Kingfish fixed scoring weights (in kg equivalent)
const GT_SCORE_KG = 5           // Giant Kingfish scores as 5kg
const KINGFISH_SCORE_KG = 4     // Other kingfish scores as 4kg

// Daily kingfish release limits per team
const MAX_GT_RELEASES_PER_DAY = 1
const MAX_KINGFISH_RELEASES_PER_DAY = 1

// Tuna species for minimum weight check
const TUNA_SPECIES = [
  'Yellowfin Tuna', 'Skipjack Tuna', 'Eastern Little Tuna/Kawakawa', 'Striped Bonito'
]

// Billfish — release only, score ZERO points but count as species multiplier
const BILLFISH_FAMILIES = ['Sailfish', 'Marlin']

// Kingfish families
const GT_FAMILY = 'Giant Kingfish'
const KINGFISH_FAMILY = 'Other Kingfish'

// Maps species name to scoring family group
const FAMILY_GROUPS = {
  // Queenfish
  'Double Spotted Queenfish': 'Queenfish',
  'Needlescaled Queenfish': 'Queenfish',
  'Talang Queenfish': 'Queenfish',
  // Barracuda
  'Blackfin Barracuda': 'Barracuda',
  'Great Barracuda': 'Barracuda',
  'Pickhandle Barracuda': 'Barracuda',
  'Sawtooth Barracuda': 'Barracuda',
  // Bonito
  'Striped Bonito': 'Bonito',
  // King Mackerel
  'King Mackerel/Cuta': 'King Mackerel',
  // Marlin (all count as one family for multiplier)
  'Black Marlin': 'Marlin',
  'Blue Marlin': 'Marlin',
  'Striped Marlin': 'Marlin',
  'White Marlin': 'Marlin',
  // Kingfish
  'Giant Kingfish/GT': 'Giant Kingfish',
  'Bluefin Kingfish': 'Other Kingfish',
  'Blacktip Kingfish': 'Other Kingfish',
  'Yellowspot Kingfish': 'Other Kingfish',
  // Amberjack and Tropical Yellowtail count as same species
  'Greater Yellowtail/Amberjack': 'Amberjack',
  'Tropical Yellowtail': 'Amberjack',
  // Single species
  'Sailfish': 'Sailfish',
  'Dorado': 'Dorado',
  'Cobia': 'Cobia',
  'Eastern Little Tuna/Kawakawa': 'Kawakawa',
  'Skipjack Tuna': 'Skipjack',
  'Yellowfin Tuna': 'Yellowfin Tuna',
  'Wahoo': 'Wahoo'
}

/**
 * Get the family group for a species name
 */
export function getFamilyGroup(speciesName) {
  return FAMILY_GROUPS[speciesName] || speciesName
}

/**
 * Check if a species is a billfish (release only, zero points, counts for multiplier)
 */
export function isBillfish(speciesName) {
  return BILLFISH_FAMILIES.includes(getFamilyGroup(speciesName))
}

/**
 * Check if a species is a kingfish
 */
export function isGT(speciesName) {
  return getFamilyGroup(speciesName) === GT_FAMILY
}

export function isOtherKingfish(speciesName) {
  return getFamilyGroup(speciesName) === KINGFISH_FAMILY
}

export function isKingfish(speciesName) {
  return isGT(speciesName) || isOtherKingfish(speciesName)
}

/**
 * Check minimum weight/length requirements
 * Returns { valid: bool, reason: string }
 */
export function checkMinimumRequirements(speciesName, weightKg, lengthCm) {
  const family = getFamilyGroup(speciesName)

  // Billfish — no weight requirement, just release
  if (BILLFISH_FAMILIES.includes(family)) {
    return { valid: true, reason: '' }
  }

  // GT — minimum 65cm fork length
  if (family === GT_FAMILY) {
    if (!lengthCm || parseFloat(lengthCm) < MIN_LENGTH_GT_CM) {
      return { valid: false, reason: `Giant Kingfish must be at least ${MIN_LENGTH_GT_CM}cm fork length` }
    }
    return { valid: true, reason: '' }
  }

  // Other kingfish — minimum 40cm
  if (family === KINGFISH_FAMILY) {
    if (!lengthCm || parseFloat(lengthCm) < MIN_LENGTH_KINGFISH_CM) {
      return { valid: false, reason: `Kingfish must be at least ${MIN_LENGTH_KINGFISH_CM}cm fork length` }
    }
    return { valid: true, reason: '' }
  }

  // Tuna — minimum 4kg
  if (TUNA_SPECIES.includes(speciesName)) {
    if (!weightKg || parseFloat(weightKg) < MIN_WEIGHT_TUNA_KG) {
      return { valid: false, reason: `Tuna must be at least ${MIN_WEIGHT_TUNA_KG}kg` }
    }
    return { valid: true, reason: '' }
  }

  // All other gamefish — minimum 3kg
  if (!weightKg || parseFloat(weightKg) < MIN_WEIGHT_OTHER_KG) {
    return { valid: false, reason: `Must be at least ${MIN_WEIGHT_OTHER_KG}kg` }
  }

  return { valid: true, reason: '' }
}

/**
 * Calculate base points for a single kill & weigh fish
 */
export function calcKillWeighPoints(weightKg) {
  const ratio = weightKg / LINE_CLASS_KG
  return Math.pow(ratio, 2) * 32 * SPECIES_FACTOR
}

/**
 * Calculate kingfish points (fixed weight scoring)
 */
export function calcKingfishPoints(speciesName) {
  if (isGT(speciesName)) return calcKillWeighPoints(GT_SCORE_KG)
  if (isOtherKingfish(speciesName)) return calcKillWeighPoints(KINGFISH_SCORE_KG)
  return 0
}

/**
 * Calculate species multiplier
 * 1-2 species → ×1, 3 species → ×2, 4 species → ×3 etc.
 */
export function calcSpeciesMultiplier(distinctFamilies) {
  if (distinctFamilies <= 2) return 1
  return distinctFamilies - 1
}

/**
 * Calculate full team daily score from an array of catches
 * Billfish count for multiplier but score zero points
 */
export function calcTeamDayScore(catches) {
  if (!catches || catches.length === 0) {
    return { rawTotal: 0, multiplier: 1, finalScore: 0, distinctFamilies: 0, catchCount: 0, details: [] }
  }

  const familiesPresent = new Set()
  const details = []
  let rawTotal = 0

  catches.forEach(c => {
    const family = getFamilyGroup(c.species_name)
    familiesPresent.add(family) // Billfish count toward multiplier

    let points = 0
    let pointsType = ''

    if (BILLFISH_FAMILIES.includes(family)) {
      // Billfish = zero points, counts for multiplier only
      points = 0
      pointsType = 'Release — counts for multiplier only'
    } else if (family === GT_FAMILY) {
      points = calcKingfishPoints(c.species_name)
      pointsType = `GT scores as ${GT_SCORE_KG}kg`
    } else if (family === KINGFISH_FAMILY) {
      points = calcKingfishPoints(c.species_name)
      pointsType = `Kingfish scores as ${KINGFISH_SCORE_KG}kg`
    } else {
      points = calcKillWeighPoints(c.weight_kg || 0)
      pointsType = `${c.weight_kg}kg ÷ ${LINE_CLASS_KG}kg² × 32`
    }

    rawTotal += points

    details.push({
      species: c.species_name,
      family,
      weight_kg: c.weight_kg,
      points: Math.round(points * 100) / 100,
      pointsType
    })
  })

  const distinctFamilies = familiesPresent.size
  const multiplier = calcSpeciesMultiplier(distinctFamilies)
  const finalScore = Math.round(rawTotal * multiplier * 100) / 100

  return {
    rawTotal: Math.round(rawTotal * 100) / 100,
    multiplier,
    finalScore,
    distinctFamilies,
    catchCount: catches.length,
    details
  }
}

/**
 * Calculate skipper grand prix points
 * Lowest total grand prix points wins
 */
export function calcSkipperGrandPrix(boatDayScores) {
  return [...boatDayScores]
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((boat, idx) => ({ ...boat, grandPrixPoints: idx + 1 }))
}

/**
 * Build full leaderboard from all competition catches
 * Tiebreaker: fewer qualifying fish wins
 */
export function buildLeaderboard(catches, teams) {
  const teamScores = {}

  catches.forEach(c => {
    if (!teamScores[c.team_id]) {
      teamScores[c.team_id] = { days: {}, totalScore: 0, totalFish: 0 }
    }
    if (!teamScores[c.team_id].days[c.competition_day_id]) {
      teamScores[c.team_id].days[c.competition_day_id] = []
    }
    teamScores[c.team_id].days[c.competition_day_id].push(c)
    teamScores[c.team_id].totalFish++
  })

  Object.keys(teamScores).forEach(teamId => {
    let total = 0
    Object.values(teamScores[teamId].days).forEach(dayCatches => {
      total += calcTeamDayScore(dayCatches).finalScore
    })
    teamScores[teamId].totalScore = Math.round(total * 100) / 100
  })

  const result = { U19: [], U16: [] }

  teams.forEach(team => {
    const scores = teamScores[team.id] || { totalScore: 0, totalFish: 0 }
    const entry = {
      ...team,
      totalScore: scores.totalScore,
      totalFish: scores.totalFish,
      dayScores: scores.days || {}
    }
    if (team.team_type === 'U19') result.U19.push(entry)
    if (team.team_type === 'U16') result.U16.push(entry)
  })

  // Sort by score desc, tiebreak: FEWER fish wins
  const sortTeams = arr => arr.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
    return a.totalFish - b.totalFish // fewer fish wins tiebreak
  })

  result.U19 = sortTeams(result.U19)
  result.U16 = sortTeams(result.U16)

  return result
}

/**
 * Check if angler has reached daily bag limit (5 fish)
 */
export function isAtBagLimit(anglerDayCatches) {
  return anglerDayCatches.length >= BAG_LIMIT
}

/**
 * Check if team has reached daily kingfish release limit
 */
export function isAtKingfishLimit(teamDayCatches, kingfishType) {
  const family = kingfishType === 'GT' ? GT_FAMILY : KINGFISH_FAMILY
  const limit = kingfishType === 'GT' ? MAX_GT_RELEASES_PER_DAY : MAX_KINGFISH_RELEASES_PER_DAY
  const count = teamDayCatches.filter(c => getFamilyGroup(c.species_name) === family).length
  return count >= limit
}

export { BAG_LIMIT, MIN_WEIGHT_TUNA_KG, MIN_WEIGHT_OTHER_KG, MIN_LENGTH_GT_CM, MIN_LENGTH_KINGFISH_CM, GT_SCORE_KG, KINGFISH_SCORE_KG }
