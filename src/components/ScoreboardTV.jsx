// ─── ScoreboardTV.jsx ────────────────────────────────────────────────────────
// Big-screen ("TV") display for the public scoreboard.
//
// Shows EVERY angler (or team, or boat) on one screen with no scrolling: the
// list is split into as many columns as needed and the text is sized to fill
// the screen exactly, whatever the screen size and however many entries
// there are. Works for any competition.
//
// It does NO scoring of its own. UniversalScoreboard computes the standings
// (the same arrays its normal tabs show) and passes them in, so the TV can
// never disagree with the Scoreboard.
//
// Opened from the "📺 TV display" button on the Scoreboard, or directly with
//   /scoreboard/<competition id>?tv=1
// Optional:  &view=angler | team | boat | rotate     (default: angler)
//
// The control bar (view, day, rotate, full screen, exit) hides itself after
// a few seconds without mouse movement so the TV shows only the standings,
// and reappears when the mouse moves or the screen is tapped.

import { useState, useEffect, useRef, useLayoutEffect } from 'react'

const NAVY  = '#1e3a8a'
const GOLD  = '#b45309'
const GREEN = '#15803d'
const GREY  = '#6b7280'

const ROTATE_SECONDS = 20
const CONTROLS_HIDE_MS = 6000

const MEDAL_BG = { 1: '#fef08a', 2: '#e5e7eb', 3: '#fed7aa' }
const MEDAL_ICON = { 1: '🥇', 2: '🥈', 3: '🥉' }

// Number formatting matching the normal Scoreboard (en-ZA, 2 decimals)
const fmt2 = (n) => (Number(n) || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Choose the column count and text size that fill the screen best ─────────
// Every entry must fit. For each possible column count, the row height is the
// available height divided by the rows needed (plus one heading row per
// column); text size is limited both by that row height and by how wide a
// column is. The column count giving the LARGEST readable text wins.
// `charsPerRow` is roughly how many characters one full row needs.
export function chooseLayout(count, width, height, charsPerRow) {
  const n = Math.max(1, count)
  let best = { cols: 1, rows: n, font: 0 }
  for (let cols = 1; cols <= 6; cols++) {
    const rows = Math.ceil(n / cols)
    if (cols > 1 && Math.ceil(n / (cols - 1)) === rows) continue // extra column adds nothing
    const rowH = height / (rows + 1)                 // +1 for the heading row
    const colW = width / cols
    const fontByHeight = rowH * 0.56
    const fontByWidth  = colW / (charsPerRow * 0.58)
    const font = Math.min(fontByHeight, fontByWidth, 44)
    if (font > best.font + 0.25) best = { cols, rows, font }
  }
  return { ...best, font: Math.max(8, Math.floor(best.font)) }
}

export default function ScoreboardTV({
  competitionName,
  venue,
  days = [],
  dayFilter,
  onDayFilter,
  lastRefresh,
  anglers = [],
  teams = [],
  boats = [],
  hasTeams,
  hasBoats,
  isSplitBoat,
  catchReleaseFormat,
  initialView = 'angler',
  onExit,
}) {
  const views = [
    { id: 'angler', label: '🎣 Anglers' },
    hasTeams && { id: 'team', label: '🏆 Teams' },
    hasBoats && { id: 'boat', label: '⚓ Boats' },
  ].filter(Boolean)

  const startRotate = initialView === 'rotate'
  const [view, setView] = useState(views.some(v => v.id === initialView) ? initialView : 'angler')
  const [rotate, setRotate] = useState(startRotate && views.length > 1)
  const [showControls, setShowControls] = useState(true)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const bodyRef = useRef(null)
  const hideTimer = useRef(null)

  // Remember the chosen view/rotation in the address bar, so a bookmarked or
  // refreshed TV page comes back exactly as it was set up.
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('tv', '1')
      url.searchParams.set('view', rotate ? 'rotate' : view)
      window.history.replaceState(null, '', url.toString())
    } catch { /* address bar update is a convenience only */ }
  }, [view, rotate])

  // Rotate Anglers → Teams → Boats
  useEffect(() => {
    if (!rotate || views.length < 2) return
    const t = setInterval(() => {
      setView(cur => {
        const i = views.findIndex(v => v.id === cur)
        return views[(i + 1) % views.length].id
      })
    }, ROTATE_SECONDS * 1000)
    return () => clearInterval(t)
  }, [rotate, views.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-hide the control bar
  useEffect(() => {
    const wake = () => {
      setShowControls(true)
      clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setShowControls(false), CONTROLS_HIDE_MS)
    }
    wake()
    window.addEventListener('mousemove', wake)
    window.addEventListener('touchstart', wake)
    window.addEventListener('keydown', wake)
    return () => {
      clearTimeout(hideTimer.current)
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('touchstart', wake)
      window.removeEventListener('keydown', wake)
    }
  }, [])

  // Esc leaves TV mode (when not in browser full screen, where Esc exits that)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !document.fullscreenElement) onExit?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit])

  // Stop the page behind from scrolling while the TV display is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Measure the space available for the standings
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const toggleFullScreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch { /* some TV browsers don't allow it; F11 still works */ }
  }

  // ── Columns for each view ─────────────────────────────────────────────────
  // label, width (fraction of a column), how to read the value, alignment
  const showKg = !catchReleaseFormat
  let rows = []
  let cols = []
  let title = ''
  if (view === 'angler') {
    title = 'Angler Standings'
    rows = anglers
    cols = [
      { key: 'name', label: 'Angler', flex: 3.4, get: r => r.name || '—', strong: true },
      { key: 'team', label: 'Team', flex: 2.6, get: r => r.teamDisplay || r.team || '', muted: true },
      { key: 'fish', label: 'Fish', flex: 0.7, get: r => r.fish, align: 'right', color: GREEN },
      showKg && { key: 'kg', label: 'Kg', flex: 1.3, get: r => fmt2(r.kg), align: 'right', color: GOLD },
      isSplitBoat && { key: 'pct', label: '%', flex: 1.3, get: r => fmt2(r.percentage), align: 'right', color: NAVY, strong: true },
      { key: 'pts', label: 'Points', flex: 1.6, get: r => fmt2(r.points), align: 'right', color: isSplitBoat ? GREY : NAVY, strong: !isSplitBoat },
    ].filter(Boolean)
  } else if (view === 'team') {
    title = 'Team Standings'
    rows = teams
    cols = [
      { key: 'name', label: 'Team', flex: 2.6, get: r => r.displayName || r.name, strong: true },
      { key: 'boat', label: 'Boat · Skipper', flex: 3.6, get: r => [r.boat, r.skipper].filter(Boolean).join(' · '), muted: true },
      { key: 'fish', label: 'Fish', flex: 0.7, get: r => r.fish, align: 'right', color: GREEN },
      showKg && { key: 'kg', label: 'Kg', flex: 1.3, get: r => fmt2(r.kg), align: 'right', color: GOLD },
      isSplitBoat && { key: 'pct', label: '%', flex: 1.3, get: r => fmt2(r.percentage), align: 'right', color: NAVY, strong: true },
      { key: 'pts', label: 'Points', flex: 1.6, get: r => fmt2(r.points), align: 'right', color: isSplitBoat ? GREY : NAVY, strong: !isSplitBoat },
    ].filter(Boolean)
  } else {
    title = 'Boat / Skipper Standings'
    rows = boats
    cols = [
      { key: 'skipper', label: 'Skipper', flex: 2.8, get: r => r.skipper || 'Unknown skipper', strong: true },
      { key: 'boat', label: 'Boat', flex: 2.4, get: r => r.boat || '', muted: true },
      { key: 'fish', label: 'Fish', flex: 0.7, get: r => r.fish, align: 'right', color: GREEN },
      showKg && { key: 'kg', label: 'Kg', flex: 1.3, get: r => fmt2(r.kg), align: 'right', color: GOLD },
      { key: 'pts', label: 'Points', flex: 1.6, get: r => fmt2(r.points), align: 'right', color: NAVY, strong: true },
    ].filter(Boolean)
  }

  // Approximate characters one row needs: position + each column's share
  const charsPerRow = 4 + cols.reduce((s, c) => s + c.flex * 5, 0)
  const layout = chooseLayout(rows.length, size.w, size.h, charsPerRow)
  const rowH = size.h > 0 ? size.h / (layout.rows + 1) : 0
  const columns = Array.from({ length: layout.cols }, (_, ci) =>
    rows.slice(ci * layout.rows, (ci + 1) * layout.rows).map((r, i) => ({ r, pos: ci * layout.rows + i + 1 }))
  ).filter(c => c.length > 0)

  const dayLabel = dayFilter === 'all'
    ? 'All days'
    : (() => { const d = days.find(x => String(x.day_number) === String(dayFilter)); return d ? `Day ${d.day_number}${d.date ? ` — ${d.date}` : ''}` : `Day ${dayFilter}` })()

  const cell = (c) => ({
    flex: c.flex, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    textAlign: c.align || 'left', padding: '0 0.35em',
    fontWeight: c.strong ? 700 : 500,
    color: c.color || (c.muted ? '#4b5563' : '#111827'),
    fontVariantNumeric: 'tabular-nums',
  })

  const ctlBtn = (active) => ({
    background: active ? 'white' : 'rgba(255,255,255,0.12)', color: active ? NAVY : 'white',
    border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, padding: '0.35rem 0.75rem',
    fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap',
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'white', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', cursor: showControls ? 'default' : 'none' }}>

      {/* ── Title bar ─────────────────────────────────────────────────────── */}
      <div style={{ background: NAVY, color: 'white', padding: '0.6vh 1.2vw', display: 'flex', alignItems: 'center', gap: '1.5vw', flexShrink: 0 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 'clamp(16px, 3.2vh, 40px)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{competitionName}</div>
          <div style={{ fontSize: 'clamp(11px, 1.8vh, 22px)', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title} · {dayLabel}{venue ? ` · ${venue}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 'clamp(11px, 1.8vh, 22px)', opacity: 0.9, whiteSpace: 'nowrap' }}>
          {rotate && <div>🔁 {views.find(v => v.id === view)?.label}</div>}
          <div>Updated {lastRefresh ? lastRefresh.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
        </div>
      </div>

      {/* ── Standings: every entry on screen ──────────────────────────────── */}
      <div ref={bodyRef} style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {rows.length === 0 && size.h > 0 && (
          <div style={{ margin: 'auto', color: GREY, fontSize: 'clamp(16px, 3vh, 36px)' }}>No standings yet.</div>
        )}
        {rowH > 0 && columns.map((col, ci) => (
          <div key={ci} style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', borderLeft: ci > 0 ? '3px solid #cbd5e1' : 'none', fontSize: layout.font }}>
            {/* heading row */}
            <div style={{ height: rowH, boxSizing: 'border-box', display: 'flex', alignItems: 'center', background: '#e0e7ff', color: NAVY, fontWeight: 700, fontSize: '0.8em', textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0 }}>
              <div style={{ width: '2.6em', textAlign: 'center', flexShrink: 0 }}>#</div>
              {cols.map(c => (
                <div key={c.key} style={{ ...cell(c), color: NAVY, fontWeight: 700 }}>{c.label}</div>
              ))}
            </div>
            {col.map(({ r, pos }) => (
              <div key={r.id ?? pos} data-tv-row style={{
                height: rowH, boxSizing: 'border-box', display: 'flex', alignItems: 'center', flexShrink: 0,
                background: MEDAL_BG[pos] || (pos % 2 === 0 ? '#f1f5f9' : 'white'),
                borderBottom: '1px solid #e5e7eb',
              }}>
                <div style={{ width: '2.6em', textAlign: 'center', flexShrink: 0, fontWeight: 800, color: '#374151' }}>
                  {MEDAL_ICON[pos] || pos}
                </div>
                {cols.map(c => (
                  <div key={c.key} style={cell(c)}>{c.get(r)}</div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ── Control bar (auto-hides) ──────────────────────────────────────── */}
      <div style={{
        position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)',
        background: 'rgba(17,24,39,0.92)', borderRadius: 10, padding: '0.5rem 0.75rem',
        display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center',
        opacity: showControls ? 1 : 0, pointerEvents: showControls ? 'auto' : 'none',
        transition: 'opacity 0.4s', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', maxWidth: '95vw',
      }}>
        {views.map(v => (
          <button key={v.id} style={ctlBtn(!rotate && view === v.id)} onClick={() => { setRotate(false); setView(v.id) }}>{v.label}</button>
        ))}
        {views.length > 1 && (
          <button style={ctlBtn(rotate)} onClick={() => setRotate(r => !r)} title={`Switch view every ${ROTATE_SECONDS} seconds`}>🔁 Rotate</button>
        )}
        {days.length > 1 && (
          <select value={dayFilter} onChange={e => onDayFilter?.(e.target.value)}
            style={{ padding: '0.35rem 0.5rem', borderRadius: 6, fontSize: '0.9rem', fontWeight: 600 }}>
            <option value="all">All days</option>
            {days.map(d => (
              <option key={d.id} value={d.day_number}>Day {d.day_number}{d.cancelled ? ' (cancelled)' : ''}</option>
            ))}
          </select>
        )}
        <button style={ctlBtn(false)} onClick={toggleFullScreen}>⛶ Full screen</button>
        <button style={ctlBtn(false)} onClick={() => onExit?.()}>✕ Exit TV</button>
      </div>
    </div>
  )
}
