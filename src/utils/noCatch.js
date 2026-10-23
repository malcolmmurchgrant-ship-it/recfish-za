// ─── noCatch.js ──────────────────────────────────────────────────────────────
// "No Catch" records: an angler (or a whole team, reported by the skipper or
// captain) came to the weigh station with nothing to weigh or release. Saved
// as a competition_catches row with species_name 'No Catch', 0 points and
// scoring = false, so it never counts as a fish anywhere, but the Scoreboard
// can tell "reported, nothing caught" apart from "not reported yet".
//
// Asked for by Malcolm, 23 Oct 2026 (CBSC October Tuna Invitational, Day 3).
// Historical imports already contain "No Catch" rows; nothing here changes
// how those competitions are shown or scored.

export const NO_CATCH = 'No Catch'

export const isNoCatchRow = (c) => /^no catch$/i.test(String(c?.species_name || '').trim())

// Today's date as YYYY-MM-DD in the viewer's local time (South Africa).
export function localToday() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

// Whether this competition shows weigh-in reporting (Weighed / No catch /
// Not reported). Live competitions do; finished ones keep their old display
// unless they actually used No Catch records. Historical imports never do.
export function tracksWeighInReports(competition, catches = []) {
  if (!competition || competition.is_historical_import) return false
  const live = !competition.results_published_at && competition.status !== 'completed'
  return live || (catches || []).some(isNoCatchRow)
}

// The day a weigh-in report should show by default: the latest day that is
// not cancelled and is not in the future.
export function defaultReportDay(days = []) {
  const today = localToday()
  const past = [...days]
    .filter(d => !d.cancelled && (!d.date || String(d.date).slice(0, 10) <= today))
    .sort((a, b) => (b.day_number || 0) - (a.day_number || 0))
  return past[0] || null
}

// Per angler per day: 'weighed' (any real catch or release recorded),
// 'no_catch' (only a No Catch record), or absent (nothing reported).
// Returns a lookup function status(participantId, dayId).
export function buildReportStatus(catches = [], participants = [], days = []) {
  const byUser = Object.fromEntries(participants.filter(p => p.user_id).map(p => [p.user_id, p.id]))
  const dayIdByNumber = Object.fromEntries(days.map(d => [d.day_number, d.id]))
  const map = new Map()
  for (const c of catches) {
    const pid = c.participant_id || (c.angler_id && byUser[c.angler_id])
    const dayId = c.competition_day_id || c.competition_days?.id || dayIdByNumber[c.competition_days?.day_number]
    if (!pid || !dayId) continue
    const key = `${pid}|${dayId}`
    if (isNoCatchRow(c)) { if (!map.has(key)) map.set(key, 'no_catch') }
    else map.set(key, 'weighed')
  }
  return (participantId, dayId) => map.get(`${participantId}|${dayId}`) || null
}

// A team's status for a day: weighed if any angler weighed, no_catch if any
// angler (usually the captain, for the whole boat) reported No Catch,
// otherwise not reported.
export function teamReportStatus(status, team, participants, dayId) {
  const crew = participants.filter(p => (p.team_id || p.competition_teams?.id) === team.id)
  const states = crew.map(p => status(p.id, dayId))
  if (states.includes('weighed')) return 'weighed'
  if (states.includes('no_catch')) return 'no_catch'
  return 'not_reported'
}
