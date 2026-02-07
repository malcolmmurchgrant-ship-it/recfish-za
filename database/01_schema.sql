-- ============================================================================
-- RecFish ZA - Complete Database Schema
-- South African Recreational Fishing Catch Reporting System
-- ============================================================================
-- Supports: SADSAA Competitions (all formats), Club competitions, Personal logging
-- Competition formats: Traditional (teams together) & Split-boat (anglers separated)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- CORE USER MANAGEMENT
-- ============================================================================

-- Organizations (SADSAA, Provincial associations, Clubs)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  abbreviation TEXT,
  type TEXT NOT NULL CHECK (type IN ('national', 'provincial', 'club', 'other')),
  parent_organization_id UUID REFERENCES organizations(id),
  logo_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for org hierarchy
CREATE INDEX idx_organizations_parent ON organizations(parent_organization_id);
CREATE INDEX idx_organizations_type ON organizations(type);

-- Users/Anglers
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  full_name TEXT NOT NULL,
  angler_number TEXT UNIQUE, -- SADSAA unique angler number
  club_name TEXT,
  club_id UUID REFERENCES organizations(id),
  province TEXT,
  province_id UUID REFERENCES organizations(id),
  gender TEXT CHECK (gender IN ('M', 'F', 'Other')),
  date_of_birth DATE,
  age_category TEXT, -- Senior, U21, U19, U16, Smallfry
  phone TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  profile_photo_url TEXT,
  privacy_level TEXT DEFAULT 'public' CHECK (privacy_level IN ('public', 'friends', 'private')),
  location_sharing BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_angler_number ON users(angler_number);
CREATE INDEX idx_users_club_id ON users(club_id);
CREATE INDEX idx_users_province_id ON users(province_id);
CREATE INDEX idx_users_email ON users(email);

-- ============================================================================
-- SPECIES DATABASE
-- ============================================================================

CREATE TABLE species (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scientific_name TEXT NOT NULL,
  common_name TEXT NOT NULL,
  afrikaans_name TEXT,
  catalogue_name TEXT, -- For matching SADSAA catch reports
  other_names TEXT[],
  family_scientific TEXT,
  family_common TEXT,
  
  -- Regulations
  minimum_size_cm DECIMAL,
  minimum_size_note TEXT,
  bag_limit INTEGER,
  bag_limit_note TEXT,
  closed_season TEXT,
  protected BOOLEAN DEFAULT false,
  
  -- Conservation status
  iucn_status TEXT,
  iucn_date DATE,
  sa_status TEXT,
  sa_date TEXT,
  
  -- SADSAA competition relevance
  sadsaa_billfish BOOLEAN DEFAULT false,
  sadsaa_tuna BOOLEAN DEFAULT false,
  sadsaa_gamefish BOOLEAN DEFAULT false,
  sadsaa_bottomfish BOOLEAN DEFAULT false,
  
  -- Species data (from your JSON)
  text_data JSONB, -- Stores appearance, biology, about, etc.
  formulas JSONB, -- Length-weight formulas
  
  -- Images
  image_urls TEXT[],
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_species_common_name ON species(common_name);
CREATE INDEX idx_species_scientific_name ON species(scientific_name);
CREATE INDEX idx_species_catalogue_name ON species(catalogue_name);
CREATE INDEX idx_species_sadsaa_billfish ON species(sadsaa_billfish) WHERE sadsaa_billfish = true;
CREATE INDEX idx_species_sadsaa_tuna ON species(sadsaa_tuna) WHERE sadsaa_tuna = true;
CREATE INDEX idx_species_sadsaa_gamefish ON species(sadsaa_gamefish) WHERE sadsaa_gamefish = true;
CREATE INDEX idx_species_sadsaa_bottomfish ON species(sadsaa_bottomfish) WHERE sadsaa_bottomfish = true;

-- Full text search on species names
CREATE INDEX idx_species_name_search ON species 
  USING gin(to_tsvector('english', common_name || ' ' || COALESCE(afrikaans_name, '') || ' ' || scientific_name));

-- ============================================================================
-- BOATS & SKIPPERS
-- ============================================================================

CREATE TABLE boats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  registration_number TEXT,
  owner_id UUID REFERENCES users(id),
  owner_organization_id UUID REFERENCES organizations(id),
  boat_type TEXT,
  length_meters DECIMAL,
  max_capacity INTEGER,
  has_gps BOOLEAN DEFAULT true,
  has_radio BOOLEAN DEFAULT true,
  certificate_of_fitness TEXT, -- COF number
  cof_expiry_date DATE,
  active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_boats_owner_id ON boats(owner_id);
CREATE INDEX idx_boats_owner_organization_id ON boats(owner_organization_id);

CREATE TABLE skippers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  full_name TEXT NOT NULL,
  phone TEXT,
  license_number TEXT, -- COC number
  license_expiry_date DATE,
  experience_years INTEGER,
  preferred_boats UUID[], -- Array of boat IDs
  rating DECIMAL CHECK (rating >= 0 AND rating <= 5),
  total_competitions INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_skippers_user_id ON skippers(user_id);

-- ============================================================================
-- COMPETITION STRUCTURE
-- ============================================================================

-- Competition Types (Templates)
CREATE TABLE competition_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  discipline TEXT NOT NULL CHECK (discipline IN ('billfish', 'tuna', 'gamefish', 'bottomfish', 'mixed')),
  team_format TEXT NOT NULL CHECK (team_format IN ('traditional', 'split_boat')),
  scoring_method TEXT NOT NULL,
  
  -- Line class and rules
  line_classes TEXT[], -- e.g., ['4kg', '6kg'] or ['10kg']
  
  -- Species rules (stored as JSONB for flexibility)
  species_rules JSONB,
  -- Example for Billfish:
  -- {
  --   "release_scoring": true,
  --   "species": ["sailfish", "marlin", "spearfish"],
  --   "straight_release_points": {"sailfish": 100, "marlin": 220, "spearfish": 100},
  --   "bonus_points": {...}
  -- }
  
  -- Bag limits and regulations
  bag_limits JSONB,
  minimum_sizes JSONB,
  
  -- Verification requirements
  verification_required BOOLEAN DEFAULT true,
  photo_required BOOLEAN DEFAULT false,
  witness_required BOOLEAN DEFAULT false,
  measuring_mat_required BOOLEAN DEFAULT false,
  
  -- Metadata
  description TEXT,
  rules_document_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_competition_types_discipline ON competition_types(discipline);
CREATE INDEX idx_competition_types_team_format ON competition_types(team_format);

-- Competitions (Specific events)
CREATE TABLE competitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_type_id UUID REFERENCES competition_types(id) NOT NULL,
  
  -- Basic info
  name TEXT NOT NULL,
  short_name TEXT,
  competition_level TEXT CHECK (competition_level IN ('international', 'national', 'interprovincial', 'provincial', 'club', 'other')),
  
  -- Hosting details
  hosting_organization_id UUID REFERENCES organizations(id),
  hosting_province TEXT,
  hosting_club TEXT,
  venue TEXT NOT NULL,
  
  -- Dates
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  registration_deadline DATE,
  
  -- Competition configuration
  team_format TEXT NOT NULL CHECK (team_format IN ('traditional', 'split_boat')),
  team_size INTEGER DEFAULT 3,
  scoring_method TEXT NOT NULL,
  line_classes TEXT[],
  
  -- Rules (can override competition type)
  species_rules JSONB,
  bag_limits JSONB,
  minimum_sizes JSONB,
  rules_override JSONB,
  
  -- Geographic boundaries (optional)
  boundary_coordinates GEOGRAPHY(POLYGON, 4326),
  
  -- Status
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'registration_open', 'active', 'completed', 'cancelled')),
  
  -- Administrative
  admin_users UUID[], -- Array of user IDs who can manage this competition
  entry_fee DECIMAL,
  prize_structure JSONB,
  
  -- Metadata
  description TEXT,
  rules_document_url TEXT,
  logo_url TEXT,
  compiled_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_competitions_type_id ON competitions(competition_type_id);
CREATE INDEX idx_competitions_hosting_org ON competitions(hosting_organization_id);
CREATE INDEX idx_competitions_status ON competitions(status);
CREATE INDEX idx_competitions_dates ON competitions(start_date, end_date);

-- Competition Days (for multi-day events)
CREATE TABLE competition_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID REFERENCES competitions(id) NOT NULL,
  day_number INTEGER NOT NULL,
  date DATE NOT NULL,
  fishing_start_time TIME,
  fishing_end_time TIME,
  lines_up_time TIME,
  weather_conditions TEXT,
  cancelled BOOLEAN DEFAULT false,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(competition_id, day_number)
);

CREATE INDEX idx_competition_days_competition_id ON competition_days(competition_id);
CREATE INDEX idx_competition_days_date ON competition_days(date);

-- Teams
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID REFERENCES competitions(id) NOT NULL,
  name TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id), -- Province or club
  captain_id UUID REFERENCES users(id),
  team_type TEXT, -- e.g., 'Provincial', 'Barbarian', 'Ladies', etc.
  division TEXT, -- e.g., 'Senior', 'Junior U19', 'Ladies'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_teams_competition_id ON teams(competition_id);
CREATE INDEX idx_teams_organization_id ON teams(organization_id);

-- Competition Participants (Registration)
CREATE TABLE competition_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID REFERENCES competitions(id) NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  team_id UUID REFERENCES teams(id),
  registration_date TIMESTAMPTZ DEFAULT NOW(),
  entry_fee_paid BOOLEAN DEFAULT false,
  division TEXT,
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'withdrawn', 'disqualified')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(competition_id, user_id)
);

CREATE INDEX idx_participants_competition_id ON competition_participants(competition_id);
CREATE INDEX idx_participants_user_id ON competition_participants(user_id);
CREATE INDEX idx_participants_team_id ON competition_participants(team_id);

-- ============================================================================
-- BOAT ASSIGNMENTS (Handles both Traditional and Split-boat formats)
-- ============================================================================

CREATE TABLE boat_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID REFERENCES competitions(id) NOT NULL,
  competition_day_id UUID REFERENCES competition_days(id),
  boat_id UUID REFERENCES boats(id) NOT NULL,
  skipper_id UUID REFERENCES skippers(id) NOT NULL,
  
  -- Anglers on this boat (3 anglers typical)
  angler_1_id UUID REFERENCES users(id),
  angler_1_team_id UUID REFERENCES teams(id),
  angler_1_position TEXT, -- 'starboard', 'port_front', 'port_back'
  
  angler_2_id UUID REFERENCES users(id),
  angler_2_team_id UUID REFERENCES teams(id),
  angler_2_position TEXT,
  
  angler_3_id UUID REFERENCES users(id),
  angler_3_team_id UUID REFERENCES teams(id),
  angler_3_position TEXT,
  
  -- Crew (optional, for Heavy Tackle Billfish)
  crew_member_id UUID REFERENCES users(id),
  
  -- Assignment metadata
  assignment_method TEXT, -- 'draw', 'rotation', 'manual'
  draw_order INTEGER,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- For traditional format: all anglers from same team
  -- For split-boat format: anglers from different teams
  UNIQUE(competition_id, competition_day_id, boat_id)
);

CREATE INDEX idx_boat_assignments_competition_id ON boat_assignments(competition_id);
CREATE INDEX idx_boat_assignments_day_id ON boat_assignments(competition_day_id);
CREATE INDEX idx_boat_assignments_boat_id ON boat_assignments(boat_id);
CREATE INDEX idx_boat_assignments_skipper_id ON boat_assignments(skipper_id);
CREATE INDEX idx_boat_assignments_angler_1 ON boat_assignments(angler_1_id);
CREATE INDEX idx_boat_assignments_angler_2 ON boat_assignments(angler_2_id);
CREATE INDEX idx_boat_assignments_angler_3 ON boat_assignments(angler_3_id);

-- ============================================================================
-- FISHING SESSIONS & CATCHES
-- ============================================================================

-- Sessions (Fishing trips)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  competition_id UUID REFERENCES competitions(id),
  competition_day_id UUID REFERENCES competition_days(id),
  boat_assignment_id UUID REFERENCES boat_assignments(id),
  
  -- Session details
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  location_start GEOGRAPHY(POINT, 4326),
  location_end GEOGRAPHY(POINT, 4326),
  
  -- GPS track (optional - for analysis)
  gps_track GEOGRAPHY(LINESTRING, 4326),
  
  -- Conditions
  weather_conditions TEXT,
  sea_state TEXT,
  water_temp_celsius DECIMAL,
  
  -- Method
  fishing_method TEXT, -- 'trolling', 'drifting', 'anchored', 'jigging', etc.
  target_species TEXT[],
  
  -- Effort
  effort_hours DECIMAL,
  lines_in_water INTEGER,
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_competition_id ON sessions(competition_id);
CREATE INDEX idx_sessions_competition_day_id ON sessions(competition_day_id);
CREATE INDEX idx_sessions_boat_assignment_id ON sessions(boat_assignment_id);
CREATE INDEX idx_sessions_start_time ON sessions(start_time);

-- Catches (The core data!)
CREATE TABLE catches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Who/What/Where/When
  user_id UUID REFERENCES users(id) NOT NULL,
  species_id UUID REFERENCES species(id) NOT NULL,
  session_id UUID REFERENCES sessions(id),
  caught_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location GEOGRAPHY(POINT, 4326),
  grid_reference TEXT, -- SADSAA grid number
  
  -- Competition context (if applicable)
  competition_id UUID REFERENCES competitions(id),
  competition_day_id UUID REFERENCES competition_days(id),
  team_id UUID REFERENCES teams(id),
  boat_assignment_id UUID REFERENCES boat_assignments(id),
  is_competition_entry BOOLEAN DEFAULT false,
  
  -- Measurements
  weight_kg DECIMAL,
  length_cm DECIMAL,
  girth_cm DECIMAL,
  official_measurement BOOLEAN DEFAULT false,
  measurement_method TEXT, -- 'scale', 'measuring_mat', 'estimated'
  
  -- Catch details
  released BOOLEAN DEFAULT false,
  mutilated BOOLEAN DEFAULT false,
  taken_by_predator BOOLEAN DEFAULT false,
  
  -- Gear used
  line_class TEXT,
  tackle_used TEXT,
  bait_lure_used TEXT,
  hook_type TEXT, -- 'j-hook', 'circle-hook-offset', 'circle-hook-non-offset'
  
  -- Verification (for competition catches)
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'disqualified')),
  verified_by UUID REFERENCES users(id),
  verification_date TIMESTAMPTZ,
  verification_notes TEXT,
  disqualification_reason TEXT,
  
  -- Witness info (for competitions)
  witness_name TEXT,
  witness_contact TEXT,
  
  -- Points (calculated based on competition rules)
  points_awarded DECIMAL,
  bonus_points DECIMAL,
  rank_in_competition INTEGER,
  rank_on_boat INTEGER, -- For split-boat format
  
  -- Photos
  photo_urls TEXT[],
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_catches_user_id ON catches(user_id);
CREATE INDEX idx_catches_species_id ON catches(species_id);
CREATE INDEX idx_catches_session_id ON catches(session_id);
CREATE INDEX idx_catches_competition_id ON catches(competition_id);
CREATE INDEX idx_catches_competition_day_id ON catches(competition_day_id);
CREATE INDEX idx_catches_team_id ON catches(team_id);
CREATE INDEX idx_catches_boat_assignment_id ON catches(boat_assignment_id);
CREATE INDEX idx_catches_caught_at ON catches(caught_at);
CREATE INDEX idx_catches_verification_status ON catches(verification_status);
CREATE INDEX idx_catches_is_competition ON catches(is_competition_entry) WHERE is_competition_entry = true;

-- Spatial index for catches
CREATE INDEX idx_catches_location ON catches USING GIST(location);

-- Catch Photos (separate table for multiple photos per catch)
CREATE TABLE catch_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  catch_id UUID REFERENCES catches(id) NOT NULL,
  photo_url TEXT NOT NULL,
  photo_type TEXT CHECK (photo_type IN ('fish_full', 'measurement', 'scale', 'witness', 'release', 'other')),
  caption TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_catch_photos_catch_id ON catch_photos(catch_id);

-- ============================================================================
-- SCORING & LEADERBOARDS
-- ============================================================================

-- Competition Scores (Cached calculations)
CREATE TABLE competition_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID REFERENCES competitions(id) NOT NULL,
  competition_day_id UUID REFERENCES competition_days(id),
  
  -- Scoring entity (team or individual)
  team_id UUID REFERENCES teams(id),
  user_id UUID REFERENCES users(id),
  
  -- Scores
  total_points DECIMAL DEFAULT 0,
  total_catches INTEGER DEFAULT 0,
  total_species INTEGER DEFAULT 0,
  total_releases INTEGER DEFAULT 0,
  
  -- Rankings
  overall_rank INTEGER,
  day_rank INTEGER,
  division_rank INTEGER,
  
  -- Boat performance (for split-boat format)
  boat_assignment_id UUID REFERENCES boat_assignments(id),
  boat_rank INTEGER,
  boat_percentage DECIMAL, -- For split-boat format
  
  -- Updated timestamp
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(competition_id, competition_day_id, team_id, user_id)
);

CREATE INDEX idx_scores_competition_id ON competition_scores(competition_id);
CREATE INDEX idx_scores_team_id ON competition_scores(team_id);
CREATE INDEX idx_scores_user_id ON competition_scores(user_id);
CREATE INDEX idx_scores_overall_rank ON competition_scores(overall_rank);

-- ============================================================================
-- AUDIT & HISTORY
-- ============================================================================

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_species_updated_at BEFORE UPDATE ON species FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_boats_updated_at BEFORE UPDATE ON boats FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_skippers_updated_at BEFORE UPDATE ON skippers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_competition_types_updated_at BEFORE UPDATE ON competition_types FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_competitions_updated_at BEFORE UPDATE ON competitions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_catches_updated_at BEFORE UPDATE ON catches FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
