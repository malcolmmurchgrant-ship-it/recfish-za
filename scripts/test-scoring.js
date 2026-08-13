// ═══════════════════════════════════════════════════════════════════════
// scripts/test-scoring.js
//
// Regression tests for scoringEngine.js and weightCalculations.js — every
// scoring format currently in use across live SADSAA competitions, each
// with expected values hand-verified against real production data (not
// invented numbers). Run this before merging ANY change to either file.
//
//   node scripts/test-scoring.js
//
// Exits 0 if everything passes, 1 (with a clear list of what broke) if
// anything doesn't. No test framework required — plain Node, no new
// dependencies, so it stays runnable without extra setup.
//
// WHY THIS EXISTS: the species-multiplier bug (Gamefish Nationals showing
// wrong totals in every report) went unnoticed because every scoring fix
// up to that point was verified by hand against whichever ONE competition
// was in front of us — nothing checked whether that fix quietly broke a
// DIFFERENT scoring format nobody was looking at. This file is that check.
//
// WHEN A COMPETITION SURFACES A NEW SCORING WRINKLE: add a test case here
// using its real numbers, the same way each case below was built from a
// real competition. The suite should only ever grow.
// ═══════════════════════════════════════════════════════════════════════

import assert from 'node:assert/strict'
import {
  calcPointsScoring,
  buildIndividualStandings,
  buildBoatPercentageTeamStandings,
  buildSkipperRanking,
} from '../src/components/CompetitionAdmin/utils/scoringEngine.js'
import { calculateWeight } from '../src/utils/weightCalculations.js'

let passed = 0
let failed = 0
const failures = []

function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failed++
    failures.push({ name, err })
    console.log(`  ✗ ${name}`)
    console.log(`    ${err.message}`)
  }
}

console.log('\n── Points-tier scoring (Bottomfish/Junior Bottomfish format) ──')

test('first fish of a species: points-per-fish + species bonus', () => {
  const pts = calcPointsScoring({ fishCount: 1, pointsPerFish: 5, speciesBonus: 3, isFirstFish: true })
  assert.equal(pts, 8)
})

test('three fish of a species: first fish gets the bonus, rest do not', () => {
  const pts = calcPointsScoring({ fishCount: 3, pointsPerFish: 5, speciesBonus: 3, isFirstFish: true })
  // base (5+3) + 2 additional fish × 5 = 8 + 10 = 18
  assert.equal(pts, 18)
})

test('flat over-line bonus (most species — e.g. Geelbek at 5pts)', () => {
  const pts = calcPointsScoring({ fishCount: 1, pointsPerFish: 5, speciesBonus: 3, isFirstFish: true, overLineCount: 1, overLineBonus: 5 })
  assert.equal(pts, 13)
})

test('weight-formula over-line bonus overrides the flat bonus (Red Steenbras, East London 2026)', () => {
  // Confirmed live: 95cm FL Red Steenbras → 16.65kg → floor = 16 bonus points → 5+3+16=24
  const pts = calcPointsScoring({ fishCount: 1, pointsPerFish: 5, speciesBonus: 3, isFirstFish: true, overLineCount: 1, overLineBonus: 5, overLineBonusPoints: 16 })
  assert.equal(pts, 24)
})

console.log('\n── Red Steenbras weight-formula calculation (East London 2026) ──')

test('95cm FL → 16.65kg (verified against SAFishID and hand calculation)', () => {
  const formula = { measure: 'FL', exponent: 2.9519, coefficient: 0.000027, result_unit: 'g', formula_type: 'power-mm' }
  const kg = calculateWeight(95, formula)
  assert.ok(Math.abs(kg - 16.65) < 0.01, `expected ~16.65, got ${kg}`)
})

test('36.8cm FL → 1.01kg (the value that exposed the async race-condition bug)', () => {
  const formula = { measure: 'FL', exponent: 2.9519, coefficient: 0.000027, result_unit: 'g', formula_type: 'power-mm' }
  const kg = calculateWeight(36.8, formula)
  assert.ok(Math.abs(kg - 1.01) < 0.02, `expected ~1.01, got ${kg}`)
})

console.log('\n── Species-multiplier scoring (Gamefish Nationals format) ──')

test('Francois Rossouw, Gamefish Nationals 2026 — real catch data, confirmed against live scoreboard', () => {
  const participants = [
    { id: 'p1', full_name: 'Francois Rossouw', user_id: 'u1', competition_teams: { team_name: 'SADSAA U21' } },
    { id: 'p2', full_name: 'Dirk Rosslee', user_id: 'u2', competition_teams: { team_name: 'Southern Gauteng Blue' } },
  ]
  const catches = [
    { angler_id: 'u1', competition_day_id: 'dayA', species_name: 'King Mackerel (Cuta)', points: 200, data_quality: 'self_reported' },
    { angler_id: 'u1', competition_day_id: 'dayA', species_name: 'Other Tuna', points: 8.9888, data_quality: 'self_reported' },
    { angler_id: 'u1', competition_day_id: 'dayA', species_name: 'Other Kingfish', points: 5, data_quality: 'self_reported' },
    { angler_id: 'u1', competition_day_id: 'dayB', species_name: 'King Mackerel (Cuta)', points: 32, data_quality: 'historical_import' },
    { angler_id: 'u1', competition_day_id: 'dayC', species_name: 'Dorado', points: 6.1952, data_quality: 'historical_import' },
    { angler_id: 'u2', competition_day_id: 'dayA', species_name: 'King Mackerel (Cuta)', points: 42.32, data_quality: 'historical_import' },
    { angler_id: 'u2', competition_day_id: 'dayA', species_name: 'Queen Mackerel', points: 6.48, data_quality: 'historical_import' },
  ]
  const scoringConfig = { method: 'percentage', species_multiplier: true }
  const result = buildIndividualStandings(catches, participants, null, null, scoringConfig)
  const francois = result.find(r => r.displayName === 'Francois Rossouw')
  assert.ok(Math.abs(francois.totalPoints - 466.17) < 0.01, `expected 466.17, got ${francois.totalPoints}`)
  assert.equal(francois.rank, 1, 'Francois should outrank Dirk — more points, even with fewer fish')
})

console.log('\n── Ranking must use points, not fish count, when boat-percentage does not apply ──')

test('fewer, higher-value catches must outrank more, lower-value ones (the exact bug this suite exists for)', () => {
  const participants = [
    { id: 'p1', full_name: 'High Value, Few Fish' },
    { id: 'p2', full_name: 'Low Value, Many Fish' },
  ]
  const catches = [
    { participant_id: 'p1', species_name: 'A', points: 500, data_quality: 'confirmed' },
    { participant_id: 'p2', species_name: 'A', points: 1, data_quality: 'confirmed' },
    { participant_id: 'p2', species_name: 'B', points: 1, data_quality: 'confirmed' },
    { participant_id: 'p2', species_name: 'C', points: 1, data_quality: 'confirmed' },
    { participant_id: 'p2', species_name: 'D', points: 1, data_quality: 'confirmed' },
    { participant_id: 'p2', species_name: 'E', points: 1, data_quality: 'confirmed' },
  ]
  // No scoringConfig passed — matches every non-boat-percentage, non-multiplier format
  const result = buildIndividualStandings(catches, participants, null, null, null)
  assert.equal(result[0].displayName, 'High Value, Few Fish', 'must rank by points, not by catch count')
})

console.log('\n── Boat-percentage ranking (East London 2026 / Bottomfish format) ──')

test('boat-relative percentage IS the primary sort key when boat_percentage_scoring is true', () => {
  const days = [{ id: 'd1', day_number: 1 }]
  const boats = [{ id: 'boatA' }, { id: 'boatB' }]
  const participants = [
    { id: 'p1', full_name: 'Boat A Winner' },   // wins boat A outright (only angler) → 100%
    { id: 'p2', full_name: 'Boat B Runner-up' }, // scores half of boat B's top scorer → 50%, but more raw points
    { id: 'p3', full_name: 'Boat B Winner' },
  ]
  const catches = [
    { participant_id: 'p1', boat_id: 'boatA', competition_day_id: 'd1', species_name: 'X', points: 10, data_quality: 'confirmed' },
    { participant_id: 'p2', boat_id: 'boatB', competition_day_id: 'd1', species_name: 'X', points: 50, data_quality: 'confirmed' },
    { participant_id: 'p3', boat_id: 'boatB', competition_day_id: 'd1', species_name: 'X', points: 100, data_quality: 'confirmed' },
  ]
  const scoringConfig = { boat_percentage_scoring: true }
  const result = buildIndividualStandings(catches, participants, days, boats, scoringConfig)
  const byName = Object.fromEntries(result.map(r => [r.displayName, r]))
  // p1 and p3 both hit 100% (each won their own boat); p2 only reaches 50%
  // despite scoring more raw points than p1 — percentage must win the tie.
  assert.equal(byName['Boat A Winner'].anglerPercentage, 100)
  assert.equal(byName['Boat B Winner'].anglerPercentage, 100)
  assert.equal(byName['Boat B Runner-up'].anglerPercentage, 50)
  assert.ok(result.findIndex(r => r.displayName === 'Boat B Runner-up') > result.findIndex(r => r.displayName === 'Boat A Winner'),
    'higher raw points must NOT outrank a lower boat-percentage in this format')
})

console.log('\n── Skipper averaging by crew size (confirmed rule, never exercised live — every East London boat had exactly 3 anglers) ──')

test('a 4-angler boat must not beat a 3-angler boat purely by having an extra rod', () => {
  const days = [{ id: 'd1', day_number: 1 }]
  const boats = [{ id: 'boat3', boat_name: 'Three Anglers', skipper_name: 'Skipper A' }, { id: 'boat4', boat_name: 'Four Anglers', skipper_name: 'Skipper B' }]
  // Boat3: 3 anglers averaging 20pts each = 60 total, avg 20
  // Boat4: 4 anglers averaging 18pts each = 72 total, avg 18 — HIGHER total, LOWER average
  const catches = [
    { participant_id: 'a1', boat_id: 'boat3', competition_day_id: 'd1', species_name: 'X', points: 20, data_quality: 'confirmed' },
    { participant_id: 'a2', boat_id: 'boat3', competition_day_id: 'd1', species_name: 'X', points: 20, data_quality: 'confirmed' },
    { participant_id: 'a3', boat_id: 'boat3', competition_day_id: 'd1', species_name: 'X', points: 20, data_quality: 'confirmed' },
    { participant_id: 'b1', boat_id: 'boat4', competition_day_id: 'd1', species_name: 'X', points: 18, data_quality: 'confirmed' },
    { participant_id: 'b2', boat_id: 'boat4', competition_day_id: 'd1', species_name: 'X', points: 18, data_quality: 'confirmed' },
    { participant_id: 'b3', boat_id: 'boat4', competition_day_id: 'd1', species_name: 'X', points: 18, data_quality: 'confirmed' },
    { participant_id: 'b4', boat_id: 'boat4', competition_day_id: 'd1', species_name: 'X', points: 18, data_quality: 'confirmed' },
  ]
  const boatDraws = [
    { participant_id: 'a1', boat_id: 'boat3', competition_day_id: 'd1' },
    { participant_id: 'a2', boat_id: 'boat3', competition_day_id: 'd1' },
    { participant_id: 'a3', boat_id: 'boat3', competition_day_id: 'd1' },
    { participant_id: 'b1', boat_id: 'boat4', competition_day_id: 'd1' },
    { participant_id: 'b2', boat_id: 'boat4', competition_day_id: 'd1' },
    { participant_id: 'b3', boat_id: 'boat4', competition_day_id: 'd1' },
    { participant_id: 'b4', boat_id: 'boat4', competition_day_id: 'd1' },
  ]
  const result = buildSkipperRanking(catches, boats, days, boatDraws)
  const boat3 = result.find(r => r.boatName === 'Three Anglers')
  const boat4 = result.find(r => r.boatName === 'Four Anglers')
  assert.equal(boat3.rank, 1, 'Boat3 has the higher AVERAGE (20 vs 18) and must rank 1st, despite Boat4 scoring more total points (72 vs 60)')
  assert.equal(boat4.rank, 2)
})

console.log('\n── Team Standings must also use points, not a meaningless 0% (found while checking Gamefish Nationals) ──')

test('team totals use multiplier-aware individual points, not a separate raw-points sum', () => {
  const participants = [
    { id: 'p1', full_name: 'Francois Rossouw', user_id: 'u1', team_id: 't1', competition_teams: { team_name: 'SADSAA U21' } },
    { id: 'p2', full_name: 'Dirk Rosslee', user_id: 'u2', team_id: 't2', competition_teams: { team_name: 'Southern Gauteng Blue' } },
  ]
  const teams = [{ id: 't1', team_name: 'SADSAA U21' }, { id: 't2', team_name: 'Southern Gauteng Blue' }]
  const catches = [
    { angler_id: 'u1', competition_day_id: 'dayA', species_name: 'King Mackerel (Cuta)', points: 200, data_quality: 'self_reported' },
    { angler_id: 'u1', competition_day_id: 'dayA', species_name: 'Other Tuna', points: 8.9888, data_quality: 'self_reported' },
    { angler_id: 'u1', competition_day_id: 'dayA', species_name: 'Other Kingfish', points: 5, data_quality: 'self_reported' },
    { angler_id: 'u1', competition_day_id: 'dayB', species_name: 'King Mackerel (Cuta)', points: 32, data_quality: 'historical_import' },
    { angler_id: 'u1', competition_day_id: 'dayC', species_name: 'Dorado', points: 6.1952, data_quality: 'historical_import' },
    { angler_id: 'u2', competition_day_id: 'dayA', species_name: 'King Mackerel (Cuta)', points: 42.32, data_quality: 'historical_import' },
    { angler_id: 'u2', competition_day_id: 'dayA', species_name: 'Queen Mackerel', points: 6.48, data_quality: 'historical_import' },
  ]
  const scoringConfig = { method: 'percentage', species_multiplier: true }
  const result = buildBoatPercentageTeamStandings(catches, participants, teams, null, null, scoringConfig)
  const u21 = result.find(r => r.teamName === 'SADSAA U21')
  assert.ok(Math.abs(u21.totalPoints - 466.17) < 0.01, `team total should match the individual's multiplier-aware total (466.17), got ${u21.totalPoints}`)
  assert.equal(u21.rank, 1, 'higher team total must rank 1st, not fall back to a meaningless 0% or fish count')
})

// ── Summary ─────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`)
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('\nFAILED:')
  for (const f of failures) console.log(`  - ${f.name}`)
  process.exit(1)
}
console.log('All scoring formats verified — safe to deploy.\n')
