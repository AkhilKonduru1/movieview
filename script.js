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

    // Load continue watching immediately (from localStorage, no network)
    loadContinueWatching();

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

// Play Movie (optionally resume from a timestamp)
function playMovie(tmdbId, title, overview, rating, year, resumeTime) {
    // Track current playing movie for progress events
    _currentPlayingId = tmdbId;
    const movie = moviesCache[tmdbId];
    _currentPlayingMeta = {
        id: tmdbId,
        title: title,
        poster_path: movie ? movie.poster_path : null,
        mediaType: 'movie',
        vote_average: movie ? movie.vote_average : 0,
    };

    // Build player URL (with optional resume timestamp)
    let playerUrl = `${VIDKING_BASE_URL}/movie/${tmdbId}?color=3b82f6&autoPlay=true`;
    if (resumeTime && resumeTime > 0) {
        playerUrl += `&progress=${Math.floor(resumeTime)}`;
    }

    // Show loading overlay, reset state
    _playerReady = false;
    _currentTime = resumeTime || 0;
    _duration = 0;
    const pl = document.getElementById('playerLoading');
    if (pl) pl.classList.remove('hidden');

    document.getElementById('videoPlayer').src = playerUrl;
    
    // Immediately create a Continue Watching entry so it shows up on return
    RecommendationEngine.updateContinueWatching({
        id: tmdbId,
        title: title,
        poster_path: movie ? movie.poster_path : null,
        mediaType: 'movie',
        currentTime: resumeTime || 1,
        duration: 7200, // placeholder ~2h until real duration arrives
        vote_average: movie ? movie.vote_average : 0,
    });

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

// Go Back — if user was searching, restore search results; otherwise go home
function goBack() {
    playerSection.style.display = 'none';
    moviesSection.style.display = 'block';
    document.getElementById('videoPlayer').src = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (searchQuery) {
        // Restore the search results they had before clicking a movie
        hideRecoSections();
        searchInput.value = searchQuery;
        searchMovies(searchQuery);
    } else {
        loadContinueWatching();
        loadRecommendations();
    }
}

// Logo click — always go to the true home page (clear search, show trending + recos)
function goHome() {
    playerSection.style.display = 'none';
    moviesSection.style.display = 'block';
    document.getElementById('videoPlayer').src = '';
    searchQuery = '';
    searchInput.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadHomePage();
}

// Reset all recommendation data
function resetRecommendations() {
    if (!confirm('This will clear your entire watch history, continue watching, and taste profile. Continue?')) return;
    RecommendationEngine.clearAllData();
    hideRecoSections();
    document.getElementById('trendingTitle').textContent = '🔥 Trending Movies';
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

// Watch progress tracking — feeds into recommendation engine + continue watching
let _currentPlayingId = null;
let _currentPlayingMeta = null;
let _currentTime = 0;
let _duration = 0;
let _playerReady = false;

window.addEventListener('message', function (event) {
    try {
        const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!message || !message.event) return;

        // Hide loading overlay once we get any player event
        if (!_playerReady) {
            _playerReady = true;
            const pl = document.getElementById('playerLoading');
            if (pl) pl.classList.add('hidden');
        }

        const movieId = message.id || _currentPlayingId;
        const movie = movieId ? moviesCache[movieId] : null;

        // Track current playback position for skip controls
        if (message.currentTime != null) _currentTime = message.currentTime;
        if (message.duration != null && message.duration > 0) _duration = message.duration;

        if (movie && (message.event === 'timeupdate' || message.event === 'pause' || message.event === 'ended')) {
            RecommendationEngine.recordWatch(movie, {
                currentTime: message.currentTime || 0,
                duration: message.duration || 0,
            });
        }

        // Update Continue Watching
        if (movieId && message.currentTime > 0 && message.duration > 0) {
            const meta = _currentPlayingMeta || {};
            RecommendationEngine.updateContinueWatching({
                id: movieId,
                title: meta.title || (movie ? movie.title : ''),
                poster_path: meta.poster_path || (movie ? movie.poster_path : null),
                mediaType: meta.mediaType || 'movie',
                currentTime: message.currentTime,
                duration: message.duration,
                season: meta.season || message.season || null,
                episode: meta.episode || message.episode || null,
                vote_average: meta.vote_average || (movie ? movie.vote_average : 0),
            });
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
    ['continueSection', 'recoSection', 'genrePicksSection', 'becauseSection', 'genreStatsSection'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

// =========================================================
// Continue Watching UI
// =========================================================

function loadContinueWatching() {
    const items = RecommendationEngine.getContinueWatching();
    const grid = document.getElementById('continueGrid');
    const section = document.getElementById('continueSection');
    if (!grid || !section) return;

    if (items.length === 0) {
        section.style.display = 'none';
        return;
    }

    grid.innerHTML = items.map(item => {
        const safeTitle = escapeHtml(item.title || 'Untitled');
        const backdropUrl = item.poster_path
            ? `https://image.tmdb.org/t/p/w780${item.poster_path}`
            : 'https://via.placeholder.com/360x200?text=No+Image';
        const timeLeft = formatTime(item.duration - item.currentTime);
        const episodeTag = (item.mediaType === 'tv' && item.season != null && item.episode != null)
            ? `<span class="cw-episode-tag">S${item.season} E${item.episode}</span>`
            : '';

        return `
            <div class="cw-card" onclick="resumeWatching(${item.id}, '${item.mediaType}', ${item.currentTime}, ${item.season}, ${item.episode})">
                <button class="cw-remove" onclick="event.stopPropagation(); removeCW(${item.id}, '${item.mediaType}', ${item.season}, ${item.episode})" title="Remove">✕</button>
                <div class="cw-poster-wrap">
                    <img src="${backdropUrl}" alt="${safeTitle}"
                         onerror="this.src='https://via.placeholder.com/360x200?text=No+Image'">
                    <div class="cw-play-overlay">
                        <div class="cw-play-icon">▶</div>
                    </div>
                    <div class="cw-progress-bar">
                        <div class="cw-progress-fill" style="width: ${item.progress}%"></div>
                    </div>
                </div>
                <div class="cw-info">
                    <div class="cw-title">${safeTitle}</div>
                    <div class="cw-meta">
                        ${episodeTag}
                        <span>${timeLeft} left</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    section.style.display = 'block';
}

function resumeWatching(id, mediaType, currentTime, season, episode) {
    if (mediaType === 'tv' && season != null && episode != null) {
        // TV show resume
        _currentPlayingId = id;
        _currentPlayingMeta = {
            id, title: '', poster_path: null, mediaType: 'tv',
            season, episode, vote_average: 0,
        };

        // Fetch show details from TMDB for title
        fetch(`${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}`)
            .then(r => r.ok ? r.json() : null)
            .then(show => {
                if (show) {
                    _currentPlayingMeta.title = show.name;
                    _currentPlayingMeta.poster_path = show.poster_path;
                    document.getElementById('playerTitle').textContent = show.name;
                    document.getElementById('playerOverview').textContent =
                        `Season ${season}, Episode ${episode} — ${show.overview || ''}`;
                    document.getElementById('playerRating').textContent = `⭐ ${(show.vote_average || 0).toFixed(1)}`;
                    document.getElementById('playerYear').textContent = '';
                }
            }).catch(() => {});

        let playerUrl = `${VIDKING_BASE_URL}/tv/${id}/${season}/${episode}?color=3b82f6&autoPlay=true&nextEpisode=true&episodeSelector=true`;
        if (currentTime > 0) playerUrl += `&progress=${Math.floor(currentTime)}`;
        document.getElementById('videoPlayer').src = playerUrl;

        document.getElementById('playerTitle').textContent = `TV Show ${id}`;
        document.getElementById('playerOverview').textContent = `Season ${season}, Episode ${episode}`;
        document.getElementById('playerRating').textContent = '';
        document.getElementById('playerYear').textContent = '';

        moviesSection.style.display = 'none';
        playerSection.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        // Movie resume — fetch details if not cached
        const cached = moviesCache[id];
        if (cached) {
            const rating = cached.vote_average ? cached.vote_average.toFixed(1) : 'N/A';
            const year = cached.release_date ? new Date(cached.release_date).getFullYear() : 'N/A';
            playMovie(id, cached.title, cached.overview, rating, year, currentTime);
        } else {
            // Fetch from TMDB
            fetch(`${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}`)
                .then(r => r.ok ? r.json() : null)
                .then(movie => {
                    if (movie) {
                        moviesCache[movie.id] = movie;
                        const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
                        const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';
                        playMovie(id, movie.title, movie.overview, rating, year, currentTime);
                    }
                }).catch(() => {
                    // Fallback: play without details
                    playMovie(id, 'Movie', '', 'N/A', 'N/A', currentTime);
                });
        }
    }
}

function removeCW(id, mediaType, season, episode) {
    RecommendationEngine.removeContinueWatching(id, mediaType, season, episode);
    loadContinueWatching();
}

function formatTime(seconds) {
    if (!seconds || seconds < 0) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

// =========================================================
// Skip Controls
// =========================================================

function skipVideo(seconds) {
    // We can't directly seek inside the iframe, but we can reload
    // the player at the new timestamp using the progress parameter.
    const newTime = Math.max(0, Math.min(_currentTime + seconds, _duration - 1));
    if (!_currentPlayingId || _duration <= 0) return;

    const meta = _currentPlayingMeta || {};
    let url;
    if (meta.mediaType === 'tv' && meta.season != null && meta.episode != null) {
        url = `${VIDKING_BASE_URL}/tv/${_currentPlayingId}/${meta.season}/${meta.episode}?color=3b82f6&autoPlay=true&nextEpisode=true&episodeSelector=true&progress=${Math.floor(newTime)}`;
    } else {
        url = `${VIDKING_BASE_URL}/movie/${_currentPlayingId}?color=3b82f6&autoPlay=true&progress=${Math.floor(newTime)}`;
    }

    // Show loading briefly while iframe reloads
    const pl = document.getElementById('playerLoading');
    if (pl) pl.classList.remove('hidden');
    _playerReady = false;
    _currentTime = newTime;

    document.getElementById('videoPlayer').src = url;

    // Show skip toast
    showSkipToast(seconds > 0 ? `Skipped +${seconds}s` : `Skipped ${seconds}s`);
}

let _skipToastEl = null;
let _skipToastTimeout = null;

function showSkipToast(text) {
    if (!_skipToastEl) {
        _skipToastEl = document.createElement('div');
        _skipToastEl.className = 'skip-toast';
        document.querySelector('.player-wrapper').appendChild(_skipToastEl);
    }
    clearTimeout(_skipToastTimeout);
    _skipToastEl.textContent = text;
    _skipToastEl.classList.add('visible');
    _skipToastTimeout = setTimeout(() => {
        _skipToastEl.classList.remove('visible');
    }, 1500);
}

// =========================================================
// Hover Preloading — warm up Vidking connection early
// =========================================================

let _preloadedConnection = false;

function preloadVidkingConnection() {
    if (_preloadedConnection) return;
    _preloadedConnection = true;
    // Create a tiny hidden fetch to establish the TLS connection early
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = 'https://www.vidking.net';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
}

// Attach hover preloading to movie cards (delegated)
document.addEventListener('mouseover', (e) => {
    if (e.target.closest('.movie-card') || e.target.closest('.cw-card')) {
        preloadVidkingConnection();
    }
});

// Hide loading overlay when iframe finishes loading
document.addEventListener('DOMContentLoaded', () => {
    const iframe = document.getElementById('videoPlayer');
    if (iframe) {
        iframe.addEventListener('load', () => {
            // Give a brief moment for the player JS to init, then hide overlay
            setTimeout(() => {
                const pl = document.getElementById('playerLoading');
                if (pl) pl.classList.add('hidden');
                _playerReady = true;
            }, 800);
        });
    }
});
