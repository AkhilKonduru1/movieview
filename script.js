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
    loadTrendingMovies();
    setupSearchDebounce();
});

// Setup search with debounce
function setupSearchDebounce() {
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchQuery = e.target.value.trim();
        currentPage = 1;
        
        searchTimeout = setTimeout(() => {
            if (searchQuery) {
                searchMovies(searchQuery);
            } else {
                loadTrendingMovies();
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
    playMovie(id, movie.title, movie.overview, rating, year);
}

// Play Movie
function playMovie(tmdbId, title, overview, rating, year) {
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

// Watch progress tracking (optional)
window.addEventListener('message', function (event) {
    try {
        const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        console.log('Player event:', message);
        
        // You can save watch progress here
        if (message.event === 'timeupdate') {
            // Save to localStorage
            const watchProgress = {
                movieId: message.id,
                progress: message.currentTime,
                duration: message.duration,
                timestamp: message.timestamp
            };
            localStorage.setItem(`watch_progress_${message.id}`, JSON.stringify(watchProgress));
        }
    } catch (error) {
        console.log('Message from player:', event.data);
    }
});
