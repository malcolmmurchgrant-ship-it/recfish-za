// ─── anglerPlacings.js ───────────────────────────────────────────────────────
// For each competition an angler fished: their team, boat and skipper, and -
// where it can be worked out reliably - their TEAM placing and INDIVIDUAL
// placing, e.g. "6th of 10" and "14th of 30" (Nomination Form Sections 13,
// 17 & 19).
//
// Placings are calculated with computeStandings() - exactly what the public
// Scoreboard shows - and ONLY for competitions that were scored live in
// RecFish AND have their results published. Historical imports (loaded from
// post-event spreadsheets, no scoring applied, sometimes missing anglers who
// blanked) and unpublished results get no placing rather than a wrong one.

import { computeStandings } from './standings'

export function ordinal(n) {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`
}
export const placeText = (place, of) => (place ? `${ordinal(place)} of ${of}` : '')

async function loadCompetition(supabase, competitionId) {
  const [
    { data: competition }, { data: catches }, { data: participants },
    { data: teams }, { data: boats }, { data: days },
  ] = await Promise.all([
    supabase.from('competitions')
      .select('*, competition_templates(discipline, level, category, scoring_config, team_config, session_structure)')
      .eq('id', competitionId).single(),
    // same query and row ceiling as the Scoreboard
    supabase.from('competition_catches')
      .select('*, competition_teams(id, team_name, province), competition_days(id, day_number, date)')
      .eq('competition_id', competitionId).order('fishing_date').range(0, 9999),
    supabase.from('competition_participants')
      .select('*, competition_teams(id, team_name, province)').eq('competition_id', competitionId),
    supabase.from('competition_teams').select('*').eq('competition_id', competitionId).order('team_name'),
    supabase.from('competition_boats').select('*').eq('competition_id', competitionId),
    supabase.from('competition_days').select('*').eq('competition_id', competitionId).order('day_number'),
  ])
  return { competition, catches: catches || [], participants: participants || [], teams: teams || [], boats: boats || [], days: days || [] }
}

// Returns { [competitionId]: { team, boat, skipper, teamPlace, teamCount,
//   anglerPlace, anglerCount, placingsAvailable, reason } }
export async function loadAnglerPlacings(supabase, userId) {
  if (!userId) return {}
  const { data: entries, error } = await supabase
    .from('competition_participants')
    .select('id, competition_id, team_id')
    .eq('user_id', userId)
  if (error || !entries?.length) return {}

  const out = {}
  await Promise.all(entries.map(async (entry) => {
    try {
      const data = await loadCompetition(supabase, entry.competition_id)
      const comp = data.competition
      if (!comp) return
      const team = data.teams.find(t => t.id === entry.team_id)
      const boat = team?.boat_id ? data.boats.find(b => b.id === team.boat_id) : null
      const info = {
        team: team ? team.team_name + (team.team_suffix ? ` ${team.team_suffix}` : '') : '',
        boat: boat?.boat_name || '',
        skipper: boat?.skipper_name || team?.captain_name || '',
        teamPlace: null, teamCount: null, anglerPlace: null, anglerCount: null,
        placingsAvailable: false,
        reason: comp.is_historical_import ? 'historical import'
          : !comp.results_published_at ? 'results not published' : '',
      }
      if (!info.reason) {
        const { teamStandings, anglerStandings } = computeStandings({
          competition: comp, template: comp.competition_templates,
          catches: data.catches, participants: data.participants,
          teams: data.teams, boats: data.boats, days: data.days,
        })
        const ti = teamStandings.findIndex(t => t.id === entry.team_id)
        const ai = anglerStandings.findIndex(a => a.id === entry.id)
        if (ti >= 0) { info.teamPlace = ti + 1; info.teamCount = teamStandings.length }
        if (ai >= 0) { info.anglerPlace = ai + 1; info.anglerCount = anglerStandings.length }
        info.placingsAvailable = ti >= 0 || ai >= 0
      }
      out[entry.competition_id] = info
    } catch (e) {
      console.error('Placings for', entry.competition_id, 'failed:', e)
    }
  }))
  return out
}
