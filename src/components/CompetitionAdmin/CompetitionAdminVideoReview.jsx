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

export default function CompetitionAdminVideoReview({ competitionId, isVideoVerifier, onReload }) {
  const { user } = useAuth()
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [noteDrafts, setNoteDrafts] = useState({})

  const loadPending = async () => {
    setLoading(true)
    setError('')
    const { data, error: fetchError } = await supabase
      .from('competition_catches')
      .select(`
        id, species_name, pending_points, video_url, measured_min_size,
        fishing_date, created_at,
        competition_participants ( full_name ),
        competition_teams ( team_name ),
        competition_boats ( boat_name ),
        competition_days ( day_number )
      `)
      .eq('competition_id', competitionId)
      .eq('video_status', 'pending')
      .order('created_at', { ascending: true })

    if (fetchError) {
      setError('Failed to load pending releases: ' + fetchError.message)
    } else {
      setPending(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (competitionId && isVideoVerifier) loadPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId, isVideoVerifier])

  const decide = async (catchId, decision) => {
    setBusyId(catchId)
    setError('')

    const item = pending.find(p => p.id === catchId)
    const note = noteDrafts[catchId] || ''

    const updates = decision === 'verified'
      ? {
          points: item.pending_points ?? 0,
          video_status: 'verified',
          verified_by: user.id,
          verified_at: new Date().toISOString(),
          verification_note: note || null,
          pending_points: null,
        }
      : {
          points: 0,
          video_status: 'not_verified',
          verified_by: user.id,
          verified_at: new Date().toISOString(),
          verification_note: note || null,
          pending_points: null,
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
          Review each video, confirm minimum size was met, then decide. A decision here is
          final for this catch — the scorer re-saving that angler's card afterwards will
          not change or reset it.
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
    </div>
  )
}
