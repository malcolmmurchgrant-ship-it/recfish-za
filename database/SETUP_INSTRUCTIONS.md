# RecFish ZA - Database Setup Instructions

## Overview
This guide will walk you through setting up your complete RecFish ZA database in Supabase. The process takes approximately 10-15 minutes.

## What You're Setting Up
- ✅ Complete database schema (users, competitions, catches, etc.)
- ✅ 497 South African fish species with full data
- ✅ 6 pre-configured SADSAA competition types
- ✅ Both traditional and split-boat competition formats
- ✅ All 4 scoring engines (Billfish, Tuna, Gamefish, Bottomfish)

## Prerequisites
- ✅ Supabase account created
- ✅ Project created: "RecfishZA" (Project ID: vfudcvosdmzljtzxkjmo)
- ✅ Project URL: https://vfudcvosdmzljtzxkjmo.supabase.co
- ✅ You have your project password saved

---

## Step 1: Access Supabase SQL Editor

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Click on your "RecfishZA" project
3. In the left sidebar, click on **"SQL Editor"**
4. You should see a blank SQL query window

---

## Step 2: Run Schema Creation

### 2.1 Open the Schema File
- Open the file: `database/01_schema.sql`
- This file is quite large (~800 lines)

### 2.2 Copy and Run
1. Select ALL text in `01_schema.sql` (Ctrl+A or Cmd+A)
2. Copy it (Ctrl+C or Cmd+C)
3. Paste into Supabase SQL Editor
4. Click the **"Run"** button (or press Ctrl+Enter)

### 2.3 Wait for Completion
- This should take 5-10 seconds
- You should see: "Success. No rows returned"
- This means all tables were created successfully

### 2.4 Verify Tables Created
1. In left sidebar, click **"Table Editor"**
2. You should see many tables listed:
   - users
   - organizations
   - species
   - competitions
   - catches
   - teams
   - boat_assignments
   - And many more...

✅ **Schema creation complete!**

---

## Step 3: Import Species Data

### 3.1 Open the Species Import File
- Open the file: `database/02_import_species.sql`
- This file is VERY large (~1.4 MB, 497 species)

### 3.2 Copy and Run (May take a moment)
1. Select ALL text in `02_import_species.sql`
2. Copy it
3. Paste into Supabase SQL Editor
4. Click **"Run"**

### 3.3 Wait for Import
- This may take 30-60 seconds (it's a lot of data!)
- Don't worry if it seems slow
- You should see: "Success. No rows returned"

### 3.4 Verify Species Imported
1. Go to **Table Editor** in left sidebar
2. Click on the **"species"** table
3. You should see 497 rows!
4. Browse through and verify your fish are there:
   - Cape Anchovy
   - Yellowfin Tuna
   - Geelbek
   - Etc.

✅ **Species import complete!** You now have 497 fish species in your database.

---

## Step 4: Load Competition Types

### 4.1 Open Competition Types File
- Open the file: `database/03_competition_types.sql`

### 4.2 Copy and Run
1. Select ALL text in `03_competition_types.sql`
2. Copy it
3. Paste into Supabase SQL Editor
4. Click **"Run"**

### 4.3 Verify Competition Types
1. Go to **Table Editor**
2. Click on **"competition_types"** table
3. You should see 6 rows:
   - SADSAA Heavy Tackle Billfish
   - SADSAA Light Tackle Billfish
   - SADSAA Tuna
   - SADSAA Gamefish
   - SADSAA Bottomfish (2023 Rules)
   - SADSAA Bottomfish (Traditional)

✅ **Competition types loaded!**

---

## Step 5: Verify Everything Works

### Quick Database Check

Run this query in SQL Editor to verify everything:

```sql
-- Count tables
SELECT 
  'Organizations' as table_name, COUNT(*) as count FROM organizations
UNION ALL
SELECT 'Species', COUNT(*) FROM species
UNION ALL
SELECT 'Competition Types', COUNT(*) FROM competition_types
UNION ALL
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Competitions', COUNT(*) FROM competitions
UNION ALL
SELECT 'Catches', COUNT(*) FROM catches;
```

**Expected results:**
```
Organizations: 0 (none created yet - that's fine)
Species: 497 ✅
Competition Types: 6 ✅
Users: 0 (none yet)
Competitions: 0 (none yet)
Catches: 0 (none yet)
```

### Test Species Lookup

Try this query to find some fish:

```sql
SELECT 
  common_name, 
  scientific_name, 
  afrikaans_name,
  bag_limit,
  minimum_size_cm
FROM species 
WHERE common_name ILIKE '%tuna%'
ORDER BY common_name;
```

You should see all your tuna species!

---

## Step 6: Get Your Connection Details

You'll need these for the React app:

### 6.1 Project URL
- Already have this: `https://vfudcvosdmzljtzxkjmo.supabase.co`

### 6.2 Anon Key (Public Key)
1. In Supabase dashboard, click **"Settings"** (gear icon in left sidebar)
2. Click **"API"**
3. Find **"Project API keys"**
4. Copy the **"anon public"** key
5. Save it somewhere safe

### 6.3 Service Role Key (Optional - for admin operations)
- On same API settings page
- Copy **"service_role"** key if needed
- ⚠️ Keep this SECRET - don't share publicly!

---

## Database Setup Complete! ✅

You now have:
- ✅ Complete database structure
- ✅ 497 fish species loaded
- ✅ 6 SADSAA competition types configured
- ✅ Ready for the React app to connect

---

## Next Steps

1. **Test the React App**
   - We'll build the React app next
   - It will connect to this database
   - You'll be able to log catches!

2. **Add Some Test Data** (Optional)
   - Create a test user
   - Create a test competition
   - Log some test catches
   - See the system working!

---

## Troubleshooting

### Problem: "Error: relation already exists"
**Solution:** Tables already exist. Either:
- Skip that file (already done)
- Or drop all tables and start fresh:
  ```sql
  -- WARNING: This deletes everything!
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  -- Then run 01_schema.sql again
  ```

### Problem: "Error: insert or update violates foreign key constraint"
**Solution:** Run files in order:
1. First: `01_schema.sql`
2. Second: `02_import_species.sql`
3. Third: `03_competition_types.sql`

### Problem: Species import taking too long
**Solution:** 
- This is normal - 497 species takes time
- Wait 1-2 minutes
- If it times out, try running in smaller batches
- Or contact me for help splitting the file

### Problem: Can't find SQL Editor
**Solution:**
- Look in left sidebar
- Icon looks like `</>`
- Or search for "SQL" in Supabase search bar

---

## Database Schema Quick Reference

### Main Tables
- **users** - Anglers/users
- **organizations** - SADSAA, provinces, clubs
- **species** - 497 fish species
- **boats** - Tournament boats
- **skippers** - Boat skippers
- **competitions** - Specific tournaments
- **teams** - Competition teams
- **boat_assignments** - Daily boat/angler assignments
- **catches** - All fish caught
- **competition_scores** - Leaderboards

### Key Features
- ✅ Supports both competition formats (traditional & split-boat)
- ✅ GPS tracking (PostGIS enabled)
- ✅ Photo uploads
- ✅ Verification workflows
- ✅ Real-time scoring
- ✅ Automatic catch reports

---

## Need Help?

If you run into any issues:
1. Check the error message
2. Verify you ran files in order
3. Try the troubleshooting section
4. Ask me - I'm here to help!

---

**Ready for the next step? Let me know when your database is set up and we'll build the React app!** 🎣
