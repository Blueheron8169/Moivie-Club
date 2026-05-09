// app.js - Full Platform Logic (Bug Fixes applied)

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDgmwWYIqNWrXuhDyrzJmJUOhm4ZFJxj5Y",
    authDomain: "movie-rater-6f591.firebaseapp.com",
    projectId: "movie-rater-6f591",
    storageBucket: "movie-rater-6f591.firebasestorage.app",
    messagingSenderId: "627802743041",
    appId: "1:627802743041:web:45ca75bf32cd126c6efb00"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const OMDB_API_KEY = "trilogy"; 

// --- STATE ---
let currentUser = "Anonymous";
let chatUnsubscribe = null;
let reviewsUnsubscribe = null;
let currentMovieContext = null;

// Safe load Personal Lists (Local Storage)
let myLists;
try {
    myLists = JSON.parse(localStorage.getItem('cineclub_lists')) || { favorites: [], watched: [], watchlist: [] };
} catch (e) {
    myLists = { favorites: [], watched: [], watchlist: [] };
}

// --- DOM ELEMENTS ---
const navItems = document.querySelectorAll('.nav-item');
const tabViews = document.querySelectorAll('.tab-view');
const usernameModal = document.getElementById('username-modal');
const usernameInput = document.getElementById('username-input');
const saveUsernameBtn = document.getElementById('save-username-btn');

// Movies View
const searchInput = document.getElementById('movie-search');
const searchBtn = document.getElementById('search-btn');
const searchResultsContainer = document.getElementById('search-results-container');
const searchGrid = document.getElementById('search-grid');


// Lists View
const favoritesGrid = document.getElementById('favorites-grid');
const watchedGrid = document.getElementById('watched-grid');
const watchlistGrid = document.getElementById('watchlist-grid');

// Chat View
const chatContainer = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

// Movie Modal
const movieModal = document.getElementById('movie-modal');
const closeMovieModalBtn = document.getElementById('close-movie-modal');
const modalPoster = document.getElementById('modal-poster');
const modalTitle = document.getElementById('modal-title');
const modalMeta = document.getElementById('modal-meta');
const modalPlot = document.getElementById('modal-plot');

// Modal Actions
const btnFav = document.getElementById('btn-fav');
const btnWatched = document.getElementById('btn-watched');
const btnWatchlist = document.getElementById('btn-watchlist');
const starsInput = document.querySelectorAll('.stars-input span');
const reviewText = document.getElementById('review-text');
const submitReviewBtn = document.getElementById('submit-review');
const communityReviewsList = document.getElementById('community-reviews-list');
let currentRating = 0;


// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    
    const savedName = localStorage.getItem('cineclub_username');
    if (savedName) {
        currentUser = savedName;
        usernameModal.classList.remove('active');
        initChat();
    }
    
    renderMyLists();
    
    // Default search so page isn't blank
    searchInput.value = 'Inception';
    handleSearch();
});

// --- USERNAME ---
saveUsernameBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (!name) return alert("Please enter a username.");
    currentUser = name;
    localStorage.setItem('cineclub_username', name);
    usernameModal.classList.remove('active');
    initChat();
});

// --- NAVIGATION ---
function initTabs() {
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            tabViews.forEach(t => t.classList.remove('active'));
            
            item.classList.add('active');
            const tabId = item.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');

            if (tabId === 'chat-view') chatContainer.scrollTop = chatContainer.scrollHeight;
            if (tabId === 'lists-view') renderMyLists();
        });
    });
}

// --- OMDB FETCHING ---
async function fetchMovies(query) {
    try {
        const res = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(query)}&apikey=${OMDB_API_KEY}`);
        const data = await res.json();
        return data.Response === "True" ? data.Search : [];
    } catch (e) { console.error(e); return []; }
}

async function fetchMovieDetails(id) {
    try {
        const res = await fetch(`https://www.omdbapi.com/?i=${id}&plot=full&apikey=${OMDB_API_KEY}`);
        return await res.json();
    } catch (e) { console.error(e); return null; }
}

// --- SEARCH ---

searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleSearch(); });

async function handleSearch() {
    const q = searchInput.value.trim();
    if (!q) return;
    
    searchResultsContainer.style.display = 'block';
    searchGrid.innerHTML = `<p style="color:var(--text-muted)">Searching...</p>`;
    
    const results = await fetchMovies(q);
    if(results.length > 0) renderMovieCards(results, searchGrid);
    else searchGrid.innerHTML = `<p style="color:var(--primary-red)">No results found.</p>`;
}

function renderMovieCards(movies, container) {
    container.innerHTML = movies.slice(0, 10).map(m => {
        const poster = m.Poster !== "N/A" ? m.Poster : "https://via.placeholder.com/300x450?text=No+Poster";
        return `
            <div class="movie-card" onclick="openMovieDetails('${m.imdbID}')">
                <div class="poster" style="background-image: url('${poster}')"></div>
                <div class="movie-info">
                    <h3 title="${m.Title}">${m.Title}</h3>
                    <p>${m.Year}</p>
                </div>
            </div>
        `;
    }).join('');
}

// --- MOVIE DETAILS MODAL ---
async function openMovieDetails(imdbID) {
    movieModal.classList.add('active');
    modalPlot.textContent = "Loading full details...";
    modalTitle.textContent = "Loading...";
    modalPoster.style.backgroundImage = 'none';
    
    const movie = await fetchMovieDetails(imdbID);
    if (!movie) {
        modalPlot.textContent = "Failed to load details.";
        return;
    }

    currentMovieContext = movie;
    
    // Populate Data
    modalTitle.textContent = movie.Title;
    modalMeta.textContent = `${movie.Year} • ${movie.Genre} • ${movie.Runtime} • IMDB: ${movie.imdbRating}`;
    modalPlot.textContent = movie.Plot;
    const poster = movie.Poster !== "N/A" ? movie.Poster : "https://via.placeholder.com/300x450?text=No+Poster";
    modalPoster.style.backgroundImage = `url('${poster}')`;

    // Update List Buttons State
    updateListButtonsState();
    
    // Reset Review Inputs
    currentRating = 0;
    starsInput.forEach(s => s.classList.remove('selected'));
    reviewText.value = '';

    // Load Community Reviews
    loadMovieReviews(imdbID);
}

closeMovieModalBtn.addEventListener('click', () => {
    movieModal.classList.remove('active');
    if(reviewsUnsubscribe) reviewsUnsubscribe();
});

// --- PERSONAL LISTS LOGIC ---
function saveLists() {
    localStorage.setItem('cineclub_lists', JSON.stringify(myLists));
    renderMyLists();
}

function toggleList(listName, btnElement) {
    if (!currentMovieContext) return;
    
    const movieObj = {
        imdbID: currentMovieContext.imdbID,
        Title: currentMovieContext.Title,
        Year: currentMovieContext.Year,
        Poster: currentMovieContext.Poster
    };

    const existsIndex = myLists[listName].findIndex(m => m.imdbID === movieObj.imdbID);
    
    if (existsIndex >= 0) {
        myLists[listName].splice(existsIndex, 1);
        btnElement.classList.remove('active');
    } else {
        myLists[listName].push(movieObj);
        btnElement.classList.add('active');
    }
    saveLists();
}

btnFav.addEventListener('click', () => toggleList('favorites', btnFav));
btnWatched.addEventListener('click', () => toggleList('watched', btnWatched));
btnWatchlist.addEventListener('click', () => toggleList('watchlist', btnWatchlist));

function updateListButtonsState() {
    if(!currentMovieContext) return;
    const id = currentMovieContext.imdbID;
    
    btnFav.classList.toggle('active', myLists.favorites.some(m => m.imdbID === id));
    btnWatched.classList.toggle('active', myLists.watched.some(m => m.imdbID === id));
    btnWatchlist.classList.toggle('active', myLists.watchlist.some(m => m.imdbID === id));
}

function renderMyLists() {
    renderMovieCards(myLists.favorites, favoritesGrid);
    renderMovieCards(myLists.watched, watchedGrid);
    renderMovieCards(myLists.watchlist, watchlistGrid);
    
    if(myLists.favorites.length === 0) favoritesGrid.innerHTML = "<p style='color:var(--text-muted)'>No favorites yet.</p>";
    if(myLists.watched.length === 0) watchedGrid.innerHTML = "<p style='color:var(--text-muted)'>No watched movies logged.</p>";
    if(myLists.watchlist.length === 0) watchlistGrid.innerHTML = "<p style='color:var(--text-muted)'>Watchlist is empty.</p>";
}

// --- REVIEWS LOGIC (FIREBASE) ---
starsInput.forEach(star => {
    star.addEventListener('click', (e) => {
        currentRating = parseInt(e.target.getAttribute('data-val'));
        starsInput.forEach(s => {
            if (parseInt(s.getAttribute('data-val')) <= currentRating) s.classList.add('selected');
            else s.classList.remove('selected');
        });
    });
});

submitReviewBtn.addEventListener('click', () => {
    if (currentRating === 0) return alert('Please select a star rating.');
    if (!currentMovieContext) return;

    const text = reviewText.value.trim();
    
    submitReviewBtn.textContent = 'Posting...';
    submitReviewBtn.disabled = true;

    db.collection("movie_reviews").add({
        imdbID: currentMovieContext.imdbID,
        author: currentUser,
        stars: currentRating,
        text: text || "No written review provided.",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        reviewText.value = '';
        currentRating = 0;
        starsInput.forEach(s => s.classList.remove('selected'));
        submitReviewBtn.textContent = 'Post';
        submitReviewBtn.disabled = false;
    }).catch(e => {
        console.error("Firebase Security Rules Error:", e);
        alert("Action Denied! Your Firebase Security Rules are set to strict mode. Go to your Firebase Console -> Firestore -> Rules, and set them to 'Test Mode' to allow reading/writing.");
        submitReviewBtn.textContent = 'Post';
        submitReviewBtn.disabled = false;
    });
});

function loadMovieReviews(imdbID) {
    communityReviewsList.innerHTML = '<p style="color:var(--text-muted)">Loading reviews...</p>';
    if (reviewsUnsubscribe) reviewsUnsubscribe();

    // Removed .orderBy() to prevent crashing if the user hasn't setup composite indexes in Firebase!
    reviewsUnsubscribe = db.collection("movie_reviews")
        .where("imdbID", "==", imdbID)
        .onSnapshot(snapshot => {
            if (snapshot.empty) {
                communityReviewsList.innerHTML = '<p style="color:var(--text-muted)">No reviews yet. Be the first!</p>';
                return;
            }
            
            // Sort manually in JS to avoid index requirement
            const reviews = [];
            snapshot.forEach(doc => reviews.push(doc.data()));
            reviews.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

            communityReviewsList.innerHTML = '';
            reviews.forEach(rev => {
                communityReviewsList.innerHTML += `
                    <div class="review-item">
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                            <strong>${rev.author}</strong>
                            <span style="color:#ffd700">${'★'.repeat(rev.stars)}${'☆'.repeat(5-rev.stars)}</span>
                        </div>
                        <p style="color:var(--text-main); font-size:0.9rem;">${rev.text}</p>
                    </div>
                `;
            });
        }, err => {
            console.error("Firebase Read Error:", err);
            communityReviewsList.innerHTML = '<p style="color:var(--primary-red)">Access Denied by Firebase Rules. Set your Firestore rules to Test Mode.</p>';
        });
}


// --- FIREBASE REAL-TIME CHAT ---
function initChat() {
    chatContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Loading chat history...</p>';
    if (chatUnsubscribe) chatUnsubscribe();
    
    chatUnsubscribe = db.collection("global_chat")
        .orderBy("timestamp", "asc")
        .limitToLast(50)
        .onSnapshot((snapshot) => {
            chatContainer.innerHTML = '';
            if (snapshot.empty) return chatContainer.innerHTML = '<p style="color:var(--text-muted); text-align:center;">No messages yet. Say hello!</p>';

            snapshot.forEach((doc) => {
                const msg = doc.data();
                const isSelf = msg.author === currentUser;
                chatContainer.innerHTML += `
                    <div class="chat-message ${isSelf ? 'self' : ''}">
                        <div class="msg-author">${msg.author}</div>
                        <div class="msg-text">${msg.text}</div>
                    </div>
                `;
            });
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, err => {
            console.error("Chat Error:", err);
            chatContainer.innerHTML = '<p style="color:var(--primary-red); text-align:center;">Chat disabled. Go to your Firebase console and set your Firestore Rules to Test Mode!</p>';
        });
}

function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    db.collection("global_chat").add({
        author: currentUser,
        text: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        chatInput.value = ''; // Only clear on success
    }).catch(e => {
        console.error("Firebase Error:", e);
        alert("Action Denied! Your Firebase Security Rules are blocking writes. Go to Firebase Console and enable Test Mode.");
    });
}

sendChatBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });
