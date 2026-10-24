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
  return sortAndRank(weighed, release)
}

// Standard competition ranking on points (1, 2, 2, 4): equal points share a
// place, the same way the Prizegiving tab treats ties.
function sortAndRank(weighed, release) {
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '')
  weighed.sort((a, b) => (b.points - a.points) || (b.kg - a.kg) || byName(a, b))
  release.sort((a, b) => (b.points - a.points) || (b.releases - a.releases) || byName(a, b))
  const rank = (list) => list.forEach((r, i) => { r.rank = (i > 0 && r.points === list[i - 1].points) ? list[i - 1].rank : i + 1 })
  rank(weighed); rank(release)
  return { weighed, release }
}

// Same divisions for the Reports downloads, built straight from the catches
// the Reports tab uses (Daily Biggest Tuna already scored 0, No Catch and
// predator / undersize rows already left out). Saved points are used, as
// everywhere in the Reports; disqualified and rejected catches score 0.
export function buildDivisionsFromCatches({ catches = [], participants = [], teams = [] } = {}) {
  const teamById = Object.fromEntries(teams.map(t => [t.id, t]))
  const pts = (c) => (c.data_quality === 'disqualified' || c.data_quality === 'rejected') ? 0 : num(c.points)
  const valid = catches.filter(c => c.data_quality !== 'rejected' && c.scoring !== false
    && c.species_name && !/^no catch$/i.test(String(c.species_name).trim()))
  const weighed = []
  const release = []
  for (const p of participants) {
    if (p.status === 'disqualified') continue
    const ac = valid.filter(c => c.participant_id === p.id || (p.user_id && c.angler_id === p.user_id))
    const team = teamById[p.team_id] || p.competition_teams || null
    const base = { id: p.id, name: p.full_name || 'Unknown angler', team: team?.team_name || '', teamDisplay: team?.team_name || '' }
    const w = ac.filter(c => !isReleaseCatch(c) && num(c.weight_kg) > 0)
    if (w.length > 0) {
      weighed.push({
        ...base,
        fish: w.length,
        kg: Math.round(w.reduce((s, c) => s + num(c.weight_kg), 0) * 1000) / 1000,
        points: r2(w.reduce((s, c) => s + pts(c), 0)),
        dailyBiggest: w.some(c => c.daily_biggest_excluded),
      })
    }
    const verified = ac.filter(c => isReleaseCatch(c) && isVerifiedRelease(c))
    if (verified.length > 0) {
      release.push({ ...base, releases: verified.length, points: r2(verified.reduce((s, c) => s + pts(c), 0)) })
    }
  }
  return sortAndRank(weighed, release)
}
