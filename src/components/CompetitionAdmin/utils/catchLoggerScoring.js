// ─── catchLoggerScoring.js ───────────────────────────────────────────────────
// Live, per-fish scoring for the UniversalCatchLogger draft card.
//
// scoringEngine.js (CompetitionAdmin/utils/) scores already-stored
// competition_catches rows for standings/aggregation. This file answers a
// different question: "given the fish the angler has just added to their
// draft card, and the competition's species_config/scoring_config, what are
// its points right now — before it's saved?" The two are deliberately kept
// in sync by both calling the same low-level calc functions from
// scoringEngine.js, so a draft fish's displayed points always match what it
// will score once persisted.
//
// species_config.eligible_species entries (one shape, covers every
// competition type seen so far):
//   {
//     name:              'Yellowfin Tuna',
//     group:              'Tuna (min 5kg)',          // for UI <optgroup>
//     billfish:           false,                      // counts as species, no weight score
//     kingfish_release:   false,                       // fixed release points, no weight
//     min_weight_kg:       5,
//     bag_limit:           10,
//     points_per_fish:     3,        // 'points' method only
//     species_bonus:       3,        // 'points' method only — first fish of species
//     over_line_length_cm: null,     // 'points' method only
//     over_line_length_type: null,   // 'T' (total) | 'F' (fork)
//     over_line_bonus:     0,        // 'points' method only
//   }

import {
  calcPercentagePoints,
  calcPointsScoring,
  calcKingfishRelease,
  calcCpuePoints,
} from './scoringEngine'
import { calculateWeight, getBestFormula } from '../../../utils/weightCalculations'

// ── Auto-calculate weight from length for a measured-mode species ───────────
// Mirrors LogCatch.jsx's flow exactly: look up the species' best available
// length-weight formula (Visboekie jsonb first, FishBase table fallback),
// then apply it to the entered length. Returns null if no formula is found
// or the species/length aren't available yet — callers should treat that as
// "can't estimate, weight must be entered manually" rather than an error.
//
// speciesRow must be a full row from the `species` table (id, scientific_name,
// catalogue_name, formulas, default_length_type) — NOT the lightweight
// species_config.eligible_species entry, which has no formula data.
export async function estimateWeightFromLength(supabase, speciesRow, lengthCm, measureType, sexVariant = null) {
  if (!speciesRow || !lengthCm) return null
  try {
    const formula = await getBestFormula(supabase, speciesRow, measureType || speciesRow.default_length_type || 'TL', sexVariant)
    if (!formula) return null
    const weightKg = calculateWeight(parseFloat(lengthCm), formula)
    if (!weightKg || weightKg <= 0) return null
    return { weightKg, source: formula._source, reference: formula._reference }
  } catch (err) {
    console.error('estimateWeightFromLength error:', err)
    return null
  }
}

// ── Bridge: species_config name → full species table row ────────────────────
// species_config.eligible_species entries only carry a plain display name
// ('Yellowfin Tuna'). estimateWeightFromLength needs the full species table
// row (catalogue_name, scientific_name, formulas, default_length_type) to
// find a formula. This looks up that row by matching common_name or
// catalogue_name against the competition species name — same fields
// LogCatch.jsx's search already matches against, so anything findable there
// is findable here. Returns null if no confident single match is found
// (ambiguous or absent matches should fall back to manual weight entry,
// not guess).
export async function findSpeciesRowByName(supabase, speciesName) {
  if (!speciesName) return null
  try {
    const { data, error } = await supabase
      .from('species')
      .select('id, common_name, scientific_name, afrikaans_name, catalogue_name, default_length_type, formulas')
      .or(`catalogue_name.ilike.${speciesName},common_name.ilike.${speciesName}`)
      .limit(2)
    if (error) {
      console.error('findSpeciesRowByName error:', error)
      return null
    }
    if (!data || data.length !== 1) return null // 0 or ambiguous (>1) — don't guess
    return data[0]
  } catch (err) {
    console.error('findSpeciesRowByName error:', err)
    return null
  }
}

// ── Look up a species config entry by name ──────────────────────────────────
export function findSpeciesConfig(speciesConfig, speciesName) {
  const list = speciesConfig?.eligible_species || []
  return list.find(s => s.name === speciesName) || null
}

// ── Build the flat species list + groups for the species picker ───────────────
// Returns { groups: [{ label, species: [...] }], all: [...] }
export function buildSpeciesPicker(speciesConfig) {
  const list = speciesConfig?.eligible_species || []
  const groupMap = new Map()
  for (const sp of list) {
    const label = sp.group || 'Species'
    if (!groupMap.has(label)) groupMap.set(label, [])
    groupMap.get(label).push(sp)
  }
  return {
    groups: Array.from(groupMap.entries()).map(([label, species]) => ({ label, species })),
    all: list,
  }
}

// ── Score a single draft fish row ────────────────────────────────────────────
// fish: { species, weight_kg, length_cm, fishCount, overLineCount, kingfish_release, billfish, isFirstOfSpecies }
// Returns { points, method, detail }
export function scoreDraftFish(fish, speciesCfg, scoringConfig, multiplier = 1) {
  if (!fish || !speciesCfg) return { points: 0, method: 'unknown', detail: '' }

  const method = scoringConfig?.method || 'percentage'
  const lineClassKg = parseFloat(fish.line_class_kg) || scoringConfig?.default_line_class_kg || null

  // Billfish: counts toward species multiplier only, no weight points
  if (speciesCfg.billfish) {
    return { points: 0, method: 'billfish', detail: 'Counts as species — no weight points' }
  }

  // Kingfish-style photo/measure/release: fixed points, no weight needed
  if (speciesCfg.kingfish_release) {
    const pts = calcKingfishRelease(scoringConfig)
    return { points: pts, method: 'release', detail: `Photo + measure release — ${pts}pts flat` }
  }

  if (method === 'percentage') {
    const weightKg = parseFloat(fish.weight_kg) || 0
    if (!weightKg || !lineClassKg) return { points: 0, method, detail: 'Needs weight + line class' }
    const pts = calcPercentagePoints(weightKg, lineClassKg) * multiplier
    return { points: parseFloat(pts.toFixed(4)), method, detail: `(${weightKg}kg / ${lineClassKg}kg)² × 32${multiplier > 1 ? ` × ${multiplier}` : ''}` }
  }

  if (method === 'cpue') {
    const weightKg = parseFloat(fish.weight_kg) || 0
    const pts = calcCpuePoints(weightKg)
    return { points: pts, method, detail: 'Raw weight — CPUE applied at team aggregation' }
  }

  if (method === 'points') {
    const fishCount     = parseInt(fish.fishCount, 10) || 0
    const overLineCount = parseInt(fish.overLineCount, 10) || 0
    const pointsPerFish = speciesCfg.points_per_fish ?? scoringConfig?.points_per_fish ?? 3
    const speciesBonus  = speciesCfg.species_bonus   ?? scoringConfig?.species_bonus_points ?? 3
    const overLineBonus = speciesCfg.over_line_bonus ?? scoringConfig?.over_line_bonus ?? 0
    // Weight-formula species (currently just Red Steenbras): the over-line
    // bonus is the fish's converted weight in whole kilograms, computed
    // from each entered fork length via estimateWeightFromLength — not a
    // flat per-fish value. UniversalCatchLogger computes this asynchronously
    // (weight lookups need a Supabase round trip) and attaches the already-
    // resolved total as fish.overLineBonusPoints before scoring; this
    // function stays synchronous and just uses whatever total it's given.
    const isWeightFormulaBonus = speciesCfg.over_line_bonus_type === 'weight_formula'
    const overLineBonusPoints = isWeightFormulaBonus ? (fish.overLineBonusPoints ?? 0) : null
    const pts = calcPointsScoring({
      fishCount,
      pointsPerFish,
      speciesBonus,
      overLineCount,
      overLineBonus,
      overLineBonusPoints,
      isFirstFish: !!fish.isFirstOfSpecies,
    })
    const overLineDetail = isWeightFormulaBonus
      ? (overLineCount > 0 ? ` + ${overLineBonusPoints} weight-formula OL bonus` : '')
      : (overLineCount > 0 ? ` + ${overLineCount}× over-line bonus` : '')
    return { points: pts, method, detail: `${fishCount} fish × ${pointsPerFish}pts${fish.isFirstOfSpecies ? ` + ${speciesBonus} species bonus` : ''}${overLineDetail}` }
  }

  return { points: 0, method, detail: 'Unsupported scoring method' }
}

// ── Validate a draft fish/species row against its config ────────────────────
// Returns null if valid, or a warning string. Branches on entry_mode since
// 'measured' rows (one fish, weight/length) and 'unit_count' rows (one
// species, a tally) are validated against entirely different fields.
export function validateDraftFish(fish, speciesCfg) {
  if (!speciesCfg) return 'Select a species'

  if (speciesCfg.entry_mode === 'unit_count') {
    const count = parseInt(fish.fishCount, 10) || 0
    if (count <= 0) return null // empty row, not an error — just not counted
    if (speciesCfg.bag_limit && count > speciesCfg.bag_limit) {
      return `Exceeds bag limit of ${speciesCfg.bag_limit} for this species`
    }
    return null
  }

  // entry_mode === 'measured' (default)
  if (speciesCfg.billfish) return null
  if (speciesCfg.kingfish_release) {
    return fish.measured_min_size
      ? null
      : `Must confirm minimum size${speciesCfg.min_size_mm ? ` (≥${speciesCfg.min_size_mm}mm)` : ''} before release`
  }
  const minW = speciesCfg.min_weight_kg
  if (minW && (parseFloat(fish.weight_kg) || 0) < minW) {
    return `Below minimum weight of ${minW}kg`
  }
  return null
}

// ── Compute the species-multiplier (Gamefish-style) from a draft catch list ──
// Mirrors the grouping logic in scoringEngine's standings builder so the
// in-progress card always matches what the saved rows will produce.
export function computeSpeciesMultiplier(draftCatches, speciesConfig) {
  const groupKeyFor = (speciesName) => {
    const cfg = findSpeciesConfig(speciesConfig, speciesName)
    return cfg?.multiplier_group || speciesName
  }
  const uniqueGroups = new Set(
    draftCatches
      .filter(c => c.species)
      .map(c => groupKeyFor(c.species))
  )
  const speciesCount = uniqueGroups.size
  const multiplier = Math.max(1, speciesCount - 1)
  return { speciesCount, multiplier }
}
