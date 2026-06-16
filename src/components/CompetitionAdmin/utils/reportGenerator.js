// ─── reportGenerator.js ──────────────────────────────────────────────────────
// Generates CSV and XLSX-compatible HTML reports from competition standings.
// No external packages required — uses only browser built-ins.
// PDF generation is handled server-side via Supabase Edge Function.

// ── CSV download ──────────────────────────────────────────────────────────────
export function downloadCSV(standings, competition, config) {
  const fields = config?.reporting?.csv_fields || [
    'rank','angler_number','display_name','team_name',
    'total_points','total_weight_kg','species_count','catch_count',
    'best_fish_species','best_fish_weight_kg',
  ]

  const headers = fields.map(f => f.replace(/_/g, ' ').toUpperCase())

  const rows = standings.map(s => fields.map(f => {
    switch (f) {
      case 'rank':               return s.rank
      case 'angler_number':      return s.anglerNumber || ''
      case 'display_name':       return s.displayName
      case 'team_name':          return s.teamName || ''
      case 'team_suffix':        return s.teamSuffix || ''
      case 'total_points':       return (s.totalPoints || 0).toFixed(2)
      case 'total_weight_kg':    return (s.totalWeightKg || 0).toFixed(3)
      case 'species_count':      return s.speciesCount || 0
      case 'catch_count':        return s.catchCount || 0
      case 'best_fish_species':  return s.bestFish?.species_name || ''
      case 'best_fish_weight_kg':return s.bestFish?.weight_kg || ''
      case 'line_class':         return s.lineClass ? `${s.lineClass}kg` : ''
      case 'category':           return s.category || ''
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
export function downloadXLSX(standings, catches, competition, config, mode = 'multi_sheet') {
  const name = sanitiseName(competition.name)

  if (mode === 'single_sheet') {
    const html = buildSingleSheetHTML(standings, catches, competition, config)
    triggerDownload(
      new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
      `${name}_Results.xls`
    )
  } else {
    const html = buildMultiSheetHTML(standings, catches, competition, config)
    triggerDownload(
      new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
      `${name}_Full.xls`
    )
  }
}

function buildSingleSheetHTML(standings, catches, competition, config) {
  const prizeRows = buildPrizeRows(standings, catches, config)
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
<div class="section"><h3>Standings</h3>${standingsTable(standings)}</div>
<div class="section"><h3>All Catches</h3>${catchesTable(catches)}</div>
${prizeRows.length ? `<div class="section"><h3>Prize Categories</h3>${prizeTable(prizeRows)}</div>` : ''}
</body></html>`
}

function buildMultiSheetHTML(standings, catches, competition, config) {
  const prizeRows = buildPrizeRows(standings, catches, config)
  const sheets = [
    { name: 'Standings',   content: standingsTable(standings) },
    { name: 'All Catches', content: catchesTable(catches) },
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

function standingsTable(standings) {
  const headers = ['Rank','Angler No.','Name','Team','Category','LC (kg)','Points','Weight (kg)','Species','Catches','Best Fish','Best Fish (kg)']
  const rows = standings.map(s => [
    s.rank, s.anglerNumber || '', s.displayName, s.teamName || '',
    s.category || '', s.lineClass || '',
    (s.totalPoints || 0).toFixed(2), (s.totalWeightKg || 0).toFixed(3),
    s.speciesCount || 0, s.catchCount || 0,
    s.bestFish?.species_name || '', s.bestFish?.weight_kg || '',
  ])
  return htmlTable(headers, rows)
}

function catchesTable(catches) {
  const active = catches.filter(c => c.data_quality !== 'rejected')
  const headers = ['Angler','Angler No.','Team','Day','Date','Species','Weight (kg)','Length (cm)','LC (kg)','Points','Status','Notes']
  const rows = active.map(c => [
    c.competition_participants?.full_name || '',
    c.competition_participants?.angler_number || '',
    c.competition_participants?.competition_teams?.display_name || '',
    c.competition_days?.day_number || '', c.fishing_date || '',
    c.species_name || '',
    c.weight_kg ? parseFloat(c.weight_kg).toFixed(3) : '',
    c.length_cm ? parseFloat(c.length_cm).toFixed(1) : '',
    c.line_class_kg || '',
    c.data_quality === 'disqualified' ? '0' : parseFloat(c.points || 0).toFixed(2),
    c.data_quality || 'unverified', c.notes || '',
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
    const { supabase } = await import('../../../lib/supabase')
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