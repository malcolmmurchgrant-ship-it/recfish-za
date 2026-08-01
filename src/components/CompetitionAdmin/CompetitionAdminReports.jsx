// ─── CompetitionAdminReports.jsx ─────────────────────────────────────────────
// Tab 5 — Reports
// PDF (Edge Function) + CSV + XLSX generation.
// Prize category management (editable until Publish Final Results).
// Sponsor configuration.

import { useState, useMemo, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { downloadCSV, downloadXLSX, downloadPDF } from './utils/reportGenerator'
import { buildIndividualStandings, buildDailyAnglerPercentages, buildBoatPercentageTeamStandings, buildCpueData, buildSkipperRanking } from './utils/scoringEngine'

// Flip to true once generate-competition-pdf is actually built and deployed
// as a Supabase Edge Function (confirmed none exist on this project yet).
const PDF_ENABLED = false

const NAVY  = '#1e3a8a'
const GREY  = '#6b7280'
const GREEN = '#16a34a'
const RED   = '#dc2626'
const GOLD  = '#d97706'

const S = {
  card:   { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '1rem' },
  label:  { fontSize: '0.78rem', fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' },
  input:  { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' },
  select: { width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', background: 'white', boxSizing: 'border-box' },
  btn:    (bg = NAVY, col = 'white', disabled = false) => ({
    background: disabled ? '#e5e7eb' : bg,
    color: disabled ? '#9ca3af' : col,
    border: 'none', padding: '0.6rem 1.2rem', borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9rem'
  }),
  section:{ fontWeight: 700, color: NAVY, fontSize: '0.95rem', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '2px solid #e5e7eb' },
}

const DEFAULT_PRIZE_CATEGORIES = [
  { id: 'heaviest_bag',     label: 'Heaviest Bag',      criteria: 'max_total_weight',   eligible: 'individual' },
  { id: 'most_points',      label: 'Most Points',       criteria: 'max_total_points',   eligible: 'individual' },
  { id: 'top_boat',         label: 'Top Boat / Team',   criteria: 'max_team_points',    eligible: 'team' },
  { id: 'most_species',     label: 'Most Species',      criteria: 'max_species_count',  eligible: 'individual' },
]

export default function CompetitionAdminReports({
  competition, config, catches, participants, teams, days, boats, isAdmin,
}) {
  const [xlsxMode,      setXlsxMode]      = useState(config?.reporting?.xlsx_mode || 'multi_sheet')
  const [prizeCategories, setPrizeCats]   = useState(
    config?.reporting?.prize_categories?.length
      ? config.reporting.prize_categories
      : DEFAULT_PRIZE_CATEGORIES
  )
  const [sponsorName,   setSponsorName]   = useState(config?.reporting?.cover_page?.headline_sponsor_name || '')
  const [savingConfig,  setSavingConfig]  = useState(false)
  const [downloading,   setDownloading]   = useState(null)
  const [error,         setError]         = useState('')
  const [published,     setPublished]     = useState(false)

  const isLocked   = !!competition?.results_published_at || published
  const standings  = useMemo(() => buildIndividualStandings(catches, participants, days, boats), [catches, participants, days, boats])

  // Boat draws, needed for crew-size-aware skipper averaging (same as the
  // Scoreboard tab) — this tab never fetched them, which is why Skipper
  // Standings was missing from every report entirely, not just unsplit.
  const [boatDraws, setBoatDraws] = useState([])
  useEffect(() => {
    if (!competition?.id) return
    supabase.from('competition_boat_draws')
      .select('*')
      .eq('competition_id', competition.id)
      .then(({ data }) => setBoatDraws(data || []))
  }, [competition?.id])
  const skipperRanking = useMemo(() =>
    buildSkipperRanking(catches.filter(c => c.data_quality !== 'rejected'), boats, days, boatDraws),
    [catches, boats, days, boatDraws]
  )
  // Weight isn't tracked at all for 'points'-method (unit-count) competitions
  // like this one — species are tallied, not weighed — so a "Total Weight"
  // stat would just show 0.0kg regardless of how much fishing actually
  // happened. Same fix as the Scoreboard tab's Weight column, for the same
  // reason.
  const showWeight = config?.scoring?.method !== 'points'
  // Per-day, per-angler raw points + boat percentage — raw points decide
  // each day's top-angler award, percentage is what feeds into team
  // totals. Both matter independently, so both are shown here rather than
  // collapsing into a single figure.
  const dailyRecords = useMemo(() =>
    buildDailyAnglerPercentages(catches.filter(c => c.data_quality !== 'rejected'), participants, days, boats),
    [catches, participants, days, boats]
  )
  const teamStandings = useMemo(() =>
    buildBoatPercentageTeamStandings(catches.filter(c => c.data_quality !== 'rejected'), participants, teams, days, boats),
    [catches, participants, teams, days, boats]
  )
  // Same ladies'-division split as the Scoreboard tab — this is a
  // genuinely separate code path (its own buildBoatPercentageTeamStandings
  // call), so it needed its own split; fixing the Scoreboard tab didn't
  // automatically fix reports.
  const ladiesTeamIds = useMemo(() =>
    new Set((teams || []).filter(t => t.team_type === 'ladies').map(t => t.id)),
    [teams]
  )
  const generalTeamStandings = useMemo(() =>
    teamStandings.filter(t => !ladiesTeamIds.has(t.teamId)).map((t, i) => ({ ...t, rank: i + 1 })),
    [teamStandings, ladiesTeamIds]
  )
  const ladiesTeamStandings = useMemo(() =>
    teamStandings.filter(t => ladiesTeamIds.has(t.teamId)).map((t, i) => ({ ...t, rank: i + 1 })),
    [teamStandings, ladiesTeamIds]
  )
  const dailyByDay = useMemo(() => {
    const byDay = {}
    for (const r of dailyRecords) {
      const key = r.dayNumber ?? '?'
      if (!byDay[key]) byDay[key] = []
      byDay[key].push(r)
    }
    for (const key of Object.keys(byDay)) {
      byDay[key].sort((a, b) => b.rawPoints - a.rawPoints)
    }
    return byDay
  }, [dailyRecords])

  const [fishingSessions, setFishingSessions] = useState([])
  useEffect(() => {
    if (!competition?.id) return
    supabase.from('competition_fishing_sessions')
      .select('*')
      .eq('competition_id', competition.id)
      .order('day_number').order('boat_name')
      .then(({ data }) => setFishingSessions(data || []))
  }, [competition?.id])

  const cpueData = useMemo(() =>
    buildCpueData(catches.filter(c => c.data_quality !== 'rejected'), participants, days, boats, fishingSessions),
    [catches, participants, days, boats, fishingSessions]
  )

  // Overall competition-wide CPUE per angler (summed across every day that
  // had hours recorded) — merged onto a standings copy for the Standings
  // sheet/CSV, same pattern as the earlier anglerPercentage merge before
  // that moved inside buildIndividualStandings itself. CPUE can't live
  // there the same way since it needs fishingSessions, which that function
  // doesn't otherwise touch.
  const standingsWithCpue = useMemo(() => {
    const byParticipant = {}
    for (const a of cpueData.byAngler) byParticipant[a.participantId] = a.cpue
    return standings.map(s => ({ ...s, cpue: byParticipant[s.participantId] ?? null }))
  }, [standings, cpueData])

  // Same open/ladies split as Team Standings, applied to the individual
  // field — everyone still fishes and is scored together (this doesn't
  // change anything about how anglerPercentage/points are calculated),
  // it's purely which report section an angler's row appears in and what
  // position they're numbered at within that section.
  const openStandings = useMemo(() =>
    standingsWithCpue.filter(s => s.category !== 'ladies').map((s, i) => ({ ...s, rank: i + 1 })),
    [standingsWithCpue]
  )
  const ladiesStandings = useMemo(() =>
    standingsWithCpue.filter(s => s.category === 'ladies').map((s, i) => ({ ...s, rank: i + 1 })),
    [standingsWithCpue]
  )

  // ── Save reporting config ─────────────────────────────────────────────────
  async function saveReportingConfig() {
    setSavingConfig(true); setError('')
    const updatedReporting = {
      ...(config?.reporting || {}),
      xlsx_mode:        xlsxMode,
      prize_categories: prizeCategories,
      cover_page: {
        ...(config?.reporting?.cover_page || {}),
        show_sponsor:           !!sponsorName,
        headline_sponsor_name:  sponsorName || null,
      },
    }
    // Update via rule_overrides to preserve audit trail
    const existing = competition.rule_overrides || []
    const override = {
      timestamp:      new Date().toISOString(),
      description:    'Reporting config updated',
      changed_fields: { reporting_config: updatedReporting },
    }
    const { error: err } = await supabase
      .from('competitions')
      .update({ rule_overrides: [...existing, override] })
      .eq('id', competition.id)
    if (err) { setError(err.message) }
    setSavingConfig(false)
  }

  // ── Publish final results ─────────────────────────────────────────────────
  async function handlePublish() {
    if (!window.confirm('Publish final results? This will lock all results and catches. This cannot be undone.')) return
    const { error: err } = await supabase
      .from('competitions')
      .update({
        status:               'completed',
        results_published_at: new Date().toISOString(),
        results_visible:      true,
      })
      .eq('id', competition.id)
    if (err) { setError(err.message); return }
    setPublished(true)
  }

  // ── Download handlers ─────────────────────────────────────────────────────
  async function handleDownload(type) {
    setDownloading(type); setError('')
    try {
      if (type === 'csv') {
        downloadCSV(standingsWithCpue, competition, config)
      } else if (type === 'xlsx') {
        downloadXLSX(standingsWithCpue, catches, competition, config, xlsxMode, { participants, dailyRecords, teamStandings: generalTeamStandings, ladiesTeamStandings, cpueData, openStandings, ladiesStandings, skipperRanking })
      } else if (type === 'pdf') {
        await downloadPDF(competition.id, 'full_results')
      } else if (type === 'pdf_prize') {
        await downloadPDF(competition.id, 'prize_giving')
      } else if (type === 'pdf_scorer') {
        await downloadPDF(competition.id, 'scorer_sheet')
      }
    } catch (err) {
      setError(`Download failed: ${err.message}`)
    } finally {
      setDownloading(null)
    }
  }

  // ── Prize category helpers ────────────────────────────────────────────────
  function addPrizeCategory() {
    setPrizeCats(cats => [...cats, {
      id:       `custom_${Date.now()}`,
      label:    '',
      criteria: 'max_total_points',
      eligible: 'individual',
    }])
  }

  function updatePrizeCat(index, updates) {
    setPrizeCats(cats => cats.map((c, i) => i === index ? { ...c, ...updates } : c))
  }

  function removePrizeCat(index) {
    setPrizeCats(cats => cats.filter((_, i) => i !== index))
  }

  return (
    <div>
      {/* ── Results status ───────────────────────────────────────────────── */}
      <div style={{ ...S.card, background: isLocked ? '#f0fdf4' : '#fef3c7', border: `1px solid ${isLocked ? '#86efac' : '#fcd34d'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ fontWeight: 700, color: isLocked ? GREEN : GOLD }}>
              {isLocked ? '✅ Results Published — Final' : '🔒 Results Not Yet Published'}
            </div>
            <div style={{ fontSize: '0.78rem', color: GREY, marginTop: 2 }}>
              {isLocked
                ? `Published ${new Date(competition.results_published_at).toLocaleString('en-ZA')} — all results and catches are locked`
                : 'Prize categories and results can still be edited. Publish to lock everything.'}
            </div>
          </div>
          {isAdmin && !isLocked && standings.length > 0 && (
            <button onClick={handlePublish} style={S.btn(GREEN)}>
              📢 Publish Final Results
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ ...S.card, background: '#fef2f2', border: '1px solid #fca5a5', color: RED }}>
          {error}
        </div>
      )}

      {/* ── Summary stats ────────────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={S.section}>Competition Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'Participants', val: participants.length },
            { label: 'Total Catches', val: catches.filter(c => c.data_quality !== 'rejected').length },
            { label: 'Verified',     val: catches.filter(c => c.data_quality === 'verified').length },
            { label: 'DQ\'d',        val: catches.filter(c => c.data_quality === 'disqualified').length },
            { label: 'Species',      val: new Set(catches.map(c => c.species_name).filter(Boolean)).size },
            ...(showWeight ? [{ label: 'Total Weight', val: catches.reduce((s, c) => s + parseFloat(c.weight_kg || 0), 0).toFixed(1) + ' kg' }] : []),
          ].map(({ label, val }) => (
            <div key={label} style={{ background: '#f8fafc', borderRadius: 6, padding: '0.6rem 0.75rem' }}>
              <div style={{ fontSize: '0.72rem', color: GREY, textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
              <div style={{ fontWeight: 700, color: NAVY, fontSize: '1.1rem', marginTop: 2 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Daily results (raw points + boat %) ──────────────────────────── */}
      {Object.keys(dailyByDay).length > 0 && (
        <div style={S.card}>
          <div style={S.section}>Daily Results</div>
          <div style={{ fontSize: '0.8rem', color: GREY, marginBottom: '0.75rem' }}>
            Raw points decide each day's top-angler award. Boat % is relative to the top
            scorer on that same boat that day (any team) and is what feeds into Team totals.
            CPUE is Fish Per Hour for that angler's boat that day.
          </div>
          {Object.keys(dailyByDay).sort((a, b) => a - b).map(dayNum => (
            <div key={dayNum} style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, color: NAVY, fontSize: '0.9rem', marginBottom: '0.4rem' }}>Day {dayNum}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    {['Angler','Team','Boat','Raw Points','Boat %','CPUE'].map(h => (
                      <th key={h} style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontSize: '0.72rem', textTransform: 'uppercase', color: GREY, fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dailyByDay[dayNum].map(d => {
                    const anglerCpue = cpueData.byAnglerDay.find(a => a.participantId === d.participantId && String(a.dayNumber) === String(dayNum))
                    return (
                      <tr key={`${dayNum}-${d.participantId}`} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600, color: NAVY }}>{d.displayName}</td>
                        <td style={{ padding: '0.4rem 0.6rem', color: GREY }}>{d.teamName || '—'}</td>
                        <td style={{ padding: '0.4rem 0.6rem', color: GREY }}>{d.boatName}</td>
                        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', color: GREY }}>{d.rawPoints.toFixed(2)}</td>
                        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 700, color: d.percentage === 100 ? GREEN : NAVY }}>{d.percentage.toFixed(2)}%{d.percentage === 100 ? ' \ud83e\udd47' : ''}</td>
                        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', color: GREY }}>{anglerCpue?.cpue != null ? anglerCpue.cpue.toFixed(2) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* ── Record / PB claims ───────────────────────────────────────────── */}
      {(() => {
        // notes is shared between the angler's Record/PB claim (typed at
        // catch-logging time) and an admin's rejection reason (typed later
        // in the Edit modal) — there's no separate flag distinguishing them.
        // Excluding rejected/disqualified catches is a heuristic, not a
        // structural guarantee, but keeps this list accurate for how the
        // app is actually used today.
        const claims = catches.filter(c =>
          c.notes && c.notes.trim() &&
          c.data_quality !== 'rejected' && c.data_quality !== 'disqualified'
        )
        if (claims.length === 0) return null
        return (
          <div style={S.card}>
            <div style={S.section}>🏆 Record / PB Claims</div>
            <div style={{ fontSize: '0.8rem', color: GREY, marginBottom: '0.75rem' }}>
              Catches with a Record/PB note attached — for John/you to verify and action (e.g. submit to SADSAA) manually.
            </div>
            <div style={{ display: 'grid', gap: '0.4rem' }}>
              {claims.map(c => {
                const participant = participants.find(p => p.id === c.participant_id || (c.angler_id && p.user_id === c.angler_id))
                return (
                  <div key={c.id} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '0.6rem 0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <span style={{ fontWeight: 600, color: NAVY }}>
                        {participant?.full_name || 'Unknown angler'} — {c.species_name}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: GREY }}>
                        Day {c.competition_days?.day_number || '?'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#92400e', marginTop: 2 }}>{c.notes}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── Fishing session times ────────────────────────────────────────── */}
      {fishingSessions.some(s => s.lines_in && s.lines_up) && (
        <div style={S.card}>
          <div style={S.section}>Fishing Session Times & CPUE</div>
          <div style={{ fontSize: '0.8rem', color: GREY, marginBottom: '0.75rem' }}>
            Lines In / Lines Up times logged per boat. CPUE here is Fish Per Hour
            (fish count ÷ hours) — this competition doesn't track weight (species
            are tallied, not weighed), so this uses catch rate rather than the
            traditional weight/hour figure.
          </div>
          {[...new Set(fishingSessions.map(s => s.day_number))].sort((a, b) => a - b).map(dayNum => {
            const daySessions = fishingSessions.filter(s => s.day_number === dayNum && s.lines_in && s.lines_up)
            if (daySessions.length === 0) return null
            return (
              <div key={dayNum} style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontWeight: 600, color: NAVY, fontSize: '0.85rem', marginBottom: '0.4rem' }}>Day {dayNum}</div>
                <div style={{ display: 'grid', gap: '0.3rem' }}>
                  {daySessions.map(s => {
                    const boatCpue = cpueData.byBoatDay.find(bd => bd.boatName === s.boat_name && bd.dayNumber === dayNum)
                    return (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', background: '#f8fafc', borderRadius: 6, padding: '0.4rem 0.75rem' }}>
                        <span><strong style={{ color: NAVY }}>{s.boat_name}</strong> — {s.skipper_name}</span>
                        <span style={{ color: GREY }}>
                          {s.lines_in} – {s.lines_up} ({s.fishing_hours != null ? `${s.fishing_hours}h` : '—'})
                          {boatCpue?.cpue != null && <> · CPUE: <strong style={{ color: NAVY }}>{boatCpue.cpue.toFixed(2)}</strong> fish/hr</>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Download reports ─────────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={S.section}>Download Reports</div>

        {/* XLSX mode selector */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={S.label}>XLSX Format</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[
              { id: 'multi_sheet',  label: 'Multi-sheet (Standings + Catches + Prizes)' },
              { id: 'single_sheet', label: 'Single-sheet (all on one worksheet — club use)' },
            ].map(m => (
              <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', cursor: 'pointer', padding: '0.4rem 0.75rem', borderRadius: 6, background: xlsxMode === m.id ? '#eff6ff' : '#f8fafc', border: `1px solid ${xlsxMode === m.id ? '#93c5fd' : '#e5e7eb'}` }}>
                <input type="radio" name="xlsxMode" value={m.id} checked={xlsxMode === m.id}
                  onChange={() => setXlsxMode(m.id)} />
                {m.label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
          {[
            { type: 'csv',        label: '📄 Download CSV',           desc: 'Spreadsheet-ready results' },
            { type: 'xlsx',       label: '📊 Download Excel (.xls)',  desc: xlsxMode === 'multi_sheet' ? '3 worksheets' : 'Single worksheet' },
            // PDF options hidden until the generate-competition-pdf Edge
            // Function actually exists — confirmed via the Supabase
            // dashboard that zero Edge Functions are deployed on this
            // project at all, so these three always failed silently.
            // Flip PDF_ENABLED to true once that function is built and
            // deployed; no other change needed here.
            ...(PDF_ENABLED ? [
              { type: 'pdf',        label: '📋 Full Results PDF',       desc: 'Complete results report' },
              { type: 'pdf_prize',  label: '🏆 Prize Giving PDF',      desc: 'Category winners summary' },
              { type: 'pdf_scorer', label: '📝 Scorer\'s Sheet PDF',   desc: 'Internal audit sheet' },
            ] : []),
          ].map(r => (
            <button key={r.type} onClick={() => handleDownload(r.type)}
              disabled={!!downloading || standings.length === 0}
              style={{ ...S.btn(NAVY, 'white', !!downloading || standings.length === 0), textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <span>{downloading === r.type ? 'Generating…' : r.label}</span>
              <span style={{ fontSize: '0.72rem', opacity: 0.75, fontWeight: 400 }}>{r.desc}</span>
            </button>
          ))}
        </div>
        {standings.length === 0 && (
          <div style={{ fontSize: '0.82rem', color: GREY, marginTop: '0.5rem', fontStyle: 'italic' }}>
            Reports available once catches are logged.
          </div>
        )}
      </div>

      {/* ── Prize categories ─────────────────────────────────────────────── */}
      {!isLocked && isAdmin && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={S.section}>Prize Categories</div>
            <button onClick={addPrizeCategory} style={{ ...S.btn(GREEN), padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}>
              + Add Category
            </button>
          </div>
          <div style={{ fontSize: '0.8rem', color: GREY, marginBottom: '0.75rem' }}>
            These categories appear in the Prize Giving PDF. Editable until results are published.
          </div>
          {prizeCategories.map((cat, i) => (
            <div key={cat.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'end' }}>
              <div>
                {i === 0 && <label style={S.label}>Category Label</label>}
                <input style={S.input} placeholder="e.g. Heaviest Kob"
                  value={cat.label}
                  onChange={e => updatePrizeCat(i, { label: e.target.value })} />
              </div>
              <div>
                {i === 0 && <label style={S.label}>Criteria</label>}
                <select style={S.select} value={cat.criteria}
                  onChange={e => updatePrizeCat(i, { criteria: e.target.value })}>
                  <option value="max_total_points">Most Points</option>
                  <option value="max_total_weight">Heaviest Bag</option>
                  <option value="max_species_weight">Heaviest Species</option>
                  <option value="max_species_count">Most Species</option>
                  <option value="max_team_points">Top Team — Points</option>
                  <option value="max_team_weight">Top Team — Weight</option>
                </select>
              </div>
              <div>
                {i === 0 && <label style={S.label}>Eligible</label>}
                <select style={S.select} value={cat.eligible}
                  onChange={e => updatePrizeCat(i, { eligible: e.target.value })}>
                  <option value="individual">Individual</option>
                  <option value="team">Team</option>
                  <option value="boat">Boat</option>
                  <option value="skipper">Skipper</option>
                </select>
              </div>
              <button onClick={() => removePrizeCat(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: RED, fontSize: '1.1rem', padding: '0.3rem', marginTop: i === 0 ? '1.2rem' : 0 }}>
                ✕
              </button>
            </div>
          ))}
          <div style={{ marginTop: '0.75rem' }}>
            <button onClick={saveReportingConfig} disabled={savingConfig} style={S.btn(GREEN, 'white', savingConfig)}>
              {savingConfig ? 'Saving…' : '✓ Save Prize Categories'}
            </button>
          </div>
        </div>
      )}

      {/* ── Sponsor configuration ────────────────────────────────────────── */}
      {!isLocked && isAdmin && (
        <div style={S.card}>
          <div style={S.section}>Sponsor / Branding</div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={S.label}>Headline Sponsor Name (optional)</label>
            <input style={S.input} placeholder="e.g. Shimano SA — appears on PDF cover and footer"
              value={sponsorName}
              onChange={e => setSponsorName(e.target.value)} />
          </div>
          <div style={{ fontSize: '0.8rem', color: GREY, marginBottom: '0.75rem' }}>
            Sponsor logo upload is coming in a future release. Name only for now.
          </div>
          <button onClick={saveReportingConfig} disabled={savingConfig} style={S.btn(NAVY, 'white', savingConfig)}>
            {savingConfig ? 'Saving…' : '✓ Save Branding'}
          </button>
        </div>
      )}
    </div>
  )
}
