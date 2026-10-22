// ─── dailyBiggestTunaExclusion.js ────────────────────────────────────────────
// CBSC October Tuna Invitational: the heaviest weighed tuna of each fishing
// day wins the Daily Biggest Tuna prize, and that ONE fish's points are left
// out of its angler's totals. The Prizegiving tab always did this; Greg
// Pengelly (TD) asked on 22 Oct 2026 for the Scoreboard, TV display and
// Reports downloads to do the same, so every screen shows the same totals.
//
// Which fish win is decided by invitationalPrizes.js (the same code the
// Prizegiving tab uses), so the two can never disagree. The winning catch
// keeps its weight (it still wins Yellowfin / Top Fish placings); only its
// points are shown as 0 in standings, with its real points kept alongside.
// Nothing is written to the database.

import { computeInvitationalPrizes } from './invitationalPrizes'

// Same test as the Prizegiving tab: a competition with video-verified
// release species is the Invitational format.
export function usesDailyBiggestTuna(speciesConfig) {
  return (speciesConfig?.eligible_species || []).some(s => s?.require_video_evidence)
}

export function applyDailyBiggestTunaExclusion(catches, { participants = [], teams = [], boats = [], days = [], scoringConfig = null, speciesConfig = null } = {}) {
  if (!Array.isArray(catches) || catches.length === 0) return catches || []
  if (!usesDailyBiggestTuna(speciesConfig)) return catches
  let ids
  try {
    ids = new Set(computeInvitationalPrizes({ catches, participants, teams, boats, days, scoringConfig }).excludedCatchIds || [])
  } catch (e) {
    console.error('Daily Biggest Tuna exclusion skipped:', e)
    return catches
  }
  if (ids.size === 0) return catches
  return catches.map(c => ids.has(c.id)
    ? { ...c, points: 0, original_points: c.points, daily_biggest_excluded: true }
    : c)
}
