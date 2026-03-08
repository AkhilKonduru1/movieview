# 🚀 Quick Start Guide for MovieView

## Local Testing

### Using Python
```bash
python3 -m http.server 8000
```

### Using Node.js
```bash
npx http-server
```

### Using PHP
```bash
php -S localhost:8000
```

Then open **http://localhost:8000** in your browser.

---

## Deploy to Vercel (3 Steps)

### Step 1: Push to GitHub
```bash
cd movieview
git add .
git commit -m "Initial MovieView commit"
git push origin main
```

### Step 2: Connect to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click **"New Project"** or **"Add New..."**
3. Select **"Import Git Repository"**
4. Paste your GitHub repo URL
5. Click **"Import"**
6. Click **"Deploy"** (no extra configuration needed!)

### Step 3: Done!
Your app will be live at a Vercel URL like:
```
https://movieview-xxx.vercel.app
```

---

## Features Included

✅ Trending movies from TMDB
✅ Movie search with real-time results
✅ Embedded Vidking player (50K+ movies)
✅ Watch progress tracking
✅ Fully responsive design
✅ Dark theme UI
✅ Zero configuration needed
✅ Zero dependencies (no npm packages!)
✅ Auto-deploy on push

---

## Testing Locally

1. **Open** http://localhost:8000
2. **Browse** - See trending movies load
3. **Search** - Type a movie name (e.g., "The Matrix")
4. **Click** a movie to watch it
5. **Player** - Should load automatically with the Vidking embed

---

## Environment

The app uses public APIs with no authentication needed:
- ✅ TMDB API Key: Pre-configured
- ✅ Vidking Player: Public endpoint
- ✅ No environment variables needed!

---

## Browser Support

- Chrome/Edge (Latest)
- Firefox (Latest)
- Safari (Latest)
- Mobile browsers

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Movies won't load | Check internet, refresh page |
| Player won't play | Try another movie, reload tab |
| Search not working | Clear search box, try again |
| Deployment stuck | Check Vercel dashboard for errors |

---

## File Structure

```
movieview/
├── index.html          ← Main page
├── style.css           ← All styling
├── script.js           ← All logic
├── vercel.json         ← Deploy config
└── README.md           ← Documentation
```

That's it! No build step, no package.json, no webpack. Just pure HTML/CSS/JS! 🎉

---

For issues: Check browser DevTools (F12) → Console for errors
