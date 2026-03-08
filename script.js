// API Keys and Configuration
const TMDB_API_KEY = '71e61382103e209166803f013a5f084f';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const VIDKING_BASE_URL = 'https://www.vidking.net/embed';

// State Management
let currentPage = 1;
let searchQuery = '';
let isLoading = false;
let activeMainTab = 'home';
let _currentSeriesId = null;
let _seriesCache = {};

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

    await loadTrending();

    if (activeMainTab === 'recommendations') {
        await loadRecommendations();
    }

    applyTabVisibility();
    hideLoading();
}

function setMainTab(tab) {
    activeMainTab = tab;

    const homeBtn = document.getElementById('homeTabBtn');
    const recoBtn = document.getElementById('recommendationsTabBtn');
    if (homeBtn) homeBtn.classList.toggle('active', tab === 'home');
    if (recoBtn) recoBtn.classList.toggle('active', tab === 'recommendations');

    if (searchQuery) {
        searchContent(searchQuery);
        return;
    }

    if (tab === 'home') {
        loadContinueWatching();
        loadTrending().then(() => applyTabVisibility());
    } else {
        loadRecommendations().then(() => applyTabVisibility());
    }
}

function applyTabVisibility() {
    const continueSection = document.getElementById('continueSection');
    const trendingTitle = document.getElementById('trendingTitle');

    // During search, show search results only
    if (searchQuery) {
        if (continueSection) continueSection.style.display = 'none';
        ['recoSection', 'genrePicksSection', 'becauseSection', 'genreStatsSection'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        if (trendingTitle) trendingTitle.style.display = 'block';
        moviesGrid.style.display = 'grid';
        return;
    }

    if (activeMainTab === 'home') {
        ['recoSection', 'genrePicksSection', 'becauseSection', 'genreStatsSection'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        if (trendingTitle) trendingTitle.style.display = 'block';
        moviesGrid.style.display = 'grid';
    } else {
        if (continueSection) continueSection.style.display = 'none';
        if (trendingTitle) trendingTitle.style.display = 'none';
        moviesGrid.style.display = 'none';
    }
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
                hideRecoSections();
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
async function searchContent(query) {
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
    _isPaused = false;
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

// Go Back — handles series detail, search results, or home
function goBack() {
    playerSection.style.display = 'none';
    document.getElementById('videoPlayer').src = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // If we were watching a series episode, go back to series detail
    if (_currentSeriesId) {
        document.getElementById('seriesDetailSection').style.display = 'block';
        return;
    }

    moviesSection.style.display = 'block';

    if (searchQuery) {
        // Restore the search results they had before clicking a movie
        hideRecoSections();
        searchInput.value = searchQuery;
        searchContent(searchQuery);
    } else {
        loadContinueWatching();
        if (activeMainTab === 'recommendations') {
            loadRecommendations();
        }
        applyTabVisibility();
    }
}

// Logo click — always go to the true home page (clear search, show trending + recos)
function goHome() {
    playerSection.style.display = 'none';
    document.getElementById('seriesDetailSection').style.display = 'none';
    moviesSection.style.display = 'block';
    document.getElementById('videoPlayer').src = '';
    searchQuery = '';
    searchInput.value = '';
    _currentSeriesId = null;
    activeMainTab = 'home';
    const homeBtn = document.getElementById('homeTabBtn');
    const recoBtn = document.getElementById('recommendationsTabBtn');
    if (homeBtn) homeBtn.classList.add('active');
    if (recoBtn) recoBtn.classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadHomePage();
}

// Show series detail page with seasons and episodes
async function showSeriesDetail(showId) {
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

        if (seasons.length > 0) {
            await loadSeasonEpisodes(showId, seasons[0].season_number);
        }

        moviesSection.style.display = 'none';
        playerSection.style.display = 'none';
        document.getElementById('seriesDetailSection').style.display = 'block';

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
function playEpisode(showId, season, episode) {
    const show = _seriesCache[showId] || moviesCache[showId] || {};

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
    RecommendationEngine.recordClick({
        id: showId,
        title: show.name || show.title || '',
        genre_ids: genreIds,
        vote_average: show.vote_average || 0,
    });

    const playerUrl = `${VIDKING_BASE_URL}/tv/${showId}/${season}/${episode}?color=3b82f6&autoPlay=true&nextEpisode=true&episodeSelector=true`;

    _playerReady = false;
    _isPaused = false;
    _currentTime = 0;
    _duration = 0;
    const pl = document.getElementById('playerLoading');
    if (pl) pl.classList.remove('hidden');

    document.getElementById('videoPlayer').src = playerUrl;

    RecommendationEngine.updateContinueWatching({
        id: showId,
        title: show.name || show.title || '',
        poster_path: show.poster_path || null,
        mediaType: 'tv',
        currentTime: 1,
        duration: 3600,
        season: season,
        episode: episode,
        vote_average: show.vote_average || 0,
    });

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
}

// Go back from series detail to main grid
function goBackFromSeriesDetail() {
    _currentSeriesId = null;
    document.getElementById('seriesDetailSection').style.display = 'none';
    moviesSection.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Reset all recommendation data
function resetRecommendations() {
    if (!confirm('This will clear your entire watch history, continue watching, and taste profile. Continue?')) return;
    RecommendationEngine.clearAllData();
    hideRecoSections();
    document.getElementById('trendingTitle').textContent = '🔥 Trending Movies & Series';
    applyTabVisibility();
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
let _isPaused = false;

function sendPlayerCommand(command) {
    const iframe = document.getElementById('videoPlayer');
    if (!iframe || !iframe.contentWindow) return;

    // Try a few common command payload shapes for embedded players.
    const payloads = [
        { type: 'PLAYER_COMMAND', data: { command } },
        { type: 'PLAYER_COMMAND', data: { action: command } },
        { command },
        { action: command },
    ];

    payloads.forEach(payload => {
        iframe.contentWindow.postMessage(payload, '*');
        iframe.contentWindow.postMessage(JSON.stringify(payload), '*');
    });
}

function togglePlayPause() {
    if (!_currentPlayingId || !_currentPlayingMeta) return;

    if (_isPaused) {
        sendPlayerCommand('play');
        showSkipToast('Resuming...');
    } else {
        sendPlayerCommand('pause');
        showSkipToast('Pausing...');
    }
}

window.addEventListener('message', function (event) {
    try {
        const raw = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        const message = raw?.type === 'PLAYER_EVENT' && raw?.data ? raw.data : raw;
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
        if (message.event === 'pause') _isPaused = true;
        if (message.event === 'play' || message.event === 'timeupdate') _isPaused = false;

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
        const safeTitle = escapeHtml(movie.title || movie.name || '');
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

    section.style.display = (activeMainTab === 'recommendations' && !searchQuery) ? 'block' : 'none';
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

    section.style.display = (activeMainTab === 'recommendations' && !searchQuery) ? 'block' : 'none';
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

    section.style.display = (activeMainTab === 'home' && !searchQuery) ? 'block' : 'none';
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
    _isPaused = false;
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
