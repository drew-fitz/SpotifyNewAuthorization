import spotifyHelpers, { authHelpers } from './spotifyHelpers.js';

// Function to generate playlists based on selected type
async function generatePlaylistByType(playlistType) {
  console.log(`Starting to generate ${playlistType} playlist`);

  // Check if user is authenticated
  const token = authHelpers.getCookie();
  if (!token) {
    throw new Error("You need to log in with Spotify first");
  }

  let tracks = [];

  switch (playlistType) {
    case 'mood':
      // Generate a mood-based playlist using user's top tracks
      const topTracks = await spotifyHelpers.getUserTopTracks('medium_term');
      const trackSeed = await spotifyHelpers.getTrackSeed(topTracks);
      
      // Add mood parameters to recommendations
      const token = authHelpers.getCookie();
      try {
        const response = await axios({
          method: "GET",
          url: `https://api.spotify.com/v1/recommendations?limit=20&seed_tracks=${trackSeed.join(',')}&target_energy=0.7&target_valence=0.8`,
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/x-www-form-urlencoded"
          }
        });
        
        tracks = transformTracksForDisplay(response.data.tracks);
      } catch (error) {
        console.error("Error getting mood recommendations:", error);
        throw new Error("Failed to generate mood playlist");
      }
      break;

    case 'genre':
      // Generate a genre-based playlist using user's top artists
      const topArtists = await spotifyHelpers.getUserTopArtists('medium_term');
      
      if (!topArtists || !topArtists[0] || !topArtists[0].items || topArtists[0].items.length === 0) {
        throw new Error("Could not find your top artists");
      }
      
      // Extract genres from top artists
      const genres = [];
      topArtists[0].items.forEach(artist => {
        if (artist.genres && artist.genres.length > 0) {
          genres.push(...artist.genres.slice(0, 2)); // Take up to 2 genres per artist
        }
      });
      
      // Get unique genres and limit to 5 (Spotify API limitation)
      const uniqueGenres = [...new Set(genres)].slice(0, 5);
      
      if (uniqueGenres.length === 0) {
        throw new Error("Could not determine your preferred genres");
      }
      
      try {
        const response = await axios({
          method: "GET",
          url: `https://api.spotify.com/v1/recommendations?limit=20&seed_genres=${uniqueGenres.join(',')}`,
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/x-www-form-urlencoded"
          }
        });
        
        tracks = transformTracksForDisplay(response.data.tracks);
      } catch (error) {
        console.error("Error getting genre recommendations:", error);
        throw new Error("Failed to generate genre playlist");
      }
      break;

    case 'throwback':
      // Generate a throwback playlist with older tracks
      try {
        // Get user's top tracks but apply time filters to get "throwbacks"
        const response = await axios({
          method: "GET",
          url: `https://api.spotify.com/v1/recommendations?limit=20&seed_tracks=${trackSeed.join(',')}&max_popularity=70&target_popularity=50`,
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/x-www-form-urlencoded"
          }
        });
        
        // Filter tracks to favor older releases (if release_date is available)
        const allTracks = response.data.tracks;
        const oldTracks = allTracks.filter(track => {
          if (track.album && track.album.release_date) {
            const releaseYear = new Date(track.album.release_date).getFullYear();
            const currentYear = new Date().getFullYear();
            return releaseYear < currentYear - 5; // At least 5 years old
          }
          return true; // Include if no date info available
        });
        
        // If we have enough old tracks, use those, otherwise use all tracks
        const tracksToUse = oldTracks.length >= 10 ? oldTracks : allTracks;
        tracks = transformTracksForDisplay(tracksToUse);
      } catch (error) {
        console.error("Error getting throwback recommendations:", error);
        throw new Error("Failed to generate throwback playlist");
      }
      break;

    default:
      throw new Error(`Unknown playlist type: ${playlistType}`);
  }

  // Save the tracks to local storage for potential future use (creating Spotify playlist)
  if (tracks.length > 0) {
    saveTracksForPlaylist(tracks);
  }

  return tracks;
}

// Transform API track objects to display format
function transformTracksForDisplay(tracks) {
  return tracks.map(track => ({
    id: track.id,
    uri: track.uri,
    name: track.name,
    artist: track.artists.map(artist => artist.name).join(', '),
    albumCover: track.album && track.album.images && track.album.images.length > 0 
      ? track.album.images[track.album.images.length > 2 ? 2 : 0].url // Use smaller image if available
      : null
  }));
}

// Save tracks for potential creation of Spotify playlist
function saveTracksForPlaylist(tracks) {
  const result = {
    seeds: [], // We don't have seeds here but the format expects them
    tracks: tracks.map(track => ({
      uri: track.uri,
      id: track.id,
      name: track.name
    }))
  };
  localStorage.setItem("spotiData", JSON.stringify(result));
}

// Add "Save to Spotify" functionality
function saveToSpotify() {
  return spotifyHelpers.createPlaylist();
}

// Make functions available globally
window.generatePlaylistByType = generatePlaylistByType;
window.saveToSpotify = saveToSpotify;

export { generatePlaylistByType, saveToSpotify };