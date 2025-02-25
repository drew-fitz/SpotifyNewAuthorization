/**
 * Spotify Genie - Debugging Version
 */

// Keep existing authentication code
const clientId = 'fb6eea506c354ff292e0898ffa737638';
const redirectUrl = 'https://spotifygenie-96268.web.app/';
const authorizationEndpoint = "https://accounts.spotify.com/authorize";
const tokenEndpoint = "https://accounts.spotify.com/api/token";


// Update scope to include necessary permissions
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


async function generatePlaylistByType(playlistType) {
  let seedTracks = ['0c6xIDDpzE81m2q797ordT']; // Default track ID
  let seedGenres = [];


  // Build recommendation URL
  let url = 'https://api.spotify.com/v1/recommendations?limit=10';
 
  // Simple playlist generation - using default seeds for now
  if (playlistType === 'genre') {
    seedGenres = ['rock', 'pop'];
  } else if (playlistType === 'throwback') {
    seedGenres = ['80s', '90s'];
  }
 
  if (seedTracks.length > 0) {
    url += `&seed_tracks=${seedTracks.join(',')}`;
  }
 
  if (seedGenres.length > 0) {
    url += `&seed_genres=${seedGenres.join(',')}`;
  }


  console.log(`Getting recommendations with URL: ${url}`);


  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + currentToken.access_token },
  });


  const data = await response.json();
  if (data.error) {
    throw new Error(`Recommendation error: ${data.error.message || 'Unknown error'}`);
  }
 
  return data.tracks.map(track => ({
    name: track.name,
    artist: track.artists[0].name,
    id: track.id,
    albumCover: track.album.images[0]?.url || ''
  }));
}


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
    const playlistTracks = await generatePlaylistByType(playlistType);
    console.log(`Generated playlist with ${playlistTracks.length} tracks`);
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
