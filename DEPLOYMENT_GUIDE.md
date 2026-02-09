# RecFish ZA - Deployment Guide

## 🚀 Quick Deploy to Netlify

### Prerequisites
- GitHub account (free)
- Netlify account (free)

---

## Step 1: Create GitHub Repository

### Option A: Using GitHub Desktop (Easiest)
1. Download and install GitHub Desktop: https://desktop.github.com/
2. Open GitHub Desktop
3. Click **File** → **Add Local Repository**
4. Navigate to: `C:\Users\DELL\Downloads\recfish-za-app\recfish-za-app-complete`
5. Click **Add Repository**
6. It will say "not a Git repository" - click **Create a Repository**
7. Name: `recfish-za`
8. Description: `RecFish ZA - Recreational Fishing Catch Logger for South Africa`
9. Click **Create Repository**
10. Click **Publish repository** (top right)
11. Uncheck "Keep this code private" (or keep it checked if you prefer)
12. Click **Publish Repository**

### Option B: Using Git Command Line
If you have Git installed:
```bash
cd C:\Users\DELL\Downloads\recfish-za-app\recfish-za-app-complete
git init
git add .
git commit -m "Initial commit - RecFish ZA complete"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/recfish-za.git
git push -u origin main
```

---

## Step 2: Deploy to Netlify

### 2.1 Create Netlify Account
1. Go to https://www.netlify.com/
2. Click **Sign up**
3. Choose **GitHub** to sign up (easiest - links accounts automatically)
4. Authorize Netlify to access your GitHub

### 2.2 Deploy the Site
1. Click **Add new site** → **Import an existing project**
2. Click **GitHub**
3. Find and select your **recfish-za** repository
4. Configure build settings:
   - **Branch to deploy:** `main`
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Click **Show advanced** → **Add environment variable**
6. Add these two variables:
   ```
   VITE_SUPABASE_URL = https://vfudcvosdmzljtzxkjmo.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmdWRjdm9zZG16bGp0enhram1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1OTIyOTgsImV4cCI6MjA4NTE2ODI5OH0.s4uUCjoTj2Mp_ywoYkVwaK1nz9yyJZ2744ZQEU9DNGo
   ```
7. Click **Deploy site**

### 2.3 Wait for Build
- Netlify will build your site (2-5 minutes)
- You'll get a URL like: `https://fancy-name-123456.netlify.app`

### 2.4 Rename Your Site (Optional)
1. Go to **Site settings** → **General** → **Site details**
2. Click **Change site name**
3. Choose something like: `recfish-za` or `recfishza`
4. Your URL becomes: `https://recfish-za.netlify.app`

---

## Step 3: Test on Your Android Phone

### Method 1: Install as PWA (Progressive Web App)
1. Open Chrome on your Android phone
2. Go to your Netlify URL (e.g., `https://recfish-za.netlify.app`)
3. Tap the **⋮** menu (three dots)
4. Tap **"Add to Home screen"** or **"Install app"**
5. Name it "RecFish ZA"
6. Tap **Add**
7. The app icon appears on your home screen!
8. Open it - it works like a native app! 📱

### Method 2: Just Use in Browser
- Simply open the URL in any browser on your phone
- Works immediately, no installation needed

---

## Step 4: Configure Supabase for Production

### 4.1 Update Allowed URLs
1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your **RecfishZA** project
3. Go to **Authentication** → **URL Configuration**
4. Add your Netlify URL to **Site URL**: `https://recfish-za.netlify.app`
5. Add to **Redirect URLs**: `https://recfish-za.netlify.app/**`
6. Click **Save**

### 4.2 Test Authentication
1. Open your deployed app
2. Try to sign up / log in
3. Should work perfectly!

---

## Step 5: Future Updates

### When You Want to Update the App:
1. Make changes to your code locally
2. In GitHub Desktop:
   - It will show your changes
   - Write a summary (e.g., "Added tournament module")
   - Click **Commit to main**
   - Click **Push origin**
3. Netlify automatically rebuilds and deploys! ✨
4. Your app updates in 2-5 minutes

---

## Troubleshooting

### Build Failed on Netlify
**Check the deploy log for errors:**
- Usually missing dependencies
- Environment variables not set correctly

**Common fixes:**
```bash
# If you need to rebuild locally first
npm install
npm run build
```

### App Shows Blank Page
**Check browser console (F12):**
- Look for errors
- Usually Supabase connection issues
- Verify environment variables in Netlify

### Can't Connect to Supabase
1. Check **Site settings** → **Environment variables**
2. Make sure both variables are there
3. Redeploy: **Deploys** → **Trigger deploy** → **Deploy site**

### Images Not Loading
- Make sure Supabase Storage is set up
- Check CORS settings in Supabase

---

## Advanced: Custom Domain (Optional)

### If You Want Your Own Domain (e.g., recfishza.co.za)
1. Buy domain from provider (Afrihost, Axxess, etc.)
2. In Netlify: **Domain settings** → **Add custom domain**
3. Follow instructions to update DNS records
4. Free SSL certificate automatically included!

---

## Performance Tips

### PWA Benefits:
- ✅ Works offline (after first load)
- ✅ Fast loading
- ✅ Full screen mode
- ✅ Access to GPS, camera
- ✅ Feels like a native app

### Netlify Benefits:
- ✅ Auto SSL (HTTPS)
- ✅ Global CDN
- ✅ Automatic deployments
- ✅ Rollback capability
- ✅ Branch previews

---

## Support

If you run into issues:
1. Check Netlify deploy logs
2. Check browser console (F12)
3. Check Supabase logs
4. Share error messages for help

---

## Next Steps After Deployment

1. ✅ Test all features on phone
2. ✅ Add to home screen
3. ✅ Test offline functionality
4. ✅ Test GPS and camera
5. ✅ Share with SADSAA members for beta testing
6. 🎣 Start logging catches!

**Your app is now live and ready for fishing! 🎣📱**
