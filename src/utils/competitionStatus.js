// Works out what status a competition should be SHOWN as, from its stored
// status plus its dates — instead of trusting the stored value on its own.
//
// Why this exists: the Competition Wizard stores status = 'active' for every
// competition it creates, whatever the dates are, and the Setup tab uses a
// different vocabulary again (draft / open / in_progress / completed /
// archived). Reading the raw value therefore showed a competition three
// weeks away as "Live", and any value the Hub didn't recognise as
// "Completed". Dates are the real signal, so the Hub now derives the label
// from them. A competition flips from Upcoming to Live by itself on its first
// day — nobody has to remember to change a status on the morning.
//
// Returns one of:
//   'cancelled' | 'completed' | 'upcoming' | 'registration_open' | 'draft'
//   | 'active' (running now) | 'ended' (dates passed, results not yet published)

// Today as YYYY-MM-DD in the person's own timezone. toISOString() would
// convert to UTC first and give the previous day between midnight and 02:00
// in South Africa (UTC+2).
export function todayLocal() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function effectiveStatus(comp, today = todayLocal()) {
  const stored = comp?.status

  // Final states always win, whatever the dates say.
  if (stored === 'cancelled') return 'cancelled'
  if (stored === 'completed' || stored === 'archived' || comp?.results_published_at) return 'completed'

  const start = comp?.start_date || null
  const end   = comp?.end_date   || start

  if (start && today < start) {
    if (stored === 'draft') return 'draft'
    if (stored === 'registration_open' || stored === 'open') return 'registration_open'
    return 'upcoming'
  }
  if (end && today > end) return 'ended'
  if (start) return 'active' // today is within [start, end]

  // No dates recorded at all — fall back to whatever is stored.
  if (stored === 'active' || stored === 'in_progress') return 'active'
  if (stored === 'draft') return 'draft'
  if (stored === 'registration_open' || stored === 'open') return 'registration_open'
  return 'upcoming'
}
