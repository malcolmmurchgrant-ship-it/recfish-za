// ─── CompetitionHistory.jsx ──────────────────────────────────────────────────
// My Catches → Competition History, organised for nominations:
//   discipline tabs  →  summary card  →  outstanding catches  →  by year
// (most recent year first) → competitions → catches.
// Grouping and ranking rules live in src/utils/catchDisciplines.js.

import { useEffect, useMemo, useState } from 'react'
import {
  DISCIPLINE_BY_KEY, splitByDiscipline, orderedDisciplines, summarise,
  outstandingCatches, groupByYearAndCompetition,
} from '../utils/catchDisciplines'

const NAVY = '#1e3a8a'
const GOLD = '#92400e'
const TAB_KEY = 'recfish.myCatches.discipline'

const fmtDate = (d, opts) => (d ? new Date(d).toLocaleDateString('en-ZA', opts) : '')
const kg = v => `${Number(v).toLocaleString('en-ZA', { maximumFractionDigits: 2 })} kg`
const pts = v => `${Number(v).toLocaleString('en-ZA', { maximumFractionDigits: 2 })} pts`

function readTab() { try { return localStorage.getItem(TAB_KEY) } catch { return null } }
function saveTab(k) { try { localStorage.setItem(TAB_KEY, k) } catch { /* ignore */ } }

// ── One catch ────────────────────────────────────────────────────────────────
function CatchRow({ c, showCompetition, rank }) {
  return (
    <div style={{ padding: '0.8rem 1.1rem', borderTop: '1px solid #f3f4f6', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
      {rank != null && (
        <div style={{ minWidth: 26, height: 26, borderRadius: 13, background: rank <= 3 ? '#fde68a' : '#f3f4f6',
          color: rank <= 3 ? GOLD : '#4b5563', fontWeight: 800, fontSize: '0.8rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{rank}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.98rem' }}>{c.species_name || 'Unknown species'}</span>
          {c.retained === false && (
            <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', background: '#d1fae5', color: '#065f46', borderRadius: 10, fontWeight: 600 }}>
              🏷 Tag &amp; release
            </span>
          )}
          {c.angler_verified && (
            <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', background: '#ede9fe', color: '#5b21b6', borderRadius: 10, fontWeight: 500 }}>
              ✓ Angler verified
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.9rem', fontSize: '0.83rem', color: '#374151', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          {Number(c.weight_kg) > 0 && <span><strong>{kg(c.weight_kg)}</strong></span>}
          {Number(c.length_cm) > 0 && <span>{c.length_cm} cm</span>}
          {Number(c.line_class_kg) > 0 && <span>Line {c.line_class_kg} kg</span>}
          {Number(c.points) > 0 && <span style={{ color: '#d97706', fontWeight: 700 }}>★ {pts(c.points)}</span>}
          {c.fishing_date && (
            <span style={{ color: '#6b7280' }}>
              {c.day?.day_number ? `Day ${c.day.day_number} · ` : ''}{fmtDate(c.fishing_date, { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
        {showCompetition && c.competition?.name && (
          <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.2rem' }}>🏆 {c.competition.name}</div>
        )}
        {c.notes && <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic' }}>"{c.notes}"</div>}
      </div>
    </div>
  )
}

// ── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({ discipline, s }) {
  const d = DISCIPLINE_BY_KEY[discipline]
  const showReleases = discipline === 'gamefish' || discipline.startsWith('billfish')
  const stat = (label, value, sub) => (
    <div style={{ flex: '1 1 120px', minWidth: 110 }}>
      <div style={{ fontSize: '0.72rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: NAVY, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{sub}</div>}
    </div>
  )
  return (
    <div data-testid="summary" style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '1rem 1.1rem', marginBottom: '1rem', borderTop: `4px solid ${NAVY}` }}>
      <div style={{ fontWeight: 800, color: NAVY, fontSize: '1.05rem', marginBottom: '0.75rem' }}>
        {d?.icon} {d?.label || 'All disciplines'} — summary
        {s.firstYear && <span style={{ fontWeight: 500, color: '#6b7280', fontSize: '0.85rem' }}> · {s.firstYear === s.lastYear ? s.lastYear : `${s.firstYear}–${s.lastYear}`}</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9rem 1.25rem' }}>
        {stat('Competitions', s.competitions)}
        {stat('Catches', s.catches)}
        {stat('Points', s.points.toLocaleString('en-ZA'))}
        {stat('Species', s.species)}
        {showReleases && stat('Tag & release', s.releases)}
        {s.heaviest && stat('Heaviest', kg(s.heaviest.weight_kg), s.heaviest.species_name)}
        {!showReleases && s.topScore && stat('Best score', pts(s.topScore.points), s.topScore.species_name)}
      </div>
      {s.years.length > 0 && (
        <div style={{ marginTop: '0.85rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {s.years.map(([y, n], i) => (
            <span key={y} style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem', borderRadius: 12,
              background: i === 0 ? '#dbeafe' : '#f3f4f6', color: i === 0 ? NAVY : '#374151', fontWeight: i === 0 ? 700 : 500 }}>
              {y}: {n} catch{n === 1 ? '' : 'es'}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Competition card (collapsible) ───────────────────────────────────────────
function CompetitionCard({ group, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const comp = group.competition || {}
  const total = group.catches.reduce((n, c) => n + (Number(c.points) || 0), 0)
  return (
    <div style={{ background: 'white', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '0.6rem' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ width: '100%', textAlign: 'left', background: NAVY, color: 'white', border: 'none', cursor: 'pointer',
          padding: '0.75rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{comp.name || 'Unknown competition'}</div>
          <div style={{ fontSize: '0.78rem', color: '#93c5fd', marginTop: '0.1rem' }}>
            {comp.venue && `📍 ${comp.venue}`}{comp.start_date && ` · ${fmtDate(comp.start_date, { month: 'long', year: 'numeric' })}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ background: '#fef3c7', color: GOLD, borderRadius: 12, padding: '0.2rem 0.65rem', fontSize: '0.78rem', fontWeight: 700 }}>
            {group.catches.length} catch{group.catches.length === 1 ? '' : 'es'}{total > 0 ? ` · ${pts(total)}` : ''}
          </span>
          <span style={{ fontSize: '0.9rem' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && group.catches.map(c => <CatchRow key={c.id} c={c} />)}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function CompetitionHistory({ catches, facets = [] }) {
  const split = useMemo(() => splitByDiscipline(catches), [catches])
  const tabs = useMemo(() => orderedDisciplines(split, facets), [split, facets])
  const [tab, setTab] = useState(() => readTab())

  // Fall back to the first available tab if the remembered one has no catches.
  const active = tab === 'all' || tabs.some(t => t.key === tab) ? tab : (tabs[0]?.key || 'all')
  useEffect(() => { if (active) saveTab(active) }, [active])

  const list = active === 'all' ? Object.values(split).flat() : (split[active] || [])
  const summary = useMemo(() => summarise(list), [list])
  const top = useMemo(() => (active === 'all' ? [] : outstandingCatches(list, active, 10)), [list, active])
  const years = useMemo(() => groupByYearAndCompetition(list), [list])

  const tabBtn = (key, label, count) => (
    <button key={key} type="button" onClick={() => setTab(key)} data-tab={key}
      style={{ padding: '0.5rem 0.85rem', borderRadius: 20, border: `1.5px solid ${active === key ? NAVY : '#d1d5db'}`,
        background: active === key ? NAVY : 'white', color: active === key ? 'white' : '#374151',
        fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {label} <span style={{ opacity: 0.75, fontWeight: 600 }}>({count})</span>
    </button>
  )

  return (
    <div>
      {/* Discipline tabs */}
      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {tabs.map(t => tabBtn(t.key, `${t.icon} ${t.short}`, split[t.key].length))}
        {tabs.length > 1 && tabBtn('all', 'All', Object.values(split).reduce((n, l) => n + l.length, 0))}
      </div>

      <SummaryCard discipline={active === 'all' ? 'all' : active} s={summary} />

      {/* Outstanding catches */}
      {top.length > 0 && (
        <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '1.25rem', border: '2px solid #fcd34d' }}>
          <div style={{ padding: '0.75rem 1.1rem', background: '#fffbeb', fontWeight: 800, color: GOLD, fontSize: '0.95rem' }}>
            🏅 Outstanding catches — top {top.length}
            <div style={{ fontWeight: 500, fontSize: '0.75rem', color: '#a16207', marginTop: '0.15rem' }}>
              {active === 'tuna' ? 'Ranked by points (weight scored for line class)'
                : active === 'bottomfish' || active === 'other' ? 'Ranked by points, then weight'
                : 'Released billfish first, then by weight'}
              {' '}· for Section 15 of the nomination form
            </div>
          </div>
          {top.map((c, i) => <CatchRow key={c.id} c={c} rank={i + 1} showCompetition />)}
        </div>
      )}

      {/* By year, newest first */}
      {years.map((y, yi) => (
        <div key={y.year} style={{ marginBottom: '1.1rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', margin: '0 0 0.5rem 0.1rem' }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: NAVY }}>{y.year}</span>
            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              {y.competitions.length} competition{y.competitions.length === 1 ? '' : 's'} · {y.competitions.reduce((n, g) => n + g.catches.length, 0)} catches
            </span>
          </div>
          {y.competitions.map((g, gi) => (
            <CompetitionCard key={(g.competition?.id || g.competition?.name || gi) + active}
              group={g} defaultOpen={yi === 0 && gi === 0 && g.catches.length <= 15} />
          ))}
        </div>
      ))}
    </div>
  )
}
