// ============================================================
// RecFish ZA — Competition Scoring Engine
// Junior Gamefish Nationals 2026
// ============================================================

const LINE_CLASS_KG = 10
const SPECIES_FACTOR = 1
const BAG_LIMIT = 10

const BILLFISH_POINTS = {
  Sailfish: 100,
  Marlin: 220
}

const BILLFISH_BONUS = {
  2: 20,
  3: 40
}

// Maps entered species name to its scoring family group
const FAMILY_GROUPS = {
  'Double Spotted Queenfish': 'Queenfish',
  'Needlescaled Queenfish': 'Queenfish',
  'Talang Queenfish': 'Queenfish',
  'Blackfin Barracuda': 'Barracuda',
  'Great Barracuda': 'Barracuda',
  'Pickhandle Barracuda': 'Barracuda',
  'Sawtooth Barracuda': 'Barracuda',
  'Striped Bonito': 'Bonito',
  'King Mackerel/Cuta': 'King Mackerel',
  'Black Marlin': 'Marlin',
  'Blue Marlin': 'Marlin',
  'Striped Marlin': 'Marlin',
  'White Marlin': 'Marlin',
  'Sailfish': 'Sailfish',
  'Dorado': 'Dorado',
  'Cobia': 'Cobia',
  'Giant Kingfish/GT': 'GT',
  'Greater Yellowtail/Amberjack': 'Amberjack',
  'Eastern Little Tuna/Kawakawa': 'Kawakawa',
  'Skipjack Tuna': 'Skipjack',
  'Yellowfin Tuna': 'Yellowfin Tuna',
  'Wahoo': 'Wahoo'
}

const BILLFISH_FAMILIES = ['Sailfish', 'Marlin']

/**
 * Get the family group for a species name
 */
export function getFamilyGroup(speciesName) {
  return FAMILY_GROUPS[speciesName] || speciesName
}

/**
 * Calculate base points for a single kill & weigh fish
 */
export function calcKillWeighPoints(weightKg) {
  const ratio = weightKg / LINE_CLASS_KG
  return Math.pow(ratio, 2) * 32 * SPECIES_FACTOR
}

/**
 * Calculate billfish release points for a single fish
 * releaseNumber = how many releases of this family this team has had today (1-based, including this fish)
 */
export function calcBillfishPoints(familyGroup, releaseNumber) {
  const base = BILLFISH_POINTS[familyGroup] || 0
  const bonus = BILLFISH_BONUS[releaseNumber] || 0
  return base + bonus
}

/**
 * Calculate species multiplier
 * distinctFamilies = number of distinct family groups caught by team that day
 * Rule: 1 species → ×1, 2 species → ×1, 3 species → ×2, 4 species → ×3, etc.
 */
export function calcSpeciesMultiplier(distinctFamilies) {
  if (distinctFamilies <= 2) return 1
  return distinctFamilies - 1
}

/**
 * Calculate full team daily score from an array of catches
 * catches = array of { species_name, weight_kg, released }
 * Returns { rawTotal, multiplier, finalScore, distinctFamilies, catchCount, details }
 */
export function calcTeamDayScore(catches) {
  if (!catches || catches.length === 0) {
    return { rawTotal: 0, multiplier: 1, finalScore: 0, distinctFamilies: 0, catchCount: 0, details: [] }
  }

  // Track billfish release counts per family for bonus calculation
  const billfishReleaseCounts = {}
  const familiesPresent = new Set()
  const details = []

  let rawTotal = 0

  catches.forEach(c => {
    const family = getFamilyGroup(c.species_name)
    familiesPresent.add(family)

    let points = 0
    let bonus = 0
    let pointsType = ''

    if (BILLFISH_FAMILIES.includes(family)) {
      // Billfish release
      billfishReleaseCounts[family] = (billfishReleaseCounts[family] || 0) + 1
      const releaseNum = billfishReleaseCounts[family]
      points = calcBillfishPoints(family, releaseNum)
      bonus = BILLFISH_BONUS[releaseNum] || 0
      pointsType = `Release (${releaseNum}${releaseNum === 1 ? 'st' : releaseNum === 2 ? 'nd' : 'rd'})`
    } else {
      // Kill & weigh
      points = calcKillWeighPoints(c.weight_kg || 0)
      pointsType = `${c.weight_kg}kg ÷ ${LINE_CLASS_KG}kg²× 32`
    }

    rawTotal += points

    details.push({
      species: c.species_name,
      family,
      weight_kg: c.weight_kg,
      points: Math.round(points * 100) / 100,
      bonus,
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
 * Calculate skipper grand prix points from daily boat scores
 * boatDayScores = [{ boat_id, boat_name, skipper_name, totalPoints }] sorted desc
 * Returns same array with grandPrixPoints added (1st = 1, 2nd = 2, etc.)
 */
export function calcSkipperGrandPrix(boatDayScores) {
  return [...boatDayScores]
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((boat, idx) => ({ ...boat, grandPrixPoints: idx + 1 }))
}

/**
 * Build full leaderboard from all competition catches
 * catches = all catches for competition
 * teams = all teams
 * Returns { u19: [...], u16: [...] } each sorted by total score desc
 */
export function buildLeaderboard(catches, teams) {
  const teamScores = {}

  // Group catches by team and day
  catches.forEach(c => {
    if (!teamScores[c.team_id]) {
      teamScores[c.team_id] = { days: {}, totalScore: 0, totalFish: 0, totalReleases: 0 }
    }
    if (!teamScores[c.team_id].days[c.competition_day]) {
      teamScores[c.team_id].days[c.competition_day] = []
    }
    teamScores[c.team_id].days[c.competition_day].push(c)
    if (c.released) teamScores[c.team_id].totalReleases++
    teamScores[c.team_id].totalFish++
  })

  // Calculate daily and total scores per team
  Object.keys(teamScores).forEach(teamId => {
    let total = 0
    const dayScores = {}
    Object.keys(teamScores[teamId].days).forEach(day => {
      const dayCatches = teamScores[teamId].days[day]
      const dayResult = calcTeamDayScore(dayCatches)
      dayScores[day] = dayResult
      total += dayResult.finalScore
    })
    teamScores[teamId].totalScore = Math.round(total * 100) / 100
    teamScores[teamId].dayScores = dayScores
  })

  // Build leaderboard arrays per category
  const result = { U19: [], U16: [] }

  teams.forEach(team => {
    const scores = teamScores[team.id] || { totalScore: 0, totalFish: 0, totalReleases: 0, dayScores: {} }
    const entry = {
      ...team,
      totalScore: scores.totalScore,
      totalFish: scores.totalFish,
      totalReleases: scores.totalReleases,
      dayScores: scores.dayScores || {}
    }
    if (team.team_type === 'U19') result.U19.push(entry)
    if (team.team_type === 'U16') result.U16.push(entry)
  })

  // Sort by total score desc, tiebreak by fish count
  const sortTeams = arr => arr.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
    return b.totalFish - a.totalFish
  })

  result.U19 = sortTeams(result.U19)
  result.U16 = sortTeams(result.U16)

  return result
}

/**
 * Check if angler has reached daily bag limit
 */
export function isAtBagLimit(anglerDayCatches) {
  return anglerDayCatches.length >= BAG_LIMIT
}
