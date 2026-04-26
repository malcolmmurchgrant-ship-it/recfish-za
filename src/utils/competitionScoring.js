// ============================================================
// RecFish ZA — Competition Scoring Engine
// Supports: Gamefish (SADSAA points) and Tuna (weight² × factor)
// ============================================================

// ── GAMEFISH CONSTANTS ──────────────────────────────────────
const GAMEFISH_LINE_CLASS_KG = 10
const GAMEFISH_SPECIES_FACTOR = 1
const GAMEFISH_BAG_LIMIT = 5

const MIN_WEIGHT_TUNA_KG = 4
const MIN_WEIGHT_OTHER_KG = 3
const MIN_LENGTH_GT_CM = 65
const MIN_LENGTH_KINGFISH_CM = 40
const GT_SCORE_KG = 5
const KINGFISH_SCORE_KG = 4
const MAX_GT_RELEASES_PER_DAY = 1
const MAX_KINGFISH_RELEASES_PER_DAY = 1

const BILLFISH_FAMILIES = ['Sailfish', 'Marlin']
const GT_FAMILY = 'Giant Kingfish'
const KINGFISH_FAMILY = 'Other Kingfish'

const GAMEFISH_FAMILY_GROUPS = {
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
  'Giant Kingfish/GT': 'Giant Kingfish',
  'Bluefin Kingfish': 'Other Kingfish',
  'Blacktip Kingfish': 'Other Kingfish',
  'Yellowspot Kingfish': 'Other Kingfish',
  'Greater Yellowtail/Amberjack': 'Amberjack',
  'Tropical Yellowtail': 'Amberjack',
  'Sailfish': 'Sailfish',
  'Dorado': 'Dorado',
  'Cobia': 'Cobia',
  'Eastern Little Tuna/Kawakawa': 'Kawakawa',
  'Skipjack Tuna': 'Skipjack',
  'Yellowfin Tuna': 'Yellowfin Tuna',
  'Wahoo': 'Wahoo'
}

// ── TUNA CONSTANTS ──────────────────────────────────────────
const TUNA_BAG_LIMIT = 10
const TUNA_LINE_CLASS_FACTORS = { 10: 32/100, 15: 32/225 }
const TUNA_MIN_WEIGHTS = {
  'Longfin Tuna': 10,
  'Yellowfin Tuna': 20,
  'Bigeye Tuna': 20,
  'Southern Bluefin Tuna': 20
}
const TUNA_SPECIES = ['Longfin Tuna', 'Yellowfin Tuna', 'Bigeye Tuna', 'Southern Bluefin Tuna']

// ── SHARED UTILITIES ────────────────────────────────────────
export function getFamilyGroup(speciesName) {
  return GAMEFISH_FAMILY_GROUPS[speciesName] || speciesName
}

export function isBillfish(speciesName) {
  return BILLFISH_FAMILIES.includes(getFamilyGroup(speciesName))
}

export function isGT(speciesName) {
  return getFamilyGroup(speciesName) === GT_FAMILY
}

export function isOtherKingfish(speciesName) {
  return getFamilyGroup(speciesName) === KINGFISH_FAMILY
}

export function isKingfish(speciesName) {
  return isGT(speciesName) || isOtherKingfish(speciesName)
}

// ── GAMEFISH SCORING ─────────────────────────────────────────
export function calcKillWeighPoints(weightKg) {
  const ratio = weightKg / GAMEFISH_LINE_CLASS_KG
  return Math.pow(ratio, 2) * 32 * GAMEFISH_SPECIES_FACTOR
}

export function calcKingfishPoints(speciesName) {
  if (isGT(speciesName)) return calcKillWeighPoints(GT_SCORE_KG)
  if (isOtherKingfish(speciesName)) return calcKillWeighPoints(KINGFISH_SCORE_KG)
  return 0
}

export function calcSpeciesMultiplier(distinctFamilies) {
  if (distinctFamilies <= 2) return 1
  return distinctFamilies - 1
}

export function checkGamefishMinimums(speciesName, weightKg, lengthCm) {
  const family = getFamilyGroup(speciesName)
  if (BILLFISH_FAMILIES.includes(family)) return { valid: true, reason: '' }
  if (family === GT_FAMILY) {
    if (!lengthCm || parseFloat(lengthCm) < MIN_LENGTH_GT_CM)
      return { valid: false, reason: `Giant Kingfish must be at least ${MIN_LENGTH_GT_CM}cm fork length` }
    return { valid: true, reason: '' }
  }
  if (family === KINGFISH_FAMILY) {
    if (!lengthCm || parseFloat(lengthCm) < MIN_LENGTH_KINGFISH_CM)
      return { valid: false, reason: `Kingfish must be at least ${MIN_LENGTH_KINGFISH_CM}cm fork length` }
    return { valid: true, reason: '' }
  }
  const isTuna = ['Yellowfin Tuna', 'Skipjack Tuna', 'Eastern Little Tuna/Kawakawa', 'Striped Bonito'].includes(speciesName)
  const minWeight = isTuna ? MIN_WEIGHT_TUNA_KG : MIN_WEIGHT_OTHER_KG
  if (!weightKg || parseFloat(weightKg) < minWeight)
    return { valid: false, reason: `Must be at least ${minWeight}kg` }
  return { valid: true, reason: '' }
}

export function calcTeamDayScore(catches) {
  if (!catches || catches.length === 0)
    return { rawTotal: 0, multiplier: 1, finalScore: 0, distinctFamilies: 0, catchCount: 0 }

  const scoringCatches = catches.filter(c => c.species_name !== 'No Catch')
  const familiesPresent = new Set()
  let rawTotal = 0

  scoringCatches.forEach(c => {
    const family = getFamilyGroup(c.species_name)
    familiesPresent.add(family)
    if (BILLFISH_FAMILIES.includes(family)) return
    if (family === GT_FAMILY || family === KINGFISH_FAMILY) {
      rawTotal += calcKingfishPoints(c.species_name)
    } else {
      rawTotal += calcKillWeighPoints(c.weight_kg || 0)
    }
  })

  const distinctFamilies = familiesPresent.size
  const multiplier = calcSpeciesMultiplier(distinctFamilies)
  const finalScore = Math.round(rawTotal * multiplier * 100) / 100

  return {
    rawTotal: Math.round(rawTotal * 100) / 100,
    multiplier,
    finalScore,
    distinctFamilies,
    catchCount: scoringCatches.length
  }
}

export function isAtBagLimit(anglerDayCatches) {
  return anglerDayCatches.length >= GAMEFISH_BAG_LIMIT
}

export function isAtKingfishLimit(teamDayCatches, kingfishType) {
  const family = kingfishType === 'GT' ? GT_FAMILY : KINGFISH_FAMILY
  const limit = kingfishType === 'GT' ? MAX_GT_RELEASES_PER_DAY : MAX_KINGFISH_RELEASES_PER_DAY
  return teamDayCatches.filter(c => getFamilyGroup(c.species_name) === family).length >= limit
}

export function buildLeaderboard(catches, teams) {
  const teamScores = {}
  catches.forEach(c => {
    if (!teamScores[c.team_id]) teamScores[c.team_id] = { days: {}, totalScore: 0, totalFish: 0 }
    if (!teamScores[c.team_id].days[c.competition_day_id])
      teamScores[c.team_id].days[c.competition_day_id] = []
    teamScores[c.team_id].days[c.competition_day_id].push(c)
    if (c.species_name !== 'No Catch') teamScores[c.team_id].totalFish++
  })
  Object.keys(teamScores).forEach(teamId => {
    let total = 0
    Object.values(teamScores[teamId].days).forEach(dc => { total += calcTeamDayScore(dc).finalScore })
    teamScores[teamId].totalScore = Math.round(total * 100) / 100
  })
  const result = { U19: [], U16: [] }
  teams.forEach(team => {
    const scores = teamScores[team.id] || { totalScore: 0, totalFish: 0 }
    const entry = { ...team, totalScore: scores.totalScore, totalFish: scores.totalFish }
    if (team.team_type === 'U19') result.U19.push(entry)
    if (team.team_type === 'U16') result.U16.push(entry)
  })
  const sortTeams = arr => arr.sort((a, b) =>
    b.totalScore !== a.totalScore ? b.totalScore - a.totalScore : a.totalFish - b.totalFish)
  result.U19 = sortTeams(result.U19)
  result.U16 = sortTeams(result.U16)
  return result
}

// ── TUNA SCORING ─────────────────────────────────────────────
export function calcTunaPoints(weightKg, lineClassKg) {
  const factor = TUNA_LINE_CLASS_FACTORS[lineClassKg] || TUNA_LINE_CLASS_FACTORS[10]
  return parseFloat((Math.pow(weightKg, 2) * factor).toFixed(2))
}

export function checkTunaMinimums(speciesName, weightKg) {
  const min = TUNA_MIN_WEIGHTS[speciesName]
  if (!min) return { valid: false, reason: `${speciesName} is not an eligible scoring species` }
  if (!weightKg || parseFloat(weightKg) < min)
    return { valid: false, reason: `${speciesName} minimum weight is ${min}kg` }
  return { valid: true, reason: '' }
}

export function isAtTunaBagLimit(anglerDayCatches) {
  return anglerDayCatches.length >= TUNA_BAG_LIMIT
}

export function calcTunaTeamDayScore(catches) {
  if (!catches || catches.length === 0)
    return { totalScore: 0, catchCount: 0, scoringCatches: 0 }
  const realCatches = catches.filter(c => c.species_name !== 'No Catch')
  let total = 0
  let scoring = 0
  realCatches.forEach(c => {
    if (!c.scoring) return
    total += calcTunaPoints(c.weight_kg || 0, c.line_class_kg || 10)
    scoring++
  })
  return {
    totalScore: Math.round(total * 100) / 100,
    catchCount: realCatches.length,
    scoringCatches: scoring
  }
}

export function buildTunaLeaderboard(catches, teams) {
  const teamScores = {}
  catches.forEach(c => {
    if (!teamScores[c.team_id]) teamScores[c.team_id] = { days: {}, totalScore: 0, totalFish: 0 }
    if (!teamScores[c.team_id].days[c.competition_day_id])
      teamScores[c.team_id].days[c.competition_day_id] = []
    teamScores[c.team_id].days[c.competition_day_id].push(c)
    if (c.species_name !== 'No Catch') teamScores[c.team_id].totalFish++
  })
  Object.keys(teamScores).forEach(teamId => {
    let total = 0
    Object.values(teamScores[teamId].days).forEach(dc => {
      total += calcTunaTeamDayScore(dc).totalScore
    })
    teamScores[teamId].totalScore = Math.round(total * 100) / 100
  })
  return teams.map(team => {
    const scores = teamScores[team.id] || { totalScore: 0, totalFish: 0 }
    return { ...team, totalScore: scores.totalScore, totalFish: scores.totalFish }
  }).sort((a, b) => b.totalScore !== a.totalScore ? b.totalScore - a.totalScore : b.totalFish - a.totalFish)
}

// ── SKIPPER GRAND PRIX (shared) ──────────────────────────────
export function calcSkipperGrandPrix(boatDayScores) {
  return [...boatDayScores]
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((boat, idx) => ({ ...boat, grandPrixPoints: idx + 1 }))
}

export {
  GAMEFISH_BAG_LIMIT, TUNA_BAG_LIMIT, GT_SCORE_KG, KINGFISH_SCORE_KG,
  MIN_WEIGHT_TUNA_KG, MIN_WEIGHT_OTHER_KG, MIN_LENGTH_GT_CM, MIN_LENGTH_KINGFISH_CM,
  TUNA_LINE_CLASS_FACTORS, TUNA_MIN_WEIGHTS, TUNA_SPECIES
}
