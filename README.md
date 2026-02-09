# RecFish ZA - South African Recreational Fishing App

A complete fishing catch reporting system for South African recreational anglers, built for SADSAA (South African Deep Sea Angling Association).

## Features

✅ **497 South African Fish Species** - Complete database with regulations  
✅ **Catch Logging** - Record your catches with weight, length, and photos  
✅ **Species Lookup** - Search fish by common name, scientific name, or Afrikaans name  
✅ **Personal Stats** - Track your fishing history and achievements  
✅ **SADSAA Competition Support** - (Coming soon) Manage tournament entries  
✅ **Offline Support** - (Coming soon) Log catches without internet  

---

## Quick Start

### Prerequisites

Make sure you have these installed:
- **Node.js** (v18 or higher) - You already have v24.13.0 ✅
- **npm** (v9 or higher) - You already have v11.6.2 ✅
- **Supabase Account** - You already have this set up ✅

### Step 1: Download the App

You should have received a folder called `recfish-za-app` containing all the files.

### Step 2: Install Dependencies

Open Command Prompt (or PowerShell/Windows Terminal) and navigate to the app folder:

```bash
cd path\to\recfish-za-app
npm install
```

This will download all required packages (~50MB). It takes 1-2 minutes.

### Step 3: Configure Supabase Connection

1. **Get your Supabase credentials:**
   - Go to https://supabase.com/dashboard
   - Open your "RecfishZA" project
   - Click **Settings** (gear icon, bottom left)
   - Click **API**
   - Copy these two values:
     - **Project URL** (looks like: `https://vfudcvosdmzljtzxkjmo.supabase.co`)
     - **anon public key** (long string starting with `eyJ...`)

2. **Create your environment file:**
   - In the `recfish-za-app` folder, find the file `.env.example`
   - Make a copy of it called `.env.local`
   - Open `.env.local` in Notepad
   - Replace the placeholder values:

```env
VITE_SUPABASE_URL=https://vfudcvosdmzljtzxkjmo.supabase.co
VITE_SUPABASE_ANON_KEY=your_actual_anon_key_here
```

3. **Save the file**

### Step 4: Run the App

Still in Command Prompt in the app folder:

```bash
npm run dev
```

You should see:
```
  VITE v5.0.11  ready in 500 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

The app should automatically open in your browser at `http://localhost:3000`

If it doesn't open automatically, just open your browser and go to `http://localhost:3000`

---

## Using the App

### 1. Create an Account

- Click **"Sign up"**
- Enter your name, email, and password
- Click **"Sign Up"**
- You'll be logged in automatically

### 2. Explore Species Database

- Click **"Species Lookup"** in the navigation
- Search for fish: try "yellowtail", "geelbek", "tuna"
- Click on any species to see full details
- All 497 species from your database are here!

### 3. Log Your First Catch

- Click **"Log Catch"** in navigation
- Start typing a species name (e.g., "yellowtail")
- Select species from dropdown
- Enter weight and/or length
- Add notes if you want
- Check "Released to sea" if you released it
- Click **"Log Catch"**

### 4. View Your Catches

- Click **"My Catches"** to see all logged catches
- View stats: Total catches, releases, total weight
- Delete any catch with the Delete button

---

## Troubleshooting

### "Cannot find module" errors

**Solution:** Run `npm install` again

### "Missing Supabase environment variables"

**Solution:** Make sure you created `.env.local` (not just `.env.example`) and added your actual Supabase URL and key

### App won't start / port 3000 in use

**Solution:** Something else is using port 3000. Either:
- Stop the other app
- Or edit `vite.config.js` and change port to 3001:
```js
server: {
  port: 3001,  // changed from 3000
  open: true
}
```

### Can't connect to database / No species showing

**Solution:** 
1. Check your `.env.local` file has correct credentials
2. Verify database is set up in Supabase (should have 497 species)
3. Check browser console for errors (F12)

### "Failed to fetch" errors

**Solution:** 
1. Make sure Supabase project is not paused
2. Check your internet connection
3. Verify API keys are correct

---

## Project Structure

```
recfish-za-app/
├── src/
│   ├── components/
│   │   └── Layout.jsx          # Main layout with navigation
│   ├── contexts/
│   │   └── AuthContext.jsx     # Authentication state management
│   ├── lib/
│   │   └── supabase.js         # Supabase client configuration
│   ├── pages/
│   │   ├── Login.jsx           # Login page
│   │   ├── SignUp.jsx          # Registration page
│   │   ├── Dashboard.jsx       # Home dashboard
│   │   ├── SpeciesLookup.jsx   # Search 497 species
│   │   ├── LogCatch.jsx        # Log new catches
│   │   └── MyCatches.jsx       # View catch history
│   ├── App.jsx                 # Main app component
│   └── main.jsx                # Entry point
├── .env.example                # Environment template
├── .env.local                  # Your config (create this!)
├── package.json                # Dependencies
├── vite.config.js              # Build configuration
└── index.html                  # HTML template
```

---

## Next Steps / Future Features

### Phase 1 (Current) ✅
- User authentication
- Species database lookup
- Basic catch logging
- Personal catch history

### Phase 2 (Coming Soon)
- Competition management
- Team assignments
- Boat draw system
- Real-time leaderboards

### Phase 3 (Planned)
- Offline-first PWA
- Photo uploads
- GPS location tracking
- Catch verification
- Competition scoring engines
- Excel export (SADSAA catch reports)

---

## For Developers

### Tech Stack
- **Frontend:** React 18 + Vite
- **Backend:** Supabase (PostgreSQL + Authentication)
- **Routing:** React Router v6
- **Styling:** Inline styles (no framework needed)

### Database Schema
See `/database/` folder for complete schema including:
- 497 species with regulations
- Competition types (6 SADSAA formats)
- Catches, teams, boats, skippers
- Both traditional and split-boat competition formats

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Building for Production

```bash
npm run build
```

This creates a `/dist` folder you can deploy to:
- Vercel (recommended - free, automatic HTTPS)
- Netlify
- Any static hosting

---

## Support

**Issues with the app?**
- Check the Troubleshooting section above
- Review your Supabase credentials
- Check browser console for errors (F12)

**Want to contribute?**
This is a community project for SA anglers. Suggestions and feedback welcome!

---

## License

Built for SADSAA Environmental Data Collection  
© 2026 South African Deep Sea Angling Association

---

## Database Status

✅ Complete PostgreSQL schema  
✅ 497 fish species loaded  
✅ 6 SADSAA competition types configured  
✅ Authentication enabled  
✅ Row Level Security configured  

---

**Ready to fish? Start the app and log your first catch!** 🎣
