# 🎬 MovieView - Modern Movie Streaming Platform

A beautiful, responsive movie streaming platform powered by TMDB (The Movie Database) and Vidking Player. Browse trending movies, search for your favorites, and stream them instantly.

## ✨ Features

- **Trending Movies Discovery** - Browse trending movies with real-time data from TMDB
- **Powerful Search** - Search for any movie with instant results
- **Beautiful UI** - Modern, dark-themed design with smooth animations
- **Embedded Vidking Player** - High-quality video streaming with customizable colors
- **Watch Progress Tracking** - Automatic watch progress tracking via localStorage
- **Responsive Design** - Works perfectly on desktop, tablet, and mobile devices
- **Fast Performance** - Optimized for speed with lazy loading and efficient API calls

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AkhilKonduru1/movieview.git
   cd movieview
   ```

2. **Open in browser**
   - For local development, simply open `index.html` in your browser
   - Or use a local server:
     ```bash
     # Using Python
     python -m http.server 8000
     
     # Using Node.js (with http-server)
     npx http-server
     
     # Using PHP
     php -S localhost:8000
     ```

3. **Access the app**
   - Open `http://localhost:8000` in your browser

## 🌐 Deployment to Vercel

### Option 1: Using Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

3. **Follow the prompts** to complete deployment

### Option 2: Using GitHub + Vercel

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Click "Deploy"

3. **Automatic deployments**
   - Subsequent pushes to main will automatically deploy

## 📱 How to Use

### Browse Movies
1. The homepage displays trending movies from TMDB
2. Scroll through the movie grid
3. Each movie card shows:
   - Movie poster
   - Title
   - Rating (⭐ out of 10)
   - Release year

### Search for Movies
1. Use the search bar at the top
2. Type the movie name
3. Results update in real-time
4. Results are filtered as you type

### Watch a Movie
1. Click on any movie card
2. The video player loads automatically with autoplay enabled
3. The movie synopsis and rating are displayed below the player
4. Use controls in the player to:
   - Play/Pause
   - Adjust volume
   - Toggle fullscreen
   - Seek through the video

### Go Back
1. Click the "← Back" button to return to the movie list
2. Your search query is preserved

## 🎨 Customization

### Change Player Color
Edit `script.js` and modify the color parameter in the `playMovie` function:
```javascript
const playerUrl = `${VIDKING_BASE_URL}/movie/${tmdbId}?color=YOUR_HEX_COLOR&autoPlay=true`;
```

Available preset colors:
- `3b82f6` - Blue (default)
- `e50914` - Netflix Red
- `ff0000` - YouTube Red
- `9146ff` - Twitch Purple
- `1db954` - Spotify Green

### Modify AI Configuration
All API keys and URLs are configured in `script.js`:
- `TMDB_API_KEY` - Your TMDB API key
- `VIDKING_BASE_URL` - Vidking Player endpoint

## 🔧 API Configuration

### TMDB API
- **API Key**: `71e61382103e209166803f013a5f084f`
- **Documentation**: [TMDB API Docs](https://developers.themoviedb.org/3)

### Vidking Player
- **Base URL**: `https://www.vidking.net/embed`
- **Routes**:
  - Movies: `/embed/movie/{tmdbId}`
  - TV Series: `/embed/tv/{tmdbId}/{season}/{episode}`

## 📊 Technical Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **APIs**: TMDB API, Vidking Player
- **Hosting**: Vercel
- **Browser Support**: All modern browsers

## 📦 Project Structure

```
movieview/
├── index.html          # Main HTML structure
├── style.css           # Styling and responsive design
├── script.js           # JavaScript logic and API integration
├── vercel.json         # Vercel configuration
├── .gitignore          # Git ignore configuration
└── README.md          # This file
```

## 🎯 Features

### Watch Progress Tracking
The player automatically tracks your watch progress:
- Progress is saved to localStorage
- Resume from where you left off
- Works across browser sessions

### Responsive Design
- **Desktop**: Full grid layout with 7 movies per row
- **Tablet**: 4-5 movies per row
- **Mobile**: 2-3 movies per row
- Optimized player ratio for all screen sizes

### Performance Optimizations
- Debounced search (300ms)
- Image optimization with fallbacks
- Lazy loading placeholders
- Minimal dependencies (0 npm packages)

## 🐛 Troubleshooting

### Movies not loading?
1. Check internet connection
2. Verify TMDB API key is valid
3. Check browser console for errors (F12)
4. Clear browser cache and reload

### Player not playing?
1. Ensure Vidking service is accessible
2. Try a different TMDB ID
3. Disable browser extensions
4. Try in incognito/private mode

### Search not working?
1. Try clearing the search box
2. Check for typos in movie name
3. Refresh the page
4. Check browser network tab for failed requests

## 📝 License

This project is open source and available under the MIT License.

## 🙏 Credits

- Movies data powered by [TMDB](https://www.themoviedb.org/)
- Video streaming by [Vidking Player](https://www.vidking.net/)
- Deployed on [Vercel](https://vercel.com)

## 💬 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the browser console for error messages
3. Visit [TMDB API Documentation](https://developers.themoviedb.org/3)
4. Check [Vidking Player Documentation](https://www.vidking.net)

---

**Enjoy streaming! 🎬🍿**
