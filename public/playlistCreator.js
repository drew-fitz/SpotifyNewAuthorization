// Import the spotifyHelpers if in a module environment
// import spotifyHelpers from "./spotifyHelpers";

// Create an enhanced playlist creation module that integrates with the existing code
const playlistCreator = {
    // Store selected tracks and artists
    selectedTracks: [],
    selectedArtists: [],
    
    // Initialize the playlist creator
    init: function() {
      // Add the playlist creator container to the DOM
      this.createPlaylistCreatorUI();
      // Set up event listeners
      this.setupEventListeners();
    },
    
    // Create UI elements for playlist creation
    createPlaylistCreatorUI: function() {
      const container = document.createElement('div');
      container.id = 'playlist-creator-container';
      container.className = 'component-container';
      
      container.innerHTML = `
        <h3>Create Your Playlist</h3>
        <div class="playlist-tabs">
          <button id="tracks-tab" class="tab-btn active">By Tracks</button>
          <button id="artists-tab" class="tab-btn">By Artists</button>
          <button id="top-tracks-tab" class="tab-btn">My Top Tracks</button>
          <button id="top-artists-tab" class="tab-btn">My Top Artists</button>
        </div>
        
        <div id="tracks-panel" class="panel active">
          <div class="search-box">
            <input type="text" id="track-search-input" placeholder="Search for tracks...">
            <button id="track-search-btn">Search</button>
          </div>
          <div id="track-results" class="results-container"></div>
          <div id="selected-tracks" class="selected-items">
            <h4>Selected Tracks (<span id="track-count">0</span>)</h4>
            <div class="selected-list"></div>
          </div>
        </div>
        
        <div id="artists-panel" class="panel">
          <div class="search-box">
            <input type="text" id="artist-search-input" placeholder="Search for artists...">
            <button id="artist-search-btn">Search</button>
          </div>
          <div id="artist-results" class="results-container"></div>
          <div id="selected-artists" class="selected-items">
            <h4>Selected Artists (<span id="artist-count">0</span>)</h4>
            <div class="selected-list"></div>
          </div>
        </div>
        
        <div id="top-tracks-panel" class="panel">
          <div class="range-selector">
            <label>Time Range:</label>
            <select id="top-tracks-range">
              <option value="short_term">Last Month</option>
              <option value="medium_term">Last 6 Months</option>
              <option value="long_term">All Time</option>
            </select>
          </div>
          <button id="load-top-tracks-btn">Load My Top Tracks</button>
          <div id="top-tracks-results" class="results-container"></div>
        </div>
        
        <div id="top-artists-panel" class="panel">
          <div class="range-selector">
            <label>Time Range:</label>
            <select id="top-artists-range">
              <option value="short_term">Last Month</option>
              <option value="medium_term">Last 6 Months</option>
              <option value="long_term">All Time</option>
            </select>
          </div>
          <button id="load-top-artists-btn">Load My Top Artists</button>
          <div id="top-artists-results" class="results-container"></div>
        </div>
        
        <div class="create-actions">
          <button id="create-playlist-btn" class="action-btn">Create Spotify Playlist</button>
        </div>
      `;
      
      document.body.appendChild(container);
      
      // Add some CSS to the head
      const style = document.createElement('style');
      style.textContent = `
        .playlist-tabs {
          display: flex;
          margin-bottom: 15px;
        }
        
        .tab-btn {
          flex: 1;
          background-color: #333;
          color: #ccc;
          border: none;
          padding: 10px;
          cursor: pointer;
        }
        
        .tab-btn.active {
          background-color: #1DB954;
          color: white;
        }
        
        .panel {
          display: none;
          padding: 15px;
          background-color: #333;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        
        .panel.active {
          display: block;
        }
        
        .search-box {
          display: flex;
          margin-bottom: 15px;
        }
        
        .search-box input {
          flex: 1;
          padding: 8px;
          border: none;
          border-radius: 4px 0 0 4px;
          background-color: #444;
          color: white;
        }
        
        .search-box button {
          border-radius: 0 4px 4px 0;
          padding: 8px 15px;
        }
        
        .results-container {
          max-height: 300px;
          overflow-y: auto;
          margin-bottom: 15px;
        }
        
        .result-item {
          display: flex;
          align-items: center;
          padding: 8px;
          margin-bottom: 5px;
          background-color: #444;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .result-item:hover {
          background-color: #555;
        }
        
        .result-item img {
          width: 40px;
          height: 40px;
          border-radius: 4px;
          margin-right: 10px;
        }
        
        .selected-items {
          margin-top: 20px;
        }
        
        .selected-list {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        
        .selected-item {
          display: flex;
          align-items: center;
          background-color: #1DB954;
          padding: 5px 10px;
          border-radius: 15px;
          margin-bottom: 5px;
        }
        
        .selected-item .remove-btn {
          margin-left: 8px;
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-weight: bold;
        }
        
        .create-actions {
          margin-top: 20px;
          text-align: center;
        }
        
        .action-btn {
          background-color: #1DB954;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 30px;
          font-size: 16px;
          cursor: pointer;
          transition: transform 0.2s;
        }
        
        .action-btn:hover {
          transform: scale(1.05);
        }
        
        .range-selector {
          margin-bottom: 15px;
        }
        
        .range-selector select {
          padding: 8px;
          background-color: #444;
          color: white;
          border: none;
          border-radius: 4px;
        }
      `;
      
      document.head.appendChild(style);
    },
    
    // Set up event listeners for the playlist creator
    setupEventListeners: function() {
      // Tab switching
      document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', (e) => {
          // Remove active class from all tabs and panels
          document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
          document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));
          
          // Add active class to clicked tab
          e.target.classList.add('active');
          
          // Show the corresponding panel
          const panelId = e.target.id.replace('-tab', '-panel');
          document.getElementById(panelId).classList.add('active');
        });
      });
      
      // Track search
      document.getElementById('track-search-btn').addEventListener('click', () => {
        const query = document.getElementById('track-search-input').value;
        if (query.trim()) {
          this.searchTracks(query);
        }
      });
      
      // Artist search
      document.getElementById('artist-search-btn').addEventListener('click', () => {
        const query = document.getElementById('artist-search-input').value;
        if (query.trim()) {
          this.searchArtists(query);
        }
      });
      
      // Load top tracks
      document.getElementById('load-top-tracks-btn').addEventListener('click', () => {
        const range = document.getElementById('top-tracks-range').value;
        this.loadTopTracks(range);
      });
      
      // Load top artists
      document.getElementById('load-top-artists-btn').addEventListener('click', () => {
        const range = document.getElementById('top-artists-range').value;
        this.loadTopArtists(range);
      });
      
      // Create playlist button
      document.getElementById('create-playlist-btn').addEventListener('click', () => {
        this.createPlaylist();
      });
      
      // Enter key for search inputs
      document.getElementById('track-search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          document.getElementById('track-search-btn').click();
        }
      });
      
      document.getElementById('artist-search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          document.getElementById('artist-search-btn').click();
        }
      });
    },
    
    // Search for tracks using the spotifyHelpers
    searchTracks: async function(query) {
      const resultsContainer = document.getElementById('track-results');
      resultsContainer.innerHTML = '<p>Searching...</p>';
      
      try {
        const tracks = await spotifyHelpers.searchTrack(query);
        
        if (tracks.length > 0) {
          resultsContainer.innerHTML = '';
          
          tracks.forEach(track => {
            const trackItem = document.createElement('div');
            trackItem.className = 'result-item';
            trackItem.dataset.id = track.id;
            
            // Get artist names
            const artistNames = track.artists.map(artist => artist.name).join(', ');
            
            // Get album image if available
            const albumImg = track.album.images.length > 0 ? 
              `<img src="${track.album.images[track.album.images.length - 1].url}" alt="${track.name}">` : '';
            
            trackItem.innerHTML = `
              ${albumImg}
              <div class="result-info">
                <div class="result-name">${track.name}</div>
                <div class="result-artist">${artistNames}</div>
              </div>
            `;
            
            trackItem.addEventListener('click', () => {
              this.addTrack(track);
            });
            
            resultsContainer.appendChild(trackItem);
          });
        } else {
          resultsContainer.innerHTML = '<p>No tracks found. Try a different search.</p>';
        }
      } catch (error) {
        console.error('Error searching tracks:', error);
        resultsContainer.innerHTML = `<p>Error searching tracks: ${error.message}</p>`;
      }
    },
    
    // Search for artists using the spotifyHelpers
    searchArtists: async function(query) {
      const resultsContainer = document.getElementById('artist-results');
      resultsContainer.innerHTML = '<p>Searching...</p>';
      
      try {
        const artists = await spotifyHelpers.searchArtist(query);
        
        if (artists.length > 0) {
          resultsContainer.innerHTML = '';
          
          artists.forEach(artist => {
            const artistItem = document.createElement('div');
            artistItem.className = 'result-item';
            artistItem.dataset.id = artist.id;
            
            // Get artist image if available
            const artistImg = artist.images.length > 0 ? 
              `<img src="${artist.images[artist.images.length - 1].url}" alt="${artist.name}">` : '';
            
            artistItem.innerHTML = `
              ${artistImg}
              <div class="result-info">
                <div class="result-name">${artist.name}</div>
                <div class="result-genre">${artist.genres.slice(0, 3).join(', ')}</div>
              </div>
            `;
            
            artistItem.addEventListener('click', () => {
              this.addArtist(artist);
            });
            
            resultsContainer.appendChild(artistItem);
          });
        } else {
          resultsContainer.innerHTML = '<p>No artists found. Try a different search.</p>';
        }
      } catch (error) {
        console.error('Error searching artists:', error);
        resultsContainer.innerHTML = `<p>Error searching artists: ${error.message}</p>`;
      }
    },
    
    // Load user's top tracks
    loadTopTracks: function(range) {
      const resultsContainer = document.getElementById('top-tracks-results');
      resultsContainer.innerHTML = '<p>Loading your top tracks...</p>';
      
      // This would use the spotifyHelpers.databyAllTimeTopTracks function
      // For demo purposes, we'll create a direct implementation here
      this.generatePlaylistFromTopTracks(range);
    },
    
    // Load user's top artists
    loadTopArtists: function(range) {
      const resultsContainer = document.getElementById('top-artists-results');
      resultsContainer.innerHTML = '<p>Loading your top artists...</p>';
      
      // This would use the spotifyHelpers.databyAllTimeTopArtists function
      // For demo purposes, we'll create a direct implementation here
      this.generatePlaylistFromTopArtists(range);
    },
    
    // Generate playlist from top tracks
    generatePlaylistFromTopTracks: function(range) {
      // Call the spotifyHelpers method
      spotifyHelpers.databyAllTimeTopTracks(range)
        .then(() => {
          // The function in spotifyHelpers already handles the storage and reload
          // So we don't need to do anything here
          alert('Playlist generated based on your top tracks!');
        })
        .catch(error => {
          console.error('Error generating playlist from top tracks:', error);
          document.getElementById('top-tracks-results').innerHTML = 
            `<p>Error generating playlist: ${error.message}</p>`;
        });
    },
    
    // Generate playlist from top artists
    generatePlaylistFromTopArtists: function(range) {
      // Call the spotifyHelpers method
      spotifyHelpers.databyAllTimeTopArtists(range)
        .then(() => {
          // The function in spotifyHelpers already handles the storage and reload
          // So we don't need to do anything here
          alert('Playlist generated based on your top artists!');
        })
        .catch(error => {
          console.error('Error generating playlist from top artists:', error);
          document.getElementById('top-artists-results').innerHTML = 
            `<p>Error generating playlist: ${error.message}</p>`;
        });
    },
    
    // Add a track to the selected tracks
    addTrack: function(track) {
      // Check if already selected
      if (this.selectedTracks.find(t => t.id === track.id)) {
        return;
      }
      
      // Add to selected tracks array
      this.selectedTracks.push(track);
      
      // Update the UI
      this.updateSelectedTracksUI();
    },
    
    // Add an artist to the selected artists
    addArtist: function(artist) {
      // Check if already selected
      if (this.selectedArtists.find(a => a.id === artist.id)) {
        return;
      }
      
      // Add to selected artists array
      this.selectedArtists.push(artist);
      
      // Update the UI
      this.updateSelectedArtistsUI();
    },
    
    // Remove a track from the selected tracks
    removeTrack: function(trackId) {
      this.selectedTracks = this.selectedTracks.filter(track => track.id !== trackId);
      this.updateSelectedTracksUI();
    },
    
    // Remove an artist from the selected artists
    removeArtist: function(artistId) {
      this.selectedArtists = this.selectedArtists.filter(artist => artist.id !== artistId);
      this.updateSelectedArtistsUI();
    },
    
    // Update the selected tracks UI
    updateSelectedTracksUI: function() {
      const container = document.querySelector('#selected-tracks .selected-list');
      const count = document.getElementById('track-count');
      
      // Update count
      count.textContent = this.selectedTracks.length;
      
      // Clear container
      container.innerHTML = '';
      
      // Add selected tracks to UI
      this.selectedTracks.forEach(track => {
        const trackEl = document.createElement('div');
        trackEl.className = 'selected-item';
        trackEl.innerHTML = `
          <span>${track.name}</span>
          <button class="remove-btn" data-id="${track.id}">×</button>
        `;
        
        trackEl.querySelector('.remove-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeTrack(track.id);
        });
        
        container.appendChild(trackEl);
      });
    },
    
    // Update the selected artists UI
    updateSelectedArtistsUI: function() {
      const container = document.querySelector('#selected-artists .selected-list');
      const count = document.getElementById('artist-count');
      
      // Update count
      count.textContent = this.selectedArtists.length;
      
      // Clear container
      container.innerHTML = '';
      
      // Add selected artists to UI
      this.selectedArtists.forEach(artist => {
        const artistEl = document.createElement('div');
        artistEl.className = 'selected-item';
        artistEl.innerHTML = `
          <span>${artist.name}</span>
          <button class="remove-btn" data-id="${artist.id}">×</button>
        `;
        
        artistEl.querySelector('.remove-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeArtist(artist.id);
        });
        
        container.appendChild(artistEl);
      });
    },
    
    // Create a playlist with the selected items
    // Create a playlist with the selected items
createPlaylist: function() {
    // Get the create button for UI updates
    const createButton = document.getElementById('create-playlist-btn');
    
    // Store original button text for restoring later
    const originalButtonText = createButton.textContent;
    
    // Helper function to handle errors consistently
    const handleError = (error) => {
      console.error('Error creating playlist:', error);
      createButton.textContent = originalButtonText;
      createButton.disabled = false;
      
      // Provide a more user-friendly error message based on the error type
      if (error.message && error.message.includes('token')) {
        alert('Authentication error. Please refresh your token and try again.');
      } else if (error.response && error.response.status === 429) {
        alert('You\'ve made too many requests. Please wait a moment and try again.');
      } else {
        alert(`Error creating playlist: ${error.message || 'Unknown error occurred'}`);
      }
    };
    
    // Process for track-based playlist
    if (this.selectedTracks.length > 0) {
      // Show loading state
      createButton.textContent = 'Creating playlist...';
      createButton.disabled = true;
      
      // Get track IDs
      const trackIds = this.selectedTracks.map(track => track.id);
      
      // Validate track IDs
      if (!trackIds.every(id => typeof id === 'string' && id.length > 0)) {
        handleError(new Error('Invalid track ID detected. Please try selecting tracks again.'));
        return;
      }
      
      // Call the spotifyHelpers method with a timeout for safety
      const timeout = setTimeout(() => {
        handleError(new Error('Request timed out. Please try again.'));
      }, 30000); // 30 second timeout
      
      spotifyHelpers.databySelectedTracks(trackIds)
        .then(() => {
          clearTimeout(timeout);
          createButton.textContent = originalButtonText;
          createButton.disabled = false;
          alert('Playlist created successfully! A new playlist has been added to your Spotify account.');
          
          // Optional: Clear the selected tracks after successful creation
          this.selectedTracks = [];
          this.updateSelectedTracksUI();
        })
        .catch(error => {
          clearTimeout(timeout);
          handleError(error);
        });
    } 
    // Process for artist-based playlist
    else if (this.selectedArtists.length > 0) {
      // Show loading state
      createButton.textContent = 'Creating playlist...';
      createButton.disabled = true;
      
      // Get artist IDs
      const artistIds = this.selectedArtists.map(artist => artist.id);
      
      // Validate artist IDs
      if (!artistIds.every(id => typeof id === 'string' && id.length > 0)) {
        handleError(new Error('Invalid artist ID detected. Please try selecting artists again.'));
        return;
      }
      
      // Call the spotifyHelpers method with a timeout for safety
      const timeout = setTimeout(() => {
        handleError(new Error('Request timed out. Please try again.'));
      }, 30000); // 30 second timeout
      
      spotifyHelpers.databySelectedArtists(artistIds)
        .then(() => {
          clearTimeout(timeout);
          createButton.textContent = originalButtonText;
          createButton.disabled = false;
          alert('Playlist created successfully! A new playlist has been added to your Spotify account.');
          
          // Optional: Clear the selected artists after successful creation
          this.selectedArtists = [];
          this.updateSelectedArtistsUI();
        })
        .catch(error => {
          clearTimeout(timeout);
          handleError(error);
        });
    } else {
      alert('Please select at least one track or artist first.');
    }
  }
}