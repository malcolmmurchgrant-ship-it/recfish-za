// =====================================================
// Weight Calculation Utilities for RecFish ZA
// =====================================================

/**
 * Calculate fish weight from length using species-specific formulas
 * 
 * @param {number} length - Fish length in cm (always input in cm)
 * @param {object} formula - Formula object from database
 * @param {number} formula.coefficient - Formula coefficient (a)
 * @param {number} formula.exponent - Formula exponent (b)
 * @param {string} formula.formula_type - 'log', 'mm', or 'cm'
 * @param {string} formula.result_unit - 'g' or 'kg'
 * @returns {number} Weight in kilograms
 */
export function calculateWeight(length, formula) {
  if (!length || !formula) return null;
  
  let L = parseFloat(length);
  const b = parseFloat(formula.exponent);
  
  if (isNaN(L) || isNaN(b)) return null;
  if (L <= 0) return null;

  let weight;
  const type = (formula.formula_type || '').toLowerCase();

  if (type === 'log-linear') {
    // species.formulas jsonb log-linear format:
    // coefficient stores log10(a) = F (the raw log value)
    // W(g) = 10^(F + b × log10(L_cm))
    const F = parseFloat(formula.coefficient);
    if (isNaN(F)) return null;
    weight = Math.pow(10, F + b * Math.log10(L));
    // result_unit for log-linear is always 'g' — convert to kg
    weight = weight / 1000;

  } else if (type === 'mm' || type === 'power-mm') {
    // Formula expects millimetres — convert cm input to mm
    const a = parseFloat(formula.coefficient);
    if (isNaN(a)) return null;
    const L_mm = L * 10;
    weight = a * Math.pow(L_mm, b);
    if (formula.result_unit === 'g') weight = weight / 1000;

  } else {
    // 'power', 'cm', 'log', or any other type — use length as-is in cm
    const a = parseFloat(formula.coefficient);
    if (isNaN(a)) return null;
    weight = a * Math.pow(L, b);
    if (formula.result_unit === 'g') weight = weight / 1000;
  }

  console.log('📐 Weight calculation:', {
    lengthInput: parseFloat(length),
    formulaType: type,
    exponent: b,
    finalKg: weight
  });

  return weight;
}

/**
 * Fetch formula for a species from Supabase
 * 
 * @param {object} supabase - Supabase client
 * @param {string} scientificName - Scientific name of species
 * @param {string} measureType - Measurement type (TL, FL, etc.)
 * @returns {object|null} Formula object or null
 */
export async function getFormulaForSpecies(supabase, scientificName, measureType = 'TL') {
  try {
    const { data, error } = await supabase
      .from('length_weight_formulas')
      .select('*')
      .eq('scientific_name', scientificName)
      .eq('measure_type', measureType)
      .maybeSingle(); // Use maybeSingle() instead of single() to avoid 406 errors
    
    if (error) {
      console.warn(`No formula found for ${scientificName} (${measureType}):`, error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Error fetching formula:', err);
    return null;
  }
}

/**
 * Fetch formula by catalogue name (common name lookup)
 * 
 * @param {object} supabase - Supabase client
 * @param {string} catalogueName - Catalogue name of species
 * @param {string} measureType - Measurement type (TL, FL, etc.)
 * @returns {object|null} Formula object or null
 */
export async function getFormulaByCatalogueName(supabase, catalogueName, measureType = 'TL') {
  console.log('🔍 getFormulaByCatalogueName called with:', { catalogueName, measureType });
  
  try {
    const { data, error } = await supabase
      .from('length_weight_formulas')
      .select('*')
      .eq('catalogue_name', catalogueName)
      .eq('measure_type', measureType)
      .maybeSingle(); // Use maybeSingle() instead of single() to avoid 406 errors
    
    console.log('📊 Supabase response:', { data, error });
    
    if (error) {
      console.warn(`⚠️ No formula found for ${catalogueName} (${measureType}):`, error);
      return null;
    }
    
    if (!data) {
      console.warn(`⚠️ No data returned for ${catalogueName} (${measureType})`);
      return null;
    }
    
    console.log('✅ Formula found successfully:', data);
    return data;
  } catch (err) {
    console.error('❌ Error fetching formula:', err);
    return null;
  }
}

/**
 * Get all available measure types for a species
 * 
 * @param {object} supabase - Supabase client
 * @param {string} scientificName - Scientific name of species
 * @returns {Array<string>} Array of available measure types
 */
export async function getAvailableMeasureTypes(supabase, scientificName) {
  try {
    const { data, error } = await supabase
      .from('length_weight_formulas')
      .select('measure_type')
      .eq('scientific_name', scientificName);
    
    if (error) {
      console.error('Error fetching measure types:', error);
      return [];
    }
    
    return data.map(item => item.measure_type);
  } catch (err) {
    console.error('Error fetching measure types:', err);
    return [];
  }
}

/**
 * Format weight for display
 * Always display in kg with 2 decimal places for consistency
 * 
 * @param {number} weightKg - Weight in kilograms
 * @returns {string} Formatted weight string
 */
export function formatWeight(weightKg) {
  if (!weightKg || weightKg <= 0) return '0.00 kg';
  
  // Always show in kg with 2 decimal places
  return `${weightKg.toFixed(2)} kg`;
}


/**
 * Get the best available formula for a species.
 * Priority:
 *   1. species.formulas jsonb — Visboekie (power/power-mm) or log-linear entries
 *   2. length_weight_formulas table — FishBase fallback
 *
 * Handles all three formula types stored in species.formulas:
 *   - 'power'      : W(kg) = a × L_cm^b
 *   - 'power-mm'   : W(g)  = a × (L_cm × 10)^b  → /1000 for kg
 *   - 'log-linear' : W(g)  = 10^(F + b × log10(L_cm)) → /1000 for kg
 *                    where coefficient stores F (log10 of a), NOT a itself
 *
 * Returns normalised formula object compatible with calculateWeight(), plus:
 *   _source    : 'jsonb' | 'fishbase'
 *   _reference : reference string for UI display
 *
 * @param {object} supabase     - Supabase client
 * @param {object} species      - Full species row (id, scientific_name,
 *                                catalogue_name, formulas, default_length_type)
 * @param {string} measureType  - TL | FL | DW | PCL | LBFL
 * @param {string|null} sexVariant - 'F' | 'M' | null
 */
export async function getBestFormula(supabase, species, measureType = 'TL', sexVariant = null) {
  if (!species) return null;

  // ── 1. species.formulas jsonb ───────────────────────────────────────────
  if (Array.isArray(species.formulas) && species.formulas.length > 0) {
    const match = species.formulas.find(f =>
      f.measure && f.measure.toUpperCase() === measureType.toUpperCase()
    ) || species.formulas[0];

    if (match) {
      const fType = (match.formula_type || '').toLowerCase();
      const coeff = parseFloat(match.coefficient);

      // log-linear entries in species.formulas jsonb are broken —
      // they store raw F values that produce incorrect results.
      // Skip them and fall through to length_weight_formulas instead.
      // power/power-mm store coefficient 'a' directly — must be non-zero.
      const isUsable = fType !== 'log-linear'
        && !isNaN(coeff) && coeff !== 0;

      if (isUsable) {
        return {
          coefficient:  coeff,
          exponent:     parseFloat(match.exponent),
          formula_type: fType || 'power',
          result_unit:  match.result_unit || 'g',
          measure_type: match.measure     || measureType,
          _source:      'jsonb',
          _reference:   match.reference   || 'Visboekie',
        };
      }
    }
  }

  // ── 2. length_weight_formulas table (FishBase) ──────────────────────────
  const catalogueName = sexVariant
    ? `${species.catalogue_name || species.common_name} (${sexVariant})`
    : (species.catalogue_name   || species.common_name);

  const formula = await getFormulaByCatalogueName(
    supabase,
    catalogueName,
    measureType,
    species.scientific_name
  );

  if (formula && parseFloat(formula.coefficient) !== 0) {
    return {
      ...formula,
      _source:    'fishbase',
      _reference: formula.reference || 'FishBase',
    };
  }

  console.warn(`No usable formula for ${species.scientific_name} (${measureType})`);
  return null;
}

/**
 * Validate length against typical species ranges
 * Returns warning message if length seems unusual
 * 
 * @param {number} length - Fish length in cm
 * @param {string} measureType - Measurement type
 * @returns {string|null} Warning message or null
 */
export function validateLength(length, measureType) {
  const L = parseFloat(length);
  
  if (isNaN(L) || L <= 0) {
    return 'Please enter a valid length greater than 0';
  }
  
  // Reasonable ranges by measure type
  const ranges = {
    'TL': { min: 5, max: 500 },
    'FL': { min: 5, max: 400 },
    'DW': { min: 10, max: 300 },
    'PCL': { min: 10, max: 200 },
    'LBFL': { min: 5, max: 400 }
  };
  
  const range = ranges[measureType] || { min: 0, max: 1000 };
  
  if (L < range.min) {
    return `Length seems very small for ${measureType} measurement`;
  }
  
  if (L > range.max) {
    return `Length seems very large for ${measureType} measurement - please verify`;
  }
  
  return null;
}
