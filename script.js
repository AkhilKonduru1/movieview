// API Keys and Configuration
const TMDB_API_KEY = '71e61382103e209166803f013a5f084f';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const VIDKING_BASE_URL = 'https://www.vidking.net/embed';

// State Management
let currentPage = 1;
let searchQuery = '';
let isLoading = false;
let _currentSeriesId = null;
let _seriesCache = {};
let _isRestoringRoute = false;

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
    setupSearchDebounce();
    restoreFromUrl();
});

// =========================================================
// URL Routing State
// =========================================================

function buildUrl(paramsObj = {}) {
    const url = new URL(window.location.href);
    url.search = '';
    Object.entries(paramsObj).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
            url.searchParams.set(k, String(v));
        }
    });
    return `${url.pathname}${url.search}`;
}

function updateUrl(paramsObj = {}, replace = false) {
    if (_isRestoringRoute) return;
    const nextUrl = buildUrl(paramsObj);
    const current = `${window.location.pathname}${window.location.search}`;
    if (nextUrl === current) return;
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({}, '', nextUrl);
}

function getRoute() {
    const params = new URLSearchParams(window.location.search);
    return {
        view: params.get('view') || 'home',
        q: params.get('q') || '',
        id: params.get('id') ? parseInt(params.get('id'), 10) : null,
        type: params.get('type') || null,
        season: params.get('season') ? parseInt(params.get('season'), 10) : null,
        episode: params.get('episode') ? parseInt(params.get('episode'), 10) : null,
        t: params.get('t') ? parseInt(params.get('t'), 10) : 0,
    };
}

async function restoreFromUrl() {
    _isRestoringRoute = true;
    try {
        const route = getRoute();

        if (route.view === 'search' && route.q) {
            searchQuery = route.q;
            searchInput.value = route.q;
            playerSection.style.display = 'none';
            document.getElementById('seriesDetailSection').style.display = 'none';
            moviesSection.style.display = 'block';
            await searchContent(route.q, false);
            return;
        }

        if (route.view === 'series' && route.id) {
            searchQuery = '';
            searchInput.value = '';
            await showSeriesDetail(route.id, { seasonNumber: route.season, updateUrl: false });
            return;
        }

        if (route.view === 'watch' && route.id && route.type === 'tv' && route.season && route.episode) {
            searchQuery = '';
            searchInput.value = '';
            await openTvPlayer(route.id, route.season, route.episode, route.t || 0, false);
            return;
        }

        if (route.view === 'watch' && route.id && route.type === 'movie') {
            searchQuery = '';
            searchInput.value = '';
            await openMovieById(route.id, route.t || 0, false);
            return;
        }

        // Default/home route
        searchQuery = '';
        searchInput.value = '';
        await loadHomePage();
        updateUrl({ view: 'home' }, true);
    } finally {
        _isRestoringRoute = false;
    }
}

window.addEventListener('popstate', () => {
    restoreFromUrl();
});

// Load everything on the home page
async function loadHomePage() {
    showLoading();
    hideError();
    hideNoResults();

    await loadTrending();

    updateUrl({ view: 'home' });
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
            // If in series detail view, switch to grid
            if (document.getElementById('seriesDetailSection').style.display !== 'none') {
                _currentSeriesId = null;
                document.getElementById('seriesDetailSection').style.display = 'none';
                moviesSection.style.display = 'block';
            }

            if (searchQuery) {
                searchContent(searchQuery);
            } else {
                loadHomePage();
            }
        }, 300);
    });
}

// Load Trending Content (Movies + TV Series combined)
async function loadTrending() {
    try {
        showLoading();
        hideError();
        hideNoResults();
        
        const [movieRes, tvRes] = await Promise.all([
            fetch(`${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}`),
            fetch(`${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`),
        ]);
        
        if (!movieRes.ok || !tvRes.ok) throw new Error('Failed to fetch trending content');
        
        const [movieData, tvData] = await Promise.all([movieRes.json(), tvRes.json()]);
        
        const movies = (movieData.results || []).map(m => ({ ...m, _mediaType: 'movie' }));
        const shows = (tvData.results || []).map(s => ({ ...s, _mediaType: 'tv' }));
        
        // Interleave movies and series for a mixed feed
        const combined = [];
        const maxLen = Math.max(movies.length, shows.length);
        for (let i = 0; i < maxLen; i++) {
            if (i < movies.length) combined.push(movies[i]);
            if (i < shows.length) combined.push(shows[i]);
        }
        
        displayItems(combined);
        
        const trendingTitle = document.getElementById('trendingTitle');
        if (trendingTitle) {
            trendingTitle.textContent = '🔥 Trending Movies & Series';
        }
        
        hideLoading();
    } catch (error) {
        console.error('Error loading trending content:', error);
        showError('Failed to load content. Please try again.');
        hideLoading();
    }
}

// Search Content (Movies + TV Series combined)
async function searchContent(query, updateRoute = true) {
    try {
        showLoading();
        hideError();
        
        const [movieRes, tvRes] = await Promise.all([
            fetch(`${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`),
            fetch(`${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`),
        ]);
        
        if (!movieRes.ok || !tvRes.ok) throw new Error('Search failed');
        
        const [movieData, tvData] = await Promise.all([movieRes.json(), tvRes.json()]);
        
        const movies = (movieData.results || []).map(m => ({ ...m, _mediaType: 'movie' }));
        const shows = (tvData.results || []).map(s => ({ ...s, _mediaType: 'tv' }));
        
        // Merge by popularity (vote_count as proxy) so best results appear first
        const combined = [...movies, ...shows].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        
        if (combined.length === 0) {
            showNoResults();
            moviesGrid.innerHTML = '';
        } else {
            displayItems(combined);
            hideNoResults();
        }

        const trendingTitle = document.getElementById('trendingTitle');
        if (trendingTitle) {
            trendingTitle.style.display = 'block';
            trendingTitle.textContent = '🔎 Search Results';
        }

        moviesGrid.style.display = 'grid';

        if (updateRoute) {
            updateUrl({ view: 'search', q: query, tab: activeMainTab });
        }
        
        hideLoading();
    } catch (error) {
        console.error('Error searching content:', error);
        showError('Search failed. Please try again.');
        hideLoading();
    }
}

// Store movie data for click handler
let moviesCache = {};

// Display Items (Movies or TV Series)
function displayItems(items) {
    items.forEach(m => {
        moviesCache[m.id] = m;
        if (m._mediaType) moviesCache[m.id]._mediaType = m._mediaType;
    });

    moviesGrid.innerHTML = items.map(item => {
        const posterUrl = item.poster_path 
            ? `${TMDB_IMAGE_BASE_URL}${item.poster_path}`
            : 'https://via.placeholder.com/200x300?text=No+Image';
        
        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
        const title = item.title || item.name || 'Untitled';
        const dateStr = item.release_date || item.first_air_date;
        const year = dateStr ? new Date(dateStr).getFullYear() : 'N/A';
        const safeTitle = escapeHtml(title);
        const mediaType = item._mediaType || 'movie';
        const clickAction = mediaType === 'tv'
            ? `showSeriesDetail(${item.id})`
            : `playMovieById(${item.id})`;
        const badge = mediaType === 'tv' ? '<span class="media-badge tv-badge">TV</span>' : '';

        return `
            <div class="movie-card" onclick="${clickAction}">
                ${badge}
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

// Backward compatibility wrapper
function displayMovies(movies) {
    displayItems(movies.map(m => ({ ...m, _mediaType: 'movie' })));
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Play movie by ID using cached data (or open series detail for TV)
function playMovieById(id) {
    const movie = moviesCache[id];
    if (!movie) return;

    // If it's a TV show, open series detail instead
    if (movie._mediaType === 'tv') {
        showSeriesDetail(id);
        return;
    }

    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
    const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';

    playMovie(id, movie.title, movie.overview, rating, year);
}

async function openMovieById(id, resumeTime = 0, updateRoute = true) {
    const cached = moviesCache[id];
    if (cached) {
        const rating = cached.vote_average ? cached.vote_average.toFixed(1) : 'N/A';
        const year = cached.release_date ? new Date(cached.release_date).getFullYear() : 'N/A';
        playMovie(id, cached.title || 'Movie', cached.overview || '', rating, year, resumeTime, updateRoute);
        return;
    }

    try {
        const res = await fetch(`${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}`);
        if (!res.ok) throw new Error('Failed to fetch movie');
        const movie = await res.json();
        moviesCache[id] = { ...movie, _mediaType: 'movie' };
        const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
        const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';
        playMovie(id, movie.title || 'Movie', movie.overview || '', rating, year, resumeTime, updateRoute);
    } catch {
        playMovie(id, 'Movie', '', 'N/A', 'N/A', resumeTime, updateRoute);
    }
}

async function openTvPlayer(showId, season, episode, resumeTime = 0, updateRoute = true) {
    let show = _seriesCache[showId] || moviesCache[showId] || null;
    if (!show || !show.name) {
        try {
            const res = await fetch(`${TMDB_BASE_URL}/tv/${showId}?api_key=${TMDB_API_KEY}`);
            if (res.ok) {
                show = await res.json();
                _seriesCache[showId] = show;
                moviesCache[showId] = { ...show, _mediaType: 'tv', genre_ids: (show.genres || []).map(g => g.id) };
            }
        } catch {
            // Best effort only
        }
    }

    playEpisode(showId, season, episode, {
        resumeTime,
        updateRoute,
        showData: show,
    });
}

// Play Movie (optionally resume from a timestamp)
function playMovie(tmdbId, title, overview, rating, year, resumeTime, updateRoute = true) {
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
    _isVideoPaused = false;
    _currentTime = resumeTime || 0;
    _duration = 0;
    const pl = document.getElementById('playerLoading');
    if (pl) pl.classList.remove('hidden');

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

    if (updateRoute) {
        updateUrl({ view: 'watch', type: 'movie', id: tmdbId, t: resumeTime ? Math.floor(resumeTime) : '' });
    }
}

// Go Back — handles series detail, search results, or home
function goBack() {
    playerSection.style.display = 'none';
    document.getElementById('videoPlayer').src = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // If we were watching a series episode, go back to series detail
    if (_currentSeriesId) {
        document.getElementById('seriesDetailSection').style.display = 'block';
        updateUrl({ view: 'series', id: _currentSeriesId });
        return;
    }

    moviesSection.style.display = 'block';

    if (searchQuery) {
        // Restore the search results they had before clicking a movie
        searchInput.value = searchQuery;
        searchContent(searchQuery);
    } else {
        updateUrl({ view: 'home' });
    }
}

// Logo click — always go to the true home page
function goHome() {
    playerSection.style.display = 'none';
    document.getElementById('seriesDetailSection').style.display = 'none';
    moviesSection.style.display = 'block';
    document.getElementById('videoPlayer').src = '';
    searchQuery = '';
    searchInput.value = '';
    _currentSeriesId = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateUrl({ view: 'home' });
    loadHomePage();
}

// Show series detail page with seasons and episodes
async function showSeriesDetail(showId, opts = {}) {
    const { seasonNumber = null, updateUrl = true } = opts;
    try {
        showLoading();

        const response = await fetch(
            `${TMDB_BASE_URL}/tv/${showId}?api_key=${TMDB_API_KEY}`
        );

        if (!response.ok) throw new Error('Failed to fetch series details');

        const show = await response.json();
        _seriesCache[showId] = show;
        _currentSeriesId = showId;

        moviesCache[showId] = { ...show, _mediaType: 'tv', genre_ids: (show.genres || []).map(g => g.id) };

        const posterUrl = show.poster_path
            ? `${TMDB_IMAGE_BASE_URL}${show.poster_path}`
            : 'https://via.placeholder.com/300x450?text=No+Image';
        document.getElementById('seriesPoster').src = posterUrl;
        document.getElementById('seriesTitle').textContent = show.name || 'Untitled';
        document.getElementById('seriesOverview').textContent = show.overview || 'No description available.';
        document.getElementById('seriesRating').textContent = `⭐ ${(show.vote_average || 0).toFixed(1)}`;
        document.getElementById('seriesYear').textContent = show.first_air_date
            ? `Year: ${new Date(show.first_air_date).getFullYear()}` : '';
        document.getElementById('seriesSeasonCount').textContent =
            `${show.number_of_seasons || 0} Season${show.number_of_seasons !== 1 ? 's' : ''}`;

        const seasons = (show.seasons || []).filter(s => s.season_number > 0 || show.seasons.length === 1);
        const seasonTabs = document.getElementById('seasonTabs');
        seasonTabs.innerHTML = seasons.map((s, i) => `
            <button class="season-tab ${i === 0 ? 'active' : ''}"
                    onclick="selectSeason(${showId}, ${s.season_number}, this)">
                Season ${s.season_number}
            </button>
        `).join('');

        const initialSeason = seasonNumber || (seasons.length > 0 ? seasons[0].season_number : null);
        if (initialSeason != null) {
            await loadSeasonEpisodes(showId, initialSeason);

            // Keep active tab in sync when restoring or deep-linking to a season
            const seasonBtns = seasonTabs.querySelectorAll('.season-tab');
            seasonBtns.forEach(btn => btn.classList.remove('active'));
            const target = [...seasonBtns].find(btn => btn.textContent.trim() === `Season ${initialSeason}`);
            if (target) target.classList.add('active');
        }

        moviesSection.style.display = 'none';
        playerSection.style.display = 'none';
        document.getElementById('seriesDetailSection').style.display = 'block';

        if (updateUrl) {
            updateUrl({ view: 'series', id: showId, season: initialSeason || '' });
        }

        hideLoading();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        console.error('Error loading series details:', error);
        showError('Failed to load series details. Please try again.');
        hideLoading();
    }
}

// Select a season tab
function selectSeason(showId, seasonNumber, tabEl) {
    document.querySelectorAll('.season-tab').forEach(t => t.classList.remove('active'));
    if (tabEl) tabEl.classList.add('active');
    loadSeasonEpisodes(showId, seasonNumber);
    updateUrl({ view: 'series', id: showId, season: seasonNumber });
}

// Load episodes for a specific season
async function loadSeasonEpisodes(showId, seasonNumber) {
    const episodesGrid = document.getElementById('episodesGrid');
    episodesGrid.innerHTML = '<div class="loading" style="display:flex"><div class="spinner"></div></div>';

    try {
        const response = await fetch(
            `${TMDB_BASE_URL}/tv/${showId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`
        );

        if (!response.ok) throw new Error('Failed to fetch episodes');

        const seasonData = await response.json();

        episodesGrid.innerHTML = (seasonData.episodes || []).map(ep => {
            const stillUrl = ep.still_path
                ? `https://image.tmdb.org/t/p/w400${ep.still_path}`
                : 'https://via.placeholder.com/400x225?text=No+Preview';
            const safeTitle = escapeHtml(ep.name || `Episode ${ep.episode_number}`);
            const rating = ep.vote_average ? ep.vote_average.toFixed(1) : '';
            const runtime = ep.runtime ? `${ep.runtime}m` : '';

            return `
                <div class="episode-card" onclick="playEpisode(${showId}, ${seasonNumber}, ${ep.episode_number})">
                    <div class="episode-still-wrap">
                        <img src="${stillUrl}" alt="${safeTitle}" class="episode-still"
                             onerror="this.src='https://via.placeholder.com/400x225?text=No+Preview'">
                        <div class="episode-play-overlay">
                            <div class="cw-play-icon">▶</div>
                        </div>
                    </div>
                    <div class="episode-info">
                        <div class="episode-number">E${ep.episode_number}</div>
                        <div class="episode-title">${safeTitle}</div>
                        <div class="episode-meta">
                            ${rating ? `<span>⭐ ${rating}</span>` : ''}
                            ${runtime ? `<span>${runtime}</span>` : ''}
                        </div>
                        <div class="episode-overview">${escapeHtml(ep.overview || '')}</div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading episodes:', error);
        episodesGrid.innerHTML = '<p style="color: var(--text-secondary); padding: 20px;">Failed to load episodes.</p>';
    }
}

// Play a specific episode
function playEpisode(showId, season, episode, opts = {}) {
    const { resumeTime = 0, updateRoute = true, showData = null } = opts;
    const show = showData || _seriesCache[showId] || moviesCache[showId] || {};

    _currentPlayingId = showId;
    _currentSeriesId = showId;
    _currentPlayingMeta = {
        id: showId,
        title: show.name || show.title || '',
        poster_path: show.poster_path || null,
        mediaType: 'tv',
        season: season,
        episode: episode,
        vote_average: show.vote_average || 0,
    };

    const genreIds = show.genre_ids || (show.genres || []).map(g => g.id) || [];

    let playerUrl = `${VIDKING_BASE_URL}/tv/${showId}/${season}/${episode}?color=3b82f6&autoPlay=true&nextEpisode=true&episodeSelector=true`;
    if (resumeTime > 0) playerUrl += `&progress=${Math.floor(resumeTime)}`;

    _playerReady = false;
    _isVideoPaused = false;
    _currentTime = resumeTime || 0;
    _duration = 0;
    const pl = document.getElementById('playerLoading');
    if (pl) pl.classList.remove('hidden');

    document.getElementById('videoPlayer').src = playerUrl;

    document.getElementById('playerTitle').textContent = show.name || show.title || 'TV Show';
    document.getElementById('playerOverview').textContent =
        `Season ${season}, Episode ${episode}${show.overview ? ' — ' + show.overview : ''}`;
    document.getElementById('playerRating').textContent = `⭐ ${(show.vote_average || 0).toFixed(1)}`;
    document.getElementById('playerYear').textContent = show.first_air_date
        ? `Year: ${new Date(show.first_air_date).getFullYear()}` : '';

    document.getElementById('seriesDetailSection').style.display = 'none';
    moviesSection.style.display = 'none';
    playerSection.style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (updateRoute) {
        updateUrl({
            view: 'watch',
            type: 'tv',
            id: showId,
            season,
            episode,
            t: resumeTime ? Math.floor(resumeTime) : '',
        });
    }
}

// Go back from series detail to main grid
function goBackFromSeriesDetail() {
    _currentSeriesId = null;
    document.getElementById('seriesDetailSection').style.display = 'none';
    moviesSection.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (searchQuery) {
        updateUrl({ view: 'search', q: searchQuery });
    } else {
        updateUrl({ view: 'home' });
    }
}

// Reset all recommendation data - removed

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
let _isVideoPaused = false;
let _lastToggleAt = 0;

function normalizePlayerEvent(rawData) {
    const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    if (!parsed) return null;
    if (parsed.type === 'PLAYER_EVENT' && parsed.data) return parsed.data;
    return parsed;
}

function sendVidkingCommand(command) {
    const iframe = document.getElementById('videoPlayer');
    if (!iframe || !iframe.contentWindow) return;

    const payloads = [
        { type: 'PLAYER_COMMAND', data: { command } },
        { type: 'VIDKING_COMMAND', data: { command } },
        { command },
        { action: command },
    ];

    payloads.forEach(payload => {
        iframe.contentWindow.postMessage(payload, '*');
        iframe.contentWindow.postMessage(JSON.stringify(payload), '*');
    });
}

window.addEventListener('message', function (event) {
    try {
        const message = normalizePlayerEvent(event.data);
        if (!message || !message.event) return;

        // Hide loading overlay once we get any player event
        if (!_playerReady) {
            _playerReady = true;
            const pl = document.getElementById('playerLoading');
            if (pl) pl.classList.add('hidden');
        }

        if (message.event === 'play') _isVideoPaused = false;
        if (message.event === 'pause' || message.event === 'ended') _isVideoPaused = true;

        // Track current playback position
        if (message.currentTime != null) _currentTime = message.currentTime;
        if (message.duration != null && message.duration > 0) _duration = message.duration;
    } catch (error) {
        // ignore non-JSON messages
    }
});

// Removed recommendation and continue watching UI functions

// Removed skip controls and playback toggle functions

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
