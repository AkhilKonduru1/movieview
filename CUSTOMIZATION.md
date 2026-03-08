# 🎨 Customization Guide for MovieView

This guide explains how to customize MovieView to match your brand.

## 🎯 Quick Customizations

### Change Player Color

**File**: `script.js`

Find the `playMovie()` function and change the `color` parameter:

```javascript
// Current (Blue)
const playerUrl = `${VIDKING_BASE_URL}/movie/${tmdbId}?color=3b82f6&autoPlay=true`;

// Change to Netflix Red
const playerUrl = `${VIDKING_BASE_URL}/movie/${tmdbId}?color=e50914&autoPlay=true`;
```

### Available Colors

Copy the hex code and replace in the URL:

| Brand | Color | Hex Code |
|-------|-------|----------|
| Netflix | 🔴 | `e50914` |
| YouTube | 🔴 | `ff0000` |
| Twitch | 💜 | `9146ff` |
| Discord | 💙 | `5865f2` |
| Spotify | 💚 | `1db954` |
| Amazon | 🟠 | `ff9900` |
| Hulu | 🟢 | `3ee000` |
| Default (Blue) | 🔵 | `3b82f6` |

### Change Site Theme Color

**File**: `style.css`

Find the `:root` section and modify the CSS variables:

```css
:root {
    --primary-color: #0f172a;      /* Dark background */
    --secondary-color: #1e293b;    /* Card background */
    --accent-color: #3b82f6;       /* Blue highlight color */
    --accent-hover: #2563eb;       /* Dark blue hover */
    --text-primary: #ffffff;       /* Main text */
    --text-secondary: #cbd5e1;     /* Secondary text */
    --border-color: #334155;       /* Border color */
    --success-color: #10b981;      /* Green (ratings) */
}
```

### Example: Dark Red Theme

```css
:root {
    --primary-color: #1a0f0f;
    --secondary-color: #2d1818;
    --accent-color: #ef4444;       /* Red */
    --accent-hover: #dc2626;       /* Dark red */
    --text-primary: #ffffff;
    --text-secondary: #f1f5f9;
    --border-color: #523d3d;
    --success-color: #f87171;      /* Light red */
}
```

### Example: Purple Theme

```css
:root {
    --primary-color: #1a0f2e;
    --secondary-color: #2d1b4e;
    --accent-color: #8b5cf6;       /* Purple */
    --accent-hover: #7c3aed;       /* Dark purple */
    --text-primary: #ffffff;
    --text-secondary: #e9d5ff;
    --border-color: #5e3d8f;
    --success-color: #c084fc;      /* Light purple */
}
```

## 🖼️ Change Logo/Branding

**File**: `index.html`

Replace the logo in the navigation:

```html
<!-- Current -->
<h1>🎬 MovieView</h1>

<!-- Custom Logo -->
<h1>🎥 My Stream</h1>

<!-- Or with image -->
<img src="/logo.png" alt="My Stream" class="nav-logo">
```

Then add CSS:

```css
.nav-logo {
    height: 40px;
    width: auto;
}
```

## 📝 Change Footer Text

**File**: `index.html`

Find the footer section:

```html
<footer class="footer">
    <p>&copy; 2026 MovieView. Powered by TMDB & Vidking Player.</p>
</footer>
```

Change to:

```html
<footer class="footer">
    <p>&copy; 2026 My Custom Site. Movies powered by TMDB & Vidking Player.</p>
</footer>
```

## 📱 Mobile Layout Adjustments

**File**: `style.css`

Modify the responsive breakpoints:

```css
/* For tablets */
@media (max-width: 1024px) {
    .movies-grid {
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    }
}

/* For mobile phones */
@media (max-width: 480px) {
    .movies-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}
```

## 🎮 Disable Features

### Disable Autoplay

**File**: `script.js`

```javascript
// Change this line:
const playerUrl = `${VIDKING_BASE_URL}/movie/${tmdbId}?color=3b82f6&autoPlay=true`;

// To this:
const playerUrl = `${VIDKING_BASE_URL}/movie/${tmdbId}?color=3b82f6&autoPlay=false`;
```

### Add Episode Selector (for TV support)

**File**: `script.js`

Modify the `playTVShow()` function (you'd need to add this):

```javascript
function playTVShow(tmdbId, season = 1, episode = 1) {
    const playerUrl = `${VIDKING_BASE_URL}/tv/${tmdbId}/${season}/${episode}?color=3b82f6&autoPlay=true&episodeSelector=true&nextEpisode=true`;
    document.getElementById('videoPlayer').src = playerUrl;
}
```

## 🔒 Hide/Show Elements

### Hide the Search Bar

**File**: `style.css`

```css
.nav-search {
    display: none;
}
```

### Hide Ratings on Cards

**File**: `style.css`

```css
.movie-card-rating {
    display: none;
}
```

## 🎨 Advanced Styling

### Custom Card Shadows

**File**: `style.css`

```css
.movie-card {
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);  /* More shadow */
}

.movie-card:hover {
    box-shadow: 0 20px 40px rgba(59, 130, 246, 0.4);  /* Brighter on hover */
}
```

### Rounded Corners

```css
.movie-card {
    border-radius: 16px;  /* More rounded */
}

.player-container {
    border-radius: 20px;  /* More rounded */
}
```

### Grid Layout

Change number of movies per row:

```css
.movies-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));  /* Wider cards */
}
```

## 🌐 Add Custom Fonts

**File**: `style.css`

```css
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');

body {
    font-family: 'Poppins', sans-serif;
}
```

## 🔗 Change API Key (if needed)

**File**: `script.js`

```javascript
const TMDB_API_KEY = 'YOUR_NEW_API_KEY_HERE';
```

Get a free API key from [TMDB](https://www.themoviedb.org/settings/api)

## 📊 CSS Variables Reference

All customizable colors (in `style.css`):

```css
:root {
    --primary-color: #0f172a;      /* Main background */
    --secondary-color: #1e293b;    /* Cards & panels */
    --accent-color: #3b82f6;       /* Links & highlights */
    --accent-hover: #2563eb;       /* Hover state */
    --text-primary: #ffffff;       /* Main text */
    --text-secondary: #cbd5e1;     /* Secondary text */
    --border-color: #334155;       /* Borders & dividers */
    --success-color: #10b981;      /* Success/ratings */
}
```

## 🧪 Testing Changes

1. **Save** your changes
2. **Refresh** your browser (Ctrl+Shift+R to clear cache)
3. **Check** the result
4. **Debug** with F12 if needed

## 📦 Deploy Customizations

After making changes:

```bash
git add .
git commit -m "Customize colors and branding"
git push origin main
```

Vercel will automatically deploy within seconds! ✨

---

Need help? Check the browser console (F12) for errors!
