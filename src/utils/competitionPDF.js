// ============================================================
// RecFish ZA — Competition Results PDF Generator v2
// Uses jsPDF + jsPDF-AutoTable
// Includes CPUE (Catch Per Unit Effort)
// ============================================================

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const NAVY      = [30, 58, 138]
const NAVY2     = [30, 64, 175]
const TEAL      = [15, 118, 110]
const PURPLE    = [124, 58, 237]
const ORANGE_BG = [255, 247, 237]
const GOLD_BG   = [254, 249, 195]
const SILVER_BG = [243, 244, 246]
const BRONZE_BG = [253, 246, 236]
const PALE_BLU  = [239, 246, 255]
const PALE_PUR  = [245, 243, 255]
const PALE_GRN  = [209, 250, 229]
const LIGHT_BLU = [219, 234, 254]
const DARK      = [31, 41, 55]
const GRAY      = [107, 114, 128]
const WHITE     = [255, 255, 255]
const GOLD_TXT  = [180, 120, 0]
const ORANGE_TXT= [146, 64, 14]

const NAT_COMP_ID    = 'ff6e95a9-4f9e-4b54-ad47-a913831d336c'
const INT_COMP_ID    = '4a905558-8a94-4dc2-8305-bce37bfc1fe4'
const FISHING_HOURS_DEFAULT = 10
const LINES_IN_DEFAULT      = '06:00'
const LINES_UP_DEFAULT      = '16:00'

function getFishingHours(dayRecord) {
  if (dayRecord?.fishing_start_time && dayRecord?.fishing_end_time) {
    const [sh, sm] = dayRecord.fishing_start_time.slice(0,5).split(':').map(Number)
    const [eh, em] = dayRecord.fishing_end_time.slice(0,5).split(':').map(Number)
    return ((eh * 60 + em) - (sh * 60 + sm)) / 60
  }
  return FISHING_HOURS_DEFAULT
}

function getLinesIn(dayRecord) {
  return dayRecord?.fishing_start_time?.slice(0,5) || LINES_IN_DEFAULT
}

function getLinesUp(dayRecord) {
  return dayRecord?.fishing_end_time?.slice(0,5) || LINES_UP_DEFAULT
}

const TEAM_LOGOS = {
  'SADSAA Masters':           '/logos/SADSAA Logo.png',
  'SADSAA':                   '/logos/SADSAA Logo.png',
  'Mpumalanga':               '/logos/Mpumalanga Deep Sea Angling Logo.png',
  'Natal':                    '/logos/Natal Logo.png',
  'Southern Cape':            '/logos/Southern Cape Logo.png',
  'Northern Gauteng':         '/logos/NGDSAA logo.png',
  'Western Province Blue':    '/logos/WPDSAA Flag Logo.png',
  'Western Province White':   '/logos/WPDSAA Flag Logo.png',
  'Eastern Province A-Team':  '/logos/Eastern Province Logo.png',
  'Eastern Province B-Team':  '/logos/Eastern Province Logo.png',
  'Barbarians':               '/logos/Barbarians Logo.png',
  'Protea - South Africa':    '/logos/Protea Logo.png',
  'Egypt - El Gouna':         '/logos/Egyptian_Angling_Federation_Logo.png',
}

// ── SCORING ───────────────────────────────────────────────────
function tunaPoints(weightKg, lineClassKg) {
  const factors = { 10: 0.32, 15: 0.142 }
  const f = factors[parseInt(lineClassKg || 10)] || 0.32
  return parseFloat((Math.pow(weightKg, 2) * f).toFixed(2))
}

function calcTeamScores(catches, teams, boats, fishingHours) {
  fishingHours = fishingHours || FISHING_HOURS_DEFAULT
  const scores = {}
  teams.forEach(t => { scores[t.id] = { team: t, total: 0, fish: 0, weight: 0 } })
  catches.forEach(c => {
    if (!scores[c.team_id] || !c.weight_kg || c.scoring === false) return
    const pts = parseFloat(c.points || tunaPoints(parseFloat(c.weight_kg), c.line_class_kg || 10))
    scores[c.team_id].total  += pts
    scores[c.team_id].fish   += 1
    scores[c.team_id].weight += parseFloat(c.weight_kg)
  })
  const teamBoat = {}
  teams.forEach(t => {
    if (t.boat_id) { const b = boats.find(b => b.id === t.boat_id); if (b) teamBoat[t.id] = b }
  })
  return Object.values(scores)
    .map(s => ({
      pos: 0, team: s.team.team_name, team_id: s.team.id,
      boat: teamBoat[s.team.id]?.boat_name || '',
      skipper: teamBoat[s.team.id]?.skipper_name || '',
      fish: s.fish, weight: Math.round(s.weight * 100) / 100,
      total: Math.round(s.total * 100) / 100,
      cpue_kg:   Math.round(s.weight / fishingHours * 100) / 100,
      cpue_fish: Math.round(s.fish   / fishingHours * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total || b.fish - a.fish)
    .map((r, i) => ({ ...r, pos: i + 1 }))
}

function calcAnglerScores(catches, anglers, teams, fishingHours) {
  fishingHours = fishingHours || FISHING_HOURS_DEFAULT
  const teamMap = Object.fromEntries((teams || []).map(t => [t.id, t.team_name]))
  const scores = {}
  anglers.forEach(a => { scores[a.id] = { angler: a, total: 0, fish: 0, weight: 0 } })
  catches.forEach(c => {
    if (!scores[c.angler_id] || !c.weight_kg || c.scoring === false) return
    const pts = parseFloat(c.points || tunaPoints(parseFloat(c.weight_kg), c.line_class_kg || 10))
    scores[c.angler_id].total  += pts
    scores[c.angler_id].fish   += 1
    scores[c.angler_id].weight += parseFloat(c.weight_kg)
  })
  return Object.values(scores)
    .map(s => ({
      pos: 0, angler: s.angler.full_name,
      team: teamMap[s.angler.team_id] || s.angler.division || '',
      fish: s.fish, weight: Math.round(s.weight * 100) / 100,
      total: Math.round(s.total * 100) / 100,
      cpue_kg:   Math.round(s.weight / fishingHours * 100) / 100,
      cpue_fish: Math.round(s.fish   / fishingHours * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total || b.fish - a.fish)
    .map((r, i) => ({ ...r, pos: i + 1 }))
}

function calcTopCatches(catches, anglers, teams, n = 5) {
  const angMap  = Object.fromEntries(anglers.map(a => [a.id, a]))
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]))
  return catches
    .filter(c => c.weight_kg && c.scoring !== false)
    .map(c => ({
      angler:  angMap[c.angler_id]?.full_name || '',
      team:    teamMap[c.team_id]?.team_name || '',
      species: c.species_name || '',
      weight:  parseFloat(c.weight_kg),
      lc:      `${c.line_class_kg || 10} kg`,
      pts:     parseFloat(c.points || tunaPoints(parseFloat(c.weight_kg), c.line_class_kg || 10)),
    }))
    .sort((a, b) => b.pts - a.pts)
    .slice(0, n)
}

function calcSkipperGP(catches, teams, boats, fishingHours) {
  fishingHours = fishingHours || FISHING_HOURS_DEFAULT
  const teamBoat = {}
  teams.forEach(t => {
    if (t.boat_id) { const b = boats.find(b => b.id === t.boat_id); if (b) teamBoat[t.id] = b }
  })
  const dayBoatScores = {}
  catches.forEach(c => {
    if (!c.weight_kg || c.scoring === false) return
    const boat = teamBoat[c.team_id]
    if (!boat) return
    const key = `${boat.id}_${c.competition_day_id}`
    const pts = parseFloat(c.points || tunaPoints(parseFloat(c.weight_kg), c.line_class_kg || 10))
    if (!dayBoatScores[key]) dayBoatScores[key] = { boat, pts: 0, fish: 0, weight: 0 }
    dayBoatScores[key].pts    += pts
    dayBoatScores[key].fish   += 1
    dayBoatScores[key].weight += parseFloat(c.weight_kg)
  })
  const byDay = {}
  Object.entries(dayBoatScores).forEach(([key, v]) => {
    const dayId = key.split('_').slice(1).join('_')
    if (!byDay[dayId]) byDay[dayId] = []
    byDay[dayId].push({ boatId: v.boat.id, pts: v.pts })
  })
  const gpTotals = {}
  Object.values(byDay).forEach(dayScores => {
    dayScores.sort((a, b) => b.pts - a.pts)
    dayScores.forEach((s, i) => { gpTotals[s.boatId] = (gpTotals[s.boatId] || 0) + (i + 1) })
  })
  const boatTotals = {}
  Object.values(dayBoatScores).forEach(v => {
    const id = v.boat.id
    if (!boatTotals[id]) boatTotals[id] = { boat: v.boat, fish: 0, weight: 0 }
    boatTotals[id].fish   += v.fish
    boatTotals[id].weight += v.weight
  })
  return boats
    .filter(b => gpTotals[b.id])
    .map(b => ({
      pos: 0, skipper: b.skipper_name, boat: b.boat_name,
      gp: gpTotals[b.id] || 0,
      cpue_kg:   Math.round((boatTotals[b.id]?.weight || 0) / FISHING_HOURS * 100) / 100,
      cpue_fish: Math.round((boatTotals[b.id]?.fish   || 0) / FISHING_HOURS * 100) / 100,
    }))
    .sort((a, b) => a.gp - b.gp)
    .map((r, i) => ({ ...r, pos: i + 1 }))
}

function calcAnglerCatchDetail(catches, anglers, teams, fishingHours) {
  fishingHours = fishingHours || FISHING_HOURS_DEFAULT
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t.team_name]))
  const data = {}
  anglers.forEach(a => {
    data[a.id] = { name: a.full_name, team: teamMap[a.team_id] || a.division || '',
                   catches: [], total: 0, fish: 0, weight: 0 }
  })
  catches.forEach(c => {
    if (!data[c.angler_id]) return
    const scoring = c.scoring !== false && c.weight_kg
    const pts = scoring
      ? parseFloat(c.points || tunaPoints(parseFloat(c.weight_kg), c.line_class_kg || 10))
      : 0
    data[c.angler_id].catches.push({
      species: c.species_name || '', weight: c.weight_kg ? parseFloat(c.weight_kg) : 0,
      lc: `${c.line_class_kg || 10} kg`, pts, scoring
    })
    if (scoring) {
      data[c.angler_id].total  += pts
      data[c.angler_id].fish   += 1
      data[c.angler_id].weight += parseFloat(c.weight_kg)
    }
  })
  const withFish    = Object.values(data).filter(a => a.fish > 0).sort((a, b) => b.total - a.total)
  const withoutFish = Object.values(data).filter(a => a.fish === 0).sort((a, b) => a.name.localeCompare(b.name))
  return [...withFish, ...withoutFish].map((a, i) => ({
    ...a,
    rank:      a.fish > 0 ? i + 1 : '—',
    cpue_kg:   Math.round(a.weight / FISHING_HOURS * 100) / 100,
    cpue_fish: Math.round(a.fish   / FISHING_HOURS * 100) / 100,
  }))
}

// ── PDF HELPERS ───────────────────────────────────────────────
function addHeader(doc, compName, venue, dayLabel, fishingDate, isFinal = false, linesIn, linesUp, hrs) {
  const W = doc.internal.pageSize.width
  const li = linesIn || LINES_IN_DEFAULT
  const lu = linesUp || LINES_UP_DEFAULT
  const h  = hrs     || FISHING_HOURS_DEFAULT
  doc.setFillColor(...NAVY)
  doc.rect(10, 10, W - 20, 24, 'F')
  doc.setTextColor(...WHITE)
  doc.setFontSize(14); doc.setFont('helvetica', 'bold')
  doc.text(compName, 32, 19)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal')
  doc.setTextColor(...LIGHT_BLU)
  doc.text(venue, 32, 24.5)
  doc.text(`${dayLabel}  •  ${fishingDate}  •  Fishing: ${li}–${lu} (${h} hrs)`, 32, 30)
  doc.setFontSize(7)
  doc.text(isFinal ? 'FINAL RESULTS' : 'Official Results', W - 12, 19, { align: 'right' })
}

function addFooter(doc, compName, dayLabel, dateStr) {
  const W = doc.internal.pageSize.width
  const y = doc.internal.pageSize.height - 8
  doc.setDrawColor(...GRAY); doc.setLineWidth(0.2)
  doc.line(10, y - 3, W - 10, y - 3)
  doc.setFontSize(7); doc.setTextColor(...GRAY); doc.setFont('helvetica', 'normal')
  doc.text('Generated by RecFish ZA  •  recfish-za.netlify.app', 10, y)
  doc.text(`${compName}  •  ${dayLabel}  •  ${dateStr}`, W - 10, y, { align: 'right' })
}

function medalFill(data) {
  if (data.section !== 'body') return
  if (data.row.index === 0) data.cell.styles.fillColor = GOLD_BG
  else if (data.row.index === 1) data.cell.styles.fillColor = SILVER_BG
  else if (data.row.index === 2) data.cell.styles.fillColor = BRONZE_BG
}

// ── NATIONALS PAGE 1 ─────────────────────────────────────────
function addNationalsPage1(doc, natStandings, topCatches, skippers,
                            dayLabel, dateStr, compName, venue, isFinal, linesIn, linesUp, hrs) {
  addHeader(doc, compName, venue, dayLabel, dateStr, isFinal, linesIn, linesUp, hrs)
  let y = 40

  // Nationals standings with CPUE
  doc.setFontSize(10); doc.setFont('helvetica', 'bold')
  doc.setTextColor(...NAVY); doc.text('Nationals — Team Standings', 10, y); y += 3

  autoTable(doc, {
    startY: y,
    head: [['#', 'Team', 'Boat', 'Skipper', 'Fish', 'Points', 'kg/hr', 'f/hr']],
    body: natStandings.map(t => [
      t.pos, t.team, t.boat, t.skipper, t.fish,
      t.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
      t.cpue_kg.toFixed(2), t.cpue_fish.toFixed(2)
    ]),
    headStyles:    { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    bodyStyles:    { fontSize: 8, textColor: DARK },
    alternateRowStyles: { fillColor: PALE_BLU },
    columnStyles:  { 0: { halign: 'center', cellWidth: 9 }, 4: { halign: 'center', cellWidth: 12 },
                     5: { halign: 'right', fontStyle: 'bold', cellWidth: 22 },
                     6: { halign: 'center', cellWidth: 18 }, 7: { halign: 'center', cellWidth: 18 } },
    didParseCell: medalFill,
    margin: { left: 10, right: 10 },
  })
  y = doc.lastAutoTable.finalY + 5

  // Top catches
  const topLabel = isFinal ? 'Top 10 Catches — All Days' : `Top 5 Catches — ${dayLabel.replace(' Results','')}`
  doc.setFontSize(10); doc.setFont('helvetica', 'bold')
  doc.setTextColor(...NAVY); doc.text(topLabel, 10, y); y += 3

  autoTable(doc, {
    startY: y,
    head: [['#', 'Angler', 'Team', 'Species', 'Weight', 'Line', 'Points']],
    body: topCatches.map((c, i) => [
      i + 1, c.angler, c.team, c.species,
      `${c.weight.toFixed(2)} kg`, c.lc,
      c.pts.toLocaleString('en-ZA', { minimumFractionDigits: 2 })
    ]),
    headStyles:    { fillColor: TEAL, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    bodyStyles:    { fontSize: 8, textColor: DARK },
    alternateRowStyles: { fillColor: PALE_GRN },
    columnStyles:  { 0: { halign: 'center', cellWidth: 10 }, 4: { halign: 'center' },
                     5: { halign: 'center', cellWidth: 14 }, 6: { halign: 'right', fontStyle: 'bold', cellWidth: 22 } },
    didParseCell: medalFill,
    margin: { left: 10, right: 10 },
  })
  y = doc.lastAutoTable.finalY + 5

  // Skipper Grand Prix — full width
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY)
  doc.text('Skipper Grand Prix', 10, y); y += 3

  autoTable(doc, {
    startY: y,
    head: [['#', 'Skipper', 'Boat', 'GP Points', 'CPUE kg/hr', 'CPUE fish/hr']],
    body: skippers.map(s => [s.pos, s.skipper, s.boat, s.gp, s.cpue_kg.toFixed(2), s.cpue_fish.toFixed(2)]),
    headStyles:    { fillColor: NAVY2, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    bodyStyles:    { fontSize: 8, textColor: DARK },
    alternateRowStyles: { fillColor: PALE_BLU },
    columnStyles:  { 0: { halign: 'center', cellWidth: 9 },
                     1: { cellWidth: 45 },
                     2: { cellWidth: 40 },
                     3: { halign: 'center', cellWidth: 20 },
                     4: { halign: 'center', cellWidth: 22 },
                     5: { halign: 'center', cellWidth: 22 } },
    didParseCell: medalFill,
    margin: { left: 10, right: 10 },
  })

  addFooter(doc, compName, dayLabel, dateStr)
}

// ── INTERNATIONAL PAGE 1 ──────────────────────────────────────
function addInternationalPage1(doc, intStandings, intAngScores, topCatches,
                                dayLabel, dateStr, compName, venue, isFinal, linesIn, linesUp, hrs) {
  addHeader(doc, compName, venue, dayLabel, dateStr, isFinal, linesIn, linesUp, hrs)
  let y = 40

  // International team standings
  doc.setFontSize(10); doc.setFont('helvetica', 'bold')
  doc.setTextColor(...NAVY); doc.text('International — Team Standings', 10, y); y += 3

  autoTable(doc, {
    startY: y,
    head: [['#', 'Team', 'Boat', 'Skipper', 'Fish', 'Points', 'kg/hr', 'f/hr']],
    body: intStandings.map(t => [
      t.pos, t.team, t.boat, t.skipper, t.fish,
      t.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
      t.cpue_kg.toFixed(2), t.cpue_fish.toFixed(2)
    ]),
    headStyles:    { fillColor: PURPLE, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    bodyStyles:    { fontSize: 8, textColor: DARK },
    alternateRowStyles: { fillColor: PALE_PUR },
    columnStyles:  { 0: { halign: 'center', cellWidth: 9 }, 4: { halign: 'center', cellWidth: 11 },
                     5: { halign: 'right', fontStyle: 'bold', cellWidth: 22 },
                     6: { halign: 'center', cellWidth: 16 }, 7: { halign: 'center', cellWidth: 16 } },
    didParseCell: medalFill,
    margin: { left: 10, right: 10 },
  })
  y = doc.lastAutoTable.finalY + 5

  // Top catches
  const topLabel = isFinal ? 'Top 10 Catches — All Days' : `Top 5 Catches — ${dayLabel.replace(' Results','')}`
  doc.setFontSize(10); doc.setFont('helvetica', 'bold')
  doc.setTextColor(...NAVY); doc.text(topLabel, 10, y); y += 3

  autoTable(doc, {
    startY: y,
    head: [['#', 'Angler', 'Team', 'Species', 'Weight', 'Line', 'Points']],
    body: topCatches.map((c, i) => [
      i + 1, c.angler, c.team, c.species,
      `${c.weight.toFixed(2)} kg`, c.lc,
      c.pts.toLocaleString('en-ZA', { minimumFractionDigits: 2 })
    ]),
    headStyles:    { fillColor: TEAL, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    bodyStyles:    { fontSize: 8, textColor: DARK },
    alternateRowStyles: { fillColor: PALE_GRN },
    columnStyles:  { 0: { halign: 'center', cellWidth: 10 }, 4: { halign: 'center' },
                     5: { halign: 'center', cellWidth: 14 }, 6: { halign: 'right', fontStyle: 'bold', cellWidth: 22 } },
    didParseCell: medalFill,
    margin: { left: 10, right: 10 },
  })
  y = doc.lastAutoTable.finalY + 5

  // Individual angler standings
  doc.setFontSize(10); doc.setFont('helvetica', 'bold')
  doc.setTextColor(...NAVY); doc.text('International — Individual Angler Standings', 10, y); y += 3

  autoTable(doc, {
    startY: y,
    head: [['#', 'Angler', 'Country / Team', 'Fish', 'Points', 'kg/hr', 'f/hr']],
    body: intAngScores.map(a => [
      a.pos, a.angler, a.team, a.fish,
      a.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
      a.cpue_kg.toFixed(2), a.cpue_fish.toFixed(2)
    ]),
    headStyles:    { fillColor: PURPLE, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    bodyStyles:    { fontSize: 8, textColor: DARK },
    alternateRowStyles: { fillColor: PALE_PUR },
    columnStyles:  { 0: { halign: 'center', cellWidth: 10 }, 3: { halign: 'center', cellWidth: 12 },
                     4: { halign: 'right', fontStyle: 'bold', cellWidth: 22 },
                     5: { halign: 'center', cellWidth: 16 }, 6: { halign: 'center', cellWidth: 16 } },
    didParseCell: medalFill,
    margin: { left: 10, right: 10 },
  })

  addFooter(doc, compName, dayLabel, dateStr)
}

// ── ANGLER DETAIL PAGES ───────────────────────────────────────
function addAnglerDetailPage(doc, catchDetail, sectionTitle,
                              compName, venue, dayLabel, dateStr, isFinal, linesIn, linesUp, hrs) {
  doc.addPage()
  addHeader(doc, compName, venue, dayLabel, dateStr, isFinal, linesIn, linesUp, hrs)
  let y = 40

  doc.setFontSize(10); doc.setFont('helvetica', 'bold')
  doc.setTextColor(...NAVY); doc.text(sectionTitle, 10, y); y += 5

  const W = doc.internal.pageSize.width

  catchDetail.forEach(ang => {
    const neededH = 8 + (ang.catches.length * 6) + (ang.fish > 0 ? 7 : 0) + 5
    if (y + neededH > doc.internal.pageSize.height - 20) {
      addFooter(doc, compName, dayLabel, dateStr)
      doc.addPage()
      addHeader(doc, compName, venue, dayLabel, dateStr, isFinal)
      y = 40
    }

    const hasFish = ang.fish > 0
    // Angler header bar
    doc.setFillColor(...(hasFish ? NAVY : GRAY))
    doc.rect(10, y, W - 20, 7, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(8); doc.setFont('helvetica', 'bold')
    doc.text(`${ang.rank}`, 15, y + 4.8, { align: 'center' })
    doc.text(ang.name, 20, y + 4.8)
    doc.text(ang.team, 85, y + 4.8)
    if (hasFish) {
      doc.setTextColor(...GOLD_BG)
      doc.text(
        `${ang.fish} fish  |  ${ang.weight.toFixed(2)} kg  |  ${ang.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} pts`,
        W - 12, y + 4.8, { align: 'right' }
      )
    }
    y += 7

    if (hasFish) {
      // CPUE bar
      doc.setFillColor(...ORANGE_BG)
      doc.rect(10, y, W - 20, 6, 'F')
      doc.setTextColor(...ORANGE_TXT)
      doc.setFontSize(7); doc.setFont('helvetica', 'oblique')
      doc.text(
        `CPUE:  ${ang.cpue_kg.toFixed(2)} kg/hr  |  ${ang.cpue_fish.toFixed(2)} fish/hr  (over ${hrs || FISHING_HOURS_DEFAULT} hrs fishing)`,
        20, y + 4
      )
      doc.setDrawColor(...[229, 231, 235]); doc.setLineWidth(0.1)
      doc.line(10, y + 6, W - 10, y + 6)
      y += 6

      // Catch rows
      const sorted = [...ang.catches].sort((a, b) => b.pts - a.pts)
      sorted.forEach((c, i) => {
        const bg = i % 2 === 0 ? [248, 250, 252] : WHITE
        doc.setFillColor(...bg)
        doc.rect(10, y, W - 20, 6, 'F')
        doc.setDrawColor(...[229, 231, 235]); doc.setLineWidth(0.1)
        doc.line(10, y + 6, W - 10, y + 6)
        doc.setTextColor(...GRAY); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
        doc.text(`${i + 1}.`, 16, y + 4, { align: 'center' })
        doc.setTextColor(...DARK); doc.setFontSize(8)
        doc.text(c.species, 20, y + 4)
        doc.text(`${c.weight.toFixed(2)} kg`, 112, y + 4, { align: 'right' })
        doc.text(c.lc, 126, y + 4, { align: 'center' })
        if (c.scoring) {
          doc.setTextColor(...NAVY2); doc.setFont('helvetica', 'bold')
          doc.text(c.pts.toLocaleString('en-ZA', { minimumFractionDigits: 2 }), W - 12, y + 4, { align: 'right' })
        } else {
          doc.setTextColor(...[146, 64, 14]); doc.setFont('helvetica', 'italic')
          doc.text('Non-scoring', W - 12, y + 4, { align: 'right' })
        }
        y += 6
      })
    } else {
      doc.setFillColor(...[249, 250, 251])
      doc.rect(10, y, W - 20, 6, 'F')
      doc.setTextColor(...GRAY); doc.setFontSize(7); doc.setFont('helvetica', 'oblique')
      doc.text('No fish recorded', 20, y + 4)
      y += 6
    }
    y += 3
  })

  addFooter(doc, compName, dayLabel, dateStr)
}

// ── FETCH HELPERS ────────────────────────────────────────────
async function fetchCompData(supabase, compId, dayNumber) {
  const dayNum = dayNumber === null ? null : parseInt(dayNumber)
  const [teams, anglers, boats, days] = await Promise.all([
    supabase.from('competition_teams').select('*').eq('competition_id', compId).then(r => r.data || []),
    supabase.from('competition_participants').select('*').eq('competition_id', compId).then(r => r.data || []),
    supabase.from('competition_boats').select('*').eq('competition_id', compId).then(r => r.data || []),
    supabase.from('competition_days').select('*').eq('competition_id', compId).order('day_number').then(r => r.data || []),
  ])
  let catches = []
  if (dayNum === null) {
    const r = await supabase.from('competition_catches').select('*').eq('competition_id', compId)
    catches = r.data || []
  } else {
    const day = days.find(d => parseInt(d.day_number) === dayNum)
    if (day) {
      const r = await supabase.from('competition_catches').select('*')
        .eq('competition_id', compId).eq('competition_day_id', day.id)
      catches = r.data || []
    }
  }
  return { teams, anglers, boats, days, catches }
}

// ── NATIONALS PDF ─────────────────────────────────────────────
export async function generateResultsPDF(supabase, dayNumber = null) {
  const isFinal  = dayNumber === null
  const compName = 'SADSAA Tuna Nationals 2026'
  const venue    = 'Atlantic Boat Club, Hout Bay, Cape Town'
  const dayLabel = isFinal ? 'Final Results' : `Day ${dayNumber} Results`
  const dateStr  = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })

  const d = await fetchCompData(supabase, NAT_COMP_ID, dayNumber)

  // Get actual fishing date and hours from competition days
  const fishingDay = isFinal ? null : d.days.find(x => parseInt(x.day_number) === parseInt(dayNumber))
  const fishingDate = isFinal
    ? dateStr
    : (fishingDay?.date
        ? new Date(fishingDay.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
        : dateStr)
  const fishingHours = getFishingHours(fishingDay)
  const linesIn  = isFinal ? LINES_IN_DEFAULT  : getLinesIn(fishingDay)
  const linesUp  = isFinal ? LINES_UP_DEFAULT  : getLinesUp(fishingDay)

  const natStandings   = calcTeamScores(d.catches, d.teams, d.boats, fishingHours)
  const topCatches     = calcTopCatches(d.catches, d.anglers, d.teams, isFinal ? 10 : 5)
  const skippers       = calcSkipperGP(d.catches, d.teams, d.boats, fishingHours)
  const natCatchDetail = calcAnglerCatchDetail(d.catches, d.anglers, d.teams, fishingHours)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Page 1 — Nationals only
  addNationalsPage1(doc, natStandings, topCatches, skippers, dayLabel, fishingDate, compName, venue, isFinal, linesIn, linesUp, fishingHours)

  // Page 2+ — Nationals angler detail
  addAnglerDetailPage(doc, natCatchDetail, 'Nationals — Individual Angler Catches',
                      compName, venue, dayLabel, fishingDate, isFinal, linesIn, linesUp, fishingHours)

  const filename = isFinal
    ? 'TunaNationals2026_FinalResults.pdf'
    : `TunaNationals2026_Day${dayNumber}_Results.pdf`
  doc.save(filename)
}

// ── INTERNATIONAL PDF ─────────────────────────────────────────
export async function generateIntResultsPDF(supabase, dayNumber = null) {
  const isFinal  = dayNumber === null
  const compName = 'SADSAA Tuna International 2026'
  const venue    = 'Atlantic Boat Club, Hout Bay, Cape Town'
  const dayLabel = isFinal ? 'Final Results' : `Day ${dayNumber} Results`
  const dateStr  = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })

  const d = await fetchCompData(supabase, INT_COMP_ID, dayNumber)

  const fishingDay = isFinal ? null : d.days.find(x => parseInt(x.day_number) === parseInt(dayNumber))
  const fishingDate = isFinal
    ? dateStr
    : (fishingDay?.date
        ? new Date(fishingDay.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
        : dateStr)
  const fishingHours = getFishingHours(fishingDay)
  const linesIn  = isFinal ? LINES_IN_DEFAULT  : getLinesIn(fishingDay)
  const linesUp  = isFinal ? LINES_UP_DEFAULT  : getLinesUp(fishingDay)

  const intStandings   = calcTeamScores(d.catches, d.teams, d.boats, fishingHours)
  const intAngScores   = calcAnglerScores(d.catches, d.anglers, d.teams, fishingHours)
  const topCatches     = calcTopCatches(d.catches, d.anglers, d.teams, isFinal ? 10 : 5)
  const intCatchDetail = calcAnglerCatchDetail(d.catches, d.anglers, d.teams, fishingHours)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Page 1 — International only
  addInternationalPage1(doc, intStandings, intAngScores, topCatches, dayLabel, fishingDate, compName, venue, isFinal, linesIn, linesUp, fishingHours)

  // Page 2+ — International angler detail
  addAnglerDetailPage(doc, intCatchDetail, 'International — Individual Angler Catches',
                      compName, venue, dayLabel, fishingDate, isFinal, linesIn, linesUp, fishingHours)

  const filename = isFinal
    ? 'TunaInternational2026_FinalResults.pdf'
    : `TunaInternational2026_Day${dayNumber}_Results.pdf`
  doc.save(filename)
}
