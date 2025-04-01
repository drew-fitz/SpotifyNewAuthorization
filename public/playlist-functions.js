/**
 * Playlist generation functions for Spotify Genie
 * Modified to use CSV data instead of Spotify API
 */

// Global reference to recommendation engine
window.recommendationEngine = window.recommendationEngine || null;

// Helper function to ensure the recommendation engine is initialized
async function ensureRecommendationEngine() {
  if (!recommendationEngine) {
    console.log("Initializing recommendation engine");
    recommendationEngine = new window.RecommendationEngine();
    
    // Check if we already have the dataset loaded
    if (!recommendationEngine.dataset) {
      try {
        // Try to load from localStorage
        const savedDataset = localStorage.getItem('spotify_genie_dataset');
        if (savedDataset) {
          console.log("Loading dataset from localStorage");
          await recommendationEngine.loadDataset(JSON.parse(savedDataset));
        } else {
          console.warn("No dataset found in localStorage");
        }
      } catch (error) {
        console.error("Error loading dataset from localStorage:", error);
      }
    }
  }
  return recommendationEngine;
}

// Main function to generate playlists by type
async function generatePlaylistByType(playlistType, csvData = null) {
  console.log(`Generating playlist of type: ${playlistType} using CSV data`);
  
  try {
    // Ensure recommendation engine is initialized
    await ensureRecommendationEngine();
    
    // If csvData is provided, load it directly
    if (csvData) {
      await recommendationEngine.loadDataset(csvData);
    }
    
    // Get user's liked tracks - either from localStorage or Spotify saved tracks
    let likedTracks = [];
    
    // Check if we already have liked songs data
    if (recommendationEngine.likedSongs) {
      likedTracks = recommendationEngine.likedSongs;
      console.log(`Using existing liked songs data (${likedTracks.length} tracks)`);
    } else {
      // Try to get from localStorage
      const savedLikedSongs = localStorage.getItem('spotify_genie_liked_songs');
      if (savedLikedSongs) {
        try {
          likedTracks = JSON.parse(savedLikedSongs);
          await recommendationEngine.loadLikedSongs(likedTracks);
          console.log(`Loaded ${likedTracks.length} liked songs from localStorage`);
        } catch (error) {
          console.error("Error parsing liked songs from localStorage:", error);
        }
      }
      
      // If still empty and we have Spotify API access, get from there
      if (likedTracks.length === 0 && window.currentToken && window.currentToken.access_token) {
        try {
          const spotifyTracks = await getUserSavedTracks(50);
          if (spotifyTracks && spotifyTracks.length > 0) {
            // Convert to format expected by recommendation engine
            likedTracks = spotifyTracks.map(track => ({
              Name: track.name,
              Artist: track.artist
            }));
            
            // Save to recommendation engine
            await recommendationEngine.loadLikedSongs(likedTracks);
            console.log(`Loaded ${likedTracks.length} liked songs from Spotify API`);
            
            // Save to localStorage for future use
            localStorage.setItem('spotify_genie_liked_songs', JSON.stringify(likedTracks));
          }
        } catch (error) {
          console.error("Error fetching liked songs from Spotify:", error);
        }
      }
    }
    
    // If we still don't have data, throw an error
    if (!recommendationEngine.dataset || recommendationEngine.dataset.length === 0) {
      throw new Error("No dataset available. Please upload a CSV file with song data.");
    }
    
    if (!recommendationEngine.likedSongs || recommendationEngine.likedSongs.length === 0) {
      throw new Error("No liked songs available. Please upload a CSV file with your liked songs or use Spotify liked songs.");
    }
    
    // Generate recommendations
    console.log(`Using recommendation engine to generate ${playlistType} playlist`);
    const recommendations = await processTracksByType(recommendationEngine.dataset, playlistType);
    
    return recommendations;
  } catch (error) {
    console.error("Error generating playlist from CSV:", error);
    throw error;
  }
}

// Function to route tracks to the right playlist generator
function processTracksByType(tracks, playlistType) {
  console.log(`Processing ${tracks.length} tracks for ${playlistType} playlist`);
  
  if (!tracks || tracks.length === 0) {
    console.error("No tracks provided to processTracksByType");
    return [];
  }
  
  try {
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
        return getCSVFavoritesPlaylist(tracks);
      
      case 'new-releases':
        return getCSVNewReleasesPlaylist(tracks);
      
      case 'genre-explorer':
        return getCSVGenreExplorerPlaylist(tracks);
      
      default:
        // Default to recommendation engine's general recommendations
        console.log(`Playlist type "${playlistType}" not recognized, using general recommendations`);
        return getGeneralRecommendations(tracks);
    }
  } catch (error) {
    console.error("Error in processTracksByType:", error);
    // Fallback to general recommendations
    return getGeneralRecommendations(tracks);
  }
}

// Get general recommendations using the recommendation engine
function getGeneralRecommendations(tracks) {
  console.log("Generating general recommendations");
  
  try {
    if (!recommendationEngine) {
      console.error("Recommendation engine not initialized");
      return getRandomTracks(tracks, 10);
    }
    
    // Use the recommendation engine to get recommendations
    const recommendations = recommendationEngine.recommendSongs(10);
    console.log(`Generated ${recommendations.length} recommendations`);
    
    return recommendations;
  } catch (error) {
    console.error("Error generating general recommendations:", error);
    return getRandomTracks(tracks, 10);
  }
}

// Helper function to get random tracks
function getRandomTracks(tracks, count) {
  const shuffled = [...tracks].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Mood-based playlist generators
 * Uses valence (happiness), energy, and other audio features from CSV
 */
function getMoodPlaylist(tracks, mood) {
  console.log(`Creating ${mood} mood playlist from CSV data`);
  
  // Ensure we have tracks with required features
  const tracksWithFeatures = tracks.filter(track => 
    track.valence !== undefined && 
    track.energy !== undefined
  );
  
  if (tracksWithFeatures.length === 0) {
    console.warn("No tracks with required features found, using general recommendations");
    return getGeneralRecommendations(tracks);
  }
  
  // Configure mood parameters
  let valenceMin, valenceMax, energyMin, energyMax, acousticnessWeight;
  
  switch (mood) {
    case 'happy':
      // High valence (happiness), medium-high energy
      valenceMin = 0.6;
      valenceMax = 1.0;
      energyMin = 0.4;
      energyMax = 1.0;
      acousticnessWeight = 0;
      break;
    
    case 'sad':
      // Low valence, low-medium energy
      valenceMin = 0;
      valenceMax = 0.4;
      energyMin = 0;
      energyMax = 0.6;
      acousticnessWeight = 1;
      break;
    
    case 'chill':
      // Medium valence, low energy, high acousticness
      valenceMin = 0.3;
      valenceMax = 0.8;
      energyMin = 0;
      energyMax = 0.5;
      acousticnessWeight = 2;
      break;
    
    case 'hype':
      // Medium-high valence, high energy
      valenceMin = 0.4;
      valenceMax = 1.0;
      energyMin = 0.7;
      energyMax = 1.0;
      acousticnessWeight = -1;
      break;
    
    default:
      // Default to balanced parameters
      valenceMin = 0.3;
      valenceMax = 0.8;
      energyMin = 0.3;
      energyMax = 0.8;
      acousticnessWeight = 0;
  }
  
  // Score tracks based on mood parameters
  const scoredTracks = tracksWithFeatures.map(track => {
    // Calculate how well the track fits the mood
    const valenceScore = scoreInRange(track.valence, valenceMin, valenceMax);
    const energyScore = scoreInRange(track.energy, energyMin, energyMax);
    
    // Use acousticness as a factor (more important for sad and chill)
    const acousticnessScore = acousticnessWeight >= 0 
      ? (track.acousticness || 0.5) * acousticnessWeight
      : (1 - (track.acousticness || 0.5)) * Math.abs(acousticnessWeight);
    
    // Combine scores (valence and energy are most important)
    const moodScore = valenceScore * 0.5 + energyScore * 0.4 + acousticnessScore * 0.1;
    
    // Add a small random factor to break ties and add variety
    const finalScore = moodScore * 0.9 + Math.random() * 0.1;
    
    return {
      ...track,
      moodScore: finalScore,
      // Format for display
      name: track.track_name || track.name || "Unknown Track",
      artist: track.artists || track.artist || "Unknown Artist",
      genre: track.track_genre || track.genre || "Unknown Genre",
      score: finalScore.toFixed(2),
      id: track.id || `local-${Math.random().toString(36).substring(2, 10)}`,
      albumCover: track.album_cover || track.albumCover || ''
    };
  });
  
  // Sort by score and take top 10
  const result = scoredTracks
    .sort((a, b) => b.moodScore - a.moodScore)
    .slice(0, Math.min(10, scoredTracks.length));
  
  console.log(`Generated ${result.length} tracks for ${mood} mood playlist`);
  return result;
}

// Helper function to score a value based on range
function scoreInRange(value, min, max) {
  if (value === undefined || value === null) return 0.5; // Default to middle score for missing values
  
  if (typeof value === 'string') {
    value = parseFloat(value);
    if (isNaN(value)) return 0.5;
  }
  
  if (value < min) {
    // Below range: score decreases as value gets further from min
    return Math.max(0, 1 - (min - value));
  } else if (value > max) {
    // Above range: score decreases as value gets further from max
    return Math.max(0, 1 - (value - max));
  } else {
    // Within range: perfect score
    // Additionally, give higher score to values in middle of range
    const midpoint = (min + max) / 2;
    const distanceFromMid = Math.abs(value - midpoint);
    const rangeHalfWidth = (max - min) / 2;
    
    // Score from 0.8 to 1.0 based on closeness to midpoint
    return 1.0 - (distanceFromMid / rangeHalfWidth) * 0.2;
  }
}

/**
 * Throwback playlist generator - modified to use CSV data
 * Looks for older songs based on year data in the CSV
 */
function getThrowbackPlaylist(tracks) {
  console.log("Generating throwback playlist from CSV data");
  
  // Filter tracks with year information
  const tracksWithYear = tracks.filter(track => 
    track.year !== undefined || 
    track.release_year !== undefined || 
    (track.album && track.album.release_date)
  );
  
  if (tracksWithYear.length === 0) {
    console.warn("No tracks with year data found, using general recommendations");
    return getGeneralRecommendations(tracks);
  }
  
  // Get the current year
  const currentYear = new Date().getFullYear();
  
  // Score tracks based on age (older is better for throwbacks)
  const scoredTracks = tracksWithYear.map(track => {
    // Extract year from various possible locations in the data
    let releaseYear;
    
    if (track.year) {
      releaseYear = parseInt(track.year);
    } else if (track.release_year) {
      releaseYear = parseInt(track.release_year);
    } else if (track.album && track.album.release_date) {
      releaseYear = parseInt(track.album.release_date.substring(0, 4));
    }
    
    if (isNaN(releaseYear)) {
      releaseYear = currentYear - 5; // Default to 5 years ago if no valid year
    }
    
    // Calculate age in years
    const age = currentYear - releaseYear;
    
    // Score based on age
    let throwbackScore;
    if (age >= 10 && age <= 20) {
      throwbackScore = 1.0; // Perfect throwback age
    } else if (age >= 5 && age < 10) {
      throwbackScore = 0.7 + (age - 5) * 0.06; // 0.7 - 0.94
    } else if (age > 20 && age <= 30) {
      throwbackScore = 0.9 - (age - 20) * 0.02; // 0.9 - 0.7
    } else if (age > 30) {
      throwbackScore = 0.7 - (age - 30) * 0.01; // Decreases slowly beyond 30
    } else {
      throwbackScore = age * 0.14; // 0 - 0.7 for 0-5 years
    }
    
    // Combine with popularity for well-known throwbacks
    const popularity = track.popularity !== undefined ? track.popularity : 50;
    const popularityScore = popularity / 100; // 0-1
    
    // Final score: 70% age, 20% popularity, 10% random for variety
    const finalScore = throwbackScore * 0.7 + popularityScore * 0.2 + Math.random() * 0.1;
    
    return {
      ...track,
      throwbackScore: finalScore,
      releaseYear,
      // Format for display
      name: track.track_name || track.name || "Unknown Track",
      artist: track.artists || track.artist || "Unknown Artist",
      genre: track.track_genre || track.genre || "Unknown Genre",
      score: finalScore.toFixed(2),
      id: track.id || `local-${Math.random().toString(36).substring(2, 10)}`,
      albumCover: track.album_cover || track.albumCover || ''
    };
  });
  
  // Sort by throwback score and take top 10
  const result = scoredTracks
    .sort((a, b) => b.throwbackScore - a.throwbackScore)
    .slice(0, 10);
  
  console.log(`Generated throwback playlist with ${result.length} tracks`);
  return result;
}

/**
 * CSV version of favorites playlist generator
 * Uses popularity and random selection since we can't track user listening history
 */
function getCSVFavoritesPlaylist(tracks) {
  console.log("Generating favorites playlist from CSV data");
  
  // If we have likedSongs in the recommendation engine, use those as a basis
  if (recommendationEngine && recommendationEngine.likedSongs && recommendationEngine.likedSongs.length > 0) {
    console.log("Using recommendation engine liked songs as favorites basis");
    
    // Get the tracks that match the user's liked songs
    const likedTrackNames = recommendationEngine.likedSongs.map(song => 
      (song.Name || '').toLowerCase()
    );
    
    // Score tracks based on similarity to liked songs
    const scoredTracks = tracks.map(track => {
      const trackName = (track.track_name || track.name || '').toLowerCase();
      
      // Check if this track is in liked songs
      const isLiked = likedTrackNames.includes(trackName);
      
      // Base score on popularity and a random factor
      const popularity = track.popularity !== undefined ? track.popularity : 50;
      const popularityScore = popularity / 100; // 0-1
      
      // Boost score if it's in liked songs
      const likedBonus = isLiked ? 0.5 : 0;
      
      // Final score: 40% popularity, 50% liked status, 10% random
      const finalScore = popularityScore * 0.4 + likedBonus + Math.random() * 0.1;
      
      return {
        ...track,
        favoriteScore: finalScore,
        // Format for display
        name: track.track_name || track.name || "Unknown Track",
        artist: track.artists || track.artist || "Unknown Artist",
        genre: track.track_genre || track.genre || "Unknown Genre",
        score: finalScore.toFixed(2),
        id: track.id || `local-${Math.random().toString(36).substring(2, 10)}`,
        albumCover: track.album_cover || track.albumCover || ''
      };
    });
    
    // Sort by score and take top 10
    const result = scoredTracks
      .sort((a, b) => b.favoriteScore - a.favoriteScore)
      .slice(0, 10);
    
    return result;
  }
  
  // Fallback: use popularity as a proxy for favorites
  console.log("No liked songs data, using popularity-based favorites");
  
  // Score tracks based on popularity
  const scoredTracks = tracks.map(track => {
    const popularity = track.popularity !== undefined ? track.popularity : 50;
    const popularityScore = popularity / 100; // 0-1
    
    // Add a random factor for variety
    const finalScore = popularityScore * 0.9 + Math.random() * 0.1;
    
    return {
      ...track,
      favoriteScore: finalScore,
      // Format for display
      name: track.track_name || track.name || "Unknown Track",
      artist: track.artists || track.artist || "Unknown Artist",
      genre: track.track_genre || track.genre || "Unknown Genre",
      score: finalScore.toFixed(2),
      id: track.id || `local-${Math.random().toString(36).substring(2, 10)}`,
      albumCover: track.album_cover || track.albumCover || ''
    };
  });
  
  // Sort by score and take top 10
  const result = scoredTracks
    .sort((a, b) => b.favoriteScore - a.favoriteScore)
    .slice(0, 10);
  
  console.log(`Generated favorites playlist with ${result.length} tracks`);
  return result;
}

/**
 * CSV version of new releases playlist generator
 * Uses year data in the CSV to find newer songs
 */
function getCSVNewReleasesPlaylist(tracks) {
  console.log("Generating new releases playlist from CSV data");
  
  // Filter tracks with year information
  const tracksWithYear = tracks.filter(track => 
    track.year !== undefined || 
    track.release_year !== undefined || 
    (track.album && track.album.release_date)
  );
  
  if (tracksWithYear.length === 0) {
    console.warn("No tracks with year data found, using general recommendations");
    return getGeneralRecommendations(tracks);
  }
  
  // Get the current year
  const currentYear = new Date().getFullYear();
  
  // Score tracks based on recency (newer is better)
  const scoredTracks = tracksWithYear.map(track => {
    // Extract year from various possible locations in the data
    let releaseYear;
    
    if (track.year) {
      releaseYear = parseInt(track.year);
    } else if (track.release_year) {
      releaseYear = parseInt(track.release_year);
    } else if (track.album && track.album.release_date) {
      releaseYear = parseInt(track.album.release_date.substring(0, 4));
    }
    
    if (isNaN(releaseYear)) {
      releaseYear = currentYear - 5; // Default to 5 years ago if no valid year
    }
    
    // Calculate age in years
    const age = currentYear - releaseYear;
    
    // Score based on recency - newer is better
    let recencyScore;
    if (age <= 1) {
      recencyScore = 1.0; // Current year
    } else if (age <= 2) {
      recencyScore = 0.8; // Last year
    } else if (age <= 3) {
      recencyScore = 0.6; // 2 years ago
    } else if (age <= 5) {
      recencyScore = 0.4; // 3-5 years ago
    } else {
      recencyScore = Math.max(0, 0.3 - (age - 5) * 0.05); // Older tracks get lower scores
    }
    
    // Combine with popularity
    const popularity = track.popularity !== undefined ? track.popularity : 50;
    const popularityScore = popularity / 100; // 0-1
    
    // Final score: 70% recency, 20% popularity, 10% random for variety
    const finalScore = recencyScore * 0.7 + popularityScore * 0.2 + Math.random() * 0.1;
    
    return {
      ...track,
      recencyScore: finalScore,
      releaseYear,
      // Format for display
      name: track.track_name || track.name || "Unknown Track",
      artist: track.artists || track.artist || "Unknown Artist",
      genre: track.track_genre || track.genre || "Unknown Genre",
      score: finalScore.toFixed(2),
      id: track.id || `local-${Math.random().toString(36).substring(2, 10)}`,
      albumCover: track.album_cover || track.albumCover || ''
    };
  });
  
  // Sort by recency score and take top 10
  const result = scoredTracks
    .sort((a, b) => b.recencyScore - a.recencyScore)
    .slice(0, 10);
  
  console.log(`Generated new releases playlist with ${result.length} tracks`);
  return result;
}

/**
 * CSV version of genre explorer playlist
 * Finds tracks from genres not in the user's liked songs
 */
function getCSVGenreExplorerPlaylist(tracks) {
  console.log("Generating genre explorer playlist from CSV data");
  
  // If we don't have liked songs or a recommendation engine, use general recommendations
  if (!recommendationEngine || !recommendationEngine.likedSongs || recommendationEngine.likedSongs.length === 0) {
    console.warn("No liked songs data for genre comparison, using general recommendations");
    return getGeneralRecommendations(tracks);
  }
  
  // Get user's preferred genres from recommendation engine
  let userGenres;
  try {
    userGenres = recommendationEngine.getUserGenres();
    console.log(`User's preferred genres from recommendation engine:`, userGenres);
  } catch (error) {
    console.error("Error getting user genres:", error);
    userGenres = [];
  }
  
  // If we couldn't get user's genres, use general recommendations
  if (!userGenres || userGenres.length === 0) {
    console.warn("No genre information available, using general recommendations");
    return getGeneralRecommendations(tracks);
  }
  
  // Filter tracks with genre information
  const tracksWithGenre = tracks.filter(track => 
    track.track_genre || track.genre
  );
  
  if (tracksWithGenre.length === 0) {
    console.warn("No tracks with genre data found, using general recommendations");
    return getGeneralRecommendations(tracks);
  }
  
  // Score tracks based on genre exploration potential
  const scoredTracks = tracksWithGenre.map(track => {
    const trackGenre = (track.track_genre || track.genre || '').toLowerCase();
    
    // Check if this genre is in user's preferred genres
    const isPreferredGenre = userGenres.some(genre => 
      genre.toLowerCase() === trackGenre
    );
    
    // Higher score for genres that aren't in user's preferences
    let genreExplorationScore = isPreferredGenre ? 0.2 : 0.8;
    
    // Add popularity factor (prefer somewhat popular tracks for better introduction)
    const popularity = track.popularity !== undefined ? track.popularity : 50;
    const popularityScore = (popularity / 100) * 0.15;
    
    // Add random factor
    const randomFactor = Math.random() * 0.05;
    
    // Final score
    const finalScore = genreExplorationScore + popularityScore + randomFactor;
    
    return {
      ...track,
      explorationScore: finalScore,
      // Format for display
      name: track.track_name || track.name || "Unknown Track",
      artist: track.artists || track.artist || "Unknown Artist",
      genre: track.track_genre || track.genre || "Unknown Genre",
      score: finalScore.toFixed(2),
      id: track.id || `local-${Math.random().toString(36).substring(2, 10)}`,
      albumCover: track.album_cover || track.albumCover || ''
    };
  });
  
  // Sort by score and take top 10
  const result = scoredTracks
    .sort((a, b) => b.explorationScore - a.explorationScore)
    .slice(0, 10);
  
  console.log(`Generated genre explorer playlist with ${result.length} tracks`);
  return result;
}

// Update the global function for handling playlist generation
async function handleGeneratePlaylist(event) {
  event.preventDefault();
  const selectedType = document.querySelector('input[name="playlist-type"]:checked');
 
  if (!selectedType) {
    console.error("No playlist type selected");
    document.getElementById("playlist-results").innerHTML = 
      '<div class="error-message">Please select a playlist type</div>';
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
    
    document.getElementById("playlist-results").innerHTML = 
      '<div class="loading-message">Generating your perfect playlist...</div>';
    
    // Generate playlist using our CSV-based functions
    const playlistTracks = await generatePlaylistByType(playlistType);
    
    console.log(`Generated playlist with ${playlistTracks.length} tracks`);
    
    // Store the generated playlist for potential saving to Spotify
    window.lastGeneratedPlaylist = {
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
  } finally {
    // Reset button
    const submitButton = document.querySelector('#playlist-form button[type="submit"]');
    if (submitButton) {
      submitButton.textContent = "Generate Playlist";
      submitButton.disabled = false;
    }
  }
}

// Make sure the functions are available globally for use in event handlers
window.handleGeneratePlaylist = handleGeneratePlaylist;
window.generatePlaylistByType = generatePlaylistByType;
window.processTracksByType = processTracksByType;