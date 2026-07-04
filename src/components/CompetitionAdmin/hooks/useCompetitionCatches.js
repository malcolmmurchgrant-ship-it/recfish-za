// ─── useCompetitionCatches ───────────────────────────────────────────────────
// Loads all catches for a competition, with filtering and update helpers.
// Reads from competition_catches (universal table).

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'

export function useCompetitionCatches(competitionId) {
  const [catches,  setCatches]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const load = useCallback(async () => {
    if (!competitionId) return
    setLoading(true)
    setError(null)
    try {
      // Load catches with teams (direct FK exists)
      // Participants joined separately since angler_id → auth.users not competition_participants
      const { data, error: err } = await supabase
        .from('competition_catches')
        .select(`
          *,
          competition_teams ( id, team_name, province, team_type, team_suffix ),
          competition_days ( id, day_number, date, session_status )
        `)
        .eq('competition_id', competitionId)
        .order('created_at', { ascending: false })

      if (err) throw err
      setCatches(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [competitionId])

  useEffect(() => { load() }, [load])

  // Update a single catch (scorer edit)
  async function updateCatch(catchId, updates) {
    const { error: err } = await supabase
      .from('competition_catches')
      .update({ ...updates, scored_at: new Date().toISOString() })
      .eq('id', catchId)
    if (err) throw err
    await load()
  }

  // Soft-delete by setting data_quality = 'rejected'
  async function rejectCatch(catchId, reason) {
    await updateCatch(catchId, {
      data_quality: 'rejected',
      notes: reason,
    })
  }

  // Mark catch as verified
  async function verifyCatch(catchId, verifierId) {
    await updateCatch(catchId, {
      data_quality:        'verified',
      angler_verified:     true,
      angler_verified_at:  new Date().toISOString(),
      entered_by:          verifierId,
    })
  }

  // Mark angler as DQ — zeroes points but retains catch data
  async function disqualifyAngler(participantId, reason) {
    // Registered anglers' catches are matched by angler_id (== user_id);
    // unregistered anglers (no RecFish ZA account — the common case here,
    // e.g. every junior angler in this competition) have angler_id = null
    // and are matched by participant_id instead. The previous version only
    // ever filtered on angler_id, so disqualifying an unregistered angler
    // silently updated zero rows — the DQ button would appear to succeed
    // but nothing would actually change on the scoreboard.
    const { data: participant, error: pErr } = await supabase
      .from('competition_participants')
      .select('id, user_id')
      .eq('id', participantId)
      .single()
    if (pErr) throw pErr

    let query = supabase
      .from('competition_catches')
      .update({
        data_quality: 'disqualified',
        scoring:      false,
        notes:        reason,
      })
      .eq('competition_id', competitionId)

    query = participant.user_id
      ? query.eq('angler_id', participant.user_id)
      : query.eq('participant_id', participant.id)

    const { error: err } = await query
    if (err) throw err
    await load()
  }

  // Filtered helpers
  function catchesByDay(dayNumber) {
    return catches.filter(c => c.competition_days?.day_number === dayNumber)
  }

  function catchesByParticipant(participantId) {
    // Matches either identifier — angler_id only lines up with a
    // registered angler's user_id, participant_id always lines up with
    // competition_participants.id regardless of registration status.
    return catches.filter(c => c.participant_id === participantId || c.angler_id === participantId)
  }

  function catchesByTeam(teamId) {
    return catches.filter(c => c.team_id === teamId)
  }

  // Summary stats
  const stats = {
    total:        catches.length,
    verified:     catches.filter(c => c.data_quality === 'verified').length,
    unverified:   catches.filter(c => c.data_quality === 'unverified').length,
    disqualified: catches.filter(c => c.data_quality === 'disqualified').length,
    rejected:     catches.filter(c => c.data_quality === 'rejected').length,
  }

  return {
    catches,
    loading,
    error,
    stats,
    reload:                load,
    updateCatch,
    rejectCatch,
    verifyCatch,
    disqualifyAngler,
    catchesByDay,
    catchesByParticipant,
    catchesByTeam,
  }
}
