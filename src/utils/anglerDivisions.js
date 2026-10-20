// ─── anglerDivisions.js ──────────────────────────────────────────────────────
// Every angler is a Senior unless ticked Junior. Lady and Junior are two
// separate yes/no tick boxes on each angler (competition_participants.is_lady
// / is_junior, SQL 157), so a junior girl can be both Lady and Junior, and a
// lady who isn't ticked Junior is a senior lady.
//
// (SQL 157 also added is_senior; the Senior tick box was later dropped -
// Senior now simply means "not Junior" - and that column is no longer used.
// No angler had it set.)
//
// The old single "category" column is kept and still filled in on save
// (Ladies, else Junior, else Open), so anything older that reads it keeps
// working; an angler saved before the tick boxes existed falls back to it.
// SQL 157 filled the tick boxes from category for every existing angler, so
// historical competitions read exactly as before.
//
// Every function accepts either a participant row (is_lady...) or a
// standings row built from one (isLady...).

export const isLady   = (x) => !!x && (x.isLady   === true || x.is_lady   === true || x.category === 'ladies')
export const isJunior = (x) => !!x && (x.isJunior === true || x.is_junior === true || x.category === 'junior')
export const isSenior = (x) => !!x && !isJunior(x)

// The flags to copy onto a standings row built from a participant.
export const divisionFlags = (p) => ({ isLady: isLady(p), isJunior: isJunior(p) })

// "Lady, Junior" / "Lady" / "Junior" - '' for a (male) senior.
export function divisionLabel(x) {
  return [isLady(x) && 'Lady', isJunior(x) && 'Junior'].filter(Boolean).join(', ')
}

// Matches a filter value used by the Scoreboard and prize categories:
// 'ladies' | 'junior' | 'senior' (not Junior) | 'open' (neither Lady nor Junior).
export function inDivision(x, filter) {
  if (filter === 'ladies') return isLady(x)
  if (filter === 'junior') return isJunior(x)
  if (filter === 'senior') return isSenior(x)
  if (filter === 'open')   return !isLady(x) && !isJunior(x)
  return true
}

// The old single category, kept in step with the tick boxes on save.
export function categoryFromFlags({ is_lady, is_junior }) {
  return is_lady ? 'ladies' : is_junior ? 'junior' : 'open'
}
