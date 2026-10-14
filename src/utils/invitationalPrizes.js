// ─── invitationalPrizes.js ───────────────────────────────────────────────────
// Prize winners for the CBSC October Tuna Invitational, worked out from the
// same catch records the Scoreboard uses. Pure function: no database calls.
//
// Rules (confirmed by Malcolm, 14 Oct 2026):
//   * Weighed fish score their saved points (1 point per kg). Releases score
//     their points only once the Video Verifier has verified the video;
//     pending and not-verified releases score 0.
//   * Daily Biggest Tuna: the heaviest weighed tuna (any species) on each
//     fishing day. That ONE fish's points are then removed from its angler's
//     totals (Overall, Ladies, Junior, boat average). The angler's other
//     fish and releases that day still count.
//   * A fish may win several prizes (e.g. Daily Biggest Tuna, 1st Yellowfin
//     and Top Fish), and an angler may win in several categories.
//   * Yellowfin / Longfin placings and Top Fish rank individual weighed fish
//     by weight.
//   * Up to 3 fishing days carry a Daily Biggest Tuna prize. A day that is
//     not fished has no winner (the club retains that prize money).
//
// "Fishing day" = a competition day not marked cancelled that has at least
// one catch recorded, numbered in date order. The competition has five
// calendar days (20-24 Oct), so the 2nd fishing day might be calendar Day 3.

const DAILY_PRIZE_DAYS = 3

const isYellowfin = (name) => /yellow\s*fin/i.test(name || '')
const isLongfin   = (name) => /long\s*fin/i.test(name || '')

const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
const r2 = (n) => Math.round(n * 100) / 100
const r3 = (n) => Math.round(n * 1000) / 1000

// A row that counts at all: not rejected, not disqualified, not a predator /
// "recorded but not counted" row, and a real species.
function countsAtAll(c) {
  if (c.data_quality === 'rejected' || c.data_quality === 'disqualified') return false
  if (c.scoring === false) return false
  if (!c.species_name || c.species_name === 'No Catch') return false
  return true
}

export function isReleaseCatch(c) {
  return (c.video_status != null && c.video_status !== '') || c.retained === false
}

function isWeighedCatch(c) {
  return !isReleaseCatch(c) && num(c.weight_kg) > 0
}

// Standard competition ranking (1, 2, 2, 4). `value` higher is better;
// `round` decides when two values count as equal.
function rankBy(items, value, round) {
  const sorted = [...items].sort((a, b) => value(b) - value(a))
  let place = 0
  return sorted.map((item, i) => {
    if (i === 0 || round(value(item)) !== round(value(sorted[i - 1]))) place = i + 1
    return { ...item, place }
  }).map((item, _, all) => ({
    ...item,
    tied: all.filter(o => o.place === item.place).length > 1,
  }))
}

// Turns a ranked list into prize slots 1..count. A slot taken by a tie above
// it (e.g. two tied 2nd) is reported as such rather than silently filled by
// the next fish/angler down.
function slots(ranked, count, describe) {
  const out = []
  for (let p = 1; p <= count; p++) {
    const at = ranked.filter(r => r.place === p)
    if (at.length) {
      out.push({ place: p, entries: at.map(describe), tied: at.length > 1 })
      continue
    }
    const coveredBy = ranked.find(r => r.place < p && r.place + ranked.filter(o => o.place === r.place).length > p)
    out.push({
      place: p,
      entries: [],
      tied: false,
      note: coveredBy ? `Shared with the tie for ${ordinal(coveredBy.place)} above` : 'No qualifying entry',
    })
  }
  return out
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// participants / teams / boats / days: the competition's rows.
// upToFishingDay: include fishing days 1..N only (null = every day fished).
export function computeInvitationalPrizes({
  catches = [], participants = [], teams = [], boats = [], days = [], upToFishingDay = null,
}) {
  const warnings = []

  // ── People, teams, boats ────────────────────────────────────────────────
  const teamById = Object.fromEntries(teams.map(t => [t.id, t]))
  const boatById = Object.fromEntries(boats.map(b => [b.id, b]))
  const partById = Object.fromEntries(participants.map(p => [p.id, p]))
  const partByUser = Object.fromEntries(participants.filter(p => p.user_id).map(p => [p.user_id, p]))
  const participantOf = (c) => partById[c.participant_id] || (c.angler_id && partByUser[c.angler_id]) || null

  const boatNameOfTeam = (team) => {
    if (!team) return ''
    return boatById[team.boat_id]?.boat_name || team.team_name || ''
  }
  const personInfo = (p) => {
    const team = teamById[p?.team_id] || p?.competition_teams || null
    return {
      participantId: p?.id || null,
      name: p?.full_name || 'Unknown angler',
      boat: boatNameOfTeam(team),
      team: team?.team_name || '',
      category: p?.category || '',
    }
  }

  // ── Fishing days ────────────────────────────────────────────────────────
  const valid = catches.filter(c => countsAtAll(c) && participantOf(c)?.status !== 'disqualified')
  const dayIdOf = (c) => c.competition_day_id || c.competition_days?.id || null
  const daysWithCatches = new Set(valid.map(dayIdOf).filter(Boolean))
  const fishedDays = [...days]
    .filter(d => !d.cancelled && daysWithCatches.has(d.id))
    .sort((a, b) => (a.day_number || 0) - (b.day_number || 0))
    .map((d, i) => ({ ...d, fishingDay: i + 1 }))
  const fishingDayOf = Object.fromEntries(fishedDays.map(d => [d.id, d.fishingDay]))

  const orphanCatches = valid.filter(c => !fishingDayOf[dayIdOf(c)])
  if (orphanCatches.length) {
    warnings.push(`${orphanCatches.length} catch(es) are on a day marked cancelled or have no day - they are left out. Check the Scoring tab.`)
  }
  if (fishedDays.length > DAILY_PRIZE_DAYS) {
    warnings.push(`Catches are recorded on ${fishedDays.length} days, but prizes are set for ${DAILY_PRIZE_DAYS} fishing days. Check whether a day should be marked cancelled in Setup, or test catches removed.`)
  }

  const lastDay = upToFishingDay ? Math.min(upToFishingDay, fishedDays.length) : fishedDays.length
  const inScope = valid
    .filter(c => fishingDayOf[dayIdOf(c)] && fishingDayOf[dayIdOf(c)] <= lastDay)
    .map(c => ({ ...c, _fishingDay: fishingDayOf[dayIdOf(c)], _person: participantOf(c) }))

  const weighed  = inScope.filter(isWeighedCatch)
  const releases = inScope.filter(isReleaseCatch)
  const pending  = releases.filter(c => c.video_status === 'pending')
  if (pending.length) {
    warnings.push(`${pending.length} release${pending.length === 1 ? ' is' : 's are'} still awaiting video review - they score 0 until verified, so Catch & Release, Overall, Ladies, Junior and boat placings may still change.`)
  }

  const fishDesc = (c) => ({
    ...personInfo(c._person),
    catchId: c.id,
    species: c.species_name,
    weightKg: r3(num(c.weight_kg)),
    points: r2(num(c.points)),
    fishingDay: c._fishingDay,
    result: `${num(c.weight_kg).toFixed(2)} kg${c.species_name ? ` · ${c.species_name}` : ''}`,
    detail: `Fishing Day ${c._fishingDay}`,
  })
  const byWeight = (list) => rankBy(list, c => num(c.weight_kg), v => r3(v))

  // ── Daily Biggest Tuna ──────────────────────────────────────────────────
  const dailyTuna = []
  const excludedCatchIds = new Set()
  for (let d = 1; d <= DAILY_PRIZE_DAYS; d++) {
    const day = fishedDays.find(x => x.fishingDay === d)
    if (!day) {
      dailyTuna.push({ fishingDay: d, status: 'not_fished', entries: [] })
      continue
    }
    if (d > lastDay) {
      dailyTuna.push({ fishingDay: d, day, status: 'not_included', entries: [] })
      continue
    }
    const ranked = byWeight(weighed.filter(c => c._fishingDay === d))
    const top = ranked.filter(r => r.place === 1)
    top.forEach(c => excludedCatchIds.add(c.id))
    dailyTuna.push({
      fishingDay: d, day,
      status: top.length ? 'decided' : 'no_fish',
      tied: top.length > 1,
      entries: top.map(fishDesc),
      runnerUp: ranked.find(r => r.place > 1) ? fishDesc(ranked.find(r => r.place > 1)) : null,
    })
  }
  if (dailyTuna.some(t => t.tied)) {
    warnings.push('A Daily Biggest Tuna is tied on weight - the TD must decide. Until then, BOTH tied fish are left out of their anglers\' totals.')
  }

  // ── Angler totals (after the Daily Biggest Tuna rule) ───────────────────
  const anglers = participants
    .filter(p => p.status !== 'disqualified')
    .map(p => {
      const mine = inScope.filter(c => c._person?.id === p.id)
      const w = mine.filter(isWeighedCatch)
      const rel = mine.filter(isReleaseCatch)
      const verified = rel.filter(c => c.video_status === 'verified' || (c.video_status == null && c.retained === false))
      const weighedPts = w.reduce((s, c) => s + num(c.points), 0)
      const excluded = w.filter(c => excludedCatchIds.has(c.id))
      const excludedPts = excluded.reduce((s, c) => s + num(c.points), 0)
      const releasePts = verified.reduce((s, c) => s + num(c.points), 0)
      return {
        ...personInfo(p),
        weighedPoints: r2(weighedPts),
        excludedPoints: r2(excludedPts),
        excludedFish: excluded.map(fishDesc),
        releasePoints: r2(releasePts),
        releasesVerified: verified.length,
        releasesPending: rel.filter(c => c.video_status === 'pending').length,
        total: r2(weighedPts - excludedPts + releasePts),
        scoreboardTotal: r2(weighedPts + releasePts),
        fishWeighed: w.length,
      }
    })

  const personDesc = (key, unit) => (a) => ({
    ...a,
    result: `${a[key].toFixed(2)} ${unit}`,
    detail: [
      key === 'total' && a.excludedPoints > 0 ? `${a.excludedPoints.toFixed(2)} pts of a Daily Biggest Tuna left out` : '',
      key === 'releasePoints' ? `${a.releasesVerified} verified release${a.releasesVerified === 1 ? '' : 's'}` : '',
      a.releasesPending ? `${a.releasesPending} release${a.releasesPending === 1 ? '' : 's'} awaiting review` : '',
    ].filter(Boolean).join(' · '),
  })

  const scored = anglers.filter(a => a.total > 0)
  const overallRanked = rankBy(scored, a => a.total, v => r2(v))
  const ladiesRanked  = rankBy(scored.filter(a => a.category === 'ladies'), a => a.total, v => r2(v))
  const juniorRanked  = rankBy(scored.filter(a => a.category === 'junior'), a => a.total, v => r2(v))
  const releaseRanked = rankBy(anglers.filter(a => a.releasePoints > 0), a => a.releasePoints, v => r2(v))

  // ── Boat average (for the TD's Top Team / auction decision) ─────────────
  const boatRanking = rankBy(
    teams.filter(t => !t.is_disqualified).map(t => {
      const crew = anglers.filter(a => {
        const p = partById[a.participantId]
        return p?.team_id === t.id
      })
      const sum = crew.reduce((s, a) => s + a.total, 0)
      return {
        teamId: t.id,
        name: t.team_name,
        boat: boatNameOfTeam(t),
        skipper: boatById[t.boat_id]?.skipper_name || '',
        anglers: crew.length,
        total: r2(sum),
        average: crew.length ? r2(sum / crew.length) : 0,
      }
    }).filter(b => b.anglers > 0),
    b => b.average, v => r2(v)
  )

  // ── Prize categories ────────────────────────────────────────────────────
  const yellowfin = slots(byWeight(weighed.filter(c => isYellowfin(c.species_name))), 5, fishDesc)
  const longfin   = slots(byWeight(weighed.filter(c => isLongfin(c.species_name))), 3, fishDesc)
  const topFishRanked = byWeight(weighed)
  const topFish   = slots(topFishRanked, 1, fishDesc)[0]

  const tieWarn = (label, list) => {
    if (list.some(s => s.tied)) warnings.push(`${label}: a placing is tied - the TD must decide how to split it.`)
  }
  const prizes = {
    release: slots(releaseRanked, 3, personDesc('releasePoints', 'release pts')),
    junior:  slots(juniorRanked, 1, personDesc('total', 'pts')),
    ladies:  slots(ladiesRanked, 3, personDesc('total', 'pts')),
    longfin,
    yellowfin,
    overall: slots(overallRanked, 10, personDesc('total', 'pts')),
    topFish,
  }
  tieWarn('Catch & Release', prizes.release)
  tieWarn('Top Junior', prizes.junior)
  tieWarn('Ladies', prizes.ladies)
  tieWarn('Longfin', prizes.longfin)
  tieWarn('Yellowfin', prizes.yellowfin)
  tieWarn('Overall Most Points', prizes.overall)
  tieWarn('Overall Biggest Fish', [prizes.topFish])

  return {
    fishedDays,
    lastDay,
    pendingReleases: pending.length,
    counts: {
      anglers: anglers.length,
      ladies: anglers.filter(a => a.category === 'ladies').length,
      juniors: anglers.filter(a => a.category === 'junior').length,
      weighed: weighed.length,
      releasesVerified: releases.filter(c => c.video_status === 'verified').length,
      releasesNotVerified: releases.filter(c => c.video_status === 'not_verified').length,
    },
    dailyTuna,
    prizes,
    overallRanked,
    boatRanking,
    warnings,
  }
}

// ── Run of Show ─────────────────────────────────────────────────────────────
// Greg's Prizegiving Run of Show, in announcement order (lowest place
// first), with the App's winners filled in and the TD's awards left for him.
export function buildRunOfShow(result) {
  const rows = []
  const add = (section, award, decidedBy, slot, extra = {}) => rows.push({ section, award, decidedBy, slot, ...extra })
  const td = (section, award) => add(section, award, 'TD', null)
  const desc = (list) => [...list].reverse()

  td('Special Awards', 'Best Dressed Team')
  td('Special Awards', 'Spirit of the Competition')
  td('Special Awards', 'Wooden Spoon')
  for (let d = 1; d <= DAILY_PRIZE_DAYS; d++) td('Target Weight', `Day ${d}`)

  desc(result.prizes.release).forEach(s => add('Catch and Release', ordinal(s.place), 'App', s))
  add('Juniors', 'Top Junior', 'App', result.prizes.junior[0])
  desc(result.prizes.ladies).forEach(s => add('Ladies', `${ordinal(s.place)} Lady`, 'App', s))
  desc(result.prizes.longfin).forEach(s => add('Longfin', `${ordinal(s.place)} Longfin`, 'App', s))
  desc(result.prizes.yellowfin).forEach(s => add('Yellowfin', `${ordinal(s.place)} Yellowfin`, 'App', s))
  desc(result.prizes.overall).forEach(s => add('Overall Most Points (All Anglers)', ordinal(s.place), 'App', s))
  result.dailyTuna.forEach(t => add('Daily Biggest Tuna', `Fishing Day ${t.fishingDay}`, 'App', {
    place: 1, entries: t.entries, tied: t.tied,
    note: t.status === 'not_fished' ? `No Fishing Day ${t.fishingDay} recorded. If it is not fished, the club retains this prize money`
        : t.status === 'not_included' ? 'Not yet included (see "Results up to")'
        : t.status === 'no_fish' ? 'No tuna weighed this day'
        : (t.day?.date ? `Calendar Day ${t.day.day_number} (${t.day.date})` : ''),
  }, { dailyStatus: t.status }))
  add('Overall Biggest Fish', 'Top Fish', 'App', result.prizes.topFish)
  for (const p of [3, 2, 1]) {
    const ref = result.boatRanking.filter(b => b.place === p)
    add('Top Team (Auction Winner)', `${ordinal(p)} Team`, 'TD', null, {
      reference: ref.length ? ref.map(b => `${b.boat} - avg ${b.average.toFixed(2)} pts`).join(' / ') : '',
    })
  }
  td('Non Winners Draw', '')

  return rows.map((r, i) => ({ order: i + 1, ...r }))
}
