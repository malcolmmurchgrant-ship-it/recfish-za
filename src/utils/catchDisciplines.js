// ─── catchDisciplines.js ─────────────────────────────────────────────────────
// Sorts an angler's competition catches the way SADSAA selectors look at
// them: by DISCIPLINE first (Bottomfish, Tuna, Gamefish, Light/Heavy Tackle
// Billfish), then by YEAR (most recent first), then by competition.
//
// Which discipline a catch belongs to:
//   1. the competition's own discipline (competitions.discipline), or failing
//      that, its name ("SADSAA Tuna Nationals" → Tuna);
//   2. for "mixed" events (e.g. the All Coastals) and anything still
//      unknown, the SPECIES: tunas → Tuna, gamefish species (incl. marlin
//      and sailfish) → Gamefish, everything else → Bottomfish.
//   Billfish tabs therefore come only from billfish competitions.
//
// "Outstanding" catches, per discipline (agreed with Malcolm, Oct 2026):
//   Tuna        - weight together with line class. Tuna points are already
//                 weight² scaled by line class, so points rank them; weight
//                 breaks ties / covers catches without points.
//   Bottomfish  - points, then weight. Species variety shown in the summary.
//   Gamefish /  - weight, then points. Tag & release is a highlight: counted
//   Billfish      in the summary and badged on the catch.

import { getFamilyGroup, isBillfish } from './competitionScoring'

export const DISCIPLINES = [
  { key: 'bottomfish',     label: 'Bottomfish',            short: 'Bottomfish',  icon: '🐟', facet: 'Bottomfish' },
  { key: 'tuna',           label: 'Tuna',                  short: 'Tuna',        icon: '🐟', facet: 'Tuna' },
  { key: 'gamefish',       label: 'Gamefish',              short: 'Gamefish',    icon: '🎣', facet: 'Gamefish' },
  { key: 'billfish_light', label: 'Light Tackle Billfish', short: 'LT Billfish', icon: '🗡️', facet: 'Light Tackle Billfish' },
  { key: 'billfish_heavy', label: 'Heavy Tackle Billfish', short: 'HT Billfish', icon: '🗡️', facet: 'Heavy Tackle Billfish' },
  { key: 'other',          label: 'Shore & Other',         short: 'Other',       icon: '🏖', facet: null },
]
export const DISCIPLINE_BY_KEY = Object.fromEntries(DISCIPLINES.map(d => [d.key, d]))

const TUNA_SPECIES = /\b(longfin|yellowfin|bigeye|big-eye|bluefin|albacore)\b/i

// Discipline of a competition, or null when it's mixed / can't be told.
export function disciplineOfCompetition(comp) {
  if (!comp) return null
  const d = (comp.discipline || '').toLowerCase()
  if (['bottomfish', 'tuna', 'gamefish', 'billfish_light', 'billfish_heavy'].includes(d)) return d
  if (d === 'shore' || d === 'spearfishing') return 'other'

  const n = (comp.name || '').toLowerCase()
  if (/billfish/.test(n)) {
    if (/heavy|\bht\b/.test(n)) return 'billfish_heavy'
    return 'billfish_light'
  }
  if (/tuna/.test(n)) return 'tuna'
  if (/game\s?fish/.test(n)) return 'gamefish'
  if (/bottom\s?fish/.test(n)) return 'bottomfish'
  if (/shore|spear/.test(n)) return 'other'
  return null
}

// Discipline of a single species, for mixed events.
export function disciplineOfSpecies(speciesName) {
  const s = speciesName || ''
  if (TUNA_SPECIES.test(s)) return 'tuna'
  if (isBillfish(s) || getFamilyGroup(s) !== s) return 'gamefish'   // listed gamefish species
  if (/\b(wahoo|dorado|sailfish|marlin|spearfish|king mackerel|cuta|barracuda|queenfish|kingfish|gt\b|cobia|bonito|skipjack|kawakawa|yellowtail|amberjack|garrick|leervis)\b/i.test(s)) return 'gamefish'
  return 'bottomfish'
}

export function disciplineOfCatch(c) {
  return disciplineOfCompetition(c.competition) || disciplineOfSpecies(c.species_name)
}

export function yearOfCatch(c) {
  const d = c.competition?.start_date || c.fishing_date || c.created_at
  const y = d ? new Date(d).getFullYear() : NaN
  return Number.isFinite(y) ? y : null
}

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0)
const isRelease = c => c.retained === false

// Highest first, per the agreed rules above.
export function rankCatches(catches, discipline) {
  const byPointsThenWeight = (a, b) => num(b.points) - num(a.points) || num(b.weight_kg) - num(a.weight_kg)
  const byWeightThenPoints = (a, b) => num(b.weight_kg) - num(a.weight_kg) || num(b.points) - num(a.points)
  const cmp = (discipline === 'tuna' || discipline === 'bottomfish' || discipline === 'other')
    ? byPointsThenWeight : byWeightThenPoints
  return [...catches].sort(cmp)
}

// Catches worth listing as "outstanding": something to show (weight, points
// or a release), best first.
export function outstandingCatches(catches, discipline, limit = 10) {
  const worth = catches.filter(c => num(c.weight_kg) > 0 || num(c.points) > 0 || isRelease(c))
  const ranked = rankCatches(worth, discipline)
  if (discipline === 'gamefish' || discipline.startsWith('billfish')) {
    // A tagged-and-released billfish has no weight and would sink to the
    // bottom of a weight ranking - it's a highlight, so it leads the list.
    const releasedBillfish = ranked.filter(c => isRelease(c) && !num(c.weight_kg) && isBillfish(c.species_name))
    const weighed = ranked.filter(c => !releasedBillfish.includes(c) && (num(c.weight_kg) > 0 || num(c.points) > 0))
    return [...releasedBillfish, ...weighed].slice(0, limit)
  }
  return ranked.slice(0, limit)
}

// Headline figures for one discipline.
export function summarise(catches) {
  const comps = new Map()
  const years = new Map()
  const species = new Set()
  let points = 0, releases = 0, heaviest = null, topScore = null
  for (const c of catches) {
    if (c.competition?.id) comps.set(c.competition.id, c.competition)
    const y = yearOfCatch(c)
    if (y) years.set(y, (years.get(y) || 0) + 1)
    if (c.species_name) species.add(c.species_name)
    points += num(c.points)
    if (isRelease(c)) releases++
    if (num(c.weight_kg) > 0 && (!heaviest || num(c.weight_kg) > num(heaviest.weight_kg))) heaviest = c
    if (num(c.points) > 0 && (!topScore || num(c.points) > num(topScore.points))) topScore = c
  }
  const yearList = [...years.entries()].sort((a, b) => b[0] - a[0])
  return {
    catches: catches.length,
    competitions: comps.size,
    points: Math.round(points * 100) / 100,
    species: species.size,
    releases,
    heaviest,
    topScore,
    years: yearList,                          // [[2026, 195], [2025, 6], ...] newest first
    firstYear: yearList.length ? yearList[yearList.length - 1][0] : null,
    lastYear: yearList.length ? yearList[0][0] : null,
  }
}

// Split into { [discipline]: catches[] }, leaving out "No Catch" rows.
export function splitByDiscipline(catches) {
  const out = {}
  for (const c of catches) {
    if (/^no catch$/i.test((c.species_name || '').trim())) continue
    const d = disciplineOfCatch(c)
    ;(out[d] = out[d] || []).push(c)
  }
  return out
}

// [{ year, competitions: [{ competition, catches[] }] }], newest first.
export function groupByYearAndCompetition(catches) {
  const years = new Map()
  for (const c of catches) {
    const y = yearOfCatch(c) ?? 'Unknown'
    if (!years.has(y)) years.set(y, new Map())
    const key = c.competition?.id || c.competition?.name || 'unknown'
    const comps = years.get(y)
    if (!comps.has(key)) comps.set(key, { competition: c.competition, catches: [] })
    comps.get(key).catches.push(c)
  }
  const dateOf = g => new Date(g.competition?.start_date || g.catches[0]?.fishing_date || 0).getTime()
  return [...years.entries()]
    .sort((a, b) => (b[0] === 'Unknown' ? -1 : a[0] === 'Unknown' ? 1 : b[0] - a[0]))
    .map(([year, comps]) => ({
      year,
      competitions: [...comps.values()]
        .sort((a, b) => dateOf(b) - dateOf(a))
        .map(g => ({ ...g, catches: [...g.catches].sort((a, b) =>
          new Date(a.fishing_date || 0) - new Date(b.fishing_date || 0)) })),
    }))
}

// Tab order: the angler's own disciplines (Profile) first, then the rest
// in the standard order; only disciplines that have catches.
export function orderedDisciplines(split, facets = []) {
  const have = DISCIPLINES.filter(d => split[d.key]?.length)
  const mine = have.filter(d => d.facet && facets.includes(d.facet))
  const rest = have.filter(d => !mine.includes(d))
  return [...mine, ...rest]
}
