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
      console.log("User data fetched successfully");
      renderTemplate("main", "logged-in-template", userData);
      renderTemplate("oauth", "oauth-template", currentToken);
     
      // Now let's manually create and append the new components
      console.log("Creating new component containers");
      createContainers();
     
      // Render search form
      console.log("Rendering search form");
      renderTemplate("search-form-container", "search-form-template");
     
      // Render playlist generator
      console.log("Rendering playlist generator");
      renderTemplate("playlist-generator-container", "playlist-generator-template");
     
      // Fetch and render saved tracks
      console.log("Fetching saved tracks");
      try {
        const tracks = await getUserSavedTracks();
        console.log(`Fetched ${tracks.length} saved tracks`);
        renderTemplate("tracks-container", "tracks-template", { tracks });
      } catch (error) {
        console.error("Error fetching saved tracks:", error);
        document.getElementById("tracks-container").innerHTML =
          `<div class="error-message">Error loading saved tracks: ${error.message}</div>`;
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


// Create container elements if they don't exist
function createContainers() {
  const containers = [
    "search-form-container",
    "playlist-generator-container",
    "tracks-container"
  ];
 
  containers.forEach(id => {
    if (!document.getElementById(id)) {
      console.log(`Creating missing container: ${id}`);
      const container = document.createElement("div");
      container.id = id;
      container.className = "component-container";
      document.body.appendChild(container);
    } else {
      console.log(`Container already exists: ${id}`);
    }
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
  const response = await fetch(`https://api.spotify.com/v1/me/tracks?limit=${limit}`, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
  });


  const data = await response.json();
  if (data.error) {
    throw new Error(`API error: ${data.error.message || 'Unknown error'}`);
  }
 
  return data.items.map(item => ({
    name: item.track.name,
    artist: item.track.artists[0].name,
    id: item.track.id,
    albumCover: item.track.album.images[0]?.url || ''
  }));
}


async function searchSpotify(query, type = 'track', limit = 10) {
  if (!query) return [];


  const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
  });


  const data = await response.json();
  if (data.error) {
    throw new Error(`Search error: ${data.error.message || 'Unknown error'}`);
  }
 
  return data.tracks.items.map(item => ({
    name: item.name,
    artist: item.artists[0].name,
    id: item.id,
    albumCover: item.album.images[0]?.url || ''
  }));
}

// Enhanced generatePlaylistByType function
async function generatePlaylistByType(playlistType) {
  console.log(`Starting generation of ${playlistType} playlist`);
  
  try {
    // First, get required data based on playlist type
    if (playlistType === 'new-releases') {
      // For new releases, use the new releases API
      return await getNewReleases();
    }
    
    // Get audio features for saved/top tracks depending on playlist type
    let tracksWithFeatures;
    
    // For throwback and past-favorites, we need user's saved tracks
    if (playlistType === 'throwback' || playlistType === 'past-favorites') {
      tracksWithFeatures = await getSavedTracksWithFeatures();
    } else {
      // For other playlist types, try saved tracks first, then fall back to top tracks
      try {
        tracksWithFeatures = await getSavedTracksWithFeatures();
        if (!tracksWithFeatures || tracksWithFeatures.length === 0) {
          throw new Error("No saved tracks");
        }
      } catch (error) {
        console.log("Falling back to top tracks");
        tracksWithFeatures = await getTopTracksWithFeatures();
      }
    }
    
    // If we still don't have tracks, throw an error
    if (!tracksWithFeatures || tracksWithFeatures.length === 0) {
      throw new Error("No tracks available to generate a playlist.");
    }
    
    // Process tracks based on playlist type
    return processTracksForPlaylist(tracksWithFeatures, playlistType);
    
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

// Get throwback playlist (older music)
function getThrowbackPlaylist(tracks) {
  // Filter tracks with release dates
  const tracksWithDates = tracks.filter(track => 
    track.album && track.album.release_date && track.album.release_date.length >= 4
  );
  
  if (tracksWithDates.length === 0) {
    // Fallback to random selection if no dates
    return tracks
      .sort(() => Math.random() - 0.5)
      .slice(0, 10);
  }
  
  // Sort by release date (oldest first)
  const sortedTracks = tracksWithDates.sort((a, b) => {
    const yearA = a.album.release_date.substring(0, 4);
    const yearB = b.album.release_date.substring(0, 4);
    return yearA - yearB;
  });
  
  // Focus on music older than 5 years
  const currentYear = new Date().getFullYear();
  const oldTracks = sortedTracks.filter(track => {
    const releaseYear = parseInt(track.album.release_date.substring(0, 4));
    return releaseYear < (currentYear - 5);
  });
  
  // If we have enough old tracks, use those, otherwise use the oldest available
  return (oldTracks.length >= 10 ? oldTracks : sortedTracks).slice(0, 10);
}

// Get past favorites playlist (user's most popular saved tracks)
function getPastFavoritesPlaylist(tracks) {
  // Sort by popularity
  return tracks
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 10);
}

// Get genre explorer playlist (diverse selection of genres)
function getGenreExplorerPlaylist(tracks) {
  // Group tracks by artist
  const artistGroups = {};
  tracks.forEach(track => {
    const mainArtist = track.artist.split(',')[0].trim();
    if (!artistGroups[mainArtist]) {
      artistGroups[mainArtist] = [];
    }
    artistGroups[mainArtist].push(track);
  });
  
  // Take one track from each artist
  let selectedTracks = [];
  const artists = Object.keys(artistGroups);
  
  // Shuffle artists for variety
  const shuffledArtists = artists.sort(() => Math.random() - 0.5);
  
  // Take one track from each artist until we have 10
  for (let i = 0; i < shuffledArtists.length && selectedTracks.length < 10; i++) {
    if (artistGroups[shuffledArtists[i]].length > 0) {
      // Pick the most popular track from this artist
      const artistTracks = artistGroups[shuffledArtists[i]];
      const bestTrack = artistTracks.sort((a, b) => b.popularity - a.popularity)[0];
      selectedTracks.push(bestTrack);
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
  
  return selectedTracks;
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
    renderTemplate("playlist-results", "playlist-results-template", {
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
    renderTemplate("playlist-results", "playlist-results-template", {
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
 
  const query = searchInput.value;
  console.log(`Search query: "${query}"`);
 
  if (query) {
    try {
      const searchResults = await searchSpotify(query);
      console.log(`Found ${searchResults.length} results`);
      renderTemplate("search-results", "search-results-template", { searchResults });
    } catch (error) {
      console.error("Search error:", error);
      document.getElementById("search-results").innerHTML =
        `<div class="error-message">Search error: ${error.message}</div>`;
    }
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
  const target = document.getElementById(targetId);
  if (!target) {
    console.error(`Target element not found: ${targetId}`);
    return;
  }
 
  // Clone the template
  const clone = template.content.cloneNode(true);
 
  // Process data bindings
  if (data) {
    const elements = clone.querySelectorAll("*");
    elements.forEach(ele => {
      const bindingAttrs = [...ele.attributes].filter(a => a.name.startsWith("data-bind"));


      bindingAttrs.forEach(attr => {
        const target = attr.name.replace(/data-bind-/, "").replace(/data-bind/, "");
        const targetType = target.startsWith("onclick") ? "HANDLER" : "PROPERTY";
        const targetProp = target === "" ? "innerHTML" : target;


        const prefix = targetType === "PROPERTY" ? "data." : "";
        const expression = prefix + attr.value.replace(/;\n\r\n/g, "");


        try {
          ele[targetProp] = targetType === "PROPERTY" ? eval(expression) : () => { eval(expression) };
          ele.removeAttribute(attr.name);
        } catch (ex) {
          console.error(`Error binding ${expression} to ${targetProp}:`, ex);
        }
      });
    });
  }
 
  // Render to target
  target.innerHTML = "";
  target.appendChild(clone);
  console.log(`Template "${templateId}" rendered successfully`);
}


// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);


// Make these functions available to inline event handlers
window.loginWithSpotifyClick = loginWithSpotifyClick;
window.logoutClick = logoutClick;
window.refreshTokenClick = refreshTokenClick;
window.handleSearch = handleSearch;
window.handleGeneratePlaylist = handleGeneratePlaylist;
