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


// Fixed Spotify API implementation with direct recommendations
// Alternative playlist generator that uses saved tracks and top tracks
async function generatePlaylistByType(playlistType) {
  console.log(`Starting alternative generation of ${playlistType} playlist`);
  
  try {
    // First, get all the user's saved tracks
    const savedTracksResponse = await fetch('https://api.spotify.com/v1/me/tracks?limit=50', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
    });
    
    if (!savedTracksResponse.ok) {
      throw new Error(`Failed to fetch saved tracks: ${savedTracksResponse.status}`);
    }
    
    const savedTracksData = await savedTracksResponse.json();
    
    if (!savedTracksData.items || savedTracksData.items.length === 0) {
      // Try to get user's top tracks if no saved tracks
      const topTracksResponse = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=50', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
      });
      
      if (!topTracksResponse.ok) {
        throw new Error("You don't have any saved tracks or top tracks to generate a playlist from.");
      }
      
      const topTracksData = await topTracksResponse.json();
      
      if (!topTracksData.items || topTracksData.items.length === 0) {
        throw new Error("No tracks available to generate a playlist.");
      }
      
      // Use top tracks
      return processTracksForPlaylist(topTracksData.items, playlistType);
    }
    
    // Use saved tracks
    return processTracksForPlaylist(savedTracksData.items, playlistType);
    
  } catch (error) {
    console.error("Error in alternative playlist generator:", error);
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
