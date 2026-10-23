// ─── CompetitionAdminVideoReview.jsx ───────────────────────────────────────
// Video Review tab — the Video Verifier's queue of pending release
// declarations. Not visible to Tournament Director or Scorer roles, per
// the approved proposal - gated on isVideoVerifier alone in
// CompetitionAdmin/index.jsx, not folded into isAdmin's checks.
//
// Shows every competition_catches row with video_status = 'pending',
// oldest first, with the video, angler/team/boat/day context, and the
// species' min-size confirmation - everything a verifier needs to make
// the call without leaving this screen. Verified applies the real,
// pre-computed pending_points value; Not Verified leaves points at 0.
// Both are permanent decisions from this screen's point of view - see
// UniversalCatchLogger.jsx's videoAlreadyDecided handling, which respects
// whatever gets set here and never silently resets it.
//
// Evidence trail: every decided release stays listed under "Decided" (all of
// them, not just the latest), with its video playable in place, who decided,
// when, and the note. Reset to Pending asks for a reason and keeps the earlier
// decision in the catch's verification note as history - it never erases it.
// Videos are never deleted by the app.

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import VideoUpload from '../VideoUpload'

const NAVY = '#1e3a8a'
const GREY = '#6b7280'
const GREEN = '#16a34a'
const RED = '#dc2626'
const ORANGE = '#c2410c'

const S = {
  card:   { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '1rem' },
  label:  { fontSize: '0.78rem', fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' },
}

// ─── Review player ────────────────────────────────────────────────────────────
// Shows a release video at its real shape: wide for landscape clips (anglers
// are asked to film landscape), narrower for portrait ones, with a label
// saying which the file actually is. "Rotate" turns the picture a quarter
// turn on screen for a clip that plays sideways (a phone that saved the
// wrong orientation); it never changes the stored file.
function ReviewVideo({ src, autoPlay = false, testId }) {
  const [dims, setDims] = useState(null)   // { w, h } from the file itself
  const [rot, setRot] = useState(0)        // 0, 90, 180, 270 degrees on screen
  const sideways = rot % 180 !== 0
  const shownW = dims ? (sideways ? dims.h : dims.w) : 16
  const shownH = dims ? (sideways ? dims.w : dims.h) : 9
  const landscape = shownW >= shownH
  const fileShape = !dims ? '' : dims.w > dims.h ? 'Landscape' : dims.w < dims.h ? 'Portrait' : 'Square'

  return (
    <div style={{ width: landscape ? 'min(100%, 640px)' : 'min(100%, 340px)' }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: `${shownW} / ${shownH}`, background: '#000', borderRadius: 6, overflow: 'hidden' }}>
        <video
          src={src}
          controls
          autoPlay={autoPlay}
          playsInline
          preload="metadata"
          data-testid={testId}
          onLoadedMetadata={e => {
            const v = e.currentTarget
            if (v.videoWidth && v.videoHeight) setDims({ w: v.videoWidth, h: v.videoHeight })
          }}
          style={sideways && dims
            ? { position: 'absolute', top: '50%', left: '50%',
                width: `${(dims.w / dims.h) * 100}%`, height: `${(dims.h / dims.w) * 100}%`,
                transform: `translate(-50%, -50%) rotate(${rot}deg)`, objectFit: 'contain', background: '#000' }
            : { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
                transform: rot ? `rotate(${rot}deg)` : undefined, background: '#000' }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 4, fontSize: '0.75rem', color: GREY, flexWrap: 'wrap' }}>
        {fileShape && <span data-testid="video-shape">{fileShape === 'Landscape' ? '▭' : fileShape === 'Portrait' ? '▯' : '□'} {fileShape} video{dims ? ` (${dims.w}×${dims.h})` : ''}</span>}
        <button type="button" onClick={() => setRot(r => (r + 90) % 360)} data-testid="video-rotate"
          style={{ marginLeft: 'auto', background: 'white', border: '1px solid #d1d5db', borderRadius: 6, padding: '0.2rem 0.55rem', cursor: 'pointer', fontSize: '0.75rem', color: '#374151' }}>
          ⟳ Rotate
        </button>
        {rot !== 0 && (
          <button type="button" onClick={() => setRot(0)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: GREY, textDecoration: 'underline' }}>
            Reset
          </button>
        )}
      </div>
    </div>
  )
}

export default function CompetitionAdminVideoReview({ competitionId, isVideoVerifier, onReload }) {
  const { user } = useAuth()
  const [pending, setPending] = useState([])
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [noteDrafts, setNoteDrafts] = useState({})
  const [showRecent, setShowRecent] = useState(false)
  const [names, setNames] = useState({})          // user id -> name, for "decided by"
  const [statusFilter, setStatusFilter] = useState('all')
  const [dayFilter, setDayFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [openVideo, setOpenVideo] = useState(null) // id of the decided release whose video is open

  const myName = user?.user_metadata?.full_name || user?.email || 'Video Verifier'
  const nameOf = (id) => !id ? '' : id === user?.id ? myName : (names[id] || 'another verifier')
  const fmtWhen = (iso) => { try { return new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }

  const loadAll = async () => {
    setLoading(true)
    setError('')

    const baseSelect = `
        id, species_name, pending_points, points, video_url, measured_min_size,
        fishing_date, created_at, video_status, verified_at, verified_by, verification_note,
        competition_participants ( full_name ),
        competition_teams ( team_name ),
        competition_boats ( boat_name ),
        competition_days ( day_number )
      `

    const [{ data: pendingData, error: pendingError }, { data: recentData, error: recentError }] = await Promise.all([
      supabase
        .from('competition_catches')
        .select(baseSelect)
        .eq('competition_id', competitionId)
        .eq('video_status', 'pending')
        .order('created_at', { ascending: true }),
      supabase
        .from('competition_catches')
        .select(baseSelect)
        .eq('competition_id', competitionId)
        .in('video_status', ['verified', 'not_verified'])
        .order('verified_at', { ascending: false })
        .range(0, 4999),
    ])

    if (pendingError || recentError) {
      setError('Failed to load: ' + (pendingError?.message || recentError?.message))
    } else {
      setPending(pendingData || [])
      setRecent(recentData || [])
      // Names of whoever decided. Owners/admins can look these up; anyone
      // else sees their own name and "another verifier" for the rest.
      const ids = [...new Set((recentData || []).map(r => r.verified_by).filter(Boolean))]
      if (ids.length) {
        const { data: users } = await supabase.rpc('lookup_users_by_ids', { lookup_ids: ids })
        if (Array.isArray(users)) setNames(Object.fromEntries(users.map(u => [u.id, u.full_name || u.email])))
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    if (competitionId && isVideoVerifier) loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId, isVideoVerifier])

  const decide = async (catchId, decision) => {
    setBusyId(catchId)
    setError('')

    const item = pending.find(p => p.id === catchId)
    // Keep any history left by an earlier Reset to Pending under the new note.
    const history = (item?.verification_note || '').trim()
    const note = [String(noteDrafts[catchId] || '').trim(), history].filter(Boolean).join('\n')

    // pending_points is deliberately left as-is here, not cleared to null
    // - keeping the real computed value around means a wrongly-decided
    // catch can be reset back to pending later without needing to
    // re-derive it from species_config, which would be ambiguous (see
    // the earlier duplicate-species-name issue).
    const updates = decision === 'verified'
      ? {
          points: item.pending_points ?? 0,
          video_status: 'verified',
          verified_by: user.id,
          verified_at: new Date().toISOString(),
          verification_note: note || null,
        }
      : {
          points: 0,
          video_status: 'not_verified',
          verified_by: user.id,
          verified_at: new Date().toISOString(),
          verification_note: note || null,
        }

    // .select('id') returns the rows actually changed: the database's row
    // security can skip an update without an error, and a decision that
    // wasn't stored must never look as if it was.
    const { data: changed, error: updateError } = await supabase
      .from('competition_catches')
      .update(updates)
      .eq('id', catchId)
      .select('id')

    setBusyId(null)

    if (updateError) {
      setError('Failed to save decision: ' + updateError.message)
      return
    }
    if (!changed || changed.length === 0) {
      setError('Decision NOT saved: the database did not allow this change. The release is still pending — please tell the organiser.')
      return
    }

    setPending(prev => prev.filter(p => p.id !== catchId))
    if (onReload) onReload()
    loadAll()
  }

  const resetToPending = async (catchId) => {
    const item = recent.find(r => r.id === catchId)
    const reason = window.prompt('Why is this release going back to Pending? (kept in its record)')
    if (reason === null) return
    if (!reason.trim()) { setError('Please give a reason for resetting - it is kept as part of the record.'); return }
    setBusyId(catchId)
    setError('')
    const was = item?.video_status === 'verified' ? 'Verified' : 'Not Verified'
    const entry = `[Reset to Pending ${fmtWhen(new Date().toISOString())} by ${myName}: ${reason.trim()}. ` +
      `Was ${was} by ${nameOf(item?.verified_by)} on ${fmtWhen(item?.verified_at)}` +
      `${item?.verification_note ? ` - note: ${item.verification_note}` : ''}]`

    const { data: changed, error: updateError } = await supabase
      .from('competition_catches')
      .update({
        video_status: 'pending',
        points: 0,
        verified_by: null,
        verified_at: null,
        verification_note: entry,
      })
      .eq('id', catchId)
      .select('id')

    setBusyId(null)

    if (updateError) {
      setError('Failed to reset: ' + updateError.message)
      return
    }
    if (!changed || changed.length === 0) {
      setError('Reset NOT saved: the database did not allow this change. The decision stands.')
      return
    }

    if (onReload) onReload()
    loadAll()
  }

  // The Video Verifier attaches a video they received outside the app (e.g.
  // by WhatsApp) to a pending release, so it is kept with the catch record.
  // Optional - verifying does not require it.
  const attachVideo = async (catchId, result) => {
    if (!result?.videoUrl) return
    setError('')
    const { data: changed, error: updateError } = await supabase
      .from('competition_catches')
      .update({ video_url: result.videoUrl })
      .eq('id', catchId)
      .select('id')
    if (updateError || !changed || changed.length === 0) {
      setError('Video uploaded but NOT linked to the catch' + (updateError ? ': ' + updateError.message : ' (the database did not allow the change).') + ' You can still verify from WhatsApp.')
      return
    }
    setPending(prev => prev.map(p => p.id === catchId ? { ...p, video_url: result.videoUrl } : p))
  }

  const loggedAt = (iso) => {
    if (!iso) return ''
    try { return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
  }

  if (!isVideoVerifier) {
    return (
      <div style={{ ...S.card, textAlign: 'center', color: GREY }}>
        You do not have Video Verifier access on this competition.
      </div>
    )
  }

  if (loading) {
    return <div style={{ ...S.card, textAlign: 'center', color: GREY }}>Loading pending releases…</div>
  }

  return (
    <div>
      <div style={{ ...S.card, background: '#fff7ed', borderLeft: `4px solid ${ORANGE}` }}>
        <div style={{ fontWeight: 700, color: ORANGE, marginBottom: 4 }}>
          {pending.length} pending release{pending.length === 1 ? '' : 's'}
        </div>
        <div style={{ fontSize: '0.85rem', color: GREY }}>
          Review each release's video — in the app if one is attached, otherwise the one
          sent to you (e.g. by WhatsApp) — judge whether the fish met the minimum size, then decide. Made a wrong call?
          Open "Decided releases" below and use Reset to Pending (with a reason) — that puts it
          back in this queue for another look. The earlier decision is kept in its history.
        </div>
      </div>

      {error && (
        <div style={{ ...S.card, background: '#fee2e2', color: '#991b1b' }}>{error}</div>
      )}

      {pending.length === 0 && !error && (
        <div style={{ ...S.card, textAlign: 'center', color: GREY }}>
          Nothing waiting for review right now.
        </div>
      )}

      {pending.map(item => (
        <div key={item.id} style={S.card}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {item.video_url ? (
              <ReviewVideo src={item.video_url} />
            ) : (
              <div style={{ width: 260, maxWidth: '100%', borderRadius: 6, background: '#f8fafc', border: '2px dashed #cbd5e1', padding: '0.9rem', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: '0.85rem', color: '#374151' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>📱 No video in the app</div>
                  Check the video sent to you (e.g. on WhatsApp), matching it by angler, boat, day and the time logged.
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: GREY, marginBottom: 4 }}>Optional: keep it with this catch</div>
                  <VideoUpload
                    label='Attach video from phone'
                    onVideoUploaded={result => attachVideo(item.id, result)}
                  />
                </div>
              </div>
            )}

            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: NAVY }}>
                {item.competition_participants?.full_name || 'Unknown angler'}
              </div>
              <div style={{ fontSize: '0.85rem', color: GREY, marginBottom: 8 }}>
                {item.competition_teams?.team_name} · {item.competition_boats?.boat_name} · Day {item.competition_days?.day_number}
                {item.created_at && <> · Logged {loggedAt(item.created_at)}</>}
              </div>

              <span style={S.label}>Species</span>
              <div style={{ marginBottom: 8 }}>{item.species_name}</div>

              {/* Size can't be checked at the scales for a released fish, so it is
                  part of the verifier's judgement from the video. Older releases
                  that the scorer did confirm still show that. */}
              <span style={S.label}>Minimum size</span>
              <div style={{ marginBottom: 8, color: item.measured_min_size ? GREEN : '#374151', fontWeight: 600 }}>
                {item.measured_min_size ? '✓ Confirmed by scorer at logging' : '👁 Judge from the video — if it looks under the minimum, choose Not Verified'}
              </div>

              {item.verification_note && (
                <div style={{ fontSize: '0.78rem', color: ORANGE, background: '#fff7ed', borderRadius: 6, padding: '0.4rem 0.55rem', marginBottom: 8, whiteSpace: 'pre-line' }}>
                  <strong>History:</strong> {item.verification_note}
                </div>
              )}

              <span style={S.label}>Points if verified</span>
              <div style={{ marginBottom: 12, fontWeight: 700, fontSize: '1.1rem', color: NAVY }}>
                {item.pending_points ?? 0} pts
              </div>

              <textarea
                placeholder="Optional note (visible in this catch's record either way)"
                value={noteDrafts[item.id] || ''}
                onChange={e => setNoteDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                style={{ width: '100%', minHeight: 50, padding: '0.4rem 0.5rem', fontSize: '0.85rem', borderRadius: 6, border: '1px solid #d1d5db', marginBottom: 10 }}
              />

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => decide(item.id, 'verified')}
                  disabled={busyId === item.id}
                  style={{
                    flex: 1, background: GREEN, color: 'white', border: 'none', borderRadius: 6,
                    padding: '0.6rem 1rem', fontWeight: 700, cursor: busyId === item.id ? 'not-allowed' : 'pointer',
                  }}
                >
                  ✓ Verified
                </button>
                <button
                  onClick={() => decide(item.id, 'not_verified')}
                  disabled={busyId === item.id}
                  style={{
                    flex: 1, background: RED, color: 'white', border: 'none', borderRadius: 6,
                    padding: '0.6rem 1rem', fontWeight: 700, cursor: busyId === item.id ? 'not-allowed' : 'pointer',
                  }}
                >
                  ✗ Not Verified
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      <div style={{ ...S.card, cursor: 'pointer' }} onClick={() => setShowRecent(s => !s)} data-testid="decided-toggle">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, color: NAVY }}>
            Decided releases ({recent.length}) — {recent.filter(r => r.video_status === 'verified').length} verified · {recent.filter(r => r.video_status === 'not_verified').length} not verified
          </div>
          <div style={{ color: GREY }}>{showRecent ? '▲ Hide' : '▼ Show'}</div>
        </div>
      </div>

      {showRecent && (() => {
        const days = [...new Set(recent.map(r => r.competition_days?.day_number).filter(Boolean))].sort((a, b) => a - b)
        const q = search.trim().toLowerCase()
        const shown = recent.filter(r =>
          (statusFilter === 'all' || r.video_status === statusFilter) &&
          (dayFilter === 'all' || String(r.competition_days?.day_number) === dayFilter) &&
          (!q || [r.competition_participants?.full_name, r.competition_teams?.team_name, r.competition_boats?.boat_name, r.species_name]
                  .some(v => (v || '').toLowerCase().includes(q))))
        const ctl = { padding: '0.45rem 0.55rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }
        return (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={ctl} data-testid="decided-status">
                <option value="all">All decisions</option>
                <option value="verified">Verified</option>
                <option value="not_verified">Not Verified</option>
              </select>
              <select value={dayFilter} onChange={e => setDayFilter(e.target.value)} style={ctl}>
                <option value="all">All days</option>
                {days.map(d => <option key={d} value={String(d)}>Day {d}</option>)}
              </select>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Angler, boat, team or species…" style={{ ...ctl, flex: 1, minWidth: 180 }} data-testid="decided-search" />
            </div>
            {shown.length === 0 && <div style={{ ...S.card, textAlign: 'center', color: GREY }}>No decided releases match.</div>}
            {shown.map(item => (
              <div key={item.id} data-testid="decided-item" style={{ ...S.card, borderLeft: `4px solid ${item.video_status === 'verified' ? GREEN : RED}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <span style={{
                      display: 'inline-block', padding: '0.15rem 0.6rem', borderRadius: 12, fontSize: '0.75rem',
                      fontWeight: 700, color: 'white', background: item.video_status === 'verified' ? GREEN : RED, marginRight: 8,
                    }}>
                      {item.video_status === 'verified' ? '✓ Verified' : '✗ Not Verified'}
                    </span>
                    <strong>{item.species_name}</strong> — {item.competition_participants?.full_name || 'Unknown angler'}
                    <div style={{ fontSize: '0.8rem', color: GREY, marginTop: 2 }}>
                      {item.competition_teams?.team_name} · {item.competition_boats?.boat_name} · Day {item.competition_days?.day_number} · {item.points} pts
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#374151', marginTop: 4 }} data-testid="decided-by">
                      Decided by <strong>{nameOf(item.verified_by)}</strong>{item.verified_at ? ` · ${fmtWhen(item.verified_at)}` : ''}
                    </div>
                    {item.verification_note && (
                      <div style={{ fontSize: '0.8rem', color: '#374151', background: '#f9fafb', borderRadius: 6, padding: '0.4rem 0.55rem', marginTop: 6, whiteSpace: 'pre-line' }}>
                        <strong>Note:</strong> {item.verification_note}
                      </div>
                    )}
                    <div style={{ marginTop: 8 }}>
                      {item.video_url ? (
                        openVideo === item.id ? (
                          <ReviewVideo src={item.video_url} autoPlay testId="decided-video" />
                        ) : (
                          <button onClick={() => setOpenVideo(item.id)} data-testid="decided-watch"
                            style={{ background: NAVY, color: 'white', border: 'none', borderRadius: 6, padding: '0.4rem 0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                            ▶ Watch video
                          </button>
                        )
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: GREY }}>📱 No video in the app (checked from WhatsApp)</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => resetToPending(item.id)}
                    disabled={busyId === item.id}
                    style={{
                      background: ORANGE, color: 'white', border: 'none', borderRadius: 6,
                      padding: '0.5rem 0.9rem', fontWeight: 700, cursor: busyId === item.id ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ↺ Reset to Pending
                  </button>
                </div>
              </div>
            ))}
          </>
        )
      })()}
    </div>
  )
}

