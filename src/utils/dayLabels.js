// ─── dayLabels.js ────────────────────────────────────────────────────────────
// One way of naming a competition day in every day list, so a day the TD
// marked cancelled in Setup is plainly shown as such wherever it appears.
// SADSAA numbers fishing days only: Day 1 is the first day actually fished,
// so a cancelled day is never given a day number of its own:
//   "Day 1 — Thu, 22 Oct"
//   "CANCELLED — Tue, 20 Oct (Bad weather. Called off.)"

export function dayDate(d, { long = false } = {}) {
  if (!d?.date) return ''
  try {
    return new Date(String(d.date).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-ZA',
      long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' })
  } catch { return String(d.date) }
}

export function dayLabel(d, opts = {}) {
  if (!d) return ''
  const date = dayDate(d, opts)
  if (d.cancelled) {
    return `CANCELLED${date ? ` — ${date}` : ''}${d.cancellation_reason ? ` (${d.cancellation_reason})` : ''}`
  }
  return `Day ${d.day_number}${date ? ` — ${date}` : ''}`
}

// Today's competition day if it is a fishing day, else the first day that
// isn't cancelled - the sensible day for a logger to open on.
export function defaultFishingDay(days = []) {
  const sorted = [...days].sort((a, b) => (a.day_number || 0) - (b.day_number || 0))
  const t = new Date()
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  return sorted.find(d => !d.cancelled && String(d.date).slice(0, 10) === today)
    || sorted.find(d => !d.cancelled)
    || sorted[0]
    || null
}
