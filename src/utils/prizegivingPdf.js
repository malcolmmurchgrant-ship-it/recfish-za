// ─── prizegivingPdf.js ───────────────────────────────────────────────────────
// The Prizegiving Run of Show as a PDF for the TD to read from: every award
// in announcement order, the App's winners filled in, the TD's awards left
// blank, and a blank Prize column to write the cash / sponsor prize in.
// Followed by the full Overall list and the boat averages, so any query at
// the prizegiving can be answered from the same sheet.

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { buildRunOfShow } from './invitationalPrizes'
import { divisionLabel } from './anglerDivisions'

const NAVY = [30, 58, 138]
const AMBER = [180, 83, 9]

const winnerText = (row) => {
  if (row.decidedBy === 'TD') return ''
  const e = row.slot?.entries || []
  if (!e.length) return row.slot?.note || '-'
  return e.map(x => x.name).join(' & ') + (row.slot.tied ? '  (TIE - TD decides)' : '')
}
const boatText   = (row) => (row.slot?.entries || []).map(x => x.boat).filter(Boolean).join(' / ')
const resultText = (row) => {
  if (row.decidedBy === 'TD') return row.reference ? `App boat average: ${row.reference}` : 'TD decides'
  const e = row.slot?.entries || []
  if (!e.length) return ''
  const r = e[0].result
  const day = row.section === 'Daily Biggest Tuna' ? row.slot?.note : (e[0].fishingDay ? `Fishing Day ${e[0].fishingDay}` : '')
  return [r, day, e[0].detail && !e[0].fishingDay ? e[0].detail : ''].filter(Boolean).join(' · ')
}

export function buildPrizegivingPdf({ competitionName, result, upToLabel }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const stamp = new Date().toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })

  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...NAVY)
  doc.text(competitionName || 'CBSC October Tuna Invitational', 14, 14)
  doc.setFontSize(12); doc.setTextColor(0)
  doc.text('Prizegiving Run of Show', 14, 21)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90)
  const daysTxt = result.fishedDays.map(d => `Fishing Day ${d.fishingDay} = ${d.date || 'Day ' + d.day_number}`).join(';  ')
  doc.text(`${upToLabel}  ·  ${daysTxt || 'No fishing days recorded yet'}  ·  Printed ${stamp}`, 14, 26.5)

  let y = 31
  if (result.warnings.length) {
    doc.setFillColor(254, 243, 199); doc.setDrawColor(...AMBER)
    const lines = result.warnings.flatMap(w => doc.splitTextToSize('• ' + w, W - 34))
    const h = 7 + lines.length * 4
    doc.rect(14, y, W - 28, h, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...AMBER); doc.setFontSize(9)
    doc.text('PROVISIONAL - check before announcing:', 17, y + 5)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(60)
    doc.text(lines, 17, y + 9.5)
    y += h + 3
  }

  const rows = buildRunOfShow(result)
  const body = []
  let lastSection = null
  for (const r of rows) {
    if (r.section !== lastSection) {
      body.push([{ content: r.section, colSpan: 7, styles: { fillColor: [229, 231, 235], fontStyle: 'bold', textColor: NAVY } }])
      lastSection = r.section
    }
    body.push([
      r.order,
      r.award,
      r.decidedBy,
      { content: winnerText(r), styles: r.decidedBy === 'App' && r.slot?.entries?.length ? { fontStyle: 'bold' } : { textColor: [120, 120, 120] } },
      boatText(r),
      resultText(r),
      '',
    ])
  }
  autoTable(doc, {
    startY: y,
    head: [['#', 'Award', 'By', 'Winner', 'Boat', 'Result', 'Prize / Sponsor']],
    body,
    styles: { fontSize: 8.5, cellPadding: 1.6, valign: 'middle' },
    headStyles: { fillColor: NAVY },
    columnStyles: {
      0: { cellWidth: 9 }, 1: { cellWidth: 34 }, 2: { cellWidth: 11 }, 3: { cellWidth: 58 },
      4: { cellWidth: 36 }, 5: { cellWidth: 80 }, 6: { cellWidth: 41 },
    },
    margin: { left: 14, right: 14 },
  })

  // ── Supporting lists ─────────────────────────────────────────────────────
  doc.addPage()
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...NAVY)
  doc.text('Most Weighed Fish - full list', 14, 14)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90)
  doc.text('Most Weighed pts = weighed fish only, less the points of any Daily Biggest Tuna winning fish. Release points are shown for reference and are not included.', 14, 19)
  autoTable(doc, {
    startY: 22,
    head: [['Place', 'Angler', 'Cat.', 'Boat', 'Weighed pts', 'Daily tuna left out', 'Most Weighed pts', 'Release pts', 'Combined', 'Pending videos']],
    body: [...result.weighedRanked, ...result.overallRanked.filter(a => !(a.weighedNet > 0))].map(a => [
      a.weighedNet > 0 ? a.place + (a.tied ? '=' : '') : '-', a.name, divisionLabel(a),
      a.boat, a.weighedPoints.toFixed(2), a.excludedPoints ? '-' + a.excludedPoints.toFixed(2) : '',
      { content: a.weighedNet.toFixed(2), styles: { fontStyle: 'bold' } },
      a.releasePoints.toFixed(2), a.total.toFixed(2), a.releasesPending || '',
    ]),
    styles: { fontSize: 8, cellPadding: 1.3 },
    headStyles: { fillColor: NAVY },
    margin: { left: 14, right: 14 },
  })

  let y2 = doc.lastAutoTable.finalY + 8
  if (y2 > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y2 = 14 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...NAVY)
  doc.text('Boat averages - for the TD (Top Team / auction)', 14, y2)
  autoTable(doc, {
    startY: y2 + 3,
    head: [['Place', 'Boat', 'Team', 'Skipper', 'Anglers', 'Total pts', 'Average']],
    body: result.boatRanking.map(b => [b.place + (b.tied ? '=' : ''), b.boat, b.name, b.skipper, b.anglers, b.total.toFixed(2), b.average.toFixed(2)]),
    styles: { fontSize: 8, cellPadding: 1.3 },
    headStyles: { fillColor: NAVY },
    margin: { left: 14, right: 14 },
  })

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5); doc.setTextColor(130)
    doc.text(`RecFish ZA · ${competitionName || ''} · Prizegiving · page ${i} of ${pages}`, 14, doc.internal.pageSize.getHeight() - 6)
  }

  const safe = (competitionName || 'Invitational').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')
  return { doc, name: `${safe}_Prizegiving.pdf` }
}
