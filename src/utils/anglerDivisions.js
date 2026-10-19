// ─── anglerDivisions.js ──────────────────────────────────────────────────────
// Lady / Junior / Senior are separate yes/no tick boxes on each angler
// (competition_participants.is_lady / is_junior / is_senior, SQL 157), so a
// junior girl can be both Lady and Junior. The old single "category" column
// is kept and still filled in on save (Ladies, else Junior, else Senior,
// else Open), so anything older that reads it keeps working; and an angler
// saved before the tick boxes existed falls back to that category. SQL 157
// filled the tick boxes from category for every existing angler, so
// historical competitions read exactly as before.
//
// Every function accepts either a participant row (is_lady...) or a
// standings row built from one (isLady...).

export const isLady   = (x) => !!x && (x.isLady   === true || x.is_lady   === true || x.category === 'ladies')
export const isJunior = (x) => !!x && (x.isJunior === true || x.is_junior === true || x.category === 'junior')
export const isSenior = (x) => !!x && (x.isSenior === true || x.is_senior === true || x.category === 'senior')

// The flags to copy onto a standings row built from a participant.
export const divisionFlags = (p) => ({ isLady: isLady(p), isJunior: isJunior(p), isSenior: isSenior(p) })

// "Lady, Junior" etc. - '' for an open angler.
export function divisionLabel(x) {
  return [isLady(x) && 'Lady', isJunior(x) && 'Junior', isSenior(x) && 'Senior'].filter(Boolean).join(', ')
}

// Matches a filter value used by the Scoreboard and prize categories:
// 'ladies' | 'junior' | 'senior' | 'open' (none of the three).
export function inDivision(x, filter) {
  if (filter === 'ladies') return isLady(x)
  if (filter === 'junior') return isJunior(x)
  if (filter === 'senior') return isSenior(x)
  if (filter === 'open')   return !isLady(x) && !isJunior(x) && !isSenior(x)
  return true
}

// The old single category, kept in step with the tick boxes on save.
export function categoryFromFlags({ is_lady, is_junior, is_senior }) {
  return is_lady ? 'ladies' : is_junior ? 'junior' : is_senior ? 'senior' : 'open'
}
