# Quick Setup Guide - RecFish ZA App

**Time required: 10-15 minutes**

---

## ✅ Prerequisites Check

You already have:
- ✅ Node.js v24.13.0 installed
- ✅ npm v11.6.2 installed
- ✅ Supabase database set up with 497 species
- ✅ Git installed

---

## Step-by-Step Setup

### 1. Download & Extract

You should have downloaded a ZIP file containing the `recfish-za-app` folder.

**Extract it to somewhere easy to find**, like:
- `C:\Users\YourName\Desktop\recfish-za-app`
- Or anywhere you keep projects

### 2. Open Command Prompt

**Windows 10/11:**
1. Press `Windows key + R`
2. Type `cmd` and press Enter
3. Navigate to your app folder:
   ```
   cd C:\Users\YourName\Desktop\recfish-za-app
   ```

Replace the path with wherever you extracted the folder.

### 3. Install Packages

In Command Prompt, run:

```bash
npm install
```

**What you'll see:**
- Lots of text scrolling
- "added 150 packages" or similar
- Takes 1-2 minutes

**If you get errors:**
- Make sure you're in the right folder (should contain `package.json`)
- Try running as Administrator

### 4. Get Supabase Credentials

**Open a web browser and:**

1. Go to https://supabase.com/dashboard
2. Log in to your account
3. Click on your **"RecfishZA"** project
4. In the left sidebar, click **Settings** (gear icon at bottom)
5. Click **API** (in settings menu)

**You need TWO things:**

#### A. Project URL
- Under "Project URL"
- Looks like: `https://vfudcvosdmzljtzxkjmo.supabase.co`
- Copy this

#### B. Anon Key
- Under "Project API keys"
- Find the **"anon public"** key
- It's a long string starting with `eyJ...`
- Click the copy icon to copy it

**Keep these handy** - you'll need them in the next step.

### 5. Create Environment File

**In your app folder:**

1. Find the file called `.env.example`
2. **Right-click** on it → **Copy**
3. **Right-click** in the folder → **Paste**
4. **Rename** the copy to `.env.local` (exactly, with the dot at the start)

**Open `.env.local` in Notepad:**

1. Right-click `.env.local` → Open with → Notepad
2. You'll see:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url_here
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```
3. Replace `your_supabase_project_url_here` with your actual URL
4. Replace `your_supabase_anon_key_here` with your actual anon key

**Example:**
```
VITE_SUPABASE_URL=https://vfudcvosdmzljtzxkjmo.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmdWRjdm9zZG16bGp0enhramo...
```

5. **Save the file** (Ctrl+S)
6. **Close Notepad**

### 6. Start the App!

**Back in Command Prompt:**

```bash
npm run dev
```

**What you'll see:**
```
  VITE v5.0.11  ready in 500 ms

  ➜  Local:   http://localhost:3000/
```

**The app should automatically open in your web browser!**

If not, manually open your browser and go to: `http://localhost:3000`

---

## 🎉 Success! You Should See:

A login page with:
- 🎣 RecFish ZA logo
- Email and password fields
- "Sign in" and "Sign up" options

---

## First Time Use

### Create Your Account

1. Click **"Sign up"** (bottom of login form)
2. Enter:
   - Your full name
   - Email address
   - Password (at least 6 characters)
   - Confirm password
3. Click **"Sign Up"**
4. You'll be automatically logged in!

### Test the Species Database

1. Click **"Species Lookup"** in the top navigation
2. Try searching:
   - "yellowtail" - should show Cape Yellowtail
   - "geelbek" - should show Geelbek
   - "tuna" - should show all tuna species
3. Click on any species to see full details

**You should see fish appearing!** This means your database connection is working! ✅

### Log a Test Catch

1. Click **"Log Catch"**
2. Type a species name (e.g., "yellowtail")
3. Select from dropdown
4. Enter weight or length
5. Click **"Log Catch"**
6. Go to **"My Catches"** to see it!

---

## Troubleshooting

### Problem: "Cannot find module"
**Solution:** 
```bash
npm install
```
Run this again in the app folder.

### Problem: "Missing Supabase environment variables"
**Solution:**
- Check that you created `.env.local` (not `.env.example`)
- Make sure the file has your actual Supabase URL and key
- No extra spaces or quotes

### Problem: Port 3000 already in use
**Solution:** 
Either close whatever's using port 3000, or change the port:
1. Open `vite.config.js`
2. Change `port: 3000` to `port: 3001`
3. Save and restart: `npm run dev`

### Problem: No species showing up
**Solution:**
1. Check `.env.local` has correct credentials
2. Verify your Supabase project has 497 species (check Table Editor)
3. Press F12 in browser and check Console tab for errors

---

## Stopping the App

**To stop the development server:**
- In Command Prompt, press `Ctrl + C`
- Type `Y` and press Enter

**To start again:**
- Navigate back to the folder: `cd path\to\recfish-za-app`
- Run: `npm run dev`

---

## Next Steps

Once you have the app running:

1. **Test all features:**
   - Create account ✅
   - Search species ✅
   - Log catches ✅
   - View catch history ✅

2. **Show someone:**
   - Your president?
   - A fellow angler?
   - Action Committee member?

3. **Plan your demo:**
   - What problem does this solve?
   - How does it help SADSAA?
   - What's the cost savings?

---

## Need Help?

If you get stuck:
1. Read the error message carefully
2. Check the Troubleshooting section above
3. Press F12 in the browser to see console errors
4. Ask me for help!

---

**Ready to fish? Your app is now running!** 🎣

The app runs on your computer at `http://localhost:3000` - only you can see it right now. Later we'll deploy it to a public URL so others can use it too.
