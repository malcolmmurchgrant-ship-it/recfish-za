// ─── useCompetitionRoles ─────────────────────────────────────────────────────
// Checks the current user's role for a specific competition.
// Combines platform_user_roles (system level) with competition_user_roles
// (competition level) to determine effective permissions.

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'

const ADMIN_EMAILS = ['malcolmmurchgrant@gmail.com', 'mpca99@telkomsa.net']

export function useCompetitionRoles(competitionId) {
  const { user }              = useAuth()
  const [platformRole,  setPlatformRole]  = useState(null)
  const [competitionRole, setCompetitionRole] = useState(null)
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    if (!competitionId) return

    let settled = false

    // Hard safety net: never let this hook hang the page forever, no matter
    // what's happening with auth/network upstream. If checkRoles() hasn't
    // finished within 8s, force loading to clear so the page can render
    // (with whatever permission flags we have so far — worst case, a brief
    // under-permissioned flash that self-corrects once the real check lands).
    const timeout = setTimeout(() => {
      if (!settled) {
        console.warn('useCompetitionRoles: role check timed out after 8s — clearing loading state defensively')
        setLoading(false)
      }
    }, 8000)

    if (!user) {
      // No user yet — nothing to check, but don't hang forever waiting.
      // If user arrives later, this effect re-runs (user is a dependency)
      // and checkRoles() will run properly then.
      setLoading(false)
      return () => clearTimeout(timeout)
    }

    checkRoles().finally(() => {
      settled = true
      clearTimeout(timeout)
    })

    return () => clearTimeout(timeout)
  }, [user, competitionId])

  async function checkRoles() {
    setLoading(true)
    try {
      // Check platform_user_roles first (highest authority)
      const { data: platRoles } = await supabase
        .from('platform_user_roles')
        .select('role')
        .eq('user_id', user.id)
        .order('granted_at', { ascending: false })

      if (platRoles?.length) {
        // Return highest platform role
        const roleOrder = ['platform_admin','association_admin','provincial_admin','club_admin']
        for (const r of roleOrder) {
          if (platRoles.some(p => p.role === r)) {
            setPlatformRole(r)
            break
          }
        }
      }

      // Check competition_user_roles for this specific competition
      const { data: compRole } = await supabase
        .from('competition_user_roles')
        .select('role')
        .eq('competition_id', competitionId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (compRole) setCompetitionRole(compRole.role)

    } catch (err) {
      console.error('Role check error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Derived permission flags
  const isPlatformAdmin = platformRole === 'platform_admin' ||
                          ADMIN_EMAILS.includes(user?.email)
  const isAdmin         = isPlatformAdmin ||
                          ['association_admin','provincial_admin','club_admin'].includes(platformRole) ||
                          competitionRole === 'admin'
  const isScorer        = isAdmin || competitionRole === 'scorer' ||
                          ['tournament_director','scorer'].includes(platformRole)
  const canView         = isScorer || competitionRole === 'read_only'

  // Grant a role for this competition
  async function grantRole(email, role) {
    // Look up user by email
    const { data: users, error: lookupErr } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (lookupErr || !users) throw new Error(`User not found: ${email}`)

    const { error: insertErr } = await supabase
      .from('competition_user_roles')
      .insert({ competition_id: competitionId, user_id: users.id, role })

    if (insertErr) throw insertErr
  }

  // Revoke a role
  async function revokeRole(roleId) {
    const { error } = await supabase
      .from('competition_user_roles')
      .delete()
      .eq('id', roleId)
    if (error) throw error
  }

  return {
    user,
    platformRole,
    competitionRole,
    isPlatformAdmin,
    isAdmin,
    isScorer,
    canView,
    loading,
    grantRole,
    revokeRole,
    recheckRoles: checkRoles,
  }
}
