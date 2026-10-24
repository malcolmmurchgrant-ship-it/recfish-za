// ─── CompetitionAdminPrizegiving.jsx ─────────────────────────────────────────
// 🏆 Prizegiving tab (CBSC October Tuna Invitational): every prize on the
// TD's Run of Show that the App decides, worked out from the same catch
// records as the Scoreboard, in announcement order - plus a check list of
// anything that makes the result provisional, and a PDF to read from.
// The rules live in utils/invitationalPrizes.js.

import { useEffect, useMemo, useState } from 'react'
import { computeInvitationalPrizes, buildRunOfShow } from '../../utils/invitationalPrizes'
import { divisionLabel } from '../../utils/anglerDivisions'

const NAVY = '#1e3a8a'
const GREY = '#6b7280'
const GREEN = '#16a34a'
const AMBER = '#b45309'

const S = {
  card: { background: 'white', borderRadius: 10, padding: '1rem', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  h: { fontWeight: 700, color: NAVY, fontSize: '1rem', marginBottom: '0.6rem' },
  th: { textAlign: 'left', padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: GREY, borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' },
  td: { padding: '0.45rem 0.5rem', fontSize: '0.85rem', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' },
  btn: (bg) => ({ background: bg, color: 'white', border: 'none', borderRadius: 8, padding: '0.6rem 1.1rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }),
}

export default function CompetitionAdminPrizegiving({ competition, config, catches, participants, teams, boats, days, onReload }) {
  const [upTo, setUpTo] = useState('all')
  const [showFull, setShowFull] = useState(false)
  const [builder, setBuilder] = useState(null)
  const [msg, setMsg] = useState('')
  const [fileUrl, setFileUrl] = useState(null)
  const [fileName, setFileName] = useState('')

  const result = useMemo(() => computeInvitationalPrizes({
    catches, participants, teams, boats, days,
    upToFishingDay: upTo === 'all' ? null : Number(upTo),
    scoringConfig: config?.scoring,
  }), [catches, participants, teams, boats, days, upTo, config])
  const rows = useMemo(() => buildRunOfShow(result), [result])

  // Load the PDF maker up front, so tapping the button works on phones
  // (a download must start straight from the tap).
  useEffect(() => {
    import('../../utils/prizegivingPdf').then(m => setBuilder(() => m.buildPrizegivingPdf))
      .catch(e => setMsg('❌ Could not load the PDF maker: ' + (e.message || e)))
  }, [])
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl) }, [fileUrl])

  const upToLabel = upTo === 'all'
    ? `Results for all ${result.fishedDays.length} fishing day${result.fishedDays.length === 1 ? '' : 's'}`
    : `Results up to Fishing Day ${upTo}`

  const isPhone = typeof navigator !== 'undefined' &&
    (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)))

  const downloadPdf = () => {
    if (!builder) { setMsg('One moment - the PDF maker is still loading. Tap again in a second.'); return }
    let built
    try {
      built = builder({ competitionName: competition?.name, result, upToLabel })
    } catch (e) {
      console.error('Prizegiving PDF failed:', e)
      setMsg('❌ Could not create the PDF: ' + (e.message || e)); return
    }
    const { doc, name } = built
    const blob = doc.output('blob')
    if (fileUrl) URL.revokeObjectURL(fileUrl)
    setFileUrl(URL.createObjectURL(blob)); setFileName(name)
    const done = '✅ Run of Show PDF ready.'
    let file = null
    try { file = new File([blob], name, { type: 'application/pdf' }) } catch { /* old browser */ }
    if (isPhone && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name })
        .then(() => setMsg(done + ' Shared / saved.'))
        .catch(err => {
          if (err?.name === 'AbortError') setMsg(done + ' Use "Open the PDF" below if you still need it.')
          else { doc.save(name); setMsg(done + ' If it does not appear in Downloads, tap "Open the PDF" below.') }
        })
      return
    }
    doc.save(name)
    setMsg(done + (isPhone ? ' If it does not appear in Downloads, tap "Open the PDF" below.' : ' Check your Downloads folder.'))
  }

  const ready = result.warnings.length === 0
  let lastSection = null

  return (
    <div data-testid="prizegiving">
      {/* ── Readiness ─────────────────────────────────────────────────── */}
      <div style={{ ...S.card, borderLeft: `5px solid ${ready ? GREEN : AMBER}` }}>
        <div style={{ ...S.h, color: ready ? GREEN : AMBER }} data-testid="pg-status">
          {ready ? '✅ Ready to announce' : '⚠️ Provisional - check these before announcing'}
        </div>
        {!ready && (
          <ul style={{ margin: '0 0 0.6rem 1.1rem', padding: 0, fontSize: '0.88rem', color: '#374151' }}>
            {result.warnings.map((w, i) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}
          </ul>
        )}
        <div style={{ fontSize: '0.84rem', color: '#374151', lineHeight: 1.6 }}>
          <div>
            <b>Fishing days:</b>{' '}
            {result.fishedDays.length
              ? result.fishedDays.map(d => `Fishing Day ${d.fishingDay} = Day ${d.day_number}${d.date ? ` (${d.date})` : ''}`).join(' · ')
              : 'none recorded yet'}
          </div>
          <div>
            <b>Anglers:</b> {result.counts.anglers} · <b>Ladies:</b> {result.counts.ladies} · <b>Juniors:</b> {result.counts.juniors}
            <span style={{ color: GREY }}> - a lady or junior missing from these counts needs her/his Category set on the Participants tab.</span>
          </div>
          <div>
            <b>Weighed fish:</b> {result.counts.weighed} · <b>Releases:</b> {result.counts.releasesVerified} verified, {result.pendingReleases} pending, {result.counts.releasesNotVerified} not verified
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.8rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#374151' }}>
            Results up to:{' '}
            <select value={upTo} onChange={e => setUpTo(e.target.value)} data-testid="pg-upto"
              style={{ padding: '0.4rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }}>
              <option value="all">All days fished</option>
              {result.fishedDays.map(d => <option key={d.id} value={d.fishingDay}>Fishing Day {d.fishingDay}</option>)}
            </select>
          </label>
          {onReload && <button onClick={onReload} style={S.btn(GREY)}>↻ Refresh</button>}
          <button onClick={downloadPdf} style={S.btn(GREEN)} data-testid="pg-pdf">📄 Run of Show PDF</button>
        </div>
        {msg && <div style={{ marginTop: '0.6rem', fontSize: '0.85rem' }}>{msg}</div>}
        {fileUrl && <a href={fileUrl} download={fileName} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem', color: NAVY, fontWeight: 600 }}>Open the PDF</a>}
      </div>

      {/* ── Run of Show ───────────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={S.h}>Run of Show - {upToLabel}</div>
        <div style={{ fontSize: '0.8rem', color: GREY, marginBottom: '0.6rem' }}>
          In announcement order. "TD" awards are decided by the Tournament Director and are left blank.
          A Daily Biggest Tuna fish wins its prize, and its points are then left out of that angler's totals.
          Most Weighed Fish, Ladies and Top Junior count weighed fish only; release points count only for Catch and Release.
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="pg-table">
            <thead>
              <tr>
                <th style={S.th}>#</th><th style={S.th}>Award</th><th style={S.th}>Winner</th>
                <th style={S.th}>Boat</th><th style={S.th}>Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const header = r.section !== lastSection
                lastSection = r.section
                const e = r.slot?.entries || []
                const isTD = r.decidedBy === 'TD'
                return [
                  header && (
                    <tr key={'h' + r.order}>
                      <td colSpan={5} style={{ ...S.td, background: '#eef2ff', fontWeight: 700, color: NAVY }}>{r.section}</td>
                    </tr>
                  ),
                  <tr key={r.order} data-testid="pg-row">
                    <td style={{ ...S.td, color: GREY }}>{r.order}</td>
                    <td style={S.td}>{r.award || '-'}</td>
                    <td style={S.td}>
                      {isTD ? <span style={{ color: GREY, fontStyle: 'italic' }}>TD decides</span>
                        : e.length ? (
                          <>
                            <b>{e.map(x => x.name).join(' & ')}</b>
                            {r.slot.tied && <span style={{ marginLeft: 6, color: AMBER, fontWeight: 700, fontSize: '0.75rem' }}>TIE - TD decides</span>}
                          </>
                        ) : <span style={{ color: GREY }}>{r.slot?.note || '-'}</span>}
                    </td>
                    <td style={S.td}>{e.map(x => x.boat).filter(Boolean).join(' / ')}</td>
                    <td style={{ ...S.td, fontSize: '0.8rem' }}>
                      {isTD ? (r.reference ? <span style={{ color: GREY }}>App boat average: {r.reference}</span> : '')
                        : e.length ? (
                          <>
                            {e[0].result}
                            {r.section === 'Daily Biggest Tuna' && r.slot?.note && <div style={{ color: GREY }}>{r.slot.note}</div>}
                            {r.section !== 'Daily Biggest Tuna' && e[0].fishingDay && <span style={{ color: GREY }}> · Fishing Day {e[0].fishingDay}</span>}
                            {e[0].detail && !e[0].fishingDay && <div style={{ color: GREY }}>{e[0].detail}</div>}
                          </>
                        ) : ''}
                    </td>
                  </tr>,
                ]
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Supporting lists ──────────────────────────────────────────── */}
      <div style={S.card}>
        <button onClick={() => setShowFull(v => !v)} style={{ background: 'none', border: 'none', color: NAVY, fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.95rem' }}>
          {showFull ? '▾' : '▸'} Full Most Weighed Fish list and boat averages
        </button>
        {showFull && (
          <div style={{ overflowX: 'auto', marginTop: '0.6rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
              <thead><tr>
                <th style={S.th}>Place</th><th style={S.th}>Angler</th><th style={S.th}>Cat.</th><th style={S.th}>Boat</th>
                <th style={S.th}>Weighed</th><th style={S.th}>Daily tuna left out</th><th style={S.th}>Most Weighed pts</th>
                <th style={S.th}>Release pts</th><th style={S.th}>Combined</th>
              </tr></thead>
              <tbody>
                {/* Ranked by Most Weighed Fish (weighed only); anglers with
                    releases but no weighed fish follow, unplaced. */}
                {[...result.weighedRanked, ...result.overallRanked.filter(a => !(a.weighedNet > 0))].map(a => (
                  <tr key={a.participantId}>
                    <td style={S.td}>{a.weighedNet > 0 ? `${a.place}${a.tied ? '=' : ''}` : '-'}</td>
                    <td style={S.td}>{a.name}</td>
                    <td style={S.td}>{divisionLabel(a)}</td>
                    <td style={S.td}>{a.boat}</td>
                    <td style={S.td}>{a.weighedPoints.toFixed(2)}</td>
                    <td style={S.td}>{a.excludedPoints ? '−' + a.excludedPoints.toFixed(2) : ''}</td>
                    <td style={{ ...S.td, fontWeight: 700 }}>{a.weighedNet.toFixed(2)}</td>
                    <td style={S.td}>{a.releasePoints.toFixed(2)}{a.releasesPending ? <span style={{ color: AMBER }}> ({a.releasesPending} pending)</span> : ''}</td>
                    <td style={S.td}>{a.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ ...S.h, fontSize: '0.92rem' }}>Boat averages (for the TD's Top Team / auction decision)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={S.th}>Place</th><th style={S.th}>Boat</th><th style={S.th}>Skipper</th><th style={S.th}>Anglers</th><th style={S.th}>Total</th><th style={S.th}>Average</th>
              </tr></thead>
              <tbody>
                {result.boatRanking.map(b => (
                  <tr key={b.teamId}>
                    <td style={S.td}>{b.place}{b.tied ? '=' : ''}</td>
                    <td style={S.td}>{b.boat}</td>
                    <td style={S.td}>{b.skipper}</td>
                    <td style={S.td}>{b.anglers}</td>
                    <td style={S.td}>{b.total.toFixed(2)}</td>
                    <td style={{ ...S.td, fontWeight: 700 }}>{b.average.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
