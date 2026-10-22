// "Team - Boat" (e.g. "African Vintage Tackle - Rapha"); a team named after
// its boat shows the name once. boats: the competition's boat rows.
export function teamBoatLabel(team, boats = []) {
  if (!team) return ''
  const name = team.team_name || team.province || ''
  const boat = (boats || []).find(b => b.id === team.boat_id)?.boat_name || ''
  const same = boat && boat.trim().toLowerCase() === name.trim().toLowerCase()
  return boat && !same ? `${name} - ${boat}` : name
}
