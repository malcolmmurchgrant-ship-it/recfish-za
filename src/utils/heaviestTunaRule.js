// ─── heaviestTunaRule.js ─────────────────────────────────────────────────────
// CBSC October Tuna Invitational (TD's rule, 14 Oct 2026): an angler may
// weigh a Yellowfin AND a Bigeye or Southern Bluefin on the same day. Both
// are recorded with their weights, but only the HEAVIEST of that angler's
// Yellowfin / Bigeye / Southern Bluefin that day scores points; the lighter
// one scores 0. (Longfin are not part of this rule.) If the weights are
// equal, the Bigeye / Southern Bluefin scores - the TD's wording is "if the
// BE or SBT weighs less than the Yellowfin, no points" - which makes no
// difference to anyone's total, as points = kg.
//
// Switched on per competition by scoring_config.heaviest_tuna_only = true
// (SQL 152), so no other competition is affected.

export const isYellowfinName = (name) => /yellow\s*fin/i.test(name || '')
export const isBigeyeOrBluefinName = (name) => /big\s*eye|blue\s*fin|\bsbt\b/i.test(name || '')
export const isRuleTunaName = (name) => isYellowfinName(name) || isBigeyeOrBluefinName(name)

export const heaviestTunaRuleOn = (scoringConfig) => !!scoringConfig?.heaviest_tuna_only

// items: one angler's weighed fish for one day. Returns the item that scores
// (or null if none of them is a Yellowfin / Bigeye / Southern Bluefin).
export function pickScoringTuna(items, { species = (x) => x.species_name, weight = (x) => x.weight_kg } = {}) {
  let best = null
  for (const it of items) {
    if (!isRuleTunaName(species(it))) continue
    const w = parseFloat(weight(it)) || 0
    if (w <= 0) continue
    if (!best) { best = it; continue }
    const bw = parseFloat(weight(best)) || 0
    if (w > bw || (w === bw && isBigeyeOrBluefinName(species(it)) && !isBigeyeOrBluefinName(species(best)))) best = it
  }
  return best
}

export function ruleNote(winnerSpecies) {
  return `Lighter than this angler's ${winnerSpecies || 'heavier tuna'} today - no points (only the heaviest Yellowfin, Bigeye or Southern Bluefin scores)`
}
