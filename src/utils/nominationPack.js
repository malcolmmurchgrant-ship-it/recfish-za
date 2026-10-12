// ─── nominationPack.js ───────────────────────────────────────────────────────
// "Nomination Pack": a PDF of an angler's TD-verified competition catches in
// ONE discipline, for attaching to a SADSAA / provincial nomination form.
//
//   1. Angler details (from their Profile)
//   2. Summary - competitions, catches, points, species, heaviest, releases,
//      catches per year (most recent first)
//   3. Section 15 - Outstanding Personal Catches (top 10, ranked per
//      discipline - see catchDisciplines.js)
//   4. Competition record, by year (newest first)
//   5. Optional appendix - every catch, by year and competition
//
// Team, boat and skipper, and team / individual placings (Sections 13, 17 &
// 19) where available - see anglerPlacings.js for when placings are given.

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  DISCIPLINE_BY_KEY, summarise, outstandingCatches, groupByYearAndCompetition, yearOfCatch,
} from './catchDisciplines'
import { placeText } from './anglerPlacings'

const NAVY = [30, 58, 138]
const GOLD_BG = [254, 243, 199]
const GOLD_TXT = [146, 64, 14]
const GRAY = [107, 114, 128]
const DARK = [31, 41, 55]
const PALE = [239, 246, 255]

const n = v => (Number.isFinite(Number(v)) ? Number(v) : 0)
const fmtNum = (v, dp = 2) => (n(v) ? n(v).toLocaleString('en-ZA', { maximumFractionDigits: dp }) : '')
const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const monthYear = d => (d ? new Date(d).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' }) : '')

// Which catches fall in the chosen period. period: 'all' | number of seasons
// (calendar years, counting the current year).
export function filterByPeriod(catches, period, now = new Date()) {
  if (period === 'all' || !period) return catches
  const from = now.getFullYear() - (Number(period) - 1)
  return catches.filter(c => (yearOfCatch(c) ?? 0) >= from)
}

export function periodLabel(period, catches) {
  const s = summarise(catches)
  const span = s.firstYear ? (s.firstYear === s.lastYear ? `${s.lastYear}` : `${s.firstYear}–${s.lastYear}`) : '—'
  if (period === 'all' || !period) return `All seasons (${span})`
  return `Last ${period} season${Number(period) === 1 ? '' : 's'} (${span})`
}

export function buildNominationPack({ catches, discipline, period = 'all', includeAll = true, angler = {}, placings = {} }) {
  const d = DISCIPLINE_BY_KEY[discipline] || { label: 'All disciplines' }
  const list = filterByPeriod(catches, period)
  const s = summarise(list)
  const top = outstandingCatches(list, discipline, 10)
  const years = groupByYearAndCompetition(list)
  const showReleases = discipline === 'gamefish' || String(discipline).startsWith('billfish')
  // Only show Line / Released columns when they carry information.
  const showLine = list.some(c => n(c.line_class_kg) > 0)
  const showRel = showReleases || list.some(c => c.retained === false)
  const pick = (cols) => cols.filter(c => c.show !== false)

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 14
  let y = 14

  // ── Title band ────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17)
  doc.text('Nomination Pack — Competition Catch Record', M, 13)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11)
  doc.text(`${d.label}  ·  ${periodLabel(period, list)}`, M, 21)
  doc.setFontSize(8.5)
  doc.text(`Generated ${fmtDate(new Date())} from RecFish ZA`, M, 26.5)
  y = 38

  // ── 1. Angler ─────────────────────────────────────────────────────────────
  const section = (title) => {
    if (y > 265) { doc.addPage(); y = 16 }
    doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
    doc.text(title, M, y); y += 2
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.4); doc.line(M, y, W - M, y); y += 4
  }
  section('1. Angler')
  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1.4, textColor: DARK },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 42, textColor: GRAY } },
    body: [
      ['Name', angler.full_name || '—'],
      ['Club', angler.club_name || '—'],
      ['Province', angler.province || '—'],
      ...(angler.angler_number ? [['Angler number', angler.angler_number]] : []),
      ...(angler.wpdsaa_number ? [['WPDSAA number', angler.wpdsaa_number]] : []),
      ['Discipline', d.label],
    ],
  })
  y = doc.lastAutoTable.finalY + 7

  // ── 2. Summary ────────────────────────────────────────────────────────────
  section('2. Summary')
  const summaryRows = [
    ['Competitions fished', String(s.competitions)],
    ['Catches', String(s.catches)],
    ['Total points', fmtNum(s.points) || '0'],
    ['Species caught', String(s.species)],
    ...(showReleases ? [['Tag & release', String(s.releases)]] : []),
    ...(s.heaviest ? [['Heaviest fish', `${fmtNum(s.heaviest.weight_kg)} kg ${s.heaviest.species_name} — ${s.heaviest.competition?.name || ''}`]] : []),
    ...(!showReleases && s.topScore ? [['Highest-scoring fish', `${fmtNum(s.topScore.points)} pts ${s.topScore.species_name} — ${s.topScore.competition?.name || ''}`]] : []),
    ['Catches per year', s.years.map(([yr, c]) => `${yr}: ${c}`).join('   ·   ') || '—'],
  ]
  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, theme: 'striped',
    styles: { fontSize: 9.5, cellPadding: 1.8, textColor: DARK },
    alternateRowStyles: { fillColor: PALE },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 48 } },
    body: summaryRows,
  })
  y = doc.lastAutoTable.finalY + 7

  // ── 3. Section 15 - outstanding catches ───────────────────────────────────
  section('3. Outstanding Personal Catches (Nomination Form Section 15)')
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...GRAY)
  doc.text(
    discipline === 'tuna' ? 'Ranked by points (weight scored for line class).'
      : discipline === 'bottomfish' || discipline === 'other' ? 'Ranked by points, then weight.'
      : 'Released billfish first, then by weight.', M, y)
  y += 3
  if (top.length) {
    autoTable(doc, {
      startY: y, margin: { left: M, right: M }, theme: 'grid',
      headStyles: { fillColor: NAVY, textColor: 255, fontSize: 8.5 },
      styles: { fontSize: 8.5, cellPadding: 1.5, textColor: DARK },
      ...(() => {
        const cols = pick([
          { h: '#', v: (c, i) => i + 1, st: { cellWidth: 7, halign: 'center' } },
          { h: 'Species', v: c => c.species_name || '' },
          { h: 'Weight (kg)', v: c => fmtNum(c.weight_kg), st: { halign: 'right' } },
          { h: 'Line (kg)', v: c => fmtNum(c.line_class_kg, 0), st: { halign: 'right' }, show: showLine },
          { h: 'Points', v: c => fmtNum(c.points), st: { halign: 'right' } },
          { h: 'Released', v: c => (c.retained === false ? 'Yes' : ''), show: showRel },
          { h: 'Date', v: c => fmtDate(c.fishing_date), st: { cellWidth: 22 } },
          { h: 'Competition', v: c => c.competition?.name || '' },
        ])
        return {
          head: [cols.map(c => c.h)],
          body: top.map((c, i) => cols.map(col => col.v(c, i))),
          columnStyles: Object.fromEntries(cols.map((c, i) => [i, c.st || {}])),
        }
      })(),
      didParseCell: (h) => { if (h.section === 'body' && h.row.index < 3) h.cell.styles.fillColor = GOLD_BG },
    })
    y = doc.lastAutoTable.finalY + 7
  } else {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK); doc.text('No catches in this period.', M, y + 4); y += 10
  }

  // ── 4. Competition record by year ─────────────────────────────────────────
  section('4. Competition Record (most recent first)')
  const compRows = []
  let anyPlacing = false, anyMissing = false
  for (const yr of years) {
    compRows.push([{ content: String(yr.year), colSpan: 7, styles: { fontStyle: 'bold', fillColor: PALE, textColor: NAVY } }])
    for (const g of yr.competitions) {
      const pts = g.catches.reduce((t, c) => t + n(c.points), 0)
      const rel = g.catches.filter(c => c.retained === false).length
      const pl = placings[g.competition?.id] || {}
      const crew = [pl.team, pl.boat && `Boat: ${pl.boat}`, pl.skipper && `Skipper: ${pl.skipper}`].filter(Boolean).join('\n')
      const teamPl = placeText(pl.teamPlace, pl.teamCount)
      const indPl = placeText(pl.anglerPlace, pl.anglerCount)
      if (teamPl || indPl) anyPlacing = true; else anyMissing = true
      compRows.push([
        (g.competition?.name || 'Unknown competition') + (g.competition?.venue ? `\n${g.competition.venue}` : ''),
        monthYear(g.competition?.start_date || g.catches[0]?.fishing_date),
        crew || '—',
        teamPl || '—',
        indPl || '—',
        String(g.catches.length) + (showReleases && rel ? ` (${rel} rel.)` : ''),
        fmtNum(pts),
      ])
    }
  }
  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, theme: 'grid',
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 1.4, textColor: DARK, valign: 'middle' },
    head: [['Competition', 'Date', 'Team / Boat / Skipper', 'Team place', 'Individual place', 'Catches', 'Points']],
    body: compRows,
    columnStyles: {
      0: { cellWidth: 50 }, 1: { cellWidth: 17 }, 2: { cellWidth: 42 },
      3: { halign: 'center', fontStyle: 'bold' }, 4: { halign: 'center', fontStyle: 'bold' },
      5: { halign: 'right' }, 6: { halign: 'right' },
    },
  })
  y = doc.lastAutoTable.finalY + 6

  const notes = []
  if (anyPlacing) notes.push('Placings are calculated by RecFish ZA from the published competition results — the same standings shown on the official RecFish ZA scoreboard.')
  if (anyMissing) notes.push('"—" means no placing is available: the competition was imported from a post-event catch return without scoring, or its results have not been published yet.')
  if (notes.length) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...GRAY)
    const note = doc.splitTextToSize(notes.join(' '), W - 2 * M)
    if (y + note.length * 4 > 285) { doc.addPage(); y = 16 }
    doc.text(note, M, y); y += note.length * 4 + 4
  }

  // ── 5. Appendix - every catch ─────────────────────────────────────────────
  if (includeAll && list.length) {
    doc.addPage(); y = 16
    section('Appendix — All Catches')
    const appCols = pick([
      { h: 'Date', v: c => fmtDate(c.fishing_date) },
      { h: 'Day', v: c => (c.day?.day_number ? `Day ${c.day.day_number}` : '') },
      { h: 'Species', v: c => c.species_name || '' },
      { h: 'Weight (kg)', v: c => fmtNum(c.weight_kg), st: { halign: 'right' } },
      { h: 'Line (kg)', v: c => fmtNum(c.line_class_kg, 0), st: { halign: 'right' }, show: showLine },
      { h: 'Points', v: c => fmtNum(c.points), st: { halign: 'right' } },
      { h: 'Released', v: c => (c.retained === false ? 'Yes' : ''), show: showRel },
    ])
    const rows = []
    for (const yr of years) {
      for (const g of yr.competitions) {
        rows.push([{ content: `${yr.year}  ·  ${g.competition?.name || 'Unknown competition'}`, colSpan: appCols.length,
          styles: { fontStyle: 'bold', fillColor: PALE, textColor: NAVY } }])
        for (const c of g.catches) rows.push(appCols.map(col => col.v(c)))
      }
    }
    autoTable(doc, {
      startY: y, margin: { left: M, right: M }, theme: 'grid',
      headStyles: { fillColor: NAVY, textColor: 255, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 1.2, textColor: DARK },
      head: [appCols.map(c => c.h)],
      body: rows,
      columnStyles: Object.fromEntries(appCols.map((c, i) => [i, c.st || {}])),
    })
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    const H = doc.internal.pageSize.getHeight()
    doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2); doc.line(M, H - 11, W - M, H - 11)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRAY)
    doc.text(`${angler.full_name || ''} — ${d.label} — TD-verified catches from official SADSAA competition records (RecFish ZA)`, M, H - 7)
    doc.text(`Page ${p} of ${pages}`, W - M, H - 7, { align: 'right' })
  }

  // ── File name ─────────────────────────────────────────────────────────────
  const safe = t => String(t || '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const name = `Nomination_Pack_${safe(angler.full_name) || 'Angler'}_${safe(d.label)}_${new Date().toISOString().slice(0, 10)}.pdf`
  return { doc, name, count: list.length }
}
