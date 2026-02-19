// ============================================================
// RecFish ZA: Record Detection Utility
// src/utils/recordDetection.js
// ============================================================

/**
 * Calculate age in years on a specific date.
 */
function calculateAge(dateOfBirth, onDate) {
  const dob = new Date(dateOfBirth)
  const ref = new Date(onDate)
  let age = ref.getFullYear() - dob.getFullYear()
  const monthDiff = ref.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < dob.getDate())) {
    age--
  }
  return age
}

/**
 * Map an angler's gender + date of birth to a SADSAA record category.
 * 
 * Categories (matching species_records table):
 *   Men      — male, age 21+
 *   Woman    — female, age 21+
 *   Junior-M — male, age < 21
 *   Junior-F — female, age < 21
 *   Smallfry-M — male, age < 16  (subset of Junior-M, checked separately)
 *   Smallfry-F — female, age < 16
 *
 * @param {string} gender     - 'Men' or 'Woman' (as stored in users table)
 * @param {string} dateOfBirth - ISO date string e.g. '2000-05-14'
 * @param {string} catchDate   - ISO date string e.g. '2025-11-03'
 * @returns {string[]} Array of applicable categories, most specific first
 */
export function getRecordCategories(gender, dateOfBirth, catchDate) {
  if (!gender || !dateOfBirth || !catchDate) return []

  const age = calculateAge(dateOfBirth, catchDate)
  const isMale = gender === 'Men'

  if (age < 16) {
    // Smallfry qualifies for Smallfry AND Junior AND All
    return isMale
      ? ['Smallfry-M', 'Junior-M', 'All']
      : ['Smallfry-F', 'Junior-F', 'All']
  } else if (age < 21) {
    // Junior qualifies for Junior AND All
    return isMale
      ? ['Junior-M', 'All']
      : ['Junior-F', 'All']
  } else {
    // Senior
    return isMale
      ? ['Men', 'All']
      : ['Woman', 'All']
  }
}

/**
 * Check a catch against SADSAA and All Africa records.
 * Calls the Supabase database function check_catch_record().
 *
 * @param {object} supabase     - Supabase client instance
 * @param {object} params
 * @param {string} params.scientificName  - Species scientific name e.g. 'Seriola lalandi'
 * @param {number} params.weightKg       - Catch weight in kg
 * @param {string} params.lineClassKg    - Line class e.g. '15' or 'All Tackle' or null
 * @param {string} params.gender         - 'Men' or 'Woman'
 * @param {string} params.dateOfBirth    - ISO date string
 * @param {string} params.catchDate      - ISO date string (defaults to today)
 *
 * @returns {object|null} Record check result or null if error
 */
export async function checkRecord(supabase, {
  scientificName,
  weightKg,
  lineClassKg = null,
  gender,
  dateOfBirth,
  catchDate = new Date().toISOString().split('T')[0],
}) {
  if (!scientificName || !weightKg || !gender || !dateOfBirth) {
    return null
  }

  // Get all applicable categories for this angler
  const categories = getRecordCategories(gender, dateOfBirth, catchDate)
  if (categories.length === 0) return null

  // Check each category — return the best (most significant) result found
  const results = []

  for (const category of categories) {
    try {
      const { data, error } = await supabase.rpc('check_catch_record', {
        p_scientific_name: scientificName,
        p_weight_kg:       weightKg,
        p_line_class_kg:   lineClassKg || '',
        p_category:        category,
      })

      if (error) {
        console.warn(`Record check error for category ${category}:`, error.message)
        continue
      }

      if (data && data.status !== 'NO_RECORD' && data.status !== 'NO_RECORD_SLOT') {
        results.push(data)
      }
    } catch (err) {
      console.warn('Record check failed:', err)
    }
  }

  if (results.length === 0) return null

  // Return the most significant result
  // Priority: BEATS_ALL_AFRICA > BEATS_SADSAA > VACANT_SADSAA
  const priority = ['BEATS_ALL_AFRICA', 'BEATS_SADSAA', 'VACANT_SADSAA']
  results.sort((a, b) => priority.indexOf(a.status) - priority.indexOf(b.status))

  return results[0]
}

/**
 * Build a human-readable notification message from a record result.
 *
 * @param {object} result - Result from checkRecord()
 * @returns {object} { title, message, type, showClaimButton }
 */
export function buildRecordNotification(result) {
  if (!result) return null

  const weight = result.catch_weight_kg
  const species = result.catalogue_name
  const lineClass = result.line_class_kg !== 'All Tackle'
    ? `${result.line_class_kg}kg line`
    : 'All Tackle'
  const category = result.category

  switch (result.status) {
    case 'BEATS_ALL_AFRICA':
      return {
        type: 'all_africa',
        title: '🌍 All Africa Record!',
        message: `Your ${species} of ${weight}kg on ${lineClass} beats the current All Africa ${category} record of ${result.aa_weight_kg}kg held by ${result.aa_angler} (${result.aa_location})! The SADSAA record was ${result.sadsaa_weight_kg}kg held by ${result.sadsaa_angler}.`,
        showClaimButton: true,
      }

    case 'BEATS_SADSAA':
      return {
        type: 'sadsaa',
        title: '🏆 SADSAA Record!',
        message: `Your ${species} of ${weight}kg on ${lineClass} beats the current SADSAA ${category} record of ${result.sadsaa_weight_kg}kg set by ${result.sadsaa_angler} at ${result.sadsaa_location} on ${result.sadsaa_date}!`,
        showClaimButton: true,
      }

    case 'VACANT_SADSAA':
      return {
        type: 'vacant',
        title: '⭐ Vacant Record Slot!',
        message: `There is currently no SADSAA ${category} record for ${species} on ${lineClass}. Your catch of ${weight}kg could be the first! Follow the link below to submit a record claim.`,
        showClaimButton: true,
      }

    default:
      return null
  }
}
