// ─── useCatchLoggerData ──────────────────────────────────────────────────────
// Loads everything UniversalCatchLogger needs: participants (with teams/boats),
// competition_days, and — once an angler is selected — that angler's existing
// competition_catches rows for the selected day (hydrates the draft card).
//
// This is intentionally separate from useCompetitionCatches (the admin hook):
// that hook exposes verify/reject/disqualify actions that are admin-only and
// loads ALL catches for the competition. The angler-facing logger only ever
// needs one angler's rows for one day, loaded/saved on demand.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'

export function useCatchLoggerData(competitionId) {
  const [participants, setParticipants] = useState([])
  const [days,          setDays]         = useState([])
  const [boats,         setBoats]        = useState([])
  const [boatDraws,     setBoatDraws]    = useState([])
  const [loadingMeta,   setLoadingMeta]  = useState(true)
  const [metaError,     setMetaError]    = useState(null)

  useEffect(() => {
    if (!competitionId) return
    loadMeta()
  }, [competitionId])

  async function loadMeta() {
    setLoadingMeta(true)
    setMetaError(null)
    try {
      const [
        { data: parts, error: partsErr },
        { data: ds,    error: daysErr  },
        { data: bts,   error: boatsErr },
        { data: bd,    error: bdErr    },
      ] = await Promise.all([
        supabase
          .from('competition_participants')
          .select('*, competition_teams(id, team_name, team_suffix, province, team_type, captain_name, is_disqualified)')
          .eq('competition_id', competitionId)
          .order('full_name', { ascending: true }),
        supabase
          .from('competition_days')
          .select('*')
          .eq('competition_id', competitionId)
          .order('day_number', { ascending: true }),
        supabase
          .from('competition_boats')
          .select('*')
          .eq('competition_id', competitionId)
          .order('boat_name', { ascending: true }),
        supabase
          .from('competition_boat_draws')
          .select('*')
          .eq('competition_id', competitionId),
      ])

      if (partsErr) throw partsErr
      if (daysErr)  throw daysErr
      // boats/boat_draws are optional — not every competition type uses them
      setParticipants(parts || [])
      setDays(ds || [])
      setBoats(boatsErr ? [] : (bts || []))
      setBoatDraws(bdErr ? [] : (bd || []))
    } catch (err) {
      console.error('useCatchLoggerData meta load error:', err)
      setMetaError(err.message || 'Failed to load competition data')
    } finally {
      setLoadingMeta(false)
    }
  }

  // ── Boat assigned to an angler on a given day (split-boat formats) ─────────
  const getAnglerBoatForDay = useCallback((participantId, competitionDayId) => {
    const draw = boatDraws.find(d =>
      d.participant_id === participantId && d.competition_day_id === competitionDayId
    )
    if (!draw) return null
    return boats.find(b => b.id === draw.boat_id) || null
  }, [boatDraws, boats])

  // ── All anglers drawn to a boat on a given day ──────────────────────────────
  const getBoatAnglersForDay = useCallback((boatId, competitionDayId) => {
    const draws = boatDraws.filter(d =>
      d.boat_id === boatId && d.competition_day_id === competitionDayId
    )
    return draws
      .map(d => participants.find(p => p.id === d.participant_id))
      .filter(Boolean)
  }, [boatDraws, participants])

  // ── Load one angler's existing catches for one day ──────────────────────────
  const loadAnglerDayCatches = useCallback(async (participant, competitionDayId) => {
    if (!participant || !competitionDayId) return []
    const { data, error } = await supabase
      .from('competition_catches')
      .select('*')
      .eq('competition_id', competitionId)
      .eq('competition_day_id', competitionDayId)
      .eq('angler_id', participant.user_id)
      .order('catch_time', { ascending: true })
    if (error) {
      console.error('Error loading angler catches:', error)
      return []
    }
    return data || []
  }, [competitionId])

  // ── Load all of a team's anglers' catches for one day (team summary tab) ──
  const loadTeamDayCatches = useCallback(async (teamId, competitionDayId) => {
    if (!teamId || !competitionDayId) return []
    const { data, error } = await supabase
      .from('competition_catches')
      .select('*')
      .eq('competition_id', competitionId)
      .eq('competition_day_id', competitionDayId)
      .eq('team_id', teamId)
      .order('catch_time', { ascending: true })
    if (error) {
      console.error('Error loading team catches:', error)
      return []
    }
    return data || []
  }, [competitionId])

  // ── Load all catches for a boat on one day (split-boat summary tab) ────────
  const loadBoatDayCatches = useCallback(async (boatId, competitionDayId) => {
    if (!boatId || !competitionDayId) return []
    const { data, error } = await supabase
      .from('competition_catches')
      .select('*')
      .eq('competition_id', competitionId)
      .eq('competition_day_id', competitionDayId)
      .eq('boat_id', boatId)
      .order('catch_time', { ascending: true })
    if (error) {
      console.error('Error loading boat catches:', error)
      return []
    }
    return data || []
  }, [competitionId])

  return {
    participants,
    days,
    boats,
    boatDraws,
    loadingMeta,
    metaError,
    reloadMeta: loadMeta,
    getAnglerBoatForDay,
    getBoatAnglersForDay,
    loadAnglerDayCatches,
    loadTeamDayCatches,
    loadBoatDayCatches,
  }
}
