// ─── invitationalDivisions.js ────────────────────────────────────────────────
// CBSC October Tuna Invitational: the overall standings add weighed-fish
// points and verified release points together. Greg Pengelly (TD) asked on
// 24 Oct 2026 for the two to be shown separately as well:
//   * Weighed division  - weighed fish only (1 point per kg), with each
//     day's Daily Biggest Tuna points left out, exactly as in the overall.
//   * Release division  - video-verified releases only (20 / 5 points).
// Weighed points + release points = the angler's overall points.
//
// Pure function: works from the same rows and catches the Scoreboard already
// computed (anglerStandings + filteredCatches), so it can never disagree.

import { calcPoints } from './standings'
import { isReleaseCatch } from './invitationalPrizes'

const r2 = (n) => Math.round(n * 100) / 100
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }
const isVerifiedRelease = (c) => c.video_status === 'verified' || (c.video_status == null && c.retained === false)

export function buildDivisionStandings(anglerStandings = [], filteredCatches = [], scoringConfig = null) {
  const weighed = []
  const release = []
  for (const a of anglerStandings) {
    const ac = filteredCatches.filter(c => c.angler_id === a.uid || c.participant_id === a.id)
    const base = { id: a.id, uid: a.uid, name: a.name, team: a.team, teamDisplay: a.teamDisplay, isLady: a.isLady, isJunior: a.isJunior }

    const w = ac.filter(c => !isReleaseCatch(c) && num(c.weight_kg) > 0)
    if (w.length > 0) {
      weighed.push({
        ...base,
        fish: w.length,
        kg: Math.round(w.reduce((s, c) => s + num(c.weight_kg), 0) * 1000) / 1000,
        points: r2(w.reduce((s, c) => s + calcPoints(c, scoringConfig), 0)),
        dailyBiggest: w.some(c => c.daily_biggest_excluded),
      })
    }

    // Only verified releases score (pending / not-verified ones score 0 and
    // are not in the Scoreboard's standings catches at all).
    const verified = ac.filter(c => isReleaseCatch(c) && isVerifiedRelease(c))
    if (verified.length > 0) {
      release.push({
        ...base,
        releases: verified.length,
        points: r2(verified.reduce((s, c) => s + calcPoints(c, scoringConfig), 0)),
      })
    }
  }
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '')
  weighed.sort((a, b) => (b.points - a.points) || (b.kg - a.kg) || byName(a, b))
  release.sort((a, b) => (b.points - a.points) || (b.releases - a.releases) || byName(a, b))
  return { weighed, release }
}
