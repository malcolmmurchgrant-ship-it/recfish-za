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

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const NAVY = '#1e3a8a'
const GREY = '#6b7280'
const GREEN = '#16a34a'
const RED = '#dc2626'
const ORANGE = '#c2410c'

const S = {
  card:   { background: 'white', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '1rem' },
  label:  { fontSize: '0.78rem', fontWeight: 700, color: GREY, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' },
}

const RECENT_LIMIT = 20

export default function CompetitionAdminVideoReview({ competitionId, isVideoVerifier, onReload }) {
  const { user } = useAuth()
  const [pending, setPending] = useState([])
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [noteDrafts, setNoteDrafts] = useState({})
  const [showRecent, setShowRecent] = useState(false)

  const loadAll = async () => {
    setLoading(true)
    setError('')

    const baseSelect = `
        id, species_name, pending_points, points, video_url, measured_min_size,
        fishing_date, created_at, video_status, verified_at, verification_note,
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
        .limit(RECENT_LIMIT),
    ])

    if (pendingError || recentError) {
      setError('Failed to load: ' + (pendingError?.message || recentError?.message))
    } else {
      setPending(pendingData || [])
      setRecent(recentData || [])
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
    const note = noteDrafts[catchId] || ''

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

    const { error: updateError } = await supabase
      .from('competition_catches')
      .update(updates)
      .eq('id', catchId)

    setBusyId(null)

    if (updateError) {
      setError('Failed to save decision: ' + updateError.message)
      return
    }

    setPending(prev => prev.filter(p => p.id !== catchId))
    if (onReload) onReload()
    loadAll()
  }

  const resetToPending = async (catchId) => {
    setBusyId(catchId)
    setError('')

    const { error: updateError } = await supabase
      .from('competition_catches')
      .update({
        video_status: 'pending',
        points: 0,
        verified_by: null,
        verified_at: null,
        verification_note: null,
      })
      .eq('id', catchId)

    setBusyId(null)

    if (updateError) {
      setError('Failed to reset: ' + updateError.message)
      return
    }

    if (onReload) onReload()
    loadAll()
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
          Review each video, confirm minimum size was met, then decide. Made a wrong call?
          Open "Recently decided" below and use Reset to Pending — that puts it straight
          back in this queue for another look, rather than editing the catch directly.
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
            <video
              src={item.video_url}
              controls
              style={{ width: 260, maxWidth: '100%', borderRadius: 6, background: '#000' }}
            />

            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: NAVY }}>
                {item.competition_participants?.full_name || 'Unknown angler'}
              </div>
              <div style={{ fontSize: '0.85rem', color: GREY, marginBottom: 8 }}>
                {item.competition_teams?.team_name} · {item.competition_boats?.boat_name} · Day {item.competition_days?.day_number}
              </div>

              <span style={S.label}>Species</span>
              <div style={{ marginBottom: 8 }}>{item.species_name}</div>

              <span style={S.label}>Minimum size confirmed at logging</span>
              <div style={{ marginBottom: 8, color: item.measured_min_size ? GREEN : RED, fontWeight: 600 }}>
                {item.measured_min_size ? '✓ Yes' : '✗ Not confirmed'}
              </div>

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

      <div style={{ ...S.card, cursor: 'pointer' }} onClick={() => setShowRecent(s => !s)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, color: NAVY }}>
            Recently decided (last {recent.length})
          </div>
          <div style={{ color: GREY }}>{showRecent ? '▲ Hide' : '▼ Show'}</div>
        </div>
      </div>

      {showRecent && recent.map(item => (
        <div key={item.id} style={{ ...S.card, borderLeft: `4px solid ${item.video_status === 'verified' ? GREEN : RED}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <span style={{
                display: 'inline-block', padding: '0.15rem 0.6rem', borderRadius: 12, fontSize: '0.75rem',
                fontWeight: 700, color: 'white', background: item.video_status === 'verified' ? GREEN : RED, marginRight: 8,
              }}>
                {item.video_status === 'verified' ? '✓ Verified' : '✗ Not Verified'}
              </span>
              <strong>{item.species_name}</strong> — {item.competition_participants?.full_name || 'Unknown angler'}
              <div style={{ fontSize: '0.8rem', color: GREY }}>
                {item.competition_teams?.team_name} · Day {item.competition_days?.day_number} ·{' '}
                {item.points} pts ·{' '}
                {item.verified_at ? new Date(item.verified_at).toLocaleString() : ''}
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
    </div>
  )
}

