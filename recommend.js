// ============================================================
// MovieView Recommendation Engine
// Multi-signal algorithm using watch history, genre affinity,
// time-decay, completion rates, and collaborative filtering
// via TMDB's recommendation & similar endpoints.
// ============================================================

const RecommendationEngine = (() => {
    // --- Storage Keys ---
    const STORAGE_KEYS = {
        WATCH_HISTORY: 'mv_watch_history',
        GENRE_SCORES: 'mv_genre_scores',
        USER_PROFILE: 'mv_user_profile',
        RECO_CACHE: 'mv_reco_cache',
        CONTINUE_WATCHING: 'mv_continue_watching',
    };

    // --- TMDB Genre ID Map ---
    const GENRE_MAP = {
        28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
        80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
        14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
        9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
        10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
        10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News',
        10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap',
        10767: 'Talk', 10768: 'War & Politics',
    };

    // --- Algorithm Weights ---
    const WEIGHTS = {
        GENRE_AFFINITY:   0.35,  // How much genre preference matters
        TMDB_SIMILAR:     0.25,  // TMDB's own similar/recommended
        WATCH_COMPLETION: 0.15,  // Prefer genres user finishes
        RECENCY_BOOST:    0.10,  // Boost recently active genres
        RATING_QUALITY:   0.10,  // Prefer higher-rated movies
        DIVERSITY:        0.05,  // Inject some variety
    };

    // Half-life for time decay (in days)
    const DECAY_HALF_LIFE_DAYS = 14;

    // =========================================================
    // Watch History Tracking
    // =========================================================

    function getWatchHistory() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.WATCH_HISTORY)) || [];
        } catch { return []; }
    }

    function saveWatchHistory(history) {
        // Keep last 200 entries to avoid storage bloat
        const trimmed = history.slice(-200);
        localStorage.setItem(STORAGE_KEYS.WATCH_HISTORY, JSON.stringify(trimmed));
    }

    /**
     * Record a watch event.
     * @param {object} movie - movie object from TMDB (needs id, title, genre_ids, vote_average)
     * @param {object} progress - { currentTime, duration } from player events
     */
    function recordWatch(movie, progress = {}) {
        const history = getWatchHistory();
        const now = Date.now();
        const completionRatio = (progress.duration && progress.duration > 0)
            ? Math.min(progress.currentTime / progress.duration, 1)
            : 0;

        // Check if we already have an entry for this movie
        const existing = history.findIndex(h => h.movieId === movie.id);
        if (existing !== -1) {
            // Update existing entry with latest progress
            history[existing].lastWatched = now;
            history[existing].watchCount = (history[existing].watchCount || 1) + 1;
            history[existing].completionRatio = Math.max(history[existing].completionRatio, completionRatio);
            history[existing].totalWatchTime = (history[existing].totalWatchTime || 0) + (progress.currentTime || 0);
        } else {
            history.push({
                movieId: movie.id,
                title: movie.title,
                genreIds: movie.genre_ids || [],
                rating: movie.vote_average || 0,
                firstWatched: now,
                lastWatched: now,
                watchCount: 1,
                completionRatio,
                totalWatchTime: progress.currentTime || 0,
                hour: new Date().getHours(),
            });
        }

        saveWatchHistory(history);
        rebuildGenreScores();
    }

    /**
     * Record a click (user clicked to watch, even if player hasn't reported progress yet)
     */
    function recordClick(movie) {
        recordWatch(movie, { currentTime: 0, duration: 0 });
    }

    // =========================================================
    // Genre Affinity Scoring
    // =========================================================

    function rebuildGenreScores() {
        const history = getWatchHistory();
        const now = Date.now();
        const scores = {};
        const genreCompletions = {};
        const genreCounts = {};
        const hourBuckets = {};  // track what hours user watches

        history.forEach(entry => {
            const ageMs = now - entry.lastWatched;
            const ageDays = ageMs / (1000 * 60 * 60 * 24);
            // Exponential time decay
            const decay = Math.pow(0.5, ageDays / DECAY_HALF_LIFE_DAYS);
            // Completion multiplier: finished movies count more
            const completionMult = 0.3 + (0.7 * (entry.completionRatio || 0));
            // Repeat watch bonus
            const repeatMult = 1 + Math.log2(entry.watchCount || 1) * 0.3;

            const signal = decay * completionMult * repeatMult;

            (entry.genreIds || []).forEach(gid => {
                scores[gid] = (scores[gid] || 0) + signal;
                genreCounts[gid] = (genreCounts[gid] || 0) + 1;
                genreCompletions[gid] = (genreCompletions[gid] || 0) + (entry.completionRatio || 0);
            });

            // Track watch hours
            const h = entry.hour || 0;
            hourBuckets[h] = (hourBuckets[h] || 0) + 1;
        });

        // Normalize scores to 0-1
        const maxScore = Math.max(...Object.values(scores), 1);
        Object.keys(scores).forEach(k => { scores[k] /= maxScore; });

        // Compute average completion per genre
        const avgCompletions = {};
        Object.keys(genreCompletions).forEach(gid => {
            avgCompletions[gid] = genreCompletions[gid] / (genreCounts[gid] || 1);
        });

        // Find peak watch hour
        let peakHour = 20; // default evening
        let peakCount = 0;
        Object.entries(hourBuckets).forEach(([h, c]) => {
            if (c > peakCount) { peakCount = c; peakHour = parseInt(h); }
        });

        const profile = {
            genreScores: scores,
            genreCompletions: avgCompletions,
            genreCounts,
            peakHour,
            totalWatched: history.length,
            lastUpdated: now,
        };

        localStorage.setItem(STORAGE_KEYS.GENRE_SCORES, JSON.stringify(scores));
        localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
        return profile;
    }

    function getUserProfile() {
        try {
            const profile = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_PROFILE));
            if (profile) return profile;
        } catch {}
        return rebuildGenreScores();
    }

    function getGenreScores() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.GENRE_SCORES)) || {};
        } catch { return {}; }
    }

    // =========================================================
    // Scoring a candidate movie
    // =========================================================

    /**
     * Score a single movie against the user's profile.
     * Returns a number 0-100.
     */
    function scoreMovie(movie, profile, similarityBonus = 0) {
        const genreScores = profile.genreScores || {};
        const genreCompletions = profile.genreCompletions || {};
        const movieGenres = movie.genre_ids || [];

        // 1. Genre Affinity (weighted average of genre scores)
        let genreAffinity = 0;
        if (movieGenres.length > 0) {
            const sum = movieGenres.reduce((acc, gid) => acc + (genreScores[gid] || 0), 0);
            genreAffinity = sum / movieGenres.length;
        }

        // 2. Watch Completion affinity (prefer genres user actually finishes)
        let completionAffinity = 0;
        if (movieGenres.length > 0) {
            const sum = movieGenres.reduce((acc, gid) => acc + (genreCompletions[gid] || 0), 0);
            completionAffinity = sum / movieGenres.length;
        }

        // 3. TMDB similarity bonus (passed in from similar/recommended endpoints)
        const tmdbSimilar = Math.min(similarityBonus, 1);

        // 4. Recency boost — if the movie's genres overlap with recently-watched genres
        let recencyBoost = 0;
        const recentHistory = getWatchHistory().slice(-5);
        const recentGenres = new Set(recentHistory.flatMap(h => h.genreIds || []));
        if (movieGenres.length > 0) {
            const overlap = movieGenres.filter(g => recentGenres.has(g)).length;
            recencyBoost = overlap / movieGenres.length;
        }

        // 5. Rating quality (normalize 0-10 to 0-1)
        const ratingQuality = Math.min((movie.vote_average || 0) / 10, 1);

        // 6. Diversity injection — small bonus for genres NOT in top genres
        //    (prevents echo chamber)
        let diversityBonus = 0;
        const sortedGenres = Object.entries(genreScores).sort((a, b) => b[1] - a[1]);
        const topGenreIds = new Set(sortedGenres.slice(0, 3).map(([id]) => parseInt(id)));
        if (movieGenres.length > 0) {
            const novelGenres = movieGenres.filter(g => !topGenreIds.has(g)).length;
            diversityBonus = novelGenres / movieGenres.length * 0.5;
        }

        // Weighted combination
        const score =
            WEIGHTS.GENRE_AFFINITY   * genreAffinity +
            WEIGHTS.WATCH_COMPLETION * completionAffinity +
            WEIGHTS.TMDB_SIMILAR     * tmdbSimilar +
            WEIGHTS.RECENCY_BOOST    * recencyBoost +
            WEIGHTS.RATING_QUALITY   * ratingQuality +
            WEIGHTS.DIVERSITY        * diversityBonus;

        return Math.round(score * 100);
    }

    // =========================================================
    // Fetching recommendations (multi-source)
    // =========================================================

    /**
     * Main recommendation function.
     * Combines: user genre profile + TMDB similar + TMDB recommended + trending.
     * Returns an array of scored, deduped, sorted movies.
     */
    async function getRecommendations(limit = 20) {
        const profile = getUserProfile();
        const history = getWatchHistory();
        const watchedIds = new Set(history.map(h => h.movieId));

        // If no watch history, return empty — caller should show trending
        if (history.length === 0) return [];

        // Pick seed movies: last 5 unique watched movies
        const seedIds = [...new Set(history.slice(-10).map(h => h.movieId))].slice(-5);

        // Fetch multiple data sources in parallel
        const fetches = [];

        // 1. TMDB recommendations for each seed
        seedIds.forEach(id => {
            fetches.push(
                fetchTMDB(`/movie/${id}/recommendations`).then(data => 
                    (data.results || []).map(m => ({ ...m, _source: 'recommended', _seedId: id }))
                ).catch(() => [])
            );
        });

        // 2. TMDB similar for each seed
        seedIds.forEach(id => {
            fetches.push(
                fetchTMDB(`/movie/${id}/similar`).then(data =>
                    (data.results || []).map(m => ({ ...m, _source: 'similar', _seedId: id }))
                ).catch(() => [])
            );
        });

        // 3. Genre-based discovery — top 3 user genres
        const topGenres = Object.entries(profile.genreScores || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([id]) => id);

        if (topGenres.length > 0) {
            fetches.push(
                fetchTMDB('/discover/movie', {
                    with_genres: topGenres.join(','),
                    sort_by: 'popularity.desc',
                    'vote_count.gte': 100,
                }).then(data =>
                    (data.results || []).map(m => ({ ...m, _source: 'genre_discover' }))
                ).catch(() => [])
            );
        }

        // 4. High-rated in user's top genre
        if (topGenres.length > 0) {
            fetches.push(
                fetchTMDB('/discover/movie', {
                    with_genres: topGenres[0],
                    sort_by: 'vote_average.desc',
                    'vote_count.gte': 500,
                }).then(data =>
                    (data.results || []).map(m => ({ ...m, _source: 'top_rated_genre' }))
                ).catch(() => [])
            );
        }

        const results = await Promise.all(fetches);
        const allMovies = results.flat();

        // Deduplicate by movie ID, keeping highest source priority
        const movieMap = new Map();
        allMovies.forEach(m => {
            if (!m.id || watchedIds.has(m.id)) return; // skip already watched
            if (!movieMap.has(m.id)) {
                movieMap.set(m.id, m);
            } else {
                // If same movie from multiple sources, boost it
                const existing = movieMap.get(m.id);
                existing._multiSource = (existing._multiSource || 1) + 1;
            }
        });

        // Score each candidate
        const scored = [...movieMap.values()].map(movie => {
            // Similarity bonus: recommended > similar > discover
            let simBonus = 0;
            if (movie._source === 'recommended') simBonus = 0.9;
            else if (movie._source === 'similar') simBonus = 0.7;
            else if (movie._source === 'top_rated_genre') simBonus = 0.5;
            else if (movie._source === 'genre_discover') simBonus = 0.4;

            // Multi-source bonus
            if (movie._multiSource && movie._multiSource > 1) {
                simBonus = Math.min(simBonus + 0.2, 1);
            }

            const score = scoreMovie(movie, profile, simBonus);
            return { ...movie, _score: score };
        });

        // Sort by score descending
        scored.sort((a, b) => b._score - a._score);

        // Take top N, but inject 2-3 diversity picks from lower scores
        const top = scored.slice(0, Math.max(limit - 3, 1));
        const rest = scored.slice(limit);
        const diversePicks = pickDiverseMovies(rest, profile, 3);
        const final = [...top, ...diversePicks].slice(0, limit);

        // Shuffle the diversity picks into random positions (not all at the end)
        for (let i = final.length - 1; i > final.length - 4 && i > 0; i--) {
            const j = Math.floor(Math.random() * (final.length - 3)) + 3;
            [final[i], final[j]] = [final[j], final[i]];
        }

        // Cache results
        try {
            localStorage.setItem(STORAGE_KEYS.RECO_CACHE, JSON.stringify({
                movies: final,
                timestamp: Date.now(),
            }));
        } catch {}

        return final;
    }

    /**
     * Pick N movies that are outside the user's comfort zone
     * to prevent filter bubbles.
     */
    function pickDiverseMovies(pool, profile, n) {
        const topGenreIds = new Set(
            Object.entries(profile.genreScores || {})
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([id]) => parseInt(id))
        );

        // Find movies with genres NOT in top genres
        const diverse = pool.filter(m => {
            const genres = m.genre_ids || [];
            return genres.some(g => !topGenreIds.has(g)) && (m.vote_average || 0) > 6;
        });

        // Shuffle and take N
        for (let i = diverse.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [diverse[i], diverse[j]] = [diverse[j], diverse[i]];
        }
        return diverse.slice(0, n);
    }

    /**
     * Get cached recommendations (for instant load)
     */
    function getCachedRecommendations() {
        try {
            const cache = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECO_CACHE));
            if (cache && cache.movies && (Date.now() - cache.timestamp) < 30 * 60 * 1000) {
                return cache.movies;
            }
        } catch {}
        return null;
    }

    /**
     * Get "Because You Watched X" recommendations for a specific movie.
     */
    async function getBecauseYouWatched(movieId, limit = 10) {
        const profile = getUserProfile();
        const watchedIds = new Set(getWatchHistory().map(h => h.movieId));

        const [similar, recommended] = await Promise.all([
            fetchTMDB(`/movie/${movieId}/similar`).then(d => d.results || []).catch(() => []),
            fetchTMDB(`/movie/${movieId}/recommendations`).then(d => d.results || []).catch(() => []),
        ]);

        const all = [...recommended, ...similar];
        const seen = new Set();
        const deduped = all.filter(m => {
            if (!m.id || seen.has(m.id) || watchedIds.has(m.id)) return false;
            seen.add(m.id);
            return true;
        });

        const scored = deduped.map(m => ({
            ...m,
            _score: scoreMovie(m, profile, m._source === 'recommended' ? 0.8 : 0.6),
        }));

        scored.sort((a, b) => b._score - a._score);
        return scored.slice(0, limit);
    }

    // =========================================================
    // User Profile Stats (for display)
    // =========================================================

    function getProfileStats() {
        const profile = getUserProfile();
        const history = getWatchHistory();

        // Top genres with names
        const topGenres = Object.entries(profile.genreScores || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id, score]) => ({
                id: parseInt(id),
                name: GENRE_MAP[id] || `Genre ${id}`,
                score: Math.round(score * 100),
                count: profile.genreCounts?.[id] || 0,
                avgCompletion: Math.round((profile.genreCompletions?.[id] || 0) * 100),
            }));

        // Total watch time
        const totalSeconds = history.reduce((acc, h) => acc + (h.totalWatchTime || 0), 0);

        return {
            totalMoviesWatched: history.length,
            topGenres,
            peakWatchHour: profile.peakHour,
            totalWatchTimeMinutes: Math.round(totalSeconds / 60),
            profileStrength: Math.min(history.length * 10, 100), // 0-100%
        };
    }

    // =========================================================
    // Utility: TMDB Fetch wrapper
    // =========================================================

    async function fetchTMDB(path, params = {}) {
        const url = new URL(`${TMDB_BASE_URL}${path}`);
        url.searchParams.set('api_key', TMDB_API_KEY);
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`TMDB ${res.status}`);
        return res.json();
    }

    // =========================================================
    // Continue Watching
    // =========================================================

    function getContinueWatching() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.CONTINUE_WATCHING)) || [];
        } catch { return []; }
    }

    function saveContinueWatching(items) {
        // Keep max 30 entries
        localStorage.setItem(STORAGE_KEYS.CONTINUE_WATCHING, JSON.stringify(items.slice(0, 30)));
    }

    /**
     * Save or update a continue watching entry.
     * @param {object} opts
     * @param {number} opts.id - TMDB ID
     * @param {string} opts.title
     * @param {string} opts.poster_path
     * @param {string} opts.mediaType - 'movie' or 'tv'
     * @param {number} opts.currentTime - seconds
     * @param {number} opts.duration - seconds
     * @param {number} [opts.season]
     * @param {number} [opts.episode]
     * @param {number} [opts.vote_average]
     */
    function updateContinueWatching(opts) {
        if (!opts.id || !opts.duration || opts.duration <= 0) return;

        const progress = opts.currentTime / opts.duration;  // 0–1

        // If completed (>95%), remove from continue watching
        if (progress > 0.95) {
            removeContinueWatching(opts.id, opts.mediaType, opts.season, opts.episode);
            return;
        }

        // Don't save if barely started (<1%)
        if (progress < 0.01) return;

        const items = getContinueWatching();
        const key = _cwKey(opts.id, opts.mediaType, opts.season, opts.episode);

        const existing = items.findIndex(i => i._key === key);
        const entry = {
            _key: key,
            id: opts.id,
            title: opts.title || '',
            poster_path: opts.poster_path || null,
            mediaType: opts.mediaType || 'movie',
            currentTime: Math.floor(opts.currentTime),
            duration: Math.floor(opts.duration),
            progress: Math.round(progress * 100),
            season: opts.season || null,
            episode: opts.episode || null,
            vote_average: opts.vote_average || 0,
            updatedAt: Date.now(),
        };

        if (existing !== -1) {
            items[existing] = entry;
        } else {
            items.unshift(entry);
        }

        // Sort by most recently updated
        items.sort((a, b) => b.updatedAt - a.updatedAt);
        saveContinueWatching(items);
    }

    function removeContinueWatching(id, mediaType, season, episode) {
        const items = getContinueWatching();
        const key = _cwKey(id, mediaType, season, episode);
        const filtered = items.filter(i => i._key !== key);
        saveContinueWatching(filtered);
    }

    function _cwKey(id, mediaType, season, episode) {
        if (mediaType === 'tv' && season != null && episode != null) {
            return `${mediaType}_${id}_s${season}e${episode}`;
        }
        return `${mediaType}_${id}`;
    }

    function clearContinueWatching() {
        localStorage.removeItem(STORAGE_KEYS.CONTINUE_WATCHING);
    }

    // =========================================================
    // Clear user data
    // =========================================================

    function clearAllData() {
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    }

    // =========================================================
    // Public API
    // =========================================================
    return {
        recordWatch,
        recordClick,
        getRecommendations,
        getCachedRecommendations,
        getBecauseYouWatched,
        getProfileStats,
        getUserProfile,
        getWatchHistory,
        scoreMovie,
        clearAllData,
        getContinueWatching,
        updateContinueWatching,
        removeContinueWatching,
        clearContinueWatching,
        GENRE_MAP,
    };
})();
