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
  const a = parseFloat(formula.coefficient);
  const b = parseFloat(formula.exponent);
  
  if (isNaN(L) || isNaN(a) || isNaN(b)) return null;
  if (L <= 0) return null;
  
  // Convert length based on formula type
  if (formula.formula_type === 'mm') {
    // Formula expects millimeters, convert cm to mm
    L = L * 10;
  }
  // If formula_type is 'cm' or 'log', use length as-is in cm
  
  // Calculate weight using formula: W = a × L^b
  let weight = a * Math.pow(L, b);
  
  // Convert to kg based on result_unit
  if (formula.result_unit === 'g') {
    weight = weight / 1000;
  }
  
  console.log('📐 Weight calculation:', {
    lengthInput: parseFloat(length),
    lengthUsed: L,
    coefficient: a,
    exponent: b,
    formulaType: formula.formula_type,
    rawResult: a * Math.pow(L, b),
    resultUnit: formula.result_unit,
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
