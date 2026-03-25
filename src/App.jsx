-- ============================================================
-- Junior Gamefish Nationals 2026 — Seed Data
-- Competition ID: ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77
-- ============================================================

-- STEP 1: Insert competition days
INSERT INTO competition_days (competition_id, day_number, date, session_status)
VALUES
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 1, '2026-03-30', 'pending'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 2, '2026-03-31', 'pending'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 3, '2026-04-01', 'pending'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 4, '2026-04-02', 'pending');

-- STEP 2: Insert boats
INSERT INTO competition_boats (competition_id, boat_name, skipper_name)
VALUES
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Peromiromi', 'Bryan Jooste'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Go Fish', 'Michel de Kock'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Azura', 'Werner Flynn'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Make My Day', 'Jacques Stols'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Boer Seun', 'Marius Botes'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Zean Mari', 'Japir Kleinhans'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Fishaholic', 'Jaco Lingenfelder'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Bite Me', 'Alain Khan'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Da Fish 2', 'Wolle Prinsloo'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Seevarkie', 'Lynne Maree'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Mitsufishi', 'Victor Long'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'John Deere Jnr', 'Dirk Rosslee');

-- STEP 3: Insert teams
INSERT INTO competition_teams (competition_id, team_name, province, team_type)
VALUES
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'SADSAA U/19', 'SADSAA', 'U19'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Griquas U/19', 'Griquas', 'U19'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Gauteng U/19', 'Gauteng', 'U19'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Mpumalanga U/19', 'Mpumalanga', 'U19'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Southern Gauteng U/19 White', 'Southern Gauteng', 'U19'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Southern Gauteng U/19 Blue', 'Southern Gauteng', 'U19'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Barbarian U/19', 'Barbarian', 'U19'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Natal U/19', 'Natal', 'U19'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Mpumalanga U/16', 'Mpumalanga', 'U16'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Southern Gauteng U/16 Maroon', 'Southern Gauteng', 'U16'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Natal U/16', 'Natal', 'U16'),
  ('ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77', 'Gauteng U/16', 'Gauteng', 'U16');

-- STEP 4: Insert participants with unique generated UUIDs per angler
DO $$
DECLARE
  comp_id UUID := 'ec9c5e41-a41a-4f2f-b8f6-75843b3b4f77';
  t_sadsaa19 UUID;
  t_griquas19 UUID;
  t_gauteng19 UUID;
  t_mpuma19 UUID;
  t_sgwhite19 UUID;
  t_sgblue19 UUID;
  t_barb19 UUID;
  t_natal19 UUID;
  t_mpuma16 UUID;
  t_sgmaroon16 UUID;
  t_natal16 UUID;
  t_gauteng16 UUID;
BEGIN
  SELECT id INTO t_sadsaa19   FROM competition_teams WHERE competition_id = comp_id AND team_name = 'SADSAA U/19';
  SELECT id INTO t_griquas19  FROM competition_teams WHERE competition_id = comp_id AND team_name = 'Griquas U/19';
  SELECT id INTO t_gauteng19  FROM competition_teams WHERE competition_id = comp_id AND team_name = 'Gauteng U/19';
  SELECT id INTO t_mpuma19    FROM competition_teams WHERE competition_id = comp_id AND team_name = 'Mpumalanga U/19';
  SELECT id INTO t_sgwhite19  FROM competition_teams WHERE competition_id = comp_id AND team_name = 'Southern Gauteng U/19 White';
  SELECT id INTO t_sgblue19   FROM competition_teams WHERE competition_id = comp_id AND team_name = 'Southern Gauteng U/19 Blue';
  SELECT id INTO t_barb19     FROM competition_teams WHERE competition_id = comp_id AND team_name = 'Barbarian U/19';
  SELECT id INTO t_natal19    FROM competition_teams WHERE competition_id = comp_id AND team_name = 'Natal U/19';
  SELECT id INTO t_mpuma16    FROM competition_teams WHERE competition_id = comp_id AND team_name = 'Mpumalanga U/16';
  SELECT id INTO t_sgmaroon16 FROM competition_teams WHERE competition_id = comp_id AND team_name = 'Southern Gauteng U/16 Maroon';
  SELECT id INTO t_natal16    FROM competition_teams WHERE competition_id = comp_id AND team_name = 'Natal U/16';
  SELECT id INTO t_gauteng16  FROM competition_teams WHERE competition_id = comp_id AND team_name = 'Gauteng U/16';

  -- Each angler gets a unique generated UUID as their placeholder user_id
  INSERT INTO competition_participants (competition_id, user_id, team_id, full_name, division, category, line_class_kg) VALUES
    (comp_id, gen_random_uuid(), t_sadsaa19,   'Sheldon Kruger',      'U19', 'Captain', 10),
    (comp_id, gen_random_uuid(), t_sadsaa19,   'Aldrich Elof',        'U19', 'Crew 1',  10),
    (comp_id, gen_random_uuid(), t_sadsaa19,   'Melchior Williams',   'U19', 'Crew 2',  10),
    (comp_id, gen_random_uuid(), t_griquas19,  'Joshua Louw',         'U19', 'Captain', 10),
    (comp_id, gen_random_uuid(), t_griquas19,  'Kyle Louw',           'U19', 'Crew 1',  10),
    (comp_id, gen_random_uuid(), t_griquas19,  'Joshua Santana',      'U19', 'Crew 2',  10),
    (comp_id, gen_random_uuid(), t_gauteng19,  'Francois Smith',      'U19', 'Captain', 10),
    (comp_id, gen_random_uuid(), t_gauteng19,  'Sebastian Szabo',     'U19', 'Crew 1',  10),
    (comp_id, gen_random_uuid(), t_gauteng19,  'Braam Nel',           'U19', 'Crew 2',  10),
    (comp_id, gen_random_uuid(), t_mpuma19,    'Wilco Botha',         'U19', 'Captain', 10),
    (comp_id, gen_random_uuid(), t_mpuma19,    'Marko Siemens',       'U19', 'Crew 1',  10),
    (comp_id, gen_random_uuid(), t_mpuma19,    'Reuben Kruger',       'U19', 'Crew 2',  10),
    (comp_id, gen_random_uuid(), t_sgwhite19,  'Marcu Da Serra',      'U19', 'Captain', 10),
    (comp_id, gen_random_uuid(), t_sgwhite19,  'Marcu Forte',         'U19', 'Crew 1',  10),
    (comp_id, gen_random_uuid(), t_sgwhite19,  'Owen Lineker',        'U19', 'Crew 2',  10),
    (comp_id, gen_random_uuid(), t_sgblue19,   'Bruce Collett',       'U19', 'Captain', 10),
    (comp_id, gen_random_uuid(), t_sgblue19,   'Christiaan du Plooy', 'U19', 'Crew 1',  10),
    (comp_id, gen_random_uuid(), t_sgblue19,   'Zaydi Wilmans',       'U19', 'Crew 2',  10),
    (comp_id, gen_random_uuid(), t_barb19,     'Gerhard Oosthuizen',  'U19', 'Captain', 10),
    (comp_id, gen_random_uuid(), t_barb19,     'Josh Lingenfelder',   'U19', 'Crew 1',  10),
    (comp_id, gen_random_uuid(), t_barb19,     'Mickyle Vermaak',     'U19', 'Crew 2',  10),
    (comp_id, gen_random_uuid(), t_natal19,    'Brayden Kane',        'U19', 'Captain', 10),
    (comp_id, gen_random_uuid(), t_natal19,    'Adam Bester',         'U19', 'Crew 1',  10),
    (comp_id, gen_random_uuid(), t_natal19,    'Claire Joyce',        'U19', 'Crew 2',  10),
    (comp_id, gen_random_uuid(), t_mpuma16,    'Taylor Gower',        'U16', 'Captain', 10),
    (comp_id, gen_random_uuid(), t_mpuma16,    'Willem Smith',        'U16', 'Crew 1',  10),
    (comp_id, gen_random_uuid(), t_mpuma16,    'Estvan Nieuwoudt',    'U16', 'Crew 2',  10),
    (comp_id, gen_random_uuid(), t_sgmaroon16, 'Daniel Rosslee',      'U16', 'Captain', 10),
    (comp_id, gen_random_uuid(), t_sgmaroon16, 'Cyntitia du Plooy',   'U16', 'Crew 1',  10),
    (comp_id, gen_random_uuid(), t_sgmaroon16, 'Phillip Hugo',        'U16', 'Crew 2',  10),
    (comp_id, gen_random_uuid(), t_natal16,    'Keagyn Mocke',        'U16', 'Captain', 10),
    (comp_id, gen_random_uuid(), t_natal16,    'Lily Joyce',          'U16', 'Crew 1',  10),
    (comp_id, gen_random_uuid(), t_natal16,    'Declan Hewison',      'U16', 'Crew 2',  10),
    (comp_id, gen_random_uuid(), t_gauteng16,  'Conrad Wasserman',    'U16', 'Captain', 10),
    (comp_id, gen_random_uuid(), t_gauteng16,  'Liam Wasserman',      'U16', 'Crew 1',  10),
    (comp_id, gen_random_uuid(), t_gauteng16,  'Christian Smith',     'U16', 'Crew 2',  10);

END $$;
