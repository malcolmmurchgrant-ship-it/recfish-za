// ─── useCompetitionConfig ────────────────────────────────────────────────────
// Loads a competition record and its template config from Supabase.
// Exposes the merged pinned_config (or live template if no pinned_config yet).
// All CompetitionAdmin tabs consume this hook.

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

export function useCompetitionConfig(competitionId) {
  const [competition,    setCompetition]    = useState(null)
  const [template,       setTemplate]       = useState(null)
  const [config,         setConfig]         = useState(null)   // merged scoring/species/team/session/reporting
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)

  useEffect(() => {
    if (!competitionId) return
    load()
  }, [competitionId])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      // Load competition with its template
      const { data: comp, error: compErr } = await supabase
        .from('competitions')
        .select(`
          *,
          competition_templates (
            id, name, discipline, level, category,
            scoring_method, species_bonus, line_classes,
            default_line_class_kg, catch_release_enabled,
            release_points_method, release_fixed_points,
            release_pct_of_caught, team_format, team_size,
            num_fishing_days, skipper_competition,
            skipper_scoring_method, bag_limits, minimum_sizes,
            points_per_fish, over_line_bonus,
            session_structure, scoring_config, species_config,
            team_config, reporting_config
          )
        `)
        .eq('id', competitionId)
        .single()

      if (compErr) throw compErr

      const tmpl = comp.competition_templates

      // Use pinned_config if it exists (competition already started)
      // otherwise fall back to live template jsonb configs
      const merged = {
        session:   comp.pinned_config?.session   || tmpl?.session_structure  || {},
        scoring:   comp.pinned_config?.scoring   || tmpl?.scoring_config     || {},
        species:   comp.pinned_config?.species   || tmpl?.species_config     || {},
        team:      comp.pinned_config?.team      || tmpl?.team_config        || {},
        reporting: comp.pinned_config?.reporting || tmpl?.reporting_config   || {},
      }

      setCompetition(comp)
      setTemplate(tmpl)
      setConfig(merged)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Pin the current template config to the competition (call when moving to in_progress)
  async function pinConfig() {
    if (!competition || !template) return
    const toPin = {
      session:   template.session_structure,
      scoring:   template.scoring_config,
      species:   template.species_config,
      team:      template.team_config,
      reporting: template.reporting_config,
      pinned_at: new Date().toISOString(),
    }
    const { error: err } = await supabase
      .from('competitions')
      .update({ pinned_config: toPin, status: 'in_progress' })
      .eq('id', competitionId)
    if (err) throw err
    await load()
  }

  // Record a mid-competition rule override
  async function addRuleOverride(description, changedFields) {
    if (!competition) return
    const override = {
      timestamp:      new Date().toISOString(),
      description,
      changed_fields: changedFields,
    }
    const existing = competition.rule_overrides || []
    const { error: err } = await supabase
      .from('competitions')
      .update({ rule_overrides: [...existing, override] })
      .eq('id', competitionId)
    if (err) throw err
    await load()
  }

  // Publish final results (locks everything)
  async function publishResults() {
    const { error: err } = await supabase
      .from('competitions')
      .update({
        status:               'completed',
        results_published_at: new Date().toISOString(),
        results_visible:      true,
      })
      .eq('id', competitionId)
    if (err) throw err
    await load()
  }

  return {
    competition,
    template,
    config,
    loading,
    error,
    reload: load,
    pinConfig,
    addRuleOverride,
    publishResults,
  }
}
