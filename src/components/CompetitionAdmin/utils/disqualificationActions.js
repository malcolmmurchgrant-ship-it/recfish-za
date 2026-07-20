// ─── disqualificationActions.js ──────────────────────────────────────────────
// Single shared implementation of disqualify/reinstate for competition
// participants and their catches. Consolidated 2026-07 from three
// independent copies that had drifted apart (CompetitionAdminParticipants.jsx's
// handleDQ/handleReinstate, useCompetitionCatches.js's disqualifyAngler, and
// a third one now added in CompetitionAdminScoring.jsx) -- see the Marinus
// van der Merwe incident: a single-day DQ was applied competition-wide
// because a scope dropdown's default silently favoured the more severe,
// harder-to-notice option. All three copies already had the same
// participant_id/angler_id fallback (a registered angler's catches are
// matched by angler_id == user_id; an unregistered angler -- the common
// case, e.g. any junior without a RecFish ZA account -- has no angler_id
// and must be matched by participant_id instead, the stable anchor that
// exists regardless of registration status), but needed patching three
// times instead of once. Now there is exactly one place this logic lives --
// callers should import from here rather than re-implement it.

import { supabase } from '../../../lib/supabase'

/**
 * Disqualify a participant's catches -- either their whole competition, or
 * a single day.
 *
 * @param {object} params
 * @param {string} params.participantId - competition_participants.id
 * @param {string} params.competitionId
 * @param {string} params.reason - required, human-readable DQ reason
 * @param {string|null} [params.competitionDayId] - null (default) = whole
 *   competition, marking the participant record itself disqualified so
 *   they're correctly excluded from every standings view. Pass a specific
 *   competition_day_id to zero only that day's catches instead -- the
 *   angler remains a normal, visible competitor and their other days'
 *   scores are untouched.
 * @returns {Promise<{catchesUpdated: number}>}
 */
export async function disqualifyParticipant({ participantId, competitionId, reason, competitionDayId = null }) {
  if (!reason || !reason.trim()) {
    throw new Error('A reason is required to disqualify an angler.')
  }

  const { data: participant, error: pErr } = await supabase
    .from('competition_participants')
    .select('id, user_id')
    .eq('id', participantId)
    .single()
  if (pErr) throw pErr

  // Only a whole-competition DQ marks the participant record itself --
  // a single-day DQ shouldn't make the angler show as disqualified
  // everywhere, just zero that one day's points.
  if (!competitionDayId) {
    const { error: statusErr } = await supabase
      .from('competition_participants')
      .update({ status: 'disqualified', notes: reason.trim() })
      .eq('id', participantId)
    if (statusErr) throw statusErr
  }

  let query = supabase
    .from('competition_catches')
    .update({ data_quality: 'disqualified', scoring: false, notes: reason.trim() })
    .eq('competition_id', competitionId)

  query = participant.user_id
    ? query.eq('angler_id', participant.user_id)
    : query.eq('participant_id', participant.id)

  if (competitionDayId) {
    query = query.eq('competition_day_id', competitionDayId)
  }

  const { data, error } = await query.select('id')
  if (error) throw error
  return { catchesUpdated: data?.length || 0 }
}

/**
 * Reinstate a whole-competition-disqualified participant: clears the
 * participant-level status AND resets their catches back to unverified so
 * they're rescored -- matches the pre-consolidation behaviour exactly.
 *
 * NOTE -- pre-existing risk, not introduced by this consolidation: if any
 * of this participant's catches were independently disqualified for their
 * own reason (e.g. one specific over-line-class catch, unrelated to the
 * whole-competition DQ), this will also incorrectly clear those, since
 * there's no stored distinction today between "DQ'd because the whole
 * event was" and "DQ'd on its own merits". Worth a proper fix if this
 * scenario ever actually comes up -- flagging rather than silently
 * "fixing" it here, since that would be a real behaviour change nobody
 * asked for.
 *
 * @param {object} params
 * @param {string} params.participantId
 * @param {string} params.competitionId
 */
export async function reinstateParticipant({ participantId, competitionId }) {
  const { error: statusErr } = await supabase
    .from('competition_participants')
    .update({ status: 'registered', notes: null })
    .eq('id', participantId)
  if (statusErr) throw statusErr

  const { data: participant, error: pErr } = await supabase
    .from('competition_participants')
    .select('id, user_id')
    .eq('id', participantId)
    .single()
  if (pErr) throw pErr

  let query = supabase
    .from('competition_catches')
    .update({ data_quality: 'unverified', scoring: true })
    .eq('competition_id', competitionId)
  query = participant.user_id
    ? query.eq('angler_id', participant.user_id)
    : query.eq('participant_id', participant.id)

  const { error: catchErr } = await query
  if (catchErr) throw catchErr
}
