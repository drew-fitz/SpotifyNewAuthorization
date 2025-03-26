/**
 * Spotify Genie - Debugging Version
 */

// Keep existing authentication code
const clientId = 'fb6eea506c354ff292e0898ffa737638';
const redirectUrl = 'https://spotifygenie-96268.web.app/';
const authorizationEndpoint = "https://accounts.spotify.com/authorize";
const tokenEndpoint = "https://accounts.spotify.com/api/token";
const scope = 'user-read-private user-read-email user-library-read user-top-read user-read-recently-played playlist-modify-private playlist-read-private';


// Token management
const currentToken = {
  get access_token() { return localStorage.getItem('access_token') || null; },
  get refresh_token() { return localStorage.getItem('refresh_token') || null; },
  get expires_in() { return localStorage.getItem('expires_in') || null },
  get expires() { return localStorage.getItem('expires') || null },


  save: function (response) {
    const { access_token, refresh_token, expires_in } = response;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    localStorage.setItem('expires_in', expires_in);


    const now = new Date();
    const expiry = new Date(now.getTime() + (expires_in * 1000));
    localStorage.setItem('expires', expiry);
  }
};


// Function to format expiration date
function getExpirationDate(expires_in) {
  const now = new Date();
  const expiry = new Date(now.getTime() + (expires_in * 1000));
  return expiry.toLocaleString();
}


// Get code from URL
const args = new URLSearchParams(window.location.search);
const code = args.get('code');


// MAIN APP INITIALIZATION
async function initApp() {
  // Add custom styles first
  addStyles();
  console.log("==== APP INITIALIZATION STARTED ====");
 
  // Handle auth callback
  if (code) {
    console.log("Code found in URL, exchanging for token");
    try {
      const token = await getToken(code);
      currentToken.save(token);
      console.log("Token obtained and saved");
     
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      const updatedUrl = url.search ? url.href : url.href.replace('?', '');
      window.history.replaceState({}, document.title, updatedUrl);
    } catch (error) {
      console.error("Error during token exchange:", error);
    }
  }

  // Check if we're logged in
  if (currentToken.access_token) {
    console.log("Access token found in localStorage");
   
    try {
      // Render user profile
      const userData = await getUserData();
      console.log("User data fetched successfully:", userData);
      renderTemplate("main", "logged-in-template", userData);
      renderTemplate("oauth", "oauth-template", currentToken);
     
      // Create containers
      createContainers();
     
      // Render search form
      renderTemplate("search-form-container", "search-form-template");
     
      // Render playlist generator
      renderTemplate("playlist-generator-container", "playlist-generator-template");
      
      // Render CSV recommendations container
      renderTemplate("main", "csv-recommendations-container-template");

      // Fetch and render saved tracks with better error handling
      console.log("Fetching saved tracks...");
      try {
        const tracks = await getUserSavedTracks();
        console.log(`Successfully fetched ${tracks.length} saved tracks`);
        
        // Make sure the tracks container exists
        if (!document.getElementById("tracks-container")) {
          console.warn("tracks-container not found, creating it");
          createContainers();
        }
        
        // Render tracks
        renderTracksTemplate("tracks-container", tracks);
      } catch (error) {
        console.error("Error fetching saved tracks:", error);
        
        if (document.getElementById("tracks-container")) {
          document.getElementById("tracks-container").innerHTML = `
            <div class="component-container">
              <h3>Your Saved Tracks</h3>
              <div class="error-message">Error loading tracks: ${error.message}</div>
              <button onclick="location.reload()">Retry</button>
            </div>`;
        }
      }
    } catch (error) {
      console.error("Error initializing logged-in state:", error);
    }
  } else {
    console.log("No access token found, rendering login template");
    renderTemplate("main", "login");
  }
 
  console.log("==== APP INITIALIZATION COMPLETED ====");
}

// Improved createContainers function to log more information
function createContainers() {
  const containers = [
    "search-form-container",
    "playlist-generator-container",
    "tracks-container"
  ];
 
  containers.forEach(id => {
    const existingContainer = document.getElementById(id);
    if (!existingContainer) {
      console.log(`Creating missing container: ${id}`);
      const container = document.createElement("div");
      container.id = id;
      container.className = "component-container";
      
      // Find where to append the container
      const main = document.getElementById("main");
      if (main) {
        main.appendChild(container);
        console.log(`Added ${id} to main element`);
      } else {
        document.body.appendChild(container);
        console.log(`Added ${id} to body (main element not found)`);
      }
    } else {
      console.log(`Container already exists: ${id}`);
    }
  });
}

// Updated handleSearch with better debugging and error handling
async function handleSearch(event) {
  event.preventDefault();
  const searchInput = document.getElementById('search-input');
 
  if (!searchInput) {
    console.error("Search input element not found");
    return;
  }
 
  const query = searchInput.value.trim();
  console.log(`Executing search for: "${query}"`);
 
  if (!query) {
    console.log("Empty search query, not sending request");
    document.getElementById("search-results").innerHTML = 
      '<div class="info-message">Please enter a search term</div>';
    return;
  }
  
  try {
    // Show loading indicator
    document.getElementById("search-results").innerHTML = 
      '<div class="loading-message">Searching...</div>';
    
    const searchResults = await searchSpotify(query);
    console.log(`Search returned ${searchResults.length} results`);
    
    // Render search results
    renderSearchResultsTemplate("search-results", { searchResults });
  } catch (error) {
    console.error("Search error:", error);
    document.getElementById("search-results").innerHTML =
      `<div class="error-message">Search error: ${error.message}</div>`;
  }
}

function exportLikedSongsToCSV() {
  getUserSavedTracks(50).then(tracks => {
      if (!tracks || tracks.length === 0) {
          alert("No liked songs found!");
          return;
      }

      let csvContent = "data:text/csv;charset=utf-8,Name,Artist\n";
      tracks.forEach(track => {
          let row = `"${track.name}","${track.artist}"`;
          csvContent += row + "\n";
      });

      // Create and trigger download
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "liked_songs.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  }).catch(error => {
      console.error("Error exporting liked songs:", error);
      alert("Failed to export liked songs.");
  });
}


// SPOTIFY API FUNCTIONS


// Auth flow
async function redirectToSpotifyAuthorize() {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = crypto.getRandomValues(new Uint8Array(64));
  const randomString = randomValues.reduce((acc, x) => acc + possible[x % possible.length], "");


  const code_verifier = randomString;
  const data = new TextEncoder().encode(code_verifier);
  const hashed = await crypto.subtle.digest('SHA-256', data);


  const code_challenge_base64 = btoa(String.fromCharCode(...new Uint8Array(hashed)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');


  window.localStorage.setItem('code_verifier', code_verifier);


  const authUrl = new URL(authorizationEndpoint)
  const params = {
    response_type: 'code',
    client_id: clientId,
    scope: scope,
    code_challenge_method: 'S256',
    code_challenge: code_challenge_base64,
    redirect_uri: redirectUrl,
  };


  authUrl.search = new URLSearchParams(params).toString();
  window.location.href = authUrl.toString();
}


async function getToken(code) {
  const code_verifier = localStorage.getItem('code_verifier');


  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUrl,
      code_verifier: code_verifier,
    }),
  });


  const data = await response.json();
  if (data.error) {
    throw new Error(`Token error: ${data.error_description || data.error}`);
  }
  return data;
}


async function refreshToken() {
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: currentToken.refresh_token
    }),
  });


  return await response.json();
}


// Data fetching
async function getUserData() {
  const response = await fetch("https://api.spotify.com/v1/me", {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
  });


  const data = await response.json();
  if (data.error) {
    throw new Error(`API error: ${data.error.message || 'Unknown error'}`);
  }
  return data;
}


async function getUserSavedTracks(limit = 20) {
  try {
    console.log(`Fetching up to ${limit} saved tracks...`);
    const response = await fetch(`https://api.spotify.com/v1/me/tracks?limit=${limit}`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API error: ${errorData.error ? errorData.error.message : response.statusText}`);
    }

    const data = await response.json();
    console.log("Saved tracks API response:", data);
    
    // Validate the response structure
    if (!data.items || !Array.isArray(data.items)) {
      console.error("Unexpected API response format:", data);
      throw new Error("Unexpected API response format");
    }
    
    // Map the response to a simplified format
    const tracks = data.items.map(item => ({
      name: item.track.name,
      artist: item.track.artists.map(a => a.name).join(', '),
      id: item.track.id,
      albumCover: item.track.album.images[0]?.url || ''
    }));
    
    console.log(`Successfully processed ${tracks.length} tracks`);
    return tracks;
  } catch (error) {
    console.error("Error in getUserSavedTracks:", error);
    throw error; // Re-throw to be caught by the caller
  }
}

// Fix for searchSpotify function to properly handle API response
async function searchSpotify(query, type = 'track', limit = 10) {
  if (!query) return [];

  try {
    console.log(`Searching for "${query}" (type: ${type}, limit: ${limit})`);
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Search error: ${errorData.error ? errorData.error.message : response.statusText}`);
    }
    
    const data = await response.json();
    console.log("Search API response:", data);
    
    if (!data.tracks || !data.tracks.items) {
      console.error("Unexpected search response format:", data);
      return [];
    }
    
    // Map the response to a simplified format
    const tracks = data.tracks.items.map(item => ({
      name: item.name,
      artist: item.artists.map(a => a.name).join(', '),
      id: item.id,
      albumCover: item.album.images[0]?.url || '',
      uri: item.uri
    }));
    
    console.log(`Search returned ${tracks.length} results`);
    return tracks;
  } catch (error) {
    console.error("Error in searchSpotify:", error);
    throw error;
  }
}

// New function to render tracks properly
// Fix for the renderTracksTemplate function to ensure the export button is always added
function renderTracksTemplate(targetId, tracks) {
  console.log(`Rendering ${tracks.length} tracks to ${targetId}`);
  const targetElement = document.getElementById(targetId);
  
  if (!targetElement) {
    console.error(`Target element not found: ${targetId}`);
    return;
  }
  
  // Create container
  const container = document.createElement('div');
  container.className = 'component-container';
  
  // Add heading
  const heading = document.createElement('h3');
  heading.textContent = 'Your Saved Tracks';
  container.appendChild(heading);
  
  // Always add the export button at the top
  const exportButton = document.createElement('button');
  exportButton.textContent = 'Download Liked Songs as CSV';
  exportButton.onclick = exportLikedSongsToCSV;
  exportButton.className = 'spotify-button';
  container.appendChild(exportButton);
  
  if (!tracks || tracks.length === 0) {
    const noTracksMsg = document.createElement('p');
    noTracksMsg.textContent = "You don't have any saved tracks yet.";
    container.appendChild(noTracksMsg);
  } else {
    // Create tracks list
    const tracksList = document.createElement('div');
    tracksList.className = 'track-list';
    
    tracks.forEach(track => {
      const trackItem = document.createElement('div');
      trackItem.className = 'track-item';
      
      // Create track info container first (this will be on the left)
      const trackInfo = document.createElement('div');
      trackInfo.className = 'track-info';
      
      // Add track name
      const trackName = document.createElement('div');
      trackName.className = 'track-name';
      trackName.textContent = track.name;
      trackInfo.appendChild(trackName);
      
      // Add artist name
      const artistName = document.createElement('div');
      artistName.className = 'track-artist';
      artistName.textContent = track.artist;
      trackInfo.appendChild(artistName);
      
      // Add the track info to the track item (on the left)
      trackItem.appendChild(trackInfo);
      
      // Create album cover if available (this will be on the right)
      if (track.albumCover) {
        const albumImg = document.createElement('img');
        albumImg.src = track.albumCover;
        albumImg.alt = `${track.name} album art`;
        albumImg.className = 'album-cover';
        trackItem.appendChild(albumImg);
      }
      
      tracksList.appendChild(trackItem);
    });
    
    container.appendChild(tracksList);
  }
  
  // Clear and append to target
  targetElement.innerHTML = '';
  targetElement.appendChild(container);
}

// Add CSS styles to position album covers on the right
function addStyles() {
  // Check if our styles are already added
  if (document.getElementById('spotify-genie-styles')) return;
  
  const styleEl = document.createElement('style');
  styleEl.id = 'spotify-genie-styles';
  styleEl.textContent = `
    .track-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding: 10px;
      border-radius: 4px;
      background-color: #f5f5f5;
    }
    
    .track-info {
      flex-grow: 1;
      margin-right: 10px;
    }
    
    .track-name {
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .track-artist {
      color: #666;
    }
    
    .album-cover {
      width: 60px;
      height: 60px;
      object-fit: cover;
      border-radius: 4px;
    }
    
    .track-list {
      margin-bottom: 20px;
    }
  `;
  
  document.head.appendChild(styleEl);
  console.log("Added custom styles for track display");
}

// New function to render search results
function renderSearchResultsTemplate(targetId, { searchResults }) {
  console.log(`Rendering ${searchResults.length} search results to ${targetId}`);
  const targetElement = document.getElementById(targetId);
  
  if (!targetElement) {
    console.error(`Target element not found: ${targetId}`);
    return;
  }
  
  // Create container
  const container = document.createElement('div');
  container.className = 'search-results-container';
  
  // Add heading
  const heading = document.createElement('h3');
  heading.textContent = 'Search Results';
  container.appendChild(heading);
  
  if (!searchResults || searchResults.length === 0) {
    const noResultsMsg = document.createElement('p');
    noResultsMsg.textContent = "No matching tracks found.";
    container.appendChild(noResultsMsg);
  } else {
    // Create results list
    const resultsList = document.createElement('div');
    resultsList.className = 'track-list';
    
    searchResults.forEach(track => {
      const trackItem = document.createElement('div');
      trackItem.className = 'track-item';
      
            // Create track info container first (this will be on the left)
      const trackInfo = document.createElement('div');
      trackInfo.className = 'track-info';
      
      // Add track name
      const trackName = document.createElement('div');
      trackName.className = 'track-name';
      trackName.textContent = track.name;
      trackInfo.appendChild(trackName);
      
      // Add artist name
      const artistName = document.createElement('div');
      artistName.className = 'track-artist';
      artistName.textContent = track.artist;
      trackInfo.appendChild(artistName);
      
      // Add the track info to the track item (on the left)
      trackItem.appendChild(trackInfo);
      
      // Create album cover if available (this will be on the right)
      if (track.albumCover) {
        const albumImg = document.createElement('img');
        albumImg.src = track.albumCover;
        albumImg.alt = `${track.name} album art`;
        albumImg.className = 'album-cover';
        trackItem.appendChild(albumImg);
      }
      resultsList.appendChild(trackItem);
    });
    
    container.appendChild(resultsList);
  }
  
  // Clear and append to target
  targetElement.innerHTML = '';
  targetElement.appendChild(container);
}

// Enhanced generatePlaylistByType function
async function generatePlaylistByType(playlistType) {
  console.log(`Starting generation of ${playlistType} playlist`);
  
  try {
    // Handle "new-releases" specially
    if (playlistType === 'new-releases') {
      return await getNewReleases();
    }
    
    // For all other types, use Spotify's recommendation engine
    // We'll avoid using audio features due to 403 error
    return await getRecommendedTracks(playlistType);
    
  } catch (error) {
    console.error("Error in playlist generator:", error);
    throw error;
  }
}

// Get saved tracks with audio features
async function getSavedTracksWithFeatures() {
  console.log("Fetching saved tracks with audio features");
  
  // Step 1: Get saved tracks
  const savedTracksResponse = await fetch('https://api.spotify.com/v1/me/tracks?limit=50', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
  });
  
  if (!savedTracksResponse.ok) {
    throw new Error(`Failed to fetch saved tracks: ${savedTracksResponse.status}`);
  }
  
  const savedTracksData = await savedTracksResponse.json();
  
  if (!savedTracksData.items || savedTracksData.items.length === 0) {
    return [];
  }
  
  // Step 2: Get track IDs and prepare for audio features request
  const trackIds = savedTracksData.items.map(item => item.track.id);
  
  // Step 3: Get audio features in batches (Spotify API limit is 100 per request)
  const tracksWithFeatures = await getAudioFeatures(trackIds, savedTracksData.items);
  
  return tracksWithFeatures;
}

// Get top tracks with audio features
async function getTopTracksWithFeatures() {
  console.log("Fetching top tracks with audio features");
  
  // Step 1: Get top tracks (medium_term = ~6 months)
  const topTracksResponse = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=medium_term', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
  });
  
  if (!topTracksResponse.ok) {
    throw new Error(`Failed to fetch top tracks: ${topTracksResponse.status}`);
  }
  
  const topTracksData = await topTracksResponse.json();
  
  if (!topTracksData.items || topTracksData.items.length === 0) {
    return [];
  }
  
  // Step 2: Get track IDs and prepare for audio features request
  const trackIds = topTracksData.items.map(item => item.id);
  
  // Step 3: Get audio features
  const tracksWithFeatures = await getAudioFeatures(trackIds, topTracksData.items);
  
  return tracksWithFeatures;
}

// Get audio features for tracks
async function getAudioFeatures(trackIds, trackItems) {
  // Handle empty arrays
  if (!trackIds || trackIds.length === 0) {
    return [];
  }
  
  console.log(`Getting audio features for ${trackIds.length} tracks`);
  
  // Spotify API can only handle 100 tracks per request
  const batchSize = 100;
  const batches = [];
  
  for (let i = 0; i < trackIds.length; i += batchSize) {
    batches.push(trackIds.slice(i, i + batchSize));
  }
  
  // Get audio features for each batch
  const audioFeaturesBatches = await Promise.all(
    batches.map(async batchIds => {
      const response = await fetch(`https://api.spotify.com/v1/audio-features?ids=${batchIds.join(',')}`, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch audio features: ${response.status}`);
      }
      
      return response.json();
    })
  );
  
  // Flatten audio features
  const audioFeatures = audioFeaturesBatches
    .flatMap(batch => batch.audio_features)
    .filter(features => features !== null);
  
  // Map audio features to track objects
  const featuresMap = {};
  audioFeatures.forEach(features => {
    if (features && features.id) {
      featuresMap[features.id] = features;
    }
  });
  
  // Combine track data with audio features
  const tracksWithFeatures = trackItems.map(item => {
    // Handle both saved tracks format and top tracks format
    const track = item.track || item;
    const id = track.id;
    
    return {
      name: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      id: id,
      albumCover: track.album && track.album.images && track.album.images.length > 0 
        ? track.album.images[0].url 
        : '',
      popularity: track.popularity || 50,
      album: track.album ? {
        name: track.album.name,
        release_date: track.album.release_date || '2020'
      } : null,
      // Add audio features
      audioFeatures: featuresMap[id] || null
    };
  });
  
  return tracksWithFeatures;
}

// Get new releases
async function getNewReleases() {
  console.log("Fetching new releases");
  
  const newReleasesResponse = await fetch('https://api.spotify.com/v1/browse/new-releases?limit=50', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
  });
  
  if (!newReleasesResponse.ok) {
    throw new Error(`Failed to fetch new releases: ${newReleasesResponse.status}`);
  }
  
  const newReleasesData = await newReleasesResponse.json();
  
  if (!newReleasesData.albums || !newReleasesData.albums.items || newReleasesData.albums.items.length === 0) {
    throw new Error("No new releases found.");
  }
  
  // Now get tracks for these albums (first track from each album)
  const albumIds = newReleasesData.albums.items.map(album => album.id);
  
  // Spotify API can only handle 20 albums per request
  const batchSize = 20;
  const albumBatches = [];
  
  for (let i = 0; i < albumIds.length; i += batchSize) {
    albumBatches.push(albumIds.slice(i, i + batchSize));
  }
  
  let newReleaseTracks = [];
  
  // Get tracks for each album batch
  for (const batchIds of albumBatches) {
    const albumsResponse = await Promise.all(
      batchIds.map(albumId => 
        fetch(`https://api.spotify.com/v1/albums/${albumId}/tracks?limit=1`, {
          method: 'GET',
          headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
        })
      )
    );
    
    const albumsData = await Promise.all(
      albumsResponse.map(response => {
        if (!response.ok) {
          console.warn(`Failed to fetch album tracks: ${response.status}`);
          return { items: [] };
        }
        return response.json();
      })
    );
    
    // Match album data with track data
    const batchTracks = batchIds.map((albumId, index) => {
      const album = newReleasesData.albums.items.find(a => a.id === albumId);
      const albumTracks = albumsData[index].items;
      
      if (!album || !albumTracks || albumTracks.length === 0) {
        return null;
      }
      
      const track = albumTracks[0];
      
      return {
        name: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        id: track.id,
        albumCover: album.images && album.images.length > 0 ? album.images[0].url : '',
        popularity: album.popularity || 50,
        album: {
          name: album.name,
          release_date: album.release_date || '2023'
        }
      };
    }).filter(track => track !== null);
    
    newReleaseTracks = newReleaseTracks.concat(batchTracks);
  }
  
  // Limit to top 10 tracks
  return newReleaseTracks.slice(0, 10);
}

// Enhanced processTracksForPlaylist to handle all playlist types
function processTracksForPlaylist(tracks, playlistType) {
  console.log(`Processing ${tracks.length} tracks for ${playlistType} playlist`);
  
  // Handle different playlist types
  switch (playlistType) {
    case 'mood-happy':
      return getMoodPlaylist(tracks, 'happy');
    
    case 'mood-sad':
      return getMoodPlaylist(tracks, 'sad');
    
    case 'mood-chill':
      return getMoodPlaylist(tracks, 'chill');
    
    case 'mood-hype':
      return getMoodPlaylist(tracks, 'hype');
    
    case 'throwback':
      return getThrowbackPlaylist(tracks);
    
    case 'past-favorites':
      return getPastFavoritesPlaylist(tracks);
    
    case 'genre-explorer':
      return getGenreExplorerPlaylist(tracks);
    
    default:
      // Default to happy mood if no specific type matched
      return getMoodPlaylist(tracks, 'happy');
  }
}

// Get mood-based playlist
function getMoodPlaylist(tracks, mood) {
  // Filter tracks that have audio features
  const tracksWithFeatures = tracks.filter(track => track.audioFeatures);
  
  if (tracksWithFeatures.length === 0) {
    // Fallback to popularity if no audio features
    return tracks
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 10);
  }
  
  let filteredTracks;
  
  switch (mood) {
    case 'happy':
      // Happy: high valence, high energy
      filteredTracks = tracksWithFeatures
        .filter(track => track.audioFeatures)
        .sort((a, b) => {
          const scoreA = (a.audioFeatures.valence * 0.7) + (a.audioFeatures.energy * 0.3);
          const scoreB = (b.audioFeatures.valence * 0.7) + (b.audioFeatures.energy * 0.3);
          return scoreB - scoreA;
        });
      break;
    
    case 'sad':
      // Sad: low valence, low energy
      filteredTracks = tracksWithFeatures
        .filter(track => track.audioFeatures)
        .sort((a, b) => {
          const scoreA = ((1 - a.audioFeatures.valence) * 0.7) + ((1 - a.audioFeatures.energy) * 0.3);
          const scoreB = ((1 - b.audioFeatures.valence) * 0.7) + ((1 - b.audioFeatures.energy) * 0.3);
          return scoreB - scoreA;
        });
      break;
    
    case 'chill':
      // Chill: medium valence, low energy, low tempo
      filteredTracks = tracksWithFeatures
        .filter(track => track.audioFeatures)
        .sort((a, b) => {
          const tempoFactorA = a.audioFeatures.tempo > 120 ? 0 : (120 - a.audioFeatures.tempo) / 120;
          const tempoFactorB = b.audioFeatures.tempo > 120 ? 0 : (120 - b.audioFeatures.tempo) / 120;
          
          const scoreA = (a.audioFeatures.valence * 0.3) + ((1 - a.audioFeatures.energy) * 0.4) + (tempoFactorA * 0.3);
          const scoreB = (b.audioFeatures.valence * 0.3) + ((1 - b.audioFeatures.energy) * 0.4) + (tempoFactorB * 0.3);
          return scoreB - scoreA;
        });
      break;
    
    case 'hype':
      // Hype: high energy, high danceability, high tempo
      filteredTracks = tracksWithFeatures
        .filter(track => track.audioFeatures)
        .sort((a, b) => {
          const scoreA = (a.audioFeatures.energy * 0.4) + (a.audioFeatures.danceability * 0.3) + ((a.audioFeatures.tempo / 200) * 0.3);
          const scoreB = (b.audioFeatures.energy * 0.4) + (b.audioFeatures.danceability * 0.3) + ((b.audioFeatures.tempo / 200) * 0.3);
          return scoreB - scoreA;
        });
      break;
    
    default:
      // Default to popularity
      filteredTracks = tracksWithFeatures.sort((a, b) => b.popularity - a.popularity);
  }
  
  // Take top 10 tracks
  return filteredTracks.slice(0, 10);
}

// Get recommended tracks based on playlist type
async function getRecommendedTracks(playlistType) {
  console.log(`Getting recommendations for ${playlistType} playlist`);
  
  // Step 1: Get seed tracks from user's library
  let seedTracks = [];
  
  try {
    // Try to get top tracks first (if we have permission)
    try {
      const topTracksResponse = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=5&time_range=medium_term', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
      });
      
      if (topTracksResponse.ok) {
        const topTracksData = await topTracksResponse.json();
        if (topTracksData.items && topTracksData.items.length > 0) {
          seedTracks = topTracksData.items.map(track => track.id).slice(0, 5);
          console.log("Using top tracks as seeds:", seedTracks);
        }
      } else {
        console.log("Couldn't get top tracks, status:", topTracksResponse.status);
      }
    } catch (error) {
      console.log("Error getting top tracks:", error.message);
    }
    
    // If we don't have enough seed tracks, try saved tracks
    if (seedTracks.length < 2) {
      try {
        const savedTracksResponse = await fetch('https://api.spotify.com/v1/me/tracks?limit=5', {
          method: 'GET',
          headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
        });
        
        if (savedTracksResponse.ok) {
          const savedTracksData = await savedTracksResponse.json();
          if (savedTracksData.items && savedTracksData.items.length > 0) {
            const savedIds = savedTracksData.items.map(item => item.track.id);
            console.log("Using saved tracks as seeds:", savedIds);
            
            // Add only new tracks not already in seedTracks
            for (let id of savedIds) {
              if (!seedTracks.includes(id) && seedTracks.length < 5) {
                seedTracks.push(id);
              }
            }
          }
        } else {
          console.log("Couldn't get saved tracks, status:", savedTracksResponse.status);
        }
      } catch (error) {
        console.log("Error getting saved tracks:", error.message);
      }
    }
    
    // If we still don't have enough seed tracks, try a different approach with genres
    if (seedTracks.length < 2) {
      console.log("Not enough seed tracks, falling back to genres");
      return await getGenreBasedRecommendations();
    }
    
    if (seedTracks.length === 0) {
      console.error("No seed tracks available. Falling back to genre-based recommendations.");
      return await getGenreBasedRecommendations();
    }
    
    // Step 2: Set up parameters based on playlist type
    const params = new URLSearchParams();
    
    // Add seed tracks
    params.append('seed_tracks', seedTracks.join(','));
    
    // Set target parameter values based on playlist type
    switch (playlistType) {
      case 'mood-happy':
        params.append('target_valence', '0.8'); // High positivity
        params.append('target_energy', '0.7');  // Moderate-high energy
        params.append('min_valence', '0.6');    // Ensure songs are positive
        break;
        
      case 'mood-sad':
        params.append('target_valence', '0.2');     // Low positivity
        params.append('target_energy', '0.3');      // Low energy
        params.append('max_valence', '0.4');        // Ensure songs aren't too happy
        break;
        
      case 'mood-chill':
        params.append('target_energy', '0.3');      // Low energy
        params.append('target_tempo', '100');       // Slower tempo
        params.append('target_acousticness', '0.6'); // More acoustic
        params.append('max_energy', '0.5');         // Cap the energy
        break;
        
      case 'mood-hype':
        params.append('target_energy', '0.9');      // High energy
        params.append('target_danceability', '0.8'); // High danceability
        params.append('target_tempo', '130');       // Fast tempo
        params.append('min_energy', '0.7');         // Ensure high energy
        break;
        
      case 'throwback':
        // For throwbacks, we need a different approach
        return await getThrowbackRecommendations(seedTracks);
        
      case 'past-favorites':
        // For past favorites, boost popularity
        params.append('target_popularity', '90');   // Very popular tracks
        break;
        
      case 'genre-explorer':
        // For genre explorer, use genre-based approach
        return await getGenreBasedRecommendations();
        
      default:
        // Default mood is happy
        params.append('target_valence', '0.7');
        params.append('target_energy', '0.7');
    }
    
    // Add limit
    params.append('limit', '10');
    
    console.log("Requesting recommendations with params:", params.toString());
    
    // Step 3: Get recommendations from Spotify
    const recommendationsResponse = await fetch(`https://api.spotify.com/v1/recommendations?${params.toString()}`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
    });
    
    if (!recommendationsResponse.ok) {
      console.error("Recommendations error:", await recommendationsResponse.text());
      throw new Error(`Failed to get recommendations: ${recommendationsResponse.status}`);
    }
    
    const recommendationsData = await recommendationsResponse.json();
    
    if (!recommendationsData.tracks || recommendationsData.tracks.length === 0) {
      throw new Error("No recommendations found");
    }
    
    console.log(`Got ${recommendationsData.tracks.length} recommendations`);
    
    // Format the tracks for our UI
    return recommendationsData.tracks.map(track => ({
      name: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      id: track.id,
      albumCover: track.album && track.album.images && track.album.images.length > 0 
        ? track.album.images[0].url 
        : '',
      popularity: track.popularity || 50,
      album: track.album ? {
        name: track.album.name,
        release_date: track.album.release_date || '2023'
      } : null
    }));
    
  } catch (error) {
    console.error("Error getting recommendations:", error);
    throw error;
  }
}

// Get recommendations for throwback playlist
// Complete getThrowbackRecommendations function
async function getThrowbackRecommendations(seedTracks) {
  console.log("Getting throwback recommendations");
  
  try {
    // For throwbacks, we want older music
    // We'll leverage Spotify recommendations but with older tracks
    
    // Get a year range from 20-40 years ago
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 40;
    const maxYear = currentYear - 15; // Not too recent, not too old
    
    console.log(`Looking for music from ${minYear} to ${maxYear}`);
    
    // Use seed tracks plus some special parameters for throwbacks
    const params = new URLSearchParams();
    params.append('seed_tracks', seedTracks.join(','));
    params.append('limit', '30'); // Request more to filter
    params.append('min_popularity', '50'); // Somewhat popular
    
    const recommendationsResponse = await fetch(`https://api.spotify.com/v1/recommendations?${params.toString()}`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
    });
    
    if (!recommendationsResponse.ok) {
      console.error("Throwback recommendations error:", await recommendationsResponse.text());
      throw new Error(`Failed to get throwback recommendations: ${recommendationsResponse.status}`);
    }
    
    const recommendationsData = await recommendationsResponse.json();
    
    if (!recommendationsData.tracks || recommendationsData.tracks.length === 0) {
      throw new Error("No throwback recommendations found");
    }
    
    console.log(`Got ${recommendationsData.tracks.length} recommendations, filtering for throwbacks`);
    
    // Filter for tracks with release dates in our throwback range
    let throwbackTracks = recommendationsData.tracks
      .filter(track => {
        if (track.album && track.album.release_date && track.album.release_date.length >= 4) {
          const releaseYear = parseInt(track.album.release_date.substring(0, 4));
          return releaseYear >= minYear && releaseYear <= maxYear;
        }
        return false;
      })
      .map(track => ({
        name: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        id: track.id,
        albumCover: track.album && track.album.images && track.album.images.length > 0 
          ? track.album.images[0].url 
          : '',
        popularity: track.popularity || 50,
        album: track.album ? {
          name: track.album.name,
          release_date: track.album.release_date || '2000'
        } : null
      }));
    
    console.log(`Found ${throwbackTracks.length} tracks within the throwback time range`);
    
    // If we don't have enough throwback tracks, get general recommendations
    if (throwbackTracks.length < 10) {
      console.log("Not enough throwback tracks, adding general recommendations");
      
      // Fall back to general popular tracks
      const fallbackTracks = recommendationsData.tracks
        .filter(track => !throwbackTracks.some(t => t.id === track.id))
        .map(track => ({
          name: track.name,
          artist: track.artists.map(a => a.name).join(', '),
          id: track.id,
          albumCover: track.album && track.album.images && track.album.images.length > 0 
            ? track.album.images[0].url 
            : '',
          popularity: track.popularity || 50,
          album: track.album ? {
            name: track.album.name,
            release_date: track.album.release_date || '2000'
          } : null
        }));
      
      throwbackTracks = throwbackTracks.concat(fallbackTracks);
    }
    
    // Return up to 10 tracks
    return throwbackTracks.slice(0, 10);
    
  } catch (error) {
    console.error("Error getting throwback recommendations:", error);
    throw error;
  }
}

// Get genre-based recommendations
async function getGenreBasedRecommendations() {
  try {
    console.log("Getting genre-based recommendations");
    
    // Step 1: Get available genres
    const genresResponse = await fetch('https://api.spotify.com/v1/recommendations/available-genre-seeds', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
    });
    
    if (!genresResponse.ok) {
      console.error("Failed to get genres:", await genresResponse.text());
      throw new Error(`Failed to get available genres: ${genresResponse.status}`);
    }
    
    const genresData = await genresResponse.json();
    
    if (!genresData.genres || genresData.genres.length === 0) {
      throw new Error("No genres available");
    }
    
    console.log(`Found ${genresData.genres.length} available genres`);
    
    // Step 2: Try to get user's top artists (if we have permission)
    let preferredGenres = [];
    
    try {
      const topArtistsResponse = await fetch('https://api.spotify.com/v1/me/top/artists?limit=10', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
      });
      
      if (topArtistsResponse.ok) {
        const topArtistsData = await topArtistsResponse.json();
        
        if (topArtistsData.items && topArtistsData.items.length > 0) {
          // Collect all genres from top artists
          const allUserGenres = new Set();
          topArtistsData.items.forEach(artist => {
            if (artist.genres) {
              artist.genres.forEach(genre => allUserGenres.add(genre));
            }
          });
          
          console.log("User's genre preferences:", Array.from(allUserGenres));
          
          // Match user genres with available genre seeds
          preferredGenres = Array.from(allUserGenres)
            .filter(genre => genresData.genres.includes(genre))
            .slice(0, 5); // Max 5 genres for recommendation
        }
      } else {
        console.log("Couldn't get top artists, status:", topArtistsResponse.status);
      }
    } 
    catch (error) {
      console.log("Error getting top artists:", error.message);
    }
    
    
    // If we don't have enough preferred genres, add some popular ones
    const popularGenres = ['pop', 'rock', 'hip-hop', 'indie', 'electronic', 'jazz', 'classical', 'dance', 'r-n-b', 'alternative'];
    
    while (preferredGenres.length < 5) {
      // Find a popular genre we haven't added yet
      const genre = popularGenres.find(g => !preferredGenres.includes(g) && genresData.genres.includes(g));
      
      if (genre) {
        preferredGenres.push(genre);
      } else {
        // If we can't find more popular genres, add random ones
        const remainingGenres = genresData.genres.filter(g => !preferredGenres.includes(g));
        
        if (remainingGenres.length > 0) {
          const randomIndex = Math.floor(Math.random() * remainingGenres.length);
          preferredGenres.push(remainingGenres[randomIndex]);
        } else {
          break; // No more genres to add
        }
      }
    }
    
    console.log("Selected genres for recommendations:", preferredGenres);
    
    // Step 3: Get recommendations based on genres
    // We'll make a single request with multiple seed genres
    const params = new URLSearchParams();
    // Use first 5 genres (Spotify API limit)
    params.append('seed_genres', preferredGenres.slice(0, 5).join(','));
    params.append('limit', '10');
    params.append('min_popularity', '20'); // Ensure somewhat known songs
    
    console.log("Requesting genre recommendations with params:", params.toString());
    
    const recommendationsResponse = await fetch(`https://api.spotify.com/v1/recommendations?${params.toString()}`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
    });
    
    if (!recommendationsResponse.ok) {
      console.error("Genre recommendations error:", await recommendationsResponse.text());
      throw new Error(`Failed to get genre recommendations: ${recommendationsResponse.status}`);
    }
    
    const recommendationsData = await recommendationsResponse.json();
    
    if (!recommendationsData.tracks || recommendationsData.tracks.length === 0) {
      throw new Error("No genre recommendations found");
    }
    
    console.log(`Got ${recommendationsData.tracks.length} genre-based recommendations`);
    
    // Format tracks for UI
    const formattedTracks = recommendationsData.tracks.map(track => ({
      name: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      id: track.id,
      albumCover: track.album && track.album.images && track.album.images.length > 0 
        ? track.album.images[0].url 
        : '',
      popularity: track.popularity || 50,
      album: track.album ? {
        name: track.album.name,
        release_date: track.album.release_date || '2023'
      } : null
    }));
    
    return formattedTracks.slice(0, 10);
    
  } catch (error) {
    console.error("Error getting genre-based recommendations:", error);
    throw error;
  }
}

// Function to get a readable name from playlist type
function getPlaylistDisplayName(type) {
  const typeMap = {
    'mood': 'Happy',
    'mood-happy': 'Happy',
    'mood-sad': 'Sad',
    'mood-chill': 'Chill',
    'mood-hype': 'Hype',
    'throwback': 'Throwback',
    'past-favorites': 'Past Favorites',
    'new-releases': 'New Releases',
    'genre-explorer': 'Genre Explorer'
  };
  
  return typeMap[type] || type.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Function to handle the "Save to Spotify" button click
async function handleSaveToSpotify() {
  if (!lastGeneratedPlaylist || !lastGeneratedPlaylist.tracks || lastGeneratedPlaylist.tracks.length === 0) {
    alert("Please generate a playlist first before saving to Spotify.");
    return;
  }
  
  try {
    // Show loading indicator
    const saveButton = document.querySelector('.save-spotify-btn');
    if (saveButton) {
      saveButton.textContent = "Saving...";
      saveButton.disabled = true;
    }
    
    // Format playlist name based on type
    const displayName = getPlaylistDisplayName(lastGeneratedPlaylist.type);
    const playlistName = `${displayName} Playlist by Spotify Genie`;
    
    // Format track URIs - we need to convert IDs to full Spotify URIs
    const trackUris = lastGeneratedPlaylist.tracks.map(track => `spotify:track:${track.id}`);
    
    // Save the playlist
    const result = await savePlaylistToSpotify(playlistName, trackUris);
    
    // Update UI based on result
    if (result.success) {
      // Create success message with link
      const playlistResultsDiv = document.getElementById('playlist-results');
      const successMessage = document.createElement('div');
      successMessage.className = 'success-message';
      successMessage.innerHTML = `
        <p>Playlist "${result.playlistName}" saved successfully!</p>
        <a href="${result.playlistUrl}" target="_blank" class="spotify-button">
          <i class="fab fa-spotify"></i> Open in Spotify
        </a>
      `;
      
      // Insert after the track list
      const trackList = playlistResultsDiv.querySelector('.track-list');
      if (trackList) {
        trackList.after(successMessage);
      } else {
        playlistResultsDiv.appendChild(successMessage);
      }
      
      // Update button
      if (saveButton) {
        saveButton.textContent = "Saved to Spotify ✓";
        saveButton.disabled = true;
      }
    } else {
      // Show error
      alert(`Failed to save playlist: ${result.error}`);
      
      // Reset button
      if (saveButton) {
        saveButton.textContent = "Save to Spotify";
        saveButton.disabled = false;
      }
    }
  } catch (error) {
    console.error("Error in handleSaveToSpotify:", error);
    alert(`Error saving playlist: ${error.message}`);
    
    // Reset button
    const saveButton = document.querySelector('.save-spotify-btn');
    if (saveButton) {
      saveButton.textContent = "Save to Spotify";
      saveButton.disabled = false;
    }
  }
}

// Update the playlist generation function to store the last playlist
async function handleGeneratePlaylist(event) {
  event.preventDefault();
  const selectedType = document.querySelector('input[name="playlist-type"]:checked');
 
  if (!selectedType) {
    console.error("No playlist type selected");
    return;
  }
 
  const playlistType = selectedType.value;
  console.log(`Generating playlist of type: ${playlistType}`);
 
  try {
    // Show loading indicator
    const submitButton = document.querySelector('#playlist-form button[type="submit"]');
    if (submitButton) {
      submitButton.textContent = "Generating...";
      submitButton.disabled = true;
    }
    
    // For demo purposes, we'll use the same generation method for all types
    // In a real implementation, we would customize the generation based on the type
    const baseType = playlistType.split('-')[0];
    
    // Run the playlist generation - fallback to 'mood' for all new types as specified
    const playlistTracks = await generatePlaylistByType(baseType === 'mood' ? 'mood' : 
                                                      (baseType === 'past' ? 'throwback' : 'mood'));
    
    console.log(`Generated playlist with ${playlistTracks.length} tracks`);
    
    // Store the generated playlist
    lastGeneratedPlaylist = {
      type: playlistType,
      tracks: playlistTracks,
      generatedAt: new Date()
    };
    
    // Render the playlist to the UI
    renderPlaylistResultsTemplate("playlist-results", {
      playlistTracks,
      playlistType
    });
    
    // Reset button
    if (submitButton) {
      submitButton.textContent = "Generate Playlist";
      submitButton.disabled = false;
    }
  } catch (error) {
    console.error("Error generating playlist:", error);
    document.getElementById("playlist-results").innerHTML =
      `<div class="error-message">Error generating playlist: ${error.message}</div>`;
      
    // Reset button
    const submitButton = document.querySelector('#playlist-form button[type="submit"]');
    if (submitButton) {
      submitButton.textContent = "Generate Playlist";
      submitButton.disabled = false;
    }
  }
}

// Helper function to process tracks based on playlist type
function processTracksForPlaylist(trackItems, playlistType) {
  console.log(`Processing ${trackItems.length} tracks for ${playlistType} playlist`);
  
  // Map tracks to a common format with audio features
  const tracks = trackItems.map(item => {
    // Handle both saved tracks format and top tracks format
    const track = item.track || item;
    return {
      name: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      id: track.id,
      albumCover: track.album && track.album.images && track.album.images.length > 0 
        ? track.album.images[0].url 
        : '',
      popularity: track.popularity || 50,
      // We don't have audio features, but we'll use other properties
      album: track.album ? {
        name: track.album.name,
        release_date: track.album.release_date || '2020'
      } : null
    };
  });
  
  // Filter and sort based on playlist type
  let selectedTracks = [];
  
  if (playlistType === 'mood') {
    // For mood, prioritize popular tracks (happy mood)
    selectedTracks = tracks
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 10);
    
  } else if (playlistType === 'genre') {
    // For genre, try to get a mix of artists
    // Group by artist first
    const artistGroups = {};
    tracks.forEach(track => {
      const mainArtist = track.artist.split(',')[0].trim();
      if (!artistGroups[mainArtist]) {
        artistGroups[mainArtist] = [];
      }
      artistGroups[mainArtist].push(track);
    });
    
    // Take one track from each artist until we have 10
    const artists = Object.keys(artistGroups);
    for (let i = 0; i < artists.length && selectedTracks.length < 10; i++) {
      if (artistGroups[artists[i]].length > 0) {
        selectedTracks.push(artistGroups[artists[i]][0]);
      }
    }
    
    // If we still need more tracks, add remaining popular ones
    if (selectedTracks.length < 10) {
      const remainingTracks = tracks
        .filter(track => !selectedTracks.includes(track))
        .sort((a, b) => b.popularity - a.popularity);
      
      selectedTracks = selectedTracks.concat(
        remainingTracks.slice(0, 10 - selectedTracks.length)
      );
    }
    
  } else if (playlistType === 'throwback') {
    // For throwback, prioritize older releases if we have release dates
    selectedTracks = tracks
      .sort((a, b) => {
        // If we have release dates, sort by those
        if (a.album && b.album && a.album.release_date && b.album.release_date) {
          return a.album.release_date.localeCompare(b.album.release_date);
        }
        // Default to random for mix
        return Math.random() - 0.5;
      })
      .slice(0, 10);
  }
  
  // Ensure we have tracks
  if (selectedTracks.length === 0) {
    // Just take a random selection
    selectedTracks = tracks
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(10, tracks.length));
  }
  
  // Ensure we don't exceed 10 tracks
  selectedTracks = selectedTracks.slice(0, 10);
  
  console.log(`Generated playlist with ${selectedTracks.length} tracks`);
  return selectedTracks;
}

// Function to save the generated playlist to Spotify
async function savePlaylistToSpotify(playlistName, trackUris) {
  try {
    console.log(`Saving playlist "${playlistName}" with ${trackUris.length} tracks to Spotify`);
    
    // Step 1: Create a new playlist
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + currentToken.access_token }
    });
    
    if (!userResponse.ok) {
      throw new Error(`Failed to get user profile: ${userResponse.status}`);
    }
    
    const userData = await userResponse.json();
    const userId = userData.id;
    
    console.log(`Creating playlist for user: ${userId}`);
    
    const createResponse = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
      method: 'POST',
      headers: { 
        'Authorization': 'Bearer ' + currentToken.access_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: playlistName,
        description: `Generated by Spotify Genie on ${new Date().toLocaleDateString()}`,
        public: false
      })
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create playlist: ${createResponse.status} - ${errorText}`);
    }
    
    const playlistData = await createResponse.json();
    const playlistId = playlistData.id;
    
    console.log(`Playlist created with ID: ${playlistId}`);
    
    // Step 2: Add tracks to the playlist
    const addTracksResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: { 
        'Authorization': 'Bearer ' + currentToken.access_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uris: trackUris
      })
    });
    
    if (!addTracksResponse.ok) {
      const errorText = await addTracksResponse.text();
      throw new Error(`Failed to add tracks to playlist: ${addTracksResponse.status} - ${errorText}`);
    }
    
    const addTracksData = await addTracksResponse.json();
    console.log(`Successfully added ${addTracksData.snapshot_id ? 'tracks to' : 'no tracks to'} playlist`);
    
    return {
      success: true,
      playlistId: playlistId,
      playlistUrl: playlistData.external_urls.spotify,
      playlistName: playlistName
    };
    
  } catch (error) {
    console.error("Error saving playlist to Spotify:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Update handleGeneratePlaylist to store the last generated playlist
let lastGeneratedPlaylist = null;

// Function to handle the "Save to Spotify" button click
async function handleSaveToSpotify() {
  if (!lastGeneratedPlaylist || !lastGeneratedPlaylist.tracks || lastGeneratedPlaylist.tracks.length === 0) {
    alert("Please generate a playlist first before saving to Spotify.");
    return;
  }
  
  try {
    // Show loading indicator
    const saveButton = document.querySelector('.save-spotify-btn');
    if (saveButton) {
      saveButton.textContent = "Saving...";
      saveButton.disabled = true;
    }
    
    // Format playlist name based on type
    const playlistName = `${lastGeneratedPlaylist.type.charAt(0).toUpperCase() + lastGeneratedPlaylist.type.slice(1)} Playlist by Spotify Genie`;
    
    // Format track URIs - we need to convert IDs to full Spotify URIs
    const trackUris = lastGeneratedPlaylist.tracks.map(track => `spotify:track:${track.id}`);
    
    // Save the playlist
    const result = await savePlaylistToSpotify(playlistName, trackUris);
    
    // Update UI based on result
    if (result.success) {
      // Create success message with link
      const playlistResultsDiv = document.getElementById('playlist-results');
      const successMessage = document.createElement('div');
      successMessage.className = 'success-message';
      successMessage.innerHTML = `
        <p>Playlist "${result.playlistName}" saved successfully!</p>
        <a href="${result.playlistUrl}" target="_blank" class="spotify-button">
          <i class="fab fa-spotify" style="color: green;"></i> Open in Spotify
        </a>
      `;
      
      // Insert after the track list
      const trackList = playlistResultsDiv.querySelector('.track-list');
      if (trackList) {
        trackList.after(successMessage);
      } else {
        playlistResultsDiv.appendChild(successMessage);
      }
      
      // Update button
      if (saveButton) {
        saveButton.textContent = "Saved to Spotify ✓";
        saveButton.disabled = true;
      }
    } else {
      // Show error
      alert(`Failed to save playlist: ${result.error}`);
      
      // Reset button
      if (saveButton) {
        saveButton.textContent = "Save to Spotify";
        saveButton.disabled = false;
      }
    }
  } catch (error) {
    console.error("Error in handleSaveToSpotify:", error);
    alert(`Error saving playlist: ${error.message}`);
    
    // Reset button
    const saveButton = document.querySelector('.save-spotify-btn');
    if (saveButton) {
      saveButton.textContent = "Save to Spotify";
      saveButton.disabled = false;
    }
  }
}

// Update the playlist generation function to store the last playlist
async function handleGeneratePlaylist(event) {
  event.preventDefault();
  const selectedType = document.querySelector('input[name="playlist-type"]:checked');
 
  if (!selectedType) {
    console.error("No playlist type selected");
    return;
  }
 
  const playlistType = selectedType.value;
  console.log(`Generating playlist of type: ${playlistType}`);
 
  try {
    // Run the playlist generation
    const playlistTracks = await generatePlaylistByType(playlistType);
    console.log(`Generated playlist with ${playlistTracks.length} tracks`);
    
    // Store the generated playlist
    lastGeneratedPlaylist = {
      type: playlistType,
      tracks: playlistTracks,
      generatedAt: new Date()
    };
    
    // Render the playlist to the UI
    renderPlaylistResultsTemplate("playlist-results", {
      playlistTracks,
      playlistType
    });
  } catch (error) {
    console.error("Error generating playlist:", error);
    document.getElementById("playlist-results").innerHTML =
      `<div class="error-message">Error generating playlist: ${error.message}</div>`;
  }
}

// Make sure to wire up the save function
window.saveToSpotify = handleSaveToSpotify;

// EVENT HANDLERS
async function loginWithSpotifyClick() {
  await redirectToSpotifyAuthorize();
}


async function logoutClick() {
  localStorage.clear();
  window.location.href = redirectUrl;
}


async function refreshTokenClick() {
  try {
    const token = await refreshToken();
    currentToken.save(token);
    renderTemplate("oauth", "oauth-template", currentToken);
    alert("Token refreshed successfully!");
  } catch (error) {
    console.error("Error refreshing token:", error);
    alert("Error refreshing token: " + error.message);
  }
}

async function handleSearch(event) {
  event.preventDefault();
  const searchInput = document.getElementById('search-input');
 
  if (!searchInput) {
    console.error("Search input element not found");
    return;
  }
 
  const query = searchInput.value.trim();
  console.log(`Executing search for: "${query}"`);
 
  if (!query) {
    console.log("Empty search query, not sending request");
    document.getElementById("search-results").innerHTML = 
      '<div class="info-message">Please enter a search term</div>';
    return;
  }
  
  try {
    // Show loading indicator
    document.getElementById("search-results").innerHTML = 
      '<div class="loading-message">Searching...</div>';
    
    const searchResults = await searchSpotify(query);
    console.log(`Search returned ${searchResults.length} results`);
    
    // Render search results
    renderSearchResultsTemplate("search-results", { searchResults });
  } catch (error) {
    console.error("Search error:", error);
    document.getElementById("search-results").innerHTML =
      `<div class="error-message">Search error: ${error.message}</div>`;
  }
}

// TEMPLATE RENDERING
function renderTemplate(targetId, templateId, data = null) {
  console.log(`Rendering template "${templateId}" to target "${targetId}"`);

  // Get the template
  const template = document.getElementById(templateId);
  if (!template) {
      console.error(`Template not found: ${templateId}`);
      return;
  }

  // Get the target
  const targetElement = document.getElementById(targetId);
  if (!targetElement) {
      console.error(`Target element not found in DOM: "${targetId}"`);
      return; // Exit early if target element is missing
  }

  // Clone the template
  const clone = template.content.cloneNode(true);

  // Process data bindings if data is provided
  if (data) {
      const elements = clone.querySelectorAll("*");
      elements.forEach((ele) => {
          // Data binding logic
          if (ele.dataset && ele.dataset.bind) {
              try {
                  const value = evalInContext(ele.dataset.bind, data);
                  ele.textContent = value;
              } catch (error) {
                  console.error(`Error binding data to element:`, error);
              }
          }
      });
  }

  // Render to target
  targetElement.innerHTML = "";
  targetElement.appendChild(clone);
  console.log(`Template "${templateId}" rendered successfully to "${targetId}"`);
}

// Helper function to evaluate expressions in the context of data
function evalInContext(expr, context) {
  try {
    // Create a function that executes with the data as context
    const evaluator = new Function('data', `with(data) { return ${expr}; }`);
    return evaluator(context);
  } catch (error) {
    console.error(`Error evaluating expression "${expr}":`, error);
    return '';
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);

/**
 * FIXED CSV Recommendation Feature Integration for Spotify Genie
 * Replace these functions in app.js
 */

// Global instance of recommendation engine
let recommendationEngine = null;

// Function to handle file upload for dataset
async function handleDatasetUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    // Show loading indicator
    document.getElementById('dataset-status').textContent = "Loading dataset...";
    
    // Read the file content
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target.result;
      console.log("Dataset file read successfully, first 100 chars:", content.substring(0, 100));
      
      // Initialize recommendation engine if not already done
      if (!recommendationEngine) {
        recommendationEngine = new window.RecommendationEngine();
      }
      
      try {
        // Parse the CSV content directly
        Papa.parse(content, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            console.log("Dataset parsed successfully:", {
              rowCount: results.data.length,
              fields: results.meta.fields
            });
            
            // Check if dataset has required columns
            const requiredFields = ['track_name', 'artists'];
            const missingFields = requiredFields.filter(field => 
              !results.meta.fields.includes(field)
            );
            
            if (missingFields.length > 0) {
              console.warn("Dataset missing required fields:", missingFields);
              // Add missing fields with dummy values
              results.data.forEach((row, index) => {
                if (!row.track_name) row.track_name = `Track ${index + 1}`;
                if (!row.artists) row.artists = "Unknown Artist";
              });
            }
            
            recommendationEngine.dataset = results.data;
            
            try {
              recommendationEngine.preprocessData();
              console.log("Dataset preprocessing completed successfully");
            } catch (preprocessError) {
              console.error("Error during preprocessing:", preprocessError);
            }
            
            document.getElementById('dataset-status').textContent = 
              `Dataset loaded: ${recommendationEngine.dataset.length} songs`;
            
            // Enable recommendations button if both datasets are loaded
            if (recommendationEngine.likedSongs) {
              document.getElementById('generate-recommendations-btn').disabled = false;
            }
          },
          error: (error) => {
            console.error("Error parsing dataset CSV:", error);
            document.getElementById('dataset-status').textContent = 
              `Error loading dataset: ${error.message}`;
          }
        });
      } catch (error) {
        console.error("Error loading dataset:", error);
        document.getElementById('dataset-status').textContent = 
          `Error loading dataset: ${error.message}`;
      }
    };
    reader.readAsText(file);
  } catch (error) {
    console.error("Error handling dataset upload:", error);
    document.getElementById('dataset-status').textContent = 
      `Error: ${error.message}`;
  }
}

// Function to handle liked songs upload
async function handleLikedSongsUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    // Show loading indicator
    document.getElementById('liked-songs-status').textContent = "Loading liked songs...";
    
    // Read the file content
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target.result;
      
      // Initialize recommendation engine if not already done
      if (!recommendationEngine) {
        recommendationEngine = new window.RecommendationEngine();
      }
      
      try {
        // Parse the CSV content directly
        Papa.parse(content, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            console.log(`Liked songs parsed with ${results.data.length} songs`);
            recommendationEngine.likedSongs = results.data;
            
            document.getElementById('liked-songs-status').textContent = 
              `Liked songs loaded: ${recommendationEngine.likedSongs.length} songs`;
            
            // Enable recommendations button if both datasets are loaded
            if (recommendationEngine.dataset) {
              document.getElementById('generate-recommendations-btn').disabled = false;
            }
          },
          error: (error) => {
            console.error("Error parsing liked songs CSV:", error);
            document.getElementById('liked-songs-status').textContent = 
              `Error loading liked songs: ${error.message}`;
          }
        });
      } catch (error) {
        console.error("Error loading liked songs:", error);
        document.getElementById('liked-songs-status').textContent = 
          `Error loading liked songs: ${error.message}`;
      }
    };
    reader.readAsText(file);
  } catch (error) {
    console.error("Error handling liked songs upload:", error);
    document.getElementById('liked-songs-status').textContent = 
      `Error: ${error.message}`;
  }
}

// Function to use existing Spotify liked songs
async function useSpotifyLikedSongs() {
  try {
    // Show loading indicator
    document.getElementById('liked-songs-status').textContent = "Loading Spotify liked songs...";
    
    // Get user's saved tracks from Spotify
    const tracks = await getUserSavedTracks(50);
    console.log(`Retrieved ${tracks.length} tracks from Spotify API:`, tracks);
    
    // Initialize recommendation engine if not already done
    if (!recommendationEngine) {
      recommendationEngine = new window.RecommendationEngine();
    }
    
    // Format tracks to match liked songs format (Name, Artist)
    const formattedTracks = tracks.map(track => ({
      Name: track.name,
      Artist: track.artist
    }));
    
    console.log("Formatted tracks for liked songs:", formattedTracks);
    
    // Set the liked songs directly
    recommendationEngine.likedSongs = formattedTracks;
    
    document.getElementById('liked-songs-status').textContent = 
      `Spotify liked songs loaded: ${recommendationEngine.likedSongs.length} songs`;
    
    // Enable recommendations button if both datasets are loaded
    if (recommendationEngine.dataset) {
      document.getElementById('generate-recommendations-btn').disabled = false;
    }
  } catch (error) {
    console.error("Error loading Spotify liked songs:", error);
    document.getElementById('liked-songs-status').textContent = 
      `Error loading Spotify liked songs: ${error.message}`;
  }
}

// Function to generate recommendations and format songs nicely using the Spotify API
async function generateCSVRecommendations() {
  try {
    // Show loading indicator
    document.getElementById('csv-recommendations-results').innerHTML = 
      '<p class="loading">Generating recommendations...</p>';
    
    // Check if engine and data exist
    if (!recommendationEngine) {
      console.log("Creating recommendation engine");
      recommendationEngine = new window.RecommendationEngine();
    }
    
    if (!recommendationEngine.dataset || !recommendationEngine.likedSongs) {
      console.error("Missing data:", {
        dataset: Boolean(recommendationEngine.dataset),
        likedSongs: Boolean(recommendationEngine.likedSongs)
      });
      throw new Error("Please load both a dataset and liked songs first");
    }
    
    console.log("Starting recommendation generation with:", {
      datasetSize: recommendationEngine.dataset.length,
      likedSongsSize: recommendationEngine.likedSongs.length
    });
    
    // Verify dataset has required properties
    const sampleSong = recommendationEngine.dataset[0];
    console.log("Sample song from dataset:", sampleSong);
    
    // Make sure required features exist in the dataset
    const requiredFeatures = ['popularity', 'danceability', 'energy', 'acousticness', 'valence', 'tempo'];
    const missingFeatures = requiredFeatures.filter(feature => 
      !sampleSong.hasOwnProperty(feature) && !sampleSong.hasOwnProperty(`${feature}_standardized`)
    );
    
    if (missingFeatures.length > 0) {
      console.warn("Dataset is missing these features:", missingFeatures);
      // If features are missing, add dummy values
      recommendationEngine.dataset.forEach(song => {
        missingFeatures.forEach(feature => {
          song[feature] = Math.random() * 0.5 + 0.25; // Random value between 0.25 and 0.75
        });
      });
      // Reprocess data with added features
      recommendationEngine.preprocessData();
    }
    
    // Force preprocessing before generating recommendations
    console.log("Preprocessing data...");
    recommendationEngine.preprocessData();
    
    // Generate recommendations
    console.log("Calling recommendSongs method...");
    const recommendations = recommendationEngine.recommendSongs(10);
    console.log("Recommendations generated:", recommendations);
    
    if (!recommendations || recommendations.length === 0) {
      throw new Error("No recommendations were generated");
    }
    
    // Ensure recommendations have all required properties
    const cleanedRecommendations = recommendations.map(rec => ({
      name: rec.name || "Unknown Track",
      artist: rec.artist || "Unknown Artist",
      genre: rec.genre || "Unknown Genre",
      score: typeof rec.score === 'number' ? rec.score.toFixed(2) : rec.score || "N/A",
      id: rec.id || `local-${(rec.name || 'track').replace(/\s+/g, '-').toLowerCase()}`,
      albumCover: rec.albumCover || ''
    }));
    
    console.log("Cleaned recommendations:", cleanedRecommendations);
    
    // Store the recommendation data for saving to playlist
    lastCsvRecommendations = cleanedRecommendations;
    
    // Display recommendations
    renderRecommendationsTemplate("csv-recommendations-results", {
      recommendations: cleanedRecommendations
    });
    
  } catch (error) {
    console.error("Error generating recommendations:", error);
    document.getElementById('csv-recommendations-results').innerHTML = 
      `<div class="error-message">Error generating recommendations: ${error.message}</div>`;
  }
}

// Template rendering function for song recommendations
// Template rendering function for song recommendations
function renderRecommendationsTemplate(targetId, { recommendations }) {
  const targetElement = document.getElementById(targetId);
  if (!targetElement) {
    console.error(`Target element not found: ${targetId}`);
    return;
  }

  if (!recommendations || recommendations.length === 0) {
    targetElement.innerHTML = '<p>No recommendations found.</p>';
    return;
  }

  // Clear the existing content
  targetElement.innerHTML = "";

  // Create a container for the recommendations
  const recommendationsContainer = document.createElement("div");
  recommendationsContainer.className = "song-recommendations";
  recommendationsContainer.innerHTML = "<h3>Song Recommendations</h3>";

  // Create the track list and append each track dynamically
  const trackList = document.createElement("div");
  trackList.className = "track-list";

  recommendations.forEach(track => {
    const trackItem = document.createElement("div");
    trackItem.className = "track-item";

    const trackInfo = document.createElement("div");
    trackInfo.className = "track-info";

    const trackName = document.createElement("div");
    trackName.className = "track-name";
    trackName.textContent = track.name;

    const trackArtist = document.createElement("div");
    trackArtist.className = "track-artist";
    trackArtist.textContent = track.artist;

    const trackGenre = document.createElement("div");
    trackGenre.className = "track-genre";
    trackGenre.textContent = `Genre: ${track.genre}`;

    const trackScore = document.createElement("div");
    trackScore.className = "track-score";
    trackScore.textContent = `Score: ${track.score}`;

    // Append track info
    trackInfo.appendChild(trackName);
    trackInfo.appendChild(trackArtist);
    trackInfo.appendChild(trackGenre);
    trackInfo.appendChild(trackScore);

    trackItem.appendChild(trackInfo);

    // Album cover (if available)
    if (track.albumCover) {
      const albumImage = document.createElement("img");
      albumImage.src = track.albumCover;
      albumImage.alt = "Album cover";
      albumImage.className = "album-cover";
      trackItem.appendChild(albumImage);
    }

    // Add to track list
    trackList.appendChild(trackItem);
  });

  recommendationsContainer.appendChild(trackList);
  
  // Create playlist actions container with Save to Spotify button
  const playlistActions = document.createElement("div");
  playlistActions.className = "playlist-actions";
  
  // Create save to Spotify button
  const saveButton = document.createElement("button");
  saveButton.className = "save-spotify-btn";
  saveButton.textContent = "Save to Spotify";
  saveButton.onclick = function() {
    window.saveCSVRecommendationsToSpotify();
  };
  
  // Append button to playlist actions
  playlistActions.appendChild(saveButton);
  
  // Append playlist actions to the recommendations container
  recommendationsContainer.appendChild(playlistActions);
  
  targetElement.appendChild(recommendationsContainer);
}

// Function to save CSV recommendations to Spotify playlist
async function saveCSVRecommendationsToSpotify() {
  if (!lastCsvRecommendations || lastCsvRecommendations.length === 0) {
    alert("Please generate recommendations first");
    return;
  }
  
  try {
    // Show loading indicator
    const saveButton = document.querySelector('#csv-recommendations-container .save-spotify-btn');
    if (saveButton) {
      saveButton.textContent = "Saving...";
      saveButton.disabled = true;
    }
    
    // Convert local recommendations to Spotify format if needed
    const trackUris = [];
    const tracksToFind = [];
    
    // Separate tracks with Spotify IDs from those that need to be searched
    lastCsvRecommendations.forEach(track => {
      if (track.id && !track.id.startsWith('local-')) {
        trackUris.push(`spotify:track:${track.id}`);
      } else {
        tracksToFind.push({
          name: track.name,
          artist: track.artist
        });
      }
    });
    
    // Search for tracks that don't have IDs
    if (tracksToFind.length > 0) {
      for (const track of tracksToFind) {
        try {
          // Search Spotify for the track
          const query = `${track.name} artist:${track.artist}`;
          const searchResults = await searchSpotify(query, 'track', 1);
          
          if (searchResults && searchResults.length > 0) {
            trackUris.push(`spotify:track:${searchResults[0].id}`);
          } else {
            console.warn(`Could not find track on Spotify: ${track.name} by ${track.artist}`);
          }
        } catch (error) {
          console.error(`Error searching for track ${track.name}:`, error);
        }
      }
    }
    
    // Create and save playlist
    const playlistName = "CSV Recommendations by Spotify Genie";
    const result = await savePlaylistToSpotify(playlistName, trackUris);
    
    // Update UI based on result
    if (result.success) {
      // Create success message with link
      const recommendationsResults = document.getElementById('csv-recommendations-results');
      const successMessage = document.createElement('div');
      successMessage.className = 'success-message';
      successMessage.innerHTML = `
        <p>Playlist "${result.playlistName}" saved successfully!</p>
        <a href="${result.playlistUrl}" target="_blank" class="spotify-button">
          <i class="fab fa-spotify"></i> Open in Spotify
        </a>
      `;
      
      // Add success message to the container
      recommendationsResults.appendChild(successMessage);
      
      // Update button
      if (saveButton) {
        saveButton.textContent = "Saved to Spotify ✓";
        saveButton.disabled = true;
      }
    } else {
      // Show error
      alert(`Failed to save playlist: ${result.error}`);
      
      // Reset button
      if (saveButton) {
        saveButton.textContent = "Save to Spotify";
        saveButton.disabled = false;
      }
    }
  } catch (error) {
    console.error("Error saving recommendations to Spotify:", error);
    alert(`Error saving recommendations: ${error.message}`);
    
    // Reset button
    const saveButton = document.querySelector('#csv-recommendations-container .save-spotify-btn');
    if (saveButton) {
      saveButton.textContent = "Save to Spotify";
      saveButton.disabled = false;
    }
  }
}

// Global variable to store last generated CSV recommendations
let lastCsvRecommendations = null;

// Add these functions to the window object for event handlers
window.handleDatasetUpload = handleDatasetUpload;
window.handleLikedSongsUpload = handleLikedSongsUpload;
window.useSpotifyLikedSongs = useSpotifyLikedSongs;
window.generateCSVRecommendations = generateCSVRecommendations;
window.saveCSVRecommendationsToSpotify = saveCSVRecommendationsToSpotify;
// Make these functions available to inline event handlers
window.loginWithSpotifyClick = loginWithSpotifyClick;
window.logoutClick = logoutClick;
window.refreshTokenClick = refreshTokenClick;
window.handleSearch = handleSearch;
window.handleGeneratePlaylist = handleGeneratePlaylist;
window.exportLikedSongsToCSV = exportLikedSongsToCSV;