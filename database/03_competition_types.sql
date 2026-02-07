-- ============================================================================
-- SADSAA Competition Types - Pre-configured Templates
-- Based on SADSAA Tournament Rules 2023
-- ============================================================================

-- ============================================================================
-- 1. HEAVY TACKLE BILLFISH
-- ============================================================================
INSERT INTO competition_types (
  name,
  discipline,
  team_format,
  scoring_method,
  line_classes,
  species_rules,
  bag_limits,
  minimum_sizes,
  verification_required,
  photo_required,
  witness_required,
  description
) VALUES (
  'SADSAA Heavy Tackle Billfish',
  'billfish',
  'traditional',
  'release_points_with_bonuses',
  ARRAY['10kg', '15kg', '24kg', '37kg', '60kg'],
  '{
    "release_scoring": true,
    "full_release": true,
    "species": ["sailfish", "marlin", "spearfish"],
    "straight_release_points": {
      "spearfish": 100,
      "sailfish": 100,
      "marlin": 220
    },
    "multiple_release_bonus": {
      "spearfish": [0, 20, 40, 60, 80],
      "sailfish": [0, 20, 40, 60, 80],
      "marlin": [0, 40, 70, 100, 130]
    },
    "species_bonus": [0, 25, 50, 60],
    "daily_sequence_bonus": [5, 4, 3, 2, 1],
    "circle_hook_bonus": 5,
    "rules": {
      "hook_types": ["j-hook", "circle-hook-non-offset"],
      "circle_hook_required_for_bait": true,
      "swivel_must_touch_rod_tip": true,
      "humane_release_required": true
    }
  }'::jsonb,
  '{
    "per_day": {},
    "tournament_total": {}
  }'::jsonb,
  '{
    "all_marlin": "release_only",
    "all_sailfish": "release_only",
    "all_spearfish": "release_only"
  }'::jsonb,
  true,
  true,
  false,
  'SADSAA Heavy Tackle Billfish Tournament - Full release format with bonus points for multiple releases, species diversity, and circle hook use'
);

-- ============================================================================
-- 2. LIGHT TACKLE BILLFISH
-- ============================================================================
INSERT INTO competition_types (
  name,
  discipline,
  team_format,
  scoring_method,
  line_classes,
  species_rules,
  bag_limits,
  minimum_sizes,
  verification_required,
  photo_required,
  witness_required,
  description
) VALUES (
  'SADSAA Light Tackle Billfish',
  'billfish',
  'traditional',
  'release_points_with_bonuses',
  ARRAY['4kg', '6kg', '8kg'],
  '{
    "release_scoring": true,
    "full_release": true,
    "species": ["sailfish", "marlin", "spearfish"],
    "straight_release_points": {
      "spearfish": 100,
      "sailfish": 100,
      "marlin": 220
    },
    "multiple_release_bonus": {
      "spearfish": [0, 20, 40, 60, 80],
      "sailfish": [0, 20, 40, 60, 80],
      "marlin": [0, 40, 70, 100, 130]
    },
    "species_bonus": [0, 25, 50, 60],
    "daily_sequence_bonus": [5, 4, 3, 2, 1],
    "circle_hook_bonus": 5,
    "rules": {
      "hook_types": ["j-hook-non-stainless", "circle-hook-non-offset-non-stainless"],
      "circle_hook_required_for_bait": false,
      "j_hook_allowed_for_dead_bait": true,
      "swivel_must_touch_rod_tip": true,
      "humane_release_required": true
    }
  }'::jsonb,
  '{}'::jsonb,
  '{
    "all_marlin": "release_only",
    "all_sailfish": "release_only",
    "all_spearfish": "release_only"
  }'::jsonb,
  true,
  true,
  false,
  'SADSAA Light Tackle Billfish Tournament - Same scoring as Heavy Tackle but with lighter line classes'
);

-- ============================================================================
-- 3. TUNA
-- ============================================================================
INSERT INTO competition_types (
  name,
  discipline,
  team_format,
  scoring_method,
  line_classes,
  species_rules,
  bag_limits,
  minimum_sizes,
  verification_required,
  photo_required,
  witness_required,
  description
) VALUES (
  'SADSAA Tuna',
  'tuna',
  'traditional',
  'weight_based',
  ARRAY['10kg', '15kg', '24kg'],
  '{
    "weight_scoring": true,
    "species": ["yellowfin_tuna", "bigeye_tuna", "bluefin_tuna", "albacore", "dogtooth_tuna"],
    "species_multiplier": {
      "yellowfin_tuna": 1.0,
      "bigeye_tuna": 1.0,
      "bluefin_tuna": 1.0,
      "albacore": 1.0,
      "dogtooth_tuna": 1.0
    },
    "first_n_fish_count": 10,
    "rules": {
      "hook_types": ["j-hook", "circle-hook-non-offset"],
      "minimum_weight_equal_line_class": true,
      "release_points": false
    }
  }'::jsonb,
  '{
    "per_angler_per_day": 10,
    "note": "First 10 fish killed will be presented to scales"
  }'::jsonb,
  '{
    "default": "5kg"
  }'::jsonb,
  true,
  false,
  false,
  'SADSAA Tuna Tournament - Weight-based scoring, first 10 fish killed count'
);

-- ============================================================================
-- 4. GAMEFISH
-- ============================================================================
INSERT INTO competition_types (
  name,
  discipline,
  team_format,
  scoring_method,
  line_classes,
  species_rules,
  bag_limits,
  minimum_sizes,
  verification_required,
  photo_required,
  witness_required,
  description
) VALUES (
  'SADSAA Gamefish',
  'gamefish',
  'traditional',
  'species_multiplier',
  ARRAY['10kg', '15kg'],
  '{
    "formula": "(weight_kg / line_class_kg)^2 * 32 * species_factor",
    "species_multiplier": true,
    "species_factors": {
      "all_marlin": 1.0,
      "all_spearfish": 1.0,
      "swordfish": 1.0,
      "all_bonito": 1.0,
      "yellowfin_tuna": 1.0,
      "bigeye_tuna": 1.0,
      "bluefin_tuna": 1.0,
      "dogtooth_tuna": 1.0,
      "yellowtail": 1.0,
      "all_kingfish": 1.0,
      "all_sportfish": 1.0,
      "king_mackerel": 1.0,
      "rainbow_runner": 1.0,
      "queenfish": 1.0,
      "elf": 1.0,
      "great_barracuda": 1.0,
      "green_jobfish": 1.0,
      "queen_mackerel": 1.0,
      "cape_snoek": 1.0,
      "garrick": 1.0,
      "dorado": 1.0,
      "cobia": 1.0,
      "wahoo": 1.0,
      "sailfish": 1.0,
      "albacore": 1.0
    },
    "species_multiplier_logic": "Multiply by (number_of_species - 1). Example: 1 species = x1, 2 species = x1, 3 species = x2, 4 species = x3",
    "first_n_fish_count": 10,
    "special_rules": {
      "billfish_no_weight": true,
      "billfish_count_as_species": true,
      "green_jobfish_measureonly_protected_areas": true,
      "kingfish_measureonly_protected_areas": true,
      "spooning_dropshot_allowed": true,
      "jigging_prohibited_protected_areas": true
    },
    "rules": {
      "hook_types": ["j-hook", "circle-hook-non-offset"]
    }
  }'::jsonb,
  '{
    "per_angler_per_day": 10,
    "note": "First 10 fish killed will be presented to scales"
  }'::jsonb,
  '{
    "default": "4kg"
  }'::jsonb,
  true,
  false,
  false,
  'SADSAA Gamefish Tournament - Formula-based scoring with species multiplier'
);

-- ============================================================================
-- 5. BOTTOMFISH (2023 NEW RULES - Split-Boat Format)
-- ============================================================================
INSERT INTO competition_types (
  name,
  discipline,
  team_format,
  scoring_method,
  line_classes,
  species_rules,
  bag_limits,
  minimum_sizes,
  verification_required,
  photo_required,
  witness_required,
  measuring_mat_required,
  description
) VALUES (
  'SADSAA Bottomfish (2023 Rules)',
  'bottomfish',
  'split_boat',
  'length_based_percentage',
  ARRAY['6kg', '10kg', '15kg'],
  '{
    "length_based": true,
    "percentage_scoring": true,
    "points_per_species": {
      "note": "Points vary by species rarity and size",
      "bonus_for_first_of_species": true,
      "bonus_for_over_line_class": true
    },
    "scoring_logic": "Individual anglers compete on each boat. Winner on boat scores 100%, others proportional. Team score = sum of all team member percentages across all boats.",
    "measuring_mat": true,
    "weighing": "Only for personal records/PBs",
    "first_n_fish": "Up to bag limits per species",
    "rules": {
      "one_line_per_angler": true,
      "two_hook_rig_allowed": true,
      "hooks_separated": true,
      "circle_hooks_non_offset_only": true,
      "j_hooks_can_be_offset": true,
      "stainless_hooks_prohibited_protected_areas": true,
      "position_draw_per_boat": true,
      "no_passing_fish": true,
      "no_passing_rigs": true
    }
  }'::jsonb,
  '{
    "varies_by_species": true,
    "note": "Bag limits per species as per competition rules and DFFE regulations"
  }'::jsonb,
  '{
    "default": "2kg",
    "note": "Host province may set higher minimums per species"
  }'::jsonb,
  true,
  false,
  true,
  true,
  'SADSAA Bottomfish Tournament (2023 Rules) - Split-boat format, length-based scoring with measuring mat, percentage calculation per boat'
);

-- ============================================================================
-- 6. BOTTOMFISH (Traditional Format)
-- ============================================================================
INSERT INTO competition_types (
  name,
  discipline,
  team_format,
  scoring_method,
  line_classes,
  species_rules,
  bag_limits,
  minimum_sizes,
  verification_required,
  photo_required,
  witness_required,
  description
) VALUES (
  'SADSAA Bottomfish (Traditional)',
  'bottomfish',
  'traditional',
  'weight_based',
  ARRAY['6kg', '10kg', '15kg'],
  '{
    "weight_scoring": true,
    "species_multiplier": false,
    "first_n_fish": "Up to bag limits",
    "rules": {
      "two_hook_rig_allowed": true,
      "circle_hooks_non_offset_only": true,
      "j_hooks_allowed": true,
      "stainless_hooks_prohibited_protected_areas": true
    }
  }'::jsonb,
  '{
    "varies_by_species": true
  }'::jsonb,
  '{
    "default": "2kg"
  }'::jsonb,
  true,
  false,
  false,
  false,
  'Traditional Bottomfish format - Teams fish together, weight-based scoring'
);

-- ============================================================================
-- Update species with SADSAA competition relevance
-- ============================================================================

-- Mark Billfish species
UPDATE species SET sadsaa_billfish = true
WHERE common_name IN (
  'Sailfish', 'Black Marlin', 'Blue Marlin', 'Striped Marlin', 
  'Shortbill Spearfish', 'Longbill Spearfish',
  'Atlantic Sailfish', 'Indo-Pacific Sailfish'
) OR scientific_name IN (
  'Istiophorus platypterus', 'Istiophorus albicans',
  'Makaira indica', 'Makaira nigricans',
  'Kajikia audax', 'Tetrapturus angustirostris', 'Tetrapturus pfluegeri'
);

-- Mark Tuna species
UPDATE species SET sadsaa_tuna = true
WHERE common_name LIKE '%Tuna%' OR common_name LIKE '%Tunny%'
OR family_common = 'Tunas' OR family_common = 'Mackerels and tunas'
OR scientific_name LIKE 'Thunnus%' OR scientific_name LIKE 'Katsuwonus%'
OR scientific_name LIKE 'Euthynnus%' OR scientific_name LIKE 'Auxis%'
OR scientific_name LIKE 'Gymnosarda%';

-- Mark Gamefish species
UPDATE species SET sadsaa_gamefish = true
WHERE common_name IN (
  'Dorado', 'Wahoo', 'King Mackerel', 'Queen Mackerel',
  'Yellowtail', 'Rainbow Runner', 'Queenfish',
  'Elf', 'Great Barracuda', 'Green Jobfish',
  'Cape Snoek', 'Garrick', 'Cobia',
  'Cape Yellowtail', 'Yellowtail Amberjack', 'Greater Amberjack'
) OR sadsaa_billfish = true OR sadsaa_tuna = true;

-- Mark common Bottomfish species
UPDATE species SET sadsaa_bottomfish = true
WHERE common_name IN (
  'Carpenter', 'Roman', 'Hottentot', 'Geelbek', 'Kob',
  'Panga', 'Santer', 'Red Stumpnose', 'Blue Hottentot',
  'Jacopever', 'Blacktail', 'Dageraad', 'Red Steenbras',
  'Black Musselcracker', 'Bronze Bream', 'Zebra',
  'Scotsman', 'Cavebass', 'Cape Gurnard', 'Shallow-water Hake',
  'Dusky Kob', 'Silver Kob', 'Squaretail Kob', 'Baardman'
) OR family_common IN (
  'Seabreams', 'Snappers', 'Grunters', 'Croakers', 'Drums'
);

-- ============================================================================
-- Competition Types Setup Complete
-- 6 competition types created
-- Species tagged with SADSAA relevance
-- ============================================================================
