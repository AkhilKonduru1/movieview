// API Keys and Configuration
const TMDB_API_KEY = '71e61382103e209166803f013a5f084f';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const VIDKING_BASE_URL = 'https://www.vidking.net/embed';

// State Management
let currentPage = 1;
let searchQuery = '';
let isLoading = false;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const moviesGrid = document.getElementById('moviesGrid');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('errorMessage');
const noResults = document.getElementById('noResults');
const playerSection = document.getElementById('playerSection');
const moviesSection = document.getElementById('moviesSection');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadHomePage();
    setupSearchDebounce();
});

// Load everything on the home page
async function loadHomePage() {
    showLoading();
    hideError();
    hideNoResults();

    // Load recommendations and trending in parallel
    const [recoResult] = await Promise.allSettled([
        loadRecommendations(),
    ]);

    await loadTrendingMovies();
    hideLoading();
}

// Setup search with debounce
function setupSearchDebounce() {
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchQuery = e.target.value.trim();
        currentPage = 1;
        
        searchTimeout = setTimeout(() => {
            if (searchQuery) {
                hideRecoSections();
                searchMovies(searchQuery);
            } else {
                loadHomePage();
            }
        }, 300);
    });
}

// Load Trending Movies
async function loadTrendingMovies() {
    try {
        showLoading();
        hideError();
        hideNoResults();
        
        const response = await fetch(
            `${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}`
        );
        
        if (!response.ok) throw new Error('Failed to fetch trending movies');
        
        const data = await response.json();
        displayMovies(data.results);
        hideLoading();
    } catch (error) {
        console.error('Error loading trending movies:', error);
        showError('Failed to load movies. Please try again.');
        hideLoading();
    }
}

// Search Movies
async function searchMovies(query) {
    try {
        showLoading();
        hideError();
        
        const response = await fetch(
            `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`
        );
        
        if (!response.ok) throw new Error('Search failed');
        
        const data = await response.json();
        
        if (data.results.length === 0) {
            showNoResults();
            moviesGrid.innerHTML = '';
        } else {
            displayMovies(data.results);
            hideNoResults();
        }
        
        hideLoading();
    } catch (error) {
        console.error('Error searching movies:', error);
        showError('Search failed. Please try again.');
        hideLoading();
    }
}

// Store movie data for click handler
let moviesCache = {};

// Display Movies
function displayMovies(movies) {
    // Cache movie data so we don't pass strings through onclick attributes
    movies.forEach(m => { moviesCache[m.id] = m; });

    moviesGrid.innerHTML = movies.map(movie => {
        const posterUrl = movie.poster_path 
            ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}`
            : 'https://via.placeholder.com/200x300?text=No+Image';
        
        const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
        const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';
        const safeTitle = escapeHtml(movie.title);

        return `
            <div class="movie-card" onclick="playMovieById(${movie.id})">
                <img src="${posterUrl}" alt="${safeTitle}" class="movie-poster" onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
                <div class="movie-card-info">
                    <div class="movie-card-title">${safeTitle}</div>
                    <div class="movie-card-rating">⭐ ${rating}</div>
                    <div class="movie-card-year">${year}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Play movie by ID using cached data
function playMovieById(id) {
    const movie = moviesCache[id];
    if (!movie) return;
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
    const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';

    // Record click in recommendation engine
    RecommendationEngine.recordClick(movie);

    playMovie(id, movie.title, movie.overview, rating, year);
}

// Play Movie
function playMovie(tmdbId, title, overview, rating, year) {
    // Track current playing movie for progress events
    _currentPlayingId = tmdbId;

    // Update player
    const playerUrl = `${VIDKING_BASE_URL}/movie/${tmdbId}?color=3b82f6&autoPlay=true`;
    document.getElementById('videoPlayer').src = playerUrl;
    
    // Update movie details
    document.getElementById('playerTitle').textContent = title;
    document.getElementById('playerOverview').textContent = overview || 'No description available';
    document.getElementById('playerRating').textContent = `⭐ ${rating}`;
    document.getElementById('playerYear').textContent = `Year: ${year}`;
    
    // Switch view
    moviesSection.style.display = 'none';
    playerSection.style.display = 'block';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Go Back to Movies
function goBack() {
    playerSection.style.display = 'none';
    moviesSection.style.display = 'block';
    document.getElementById('videoPlayer').src = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Refresh recommendations when returning home
    loadRecommendations();
}

// UI Helper Functions
function showLoading() {
    loading.style.display = 'flex';
}

function hideLoading() {
    loading.style.display = 'none';
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

function hideError() {
    errorMessage.style.display = 'none';
}

function showNoResults() {
    noResults.style.display = 'block';
}

function hideNoResults() {
    noResults.style.display = 'none';
}

// Watch progress tracking — feeds into recommendation engine
let _currentPlayingId = null;

window.addEventListener('message', function (event) {
    try {
        const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!message || !message.event) return;

        const movieId = message.id || _currentPlayingId;
        const movie = movieId ? moviesCache[movieId] : null;

        if (movie && (message.event === 'timeupdate' || message.event === 'pause' || message.event === 'ended')) {
            RecommendationEngine.recordWatch(movie, {
                currentTime: message.currentTime || 0,
                duration: message.duration || 0,
            });
        }

        // Also save simple progress for resume
        if (movieId && message.event === 'timeupdate') {
            localStorage.setItem(`watch_progress_${movieId}`, JSON.stringify({
                movieId,
                progress: message.currentTime,
                duration: message.duration,
                timestamp: Date.now(),
            }));
        }
    } catch (error) {
        // ignore non-JSON messages
    }
});

// =========================================================
// Recommendation UI
// =========================================================

async function loadRecommendations() {
    const stats = RecommendationEngine.getProfileStats();

    // Not enough watch data yet
    if (stats.totalMoviesWatched < 1) {
        document.getElementById('recoSection').style.display = 'none';
        document.getElementById('genrePicksSection').style.display = 'none';
        document.getElementById('becauseSection').style.display = 'none';
        document.getElementById('genreStatsSection').style.display = 'none';
        return;
    }

    // Show profile strength
    renderProfileStrength(stats);

    // Show genre taste profile
    renderGenreProfile(stats);

    // Load main recommendations
    try {
        // Use cache for instant display, then refresh
        const cached = RecommendationEngine.getCachedRecommendations();
        if (cached && cached.length > 0) {
            renderRecoRow('recoGrid', cached, 'recoSection');
        }

        const recos = await RecommendationEngine.getRecommendations(20);
        if (recos.length > 0) {
            renderRecoRow('recoGrid', recos, 'recoSection');
        }
    } catch (e) {
        console.error('Failed to load recommendations:', e);
    }

    // "Because You Watched" — use last watched movie
    const history = RecommendationEngine.getWatchHistory();
    if (history.length >= 1) {
        const lastWatched = history[history.length - 1];
        try {
            const because = await RecommendationEngine.getBecauseYouWatched(lastWatched.movieId, 10);
            if (because.length > 0) {
                document.getElementById('becauseTitle').textContent =
                    `Because You Watched "${lastWatched.title}"`;
                renderRecoRow('becauseGrid', because, 'becauseSection');
            }
        } catch (e) {
            console.error('Failed to load because-you-watched:', e);
        }
    }

    // Top genre picks
    if (stats.topGenres.length > 0) {
        const topGenre = stats.topGenres[0];
        document.getElementById('genrePicksTitle').textContent =
            `🎬 Top Picks in ${topGenre.name}`;
        try {
            const res = await fetch(
                `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${topGenre.id}&sort_by=vote_average.desc&vote_count.gte=300&page=1`
            );
            if (res.ok) {
                const data = await res.json();
                const watchedIds = new Set(history.map(h => h.movieId));
                const filtered = (data.results || []).filter(m => !watchedIds.has(m.id));
                if (filtered.length > 0) {
                    renderRecoRow('genrePicksGrid', filtered.slice(0, 15), 'genrePicksSection');
                }
            }
        } catch (e) {
            console.error('Failed to load genre picks:', e);
        }
    }
}

function renderRecoRow(gridId, movies, sectionId) {
    const grid = document.getElementById(gridId);
    const section = document.getElementById(sectionId);
    if (!grid || !section) return;

    // Cache for click handler
    movies.forEach(m => { moviesCache[m.id] = m; });

    grid.innerHTML = movies.map(movie => {
        const posterUrl = movie.poster_path
            ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}`
            : 'https://via.placeholder.com/180x260?text=No+Image';
        const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
        const safeTitle = escapeHtml(movie.title || '');
        const score = movie._score || 0;
        const badgeClass = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

        return `
            <div class="movie-card" onclick="playMovieById(${movie.id})">
                ${score > 0 ? `<span class="match-badge ${badgeClass}">${score}% match</span>` : ''}
                <img src="${posterUrl}" alt="${safeTitle}" class="movie-poster"
                     onerror="this.src='https://via.placeholder.com/180x260?text=No+Image'">
                <div class="movie-card-info">
                    <div class="movie-card-title">${safeTitle}</div>
                    <div class="movie-card-rating">⭐ ${rating}</div>
                </div>
            </div>
        `;
    }).join('');

    section.style.display = 'block';
}

function renderProfileStrength(stats) {
    const section = document.getElementById('recoSection');
    const fill = document.getElementById('strengthFill');
    const label = document.getElementById('strengthLabel');
    if (!fill || !label) return;

    fill.style.width = `${stats.profileStrength}%`;

    let strengthText = '';
    if (stats.profileStrength < 30) strengthText = 'Getting to know you...';
    else if (stats.profileStrength < 60) strengthText = 'Building your profile';
    else if (stats.profileStrength < 90) strengthText = 'Great taste profile!';
    else strengthText = 'Expert-level profile!';

    label.textContent = `${strengthText} (${stats.totalMoviesWatched} watched)`;
}

function renderGenreProfile(stats) {
    const section = document.getElementById('genreStatsSection');
    const container = document.getElementById('genreBars');
    if (!container || stats.topGenres.length === 0) return;

    container.innerHTML = stats.topGenres.map((genre, i) => `
        <div class="genre-bar-item">
            <span class="genre-bar-name">${genre.name}</span>
            <div class="genre-bar-track">
                <div class="genre-bar-fill rank-${i + 1}" style="width: ${genre.score}%"></div>
            </div>
            <span class="genre-bar-pct">${genre.score}%</span>
            <span class="genre-bar-count">(${genre.count})</span>
        </div>
    `).join('');

    section.style.display = 'block';
}

function hideRecoSections() {
    ['recoSection', 'genrePicksSection', 'becauseSection', 'genreStatsSection'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}
