// ─── reportGenerator.js ──────────────────────────────────────────────────────
// Generates CSV and XLSX reports from competition standings.
// Uses SheetJS (xlsx) — already available in the React environment.
// PDF generation is handled server-side via Supabase Edge Function.

import * as XLSX from 'xlsx'

// ── CSV download (simple, universal) ─────────────────────────────────────────
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
      case 'angler_number':      return s.anglerNumber
      case 'display_name':       return s.displayName
      case 'team_name':          return s.teamName || ''
      case 'team_suffix':        return s.teamSuffix || ''
      case 'total_points':       return s.totalPoints?.toFixed(2)
      case 'total_weight_kg':    return s.totalWeightKg?.toFixed(3)
      case 'species_count':      return s.speciesCount
      case 'catch_count':        return s.catchCount
      case 'best_fish_species':  return s.bestFish?.species_name || ''
      case 'best_fish_weight_kg':return s.bestFish?.weight_kg || ''
      case 'line_class':         return s.lineClass ? `${s.lineClass}kg` : ''
      case 'category':           return s.category || ''
      default:                   return ''
    }
  }))

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, `${competition.name || 'Results'}_Results.csv`)
}

// ── XLSX download ─────────────────────────────────────────────────────────────
export function downloadXLSX(standings, catches, competition, config, mode = 'multi_sheet') {
  const wb = XLSX.utils.book_new()

  if (mode === 'single_sheet') {
    // All info on one worksheet
    const ws = buildStandingsSheet(standings, config)
    XLSX.utils.book_append_sheet(wb, ws, 'Results')
  } else {
    // Multi-sheet: Standings / All Catches / Prize Winners
    const standingsWS = buildStandingsSheet(standings, config)
    XLSX.utils.book_append_sheet(wb, standingsWS, 'Standings')

    const catchesWS = buildCatchesSheet(catches)
    XLSX.utils.book_append_sheet(wb, catchesWS, 'All Catches')

    const prizeWS = buildPrizeSheet(standings, catches, config)
    XLSX.utils.book_append_sheet(wb, prizeWS, 'Prize Winners')
  }

  const filename = `${competition.name || 'Results'}_${mode === 'single_sheet' ? 'Results' : 'Full'}.xlsx`
  XLSX.writeFile(wb, filename)
}

// ── Sheet builders ────────────────────────────────────────────────────────────
function buildStandingsSheet(standings, config) {
  const rows = standings.map(s => ({
    'Rank':             s.rank,
    'Angler No.':       s.anglerNumber || '',
    'Name':             s.displayName,
    'Team':             s.teamName || '',
    'Province':         s.province || '',
    'Line Class (kg)':  s.lineClass || '',
    'Category':         s.category || '',
    'Total Points':     parseFloat((s.totalPoints || 0).toFixed(2)),
    'Total Weight (kg)':parseFloat((s.totalWeightKg || 0).toFixed(3)),
    'Species':          s.speciesCount || 0,
    'Catches':          s.catchCount || 0,
    'Best Fish':        s.bestFish?.species_name || '',
    'Best Fish (kg)':   parseFloat(s.bestFish?.weight_kg || 0),
  }))

  return XLSX.utils.json_to_sheet(rows)
}

function buildCatchesSheet(catches) {
  const rows = catches
    .filter(c => c.data_quality !== 'rejected')
    .map(c => ({
      'Angler':         c.competition_participants?.full_name || '',
      'Angler No.':     c.competition_participants?.angler_number || '',
      'Team':           c.competition_participants?.competition_teams?.display_name || '',
      'Day':            c.competition_days?.day_number || '',
      'Date':           c.fishing_date || '',
      'Species':        c.species_name || '',
      'Weight (kg)':    parseFloat(c.weight_kg || 0),
      'Length (cm)':    parseFloat(c.length_cm || 0),
      'Line Class (kg)':c.line_class_kg || '',
      'Points':         parseFloat(c.points || 0),
      'Status':         c.data_quality || 'unverified',
      'Grid':           c.fine_grid_id || '',
      'Notes':          c.notes || '',
    }))

  return XLSX.utils.json_to_sheet(rows)
}

function buildPrizeSheet(standings, catches, config) {
  const categories = config?.reporting?.prize_categories || []
  const rows = []

  for (const cat of categories) {
    let winner = null

    if (cat.criteria === 'max_total_weight' && cat.eligible === 'individual') {
      winner = [...standings].sort((a, b) => b.totalWeightKg - a.totalWeightKg)[0]
    } else if (cat.criteria === 'max_total_points' && cat.eligible === 'individual') {
      winner = standings[0] // already sorted by points
    } else if (cat.criteria === 'max_species_weight' && cat.species_id) {
      const speciesCatches = catches.filter(c =>
        c.species_id === cat.species_id && c.data_quality !== 'rejected'
      ).sort((a, b) => b.weight_kg - a.weight_kg)
      if (speciesCatches.length) {
        const top = speciesCatches[0]
        winner = standings.find(s => s.participantId === top.angler_id)
        if (winner) winner = { ...winner, winningCatch: top }
      }
    }

    rows.push({
      'Category':   cat.label,
      'Winner':     winner?.displayName || 'TBD',
      'Team':       winner?.teamName || '',
      'Value':      winner?.winningCatch
                      ? `${winner.winningCatch.weight_kg}kg`
                      : winner
                        ? `${winner.totalPoints?.toFixed(2)} pts`
                        : '',
    })
  }

  return XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Note': 'No prize categories configured' }])
}

// ── PDF via Supabase Edge Function ────────────────────────────────────────────
export async function downloadPDF(competitionId, reportType = 'full_results') {
  try {
    const { data, error } = await import('../../../lib/supabase').then(m => m.supabase)
      .functions.invoke('generate-competition-pdf', {
        body: { competition_id: competitionId, report_type: reportType },
      })

    if (error) throw error

    const blob = new Blob([data], { type: 'application/pdf' })
    triggerDownload(blob, `${reportType}_${competitionId}.pdf`)
  } catch (err) {
    console.error('PDF generation error:', err)
    throw err
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────
function triggerDownload(blob, filename) {
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href     = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
