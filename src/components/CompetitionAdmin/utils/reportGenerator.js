// ─── reportGenerator.js ──────────────────────────────────────────────────────
// Generates CSV and XLSX-compatible HTML reports from competition standings.
// No external packages required — uses only browser built-ins.
// PDF generation is handled server-side via Supabase Edge Function.

import { groupCatchesBySpecies } from './scoringEngine'
// Static import, matching every other file in the codebase. This used to be
// a dynamic import() inside downloadPDF only -- Vite's own build warning
// flagged that as the reason it couldn't split supabase.js into its own
// chunk (a module can't be both statically and dynamically imported and
// still get code-split), which forced the ENTIRE app into one single
// ~1.35MB bundle. That made the whole app's module evaluation order
// fragile to any new import edge added anywhere in the graph -- which is
// what actually broke production on 2026-07-20 (a "can't access lexical
// declaration before initialization" TDZ error on every page, not just
// Reports) when disqualificationActions.js was added as a new shared
// dependency elsewhere. The dynamic import here was never actually
// achieving anything, since supabase.js was already needed eagerly by ~30
// other files regardless.
import { supabase } from '../../../lib/supabase'

// ── CSV download ──────────────────────────────────────────────────────────────
export function downloadCSV(standings, competition, config) {
  // Weight-based fields are meaningless noise for a 'points'/unit-count
  // competition (e.g. bottomfish) — nothing ever populates weight_kg there.
  const showWeight = config?.scoring?.method !== 'points'

  const fields = config?.reporting?.csv_fields || [
    'rank','angler_number','display_name','team_name','angler_percentage',
    'total_points', ...(showWeight ? ['total_weight_kg'] : []),
    'species_count','catch_count','cpue',
    'best_fish_species', ...(showWeight ? ['best_fish_weight_kg'] : []),
  ]

  const headers = fields.map(f => f.replace(/_/g, ' ').toUpperCase())

  const rows = standings.map(s => fields.map(f => {
    switch (f) {
      case 'rank':               return s.rank
      case 'angler_number':      return s.anglerNumber || ''
      case 'display_name':       return s.displayName
      case 'team_name':          return s.teamName || ''
      case 'team_suffix':        return s.teamSuffix || ''
      case 'angler_percentage':  return `${(s.anglerPercentage || 0).toFixed(2)}%`
      case 'total_points':       return (s.totalPoints || 0).toFixed(2)
      case 'total_weight_kg':    return (s.totalWeightKg || 0).toFixed(3)
      case 'species_count':      return s.speciesCount || 0
      case 'catch_count':        return s.catchCount || 0
      case 'cpue':               return s.cpue != null ? s.cpue.toFixed(2) : ''
      case 'best_fish_species':  return s.bestFish?.species_name || ''
      case 'best_fish_weight_kg':return s.bestFish?.weight_kg || ''
      case 'line_class':         return s.lineClass ? `${s.lineClass}kg` : ''
      default:                   return ''
    }
  }))

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell =>
      `"${String(cell ?? '').replace(/"/g, '""')}"`
    ).join(','))
    .join('\n')

  triggerDownload(
    new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }),
    `${sanitiseName(competition.name)}_Results.csv`
  )
}

// ── XLSX-compatible HTML download ─────────────────────────────────────────────
export function downloadXLSX(standings, catches, competition, config, mode = 'multi_sheet', extra = {}) {
  const name = sanitiseName(competition.name)
  const { participants = [], dailyRecords = [], teamStandings = [], ladiesTeamStandings = [], cpueData = null, openStandings = [], ladiesStandings = [] } = extra

  if (mode === 'single_sheet') {
    const html = buildSingleSheetHTML(standings, catches, competition, config, participants, dailyRecords, teamStandings, cpueData, ladiesTeamStandings, openStandings, ladiesStandings)
    triggerDownload(
      new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
      `${name}_Results.xls`
    )
  } else {
    const html = buildMultiSheetHTML(standings, catches, competition, config, participants, dailyRecords, teamStandings, cpueData, ladiesTeamStandings, openStandings, ladiesStandings)
    triggerDownload(
      new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
      `${name}_Full.xls`
    )
  }
}


function buildSingleSheetHTML(standings, catches, competition, config, participants = [], dailyRecords = [], teamStandings = [], cpueData = null, ladiesTeamStandings = [], openStandings = [], ladiesStandings = []) {
  const prizeRows = buildPrizeRows(standings, catches, config)
  const showWeight = config?.scoring?.method !== 'points'
  // If a ladies division exists (ladiesStandings non-empty), replace the
  // single combined Standings table with two independently-ranked ones —
  // same underlying scores, just grouped and renumbered by division. Falls
  // back to the original single table for every competition without a
  // ladies division, so this never changes existing behaviour elsewhere.
  const standingsSection = ladiesStandings.length
    ? `<div class="section"><h3>Standings</h3>${standingsTable(openStandings, showWeight)}</div>
<div class="section"><h3>Ladies' Standings</h3>${standingsTable(ladiesStandings, showWeight)}</div>`
    : `<div class="section"><h3>Standings</h3>${standingsTable(standings, showWeight)}</div>`
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; }
  h2 { color: #1e3a8a; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 24pt; }
  th { background: #1e3a8a; color: white; padding: 6px 10px; text-align: left; font-size: 10pt; }
  td { padding: 5px 10px; border-bottom: 1px solid #e5e7eb; font-size: 10pt; }
  tr:nth-child(even) td { background: #f8fafc; }
  .section { margin-top: 20pt; }
</style>
</head><body>
<h2>${competition.name || 'Results'}</h2>
<p>${competition.venue || ''} · ${competition.start_date || ''}</p>
${standingsSection}
${teamStandings.length ? `<div class="section"><h3>Team Standings</h3>${teamStandingsTable(teamStandings)}</div>` : ''}
${ladiesTeamStandings.length ? `<div class="section"><h3>Ladies' Team Standings</h3>${teamStandingsTable(ladiesTeamStandings)}</div>` : ''}
${dailyRecords.length ? `<div class="section"><h3>Daily Results</h3>${dailyResultsTable(dailyRecords, cpueData)}</div>` : ''}
<div class="section"><h3>Species Summary</h3>${speciesSummaryTable(catches)}</div>
<div class="section"><h3>Species by Angler</h3>${catchesSummaryTable(catches, participants)}</div>
<div class="section"><h3>All Catches</h3>${catchesTable(catches, participants, showWeight)}</div>
${prizeRows.length ? `<div class="section"><h3>Prize Categories</h3>${prizeTable(prizeRows)}</div>` : ''}
</body></html>`
}

function buildMultiSheetHTML(standings, catches, competition, config, participants = [], dailyRecords = [], teamStandings = [], cpueData = null, ladiesTeamStandings = [], openStandings = [], ladiesStandings = []) {
  const prizeRows = buildPrizeRows(standings, catches, config)
  const showWeight = config?.scoring?.method !== 'points'
  const sheets = [
    ...(ladiesStandings.length
      ? [
          { name: 'Standings', content: standingsTable(openStandings, showWeight) },
          { name: 'Ladies Standings', content: standingsTable(ladiesStandings, showWeight) },
        ]
      : [{ name: 'Standings', content: standingsTable(standings, showWeight) }]),
    ...(teamStandings.length ? [{ name: 'Team Standings', content: teamStandingsTable(teamStandings) }] : []),
    ...(ladiesTeamStandings.length ? [{ name: 'Ladies Team Standings', content: teamStandingsTable(ladiesTeamStandings) }] : []),
    ...(dailyRecords.length  ? [{ name: 'Daily Results',  content: dailyResultsTable(dailyRecords, cpueData) }] : []),
    { name: 'Species Summary', content: speciesSummaryTable(catches) },
    { name: 'Species by Angler', content: catchesSummaryTable(catches, participants) },
    { name: 'All Catches',    content: catchesTable(catches, participants, showWeight) },
    ...(prizeRows.length ? [{ name: 'Prize Winners', content: prizeTable(prizeRows) }] : []),
  ]
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; }
  h2 { color: #1e3a8a; }
  table { border-collapse: collapse; width: 100%; page-break-after: always; margin-bottom: 24pt; }
  th { background: #1e3a8a; color: white; padding: 6px 10px; text-align: left; font-size: 10pt; }
  td { padding: 5px 10px; border-bottom: 1px solid #e5e7eb; font-size: 10pt; }
  tr:nth-child(even) td { background: #f8fafc; }
</style>
</head><body>
<h2>${competition.name || 'Results'}</h2>
<p>${competition.venue || ''} · ${competition.start_date || ''}</p>
${sheets.map(s => `<h3>${s.name}</h3>${s.content}`).join('\n')}
</body></html>`
}

function standingsTable(standings, showWeight) {
  const headers = [
    'Rank', 'Angler No.', 'Name', 'Team', 'Angler %', 'LC (kg)', 'Points',
    ...(showWeight ? ['Weight (kg)'] : []),
    'Species', 'Catches', 'CPUE (Fish/Hr)', 'Best Fish',
    ...(showWeight ? ['Best Fish (kg)'] : []),
  ]
  const rows = standings.map(s => [
    s.rank, s.anglerNumber || '', s.displayName, s.teamName || '',
    `${(s.anglerPercentage || 0).toFixed(2)}%`,
    s.lineClass || '',
    (s.totalPoints || 0).toFixed(2),
    ...(showWeight ? [(s.totalWeightKg || 0).toFixed(3)] : []),
    s.speciesCount || 0, s.catchCount || 0,
    s.cpue != null ? s.cpue.toFixed(2) : '',
    s.bestFish?.species_name || '',
    ...(showWeight ? [s.bestFish?.weight_kg || ''] : []),
  ])
  return htmlTable(headers, rows)
}

// Grouped by angler + day + species, with fish count and points summed —
// matches the structure of a skipper's paper scorecard (one line per
// species that angler landed that day), so John can check the totals here
// against what was physically written down, rather than tallying every
// raw catch row (including the multi-fish "padding" rows) by hand. The raw
// catchesTable() below stays too, for anyone needing the individual-row
// audit trail (timestamps, notes, exact save order).
function catchesSummaryTable(catches, participants) {
  const active = catches.filter(c => c.data_quality !== 'rejected')
  const groups = {}
  for (const c of active) {
    const p = participants?.find(pp => pp.id === c.participant_id || (c.angler_id && pp.user_id === c.angler_id))
    const anglerName = p?.full_name || 'Unknown'
    const teamName = p?.competition_teams?.team_name || p?.competition_teams?.province || ''
    const day = c.competition_days?.day_number ?? ''
    const key = `${anglerName}|${day}|${c.species_name}`
    if (!groups[key]) groups[key] = { anglerName, teamName, day, species: c.species_name || 'Unknown', fishCount: 0, totalPoints: 0 }
    groups[key].fishCount += 1
    groups[key].totalPoints += c.data_quality === 'disqualified' ? 0 : parseFloat(c.points || 0)
  }
  const rows = Object.values(groups).sort((a, b) =>
    a.anglerName.localeCompare(b.anglerName) || (a.day - b.day) || a.species.localeCompare(b.species)
  )
  const headers = ['Angler', 'Team', 'Day', 'Species', 'Fish', 'Points']
  return htmlTable(headers, rows.map(r => [r.anglerName, r.teamName, r.day, r.species, r.fishCount, r.totalPoints.toFixed(2)]))
}

function catchesTable(catches, participants, showWeight) {
  const active = catches.filter(c => c.data_quality !== 'rejected')
  const headers = [
    'Angler', 'Angler No.', 'Team', 'Day', 'Date', 'Species',
    ...(showWeight ? ['Weight (kg)'] : []),
    'Length (cm)', 'LC (kg)', 'Points', 'Status', 'Notes',
  ]
  const rows = active.map(c => {
    // Same fix as CompetitionAdminScoring.jsx/useCompetitionCatches.js earlier
    // today: c.competition_participants was never actually joined by the
    // catches query, so this always read blank. Resolve from the
    // participants array instead, matching on participant_id first and
    // falling back to angler_id/user_id for any row saved the other way.
    const p = participants?.find(pp => pp.id === c.participant_id || (c.angler_id && pp.user_id === c.angler_id))
    return [
      p?.full_name || '', p?.angler_number || '',
      p?.competition_teams?.team_name || p?.competition_teams?.province || '',
      c.competition_days?.day_number || '', c.fishing_date || '',
      c.species_name || '',
      ...(showWeight ? [c.weight_kg ? parseFloat(c.weight_kg).toFixed(3) : ''] : []),
      c.length_cm ? parseFloat(c.length_cm).toFixed(1) : '',
      c.line_class_kg || '',
      c.data_quality === 'disqualified' ? '0' : parseFloat(c.points || 0).toFixed(2),
      c.data_quality || 'unverified', c.notes || '',
    ]
  })
  return htmlTable(headers, rows)
}

function speciesSummaryTable(catches) {
  const groups = groupCatchesBySpecies(catches.filter(c => c.data_quality !== 'rejected'))
  const headers = ['Species', 'Fish', 'Points']
  const rows = groups.map(g => [g.speciesName, g.fishCount, g.totalPoints.toFixed(2)])
  return htmlTable(headers, rows)
}

function dailyResultsTable(dailyRecords, cpueData) {
  const sorted = [...dailyRecords].sort((a, b) =>
    (a.dayNumber ?? 0) - (b.dayNumber ?? 0) || b.rawPoints - a.rawPoints
  )
  const headers = ['Day', 'Angler', 'Team', 'Boat', 'Raw Points', 'Boat %', 'CPUE (Fish/Hr)']
  const rows = sorted.map(d => {
    const anglerCpue = cpueData?.byAnglerDay.find(a =>
      a.participantId === d.participantId && String(a.dayNumber) === String(d.dayNumber)
    )
    return [
      d.dayNumber ?? '', d.displayName, d.teamName || '', d.boatName,
      d.rawPoints.toFixed(2), `${d.percentage.toFixed(2)}%${d.percentage === 100 ? ' (top)' : ''}`,
      anglerCpue?.cpue != null ? anglerCpue.cpue.toFixed(2) : '',
    ]
  })
  return htmlTable(headers, rows)
}

function teamStandingsTable(teamStandings) {
  const headers = ['Rank', 'Team', 'Total (Sum of Boat %)', 'Anglers']
  const rows = teamStandings.map(t => [
    t.rank, t.teamName, `${t.totalPercentage.toFixed(2)}%`,
    t.members.map(m => `${m.displayName} (${m.percentageSum.toFixed(2)}%)`).join('; '),
  ])
  return htmlTable(headers, rows)
}

function prizeTable(prizeRows) {
  return htmlTable(['Category','Winner','Team','Value'], prizeRows)
}

function buildPrizeRows(standings, catches, config) {
  const categories = config?.reporting?.prize_categories || []
  return categories.map(cat => {
    let winner = null, value = ''
    if (cat.criteria === 'max_total_weight') {
      winner = [...standings].sort((a, b) => b.totalWeightKg - a.totalWeightKg)[0]
      if (winner) value = `${winner.totalWeightKg.toFixed(3)} kg`
    } else if (cat.criteria === 'max_total_points') {
      winner = standings[0]
      if (winner) value = `${winner.totalPoints.toFixed(2)} pts`
    } else if (cat.criteria === 'max_species_count') {
      winner = [...standings].sort((a, b) => b.speciesCount - a.speciesCount)[0]
      if (winner) value = `${winner.speciesCount} species`
    } else if (cat.criteria === 'max_species_weight' && cat.species_id) {
      const top = catches
        .filter(c => c.species_id === cat.species_id && c.data_quality !== 'rejected')
        .sort((a, b) => b.weight_kg - a.weight_kg)[0]
      if (top) {
        winner = standings.find(s => s.participantId === top.angler_id)
        value = `${parseFloat(top.weight_kg).toFixed(3)} kg`
      }
    }
    return [cat.label || '', winner?.displayName || 'TBD', winner?.teamName || '', value]
  })
}

function htmlTable(headers, rows) {
  const ths = headers.map(h => `<th>${h}</th>`).join('')
  const trs = rows.map(row =>
    `<tr>${row.map(cell => `<td>${String(cell ?? '')}</td>`).join('')}</tr>`
  ).join('\n')
  return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`
}

export async function downloadPDF(competitionId, reportType = 'full_results') {
  try {
    const { data, error } = await supabase.functions.invoke(
      'generate-competition-pdf',
      { body: { competition_id: competitionId, report_type: reportType } }
    )
    if (error) throw error
    triggerDownload(
      new Blob([data], { type: 'application/pdf' }),
      `${reportType}_${competitionId}.pdf`
    )
  } catch (err) {
    console.error('PDF generation error:', err)
    throw err
  }
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function sanitiseName(name) {
  return (name || 'Results').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_')
}