// FreeStream - Complete Frontend Application

class FreeStream {
    constructor() {
        this.config = {
            API_BASE_URL: window.location.hostname === 'localhost' 
                ? 'http://localhost:3000/api'
                : '/api',
            ITEMS_PER_PAGE: 20,
            CURRENT_PAGE: 1,
            HAS_MORE: true,
            CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
            THEME: localStorage.getItem('theme') || 'dark'
        };
        
        this.state = {
            currentVideo: null,
            videoQueue: JSON.parse(localStorage.getItem('videoQueue')) || [],
            likedVideos: JSON.parse(localStorage.getItem('likedVideos')) || [],
            savedVideos: JSON.parse(localStorage.getItem('savedVideos')) || [],
            searchHistory: JSON.parse(localStorage.getItem('searchHistory')) || [],
            currentCategory: 'all',
            isLoading: false,
            videos: [],
            collections: [],
            categories: [
                { id: 'nature', name: 'Nature', icon: 'fas fa-mountain' },
                { id: 'technology', name: 'Technology', icon: 'fas fa-laptop-code' },
                { id: 'business', name: 'Business', icon: 'fas fa-briefcase' },
                { id: 'people', name: 'People', icon: 'fas fa-users' },
                { id: 'animals', name: 'Animals', icon: 'fas fa-paw' },
                { id: 'travel', name: 'Travel', icon: 'fas fa-plane' },
                { id: 'sports', name: 'Sports', icon: 'fas fa-football-ball' },
                { id: 'food', name: 'Food', icon: 'fas fa-utensils' },
                { id: 'music', name: 'Music', icon: 'fas fa-music' },
                { id: 'art', name: 'Art', icon: 'fas fa-palette' }
            ]
        };
        
        this.cache = new Map();
        this.init();
    }

    async init() {
        try {
            // Set theme
            this.setTheme(this.config.THEME);
            
            // Load initial data
            await this.loadTrendingVideos();
            await this.loadCollections();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Hide loading screen
            setTimeout(() => {
                document.getElementById('loadingScreen').classList.add('hidden');
            }, 1000);
            
            // Check API health
            await this.checkHealth();
            
            console.log('FreeStream initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize application');
        }
    }

    // API Methods
    async checkHealth() {
        try {
            const response = await fetch(`${this.config.API_BASE_URL}/health`);
            if (response.ok) {
                const stats = document.getElementById('statsInfo');
                if (stats) {
                    stats.innerHTML = '<i class="fas fa-circle"></i> API Connected';
                    stats.className = 'text-success';
                }
            }
        } catch (error) {
            console.warn('API health check failed:', error);
            const stats = document.getElementById('statsInfo');
            if (stats) {
                stats.innerHTML = '<i class="fas fa-circle"></i> API Offline';
                stats.className = 'text-danger';
            }
        }
    }

    async loadTrendingVideos(page = 1) {
        try {
            this.showLoading(true);
            
            const cacheKey = `trending_${page}`;
            const cached = this.getCached(cacheKey);
            
            if (cached) {
                this.displayVideos(cached.videos);
                return cached;
            }
            
            const response = await fetch(
                `${this.config.API_BASE_URL}/trending?page=${page}&per_page=${this.config.ITEMS_PER_PAGE}`
            );
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            const videos = data.videos || [];
            
            // Update state
            this.state.videos = [...this.state.videos, ...videos];
            this.config.HAS_MORE = data.next_page ? true : false;
            
            // Cache the response
            this.setCached(cacheKey, { videos: videos, timestamp: Date.now() });
            
            // Update UI
            this.displayVideos(videos);
            this.updateVideoCount();
            
            return data;
        } catch (error) {
            console.error('Trending videos error:', error);
            this.showError('Failed to load trending videos');
            throw error;
        } finally {
            this.showLoading(false);
        }
    }

    async searchVideos(query, page = 1) {
        try {
            this.showLoading(true);
            
            const cacheKey = `search_${query}_${page}`;
            const cached = this.getCached(cacheKey);
            
            if (cached) {
                this.displayVideos(cached.videos);
                return cached;
            }
            
            const response = await fetch(
                `${this.config.API_BASE_URL}/search?q=${encodeURIComponent(query)}&page=${page}&per_page=${this.config.ITEMS_PER_PAGE}`
            );
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            const videos = data.videos || [];
            
            // Update search history
            this.addToSearchHistory(query);
            
            // Update state
            this.state.videos = page === 1 ? videos : [...this.state.videos, ...videos];
            this.config.HAS_MORE = data.next_page ? true : false;
            
            // Cache the response
            this.setCached(cacheKey, { videos: videos, timestamp: Date.now() });
            
            // Update UI
            this.displayVideos(videos, page === 1);
            
            return data;
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Failed to search videos');
            throw error;
        } finally {
            this.showLoading(false);
        }
    }

    async loadVideoDetails(videoId) {
        try {
            this.showLoading(true);
            
            const cacheKey = `video_${videoId}`;
            const cached = this.getCached(cacheKey);
            
            if (cached) {
                this.playVideo(cached);
                return cached;
            }
            
            const response = await fetch(`${this.config.API_BASE_URL}/video/${videoId}`);
            
            if (!response.ok) {
                throw new Error('Failed to load video details');
            }
            
            const video = await response.json();
            
            // Cache the response
            this.setCached(cacheKey, video);
            
            // Play the video
            this.playVideo(video);
            
            // Load related videos
            this.loadRelatedVideos(videoId);
            
            return video;
        } catch (error) {
            console.error('Video details error:', error);
            this.showError('Failed to load video');
            throw error;
        } finally {
            this.showLoading(false);
        }
    }

    async loadRelatedVideos(videoId) {
        try {
            // For Pexels, we search using the video's tags or similar terms
            const response = await fetch(`${this.config.API_BASE_URL}/trending?per_page=6`);
            
            if (response.ok) {
                const data = await response.json();
                const videos = data.videos || [];
                this.displayRelatedVideos(videos);
            }
        } catch (error) {
            console.error('Related videos error:', error);
        }
    }

    async loadCollections() {
        try {
            const response = await fetch(`${this.config.API_BASE_URL}/collections`);
            
            if (response.ok) {
                const collections = await response.json();
                this.state.collections = collections;
                this.displayCollections(collections);
            }
        } catch (error) {
            console.error('Collections error:', error);
        }
    }

    async loadCollectionVideos(collectionId) {
        try {
            this.showLoading(true);
            
            const response = await fetch(
                `${this.config.API_BASE_URL}/collection/${collectionId}?per_page=${this.config.ITEMS_PER_PAGE}`
            );
            
            if (response.ok) {
                const data = await response.json();
                const videos = data.videos || [];
                this.displayVideos(videos, true);
                this.showNotification(`Showing ${collectionId} collection`);
            }
        } catch (error) {
            console.error('Collection videos error:', error);
            this.showError('Failed to load collection');
        } finally {
            this.showLoading(false);
        }
    }

    // UI Methods
    displayVideos(videos, clear = false) {
        const videoGrid = document.getElementById('videoGrid');
        
        if (clear) {
            videoGrid.innerHTML = '';
            this.state.videos = [];
        }
        
        if (!videos || videos.length === 0) {
            videoGrid.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-video-slash fa-3x mb-3 text-muted"></i>
                    <h4 class="text-muted">No videos found</h4>
                    <p class="text-muted">Try a different search term</p>
                </div>
            `;
            return;
        }
        
        videos.forEach(video => {
            const videoElement = this.createVideoCard(video);
            videoGrid.appendChild(videoElement);
        });
        
        // Update load more button
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.style.display = this.config.HAS_MORE ? 'block' : 'none';
        }
    }

    displayRelatedVideos(videos) {
        const relatedContainer = document.getElementById('relatedVideos');
        if (!relatedContainer) return;
        
        relatedContainer.innerHTML = '';
        
        videos.forEach(video => {
            const col = document.createElement('div');
            col.className = 'col';
            col.innerHTML = `
                <div class="video-card" data-video-id="${video.id}">
                    <div class="video-thumbnail">
                        <img src="${video.image}" 
                             alt="${video.user.name}" 
                             loading="lazy">
                        <div class="video-badge">${this.formatDuration(video.duration)}</div>
                    </div>
                    <div class="video-card-body">
                        <h6 class="video-card-title">${video.user.name}</h6>
                        <div class="video-card-meta">
                            <i class="fas fa-eye me-1"></i> ${this.formatNumber(video.avg_color || 0)}
                        </div>
                    </div>
                </div>
            `;
            
            col.addEventListener('click', () => this.loadVideoDetails(video.id));
            relatedContainer.appendChild(col);
        });
    }

    displayCollections(collections) {
        const collectionsList = document.getElementById('collectionsList');
        if (!collectionsList) return;
        
        collectionsList.innerHTML = '';
        
        collections.forEach(collection => {
            const item = document.createElement('div');
            item.className = 'list-group-item collection-item';
            item.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="collection-icon me-3">
                        <i class="fas fa-folder fa-lg text-primary"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${collection.name}</h6>
                        <small class="text-muted">${collection.count} videos</small>
                    </div>
                    <i class="fas fa-chevron-right text-muted"></i>
                </div>
            `;
            
            item.addEventListener('click', () => this.loadCollectionVideos(collection.id));
            collectionsList.appendChild(item);
        });
    }

    createVideoCard(video) {
        const col = document.createElement('div');
        col.className = 'col';
        
        const duration = video.duration || 0;
        const thumbnail = video.image || video.video_pictures?.[0]?.picture || 'https://images.pexels.com/videos/3045163/free-video-3045163.jpg';
        const photographer = video.user?.name || 'Unknown';
        
        col.innerHTML = `
            <div class="video-card fade-in" data-video-id="${video.id}">
                <div class="video-thumbnail">
                    <img src="${thumbnail}" 
                         alt="${photographer}" 
                         loading="lazy"
                         onerror="this.src='https://images.pexels.com/videos/3045163/free-video-3045163.jpg'">
                    <div class="video-badge">${this.formatDuration(duration)}</div>
                    <div class="video-card-actions">
                        <button class="btn btn-sm btn-primary play-btn">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="btn btn-sm btn-secondary ms-2 queue-btn">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
                <div class="video-card-body">
                    <h6 class="video-card-title" title="${photographer}">${this.truncateText(photographer, 30)}</h6>
                    <div class="video-card-meta">
                        <i class="fas fa-user me-1"></i> ${photographer}
                    </div>
                    <div class="video-card-stats mt-2">
                        <small class="text-muted">
                            <i class="fas fa-video me-1"></i> ${video.width || 1920}x${video.height || 1080}
                        </small>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners
        const playBtn = col.querySelector('.play-btn');
        const queueBtn = col.querySelector('.queue-btn');
        const card = col.querySelector('.video-card');
        
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.loadVideoDetails(video.id);
        });
        
        queueBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.addToQueue(video.id, photographer, duration);
        });
        
        card.addEventListener('click', () => {
            this.loadVideoDetails(video.id);
        });
        
        return col;
    }

    playVideo(video) {
        // Update state
        this.state.currentVideo = video;
        
        // Get best quality video file
        const videoFile = video.video_files?.find(file => file.quality === 'hd') 
                        || video.video_files?.[0]
                        || video.video_files;
        
        if (!videoFile) {
            this.showError('No video file available');
            return;
        }
        
        // Update video player
        const videoElement = document.getElementById('mainVideo');
        const sourceElement = document.getElementById('videoSource');
        const overlay = document.getElementById('videoOverlay');
        
        if (videoElement && sourceElement) {
            sourceElement.src = videoFile.link || videoFile.url;
            videoElement.load();
            
            // Hide overlay
            if (overlay) {
                overlay.classList.add('hidden');
            }
        }
        
        // Update video info
        this.updateVideoInfo(video);
        
        // Add to now playing
        this.updateNowPlaying(video);
        
        // Add to history
        this.addToHistory(video);
    }

    updateVideoInfo(video) {
        // Update title
        const titleElement = document.getElementById('videoTitle');
        if (titleElement) {
            titleElement.textContent = video.user?.name || 'Free Video';
        }
        
        // Update description
        const descElement = document.getElementById('videoDescription');
        if (descElement) {
            descElement.textContent = video.user?.name 
                ? `Video by ${video.user.name} on Pexels`
                : 'Free stock video from Pexels';
        }
        
        // Update duration
        const durationElement = document.getElementById('videoDuration');
        if (durationElement && video.duration) {
            durationElement.textContent = this.formatDuration(video.duration);
        }
        
        // Update quality
        const qualityElement = document.getElementById('videoQuality');
        if (qualityElement) {
            const bestQuality = video.video_files?.find(f => f.quality === 'hd') 
                             || video.video_files?.[0];
            qualityElement.textContent = bestQuality?.quality?.toUpperCase() || 'HD';
        }
        
        // Update photographer info
        const photographerElement = document.getElementById('photographerName');
        if (photographerElement) {
            photographerElement.textContent = video.user?.name || 'Pexels Contributor';
        }
        
        // Update camera info
        const cameraElement = document.getElementById('cameraInfo');
        if (cameraElement) {
            cameraElement.textContent = video.user?.name || 'Unknown';
        }
        
        // Update tags
        const tagsElement = document.getElementById('videoTags');
        if (tagsElement) {
            tagsElement.textContent = video.video_tags?.length || 0;
        }
    }

    updateNowPlaying(video) {
        const nowPlayingList = document.getElementById('nowPlayingList');
        if (!nowPlayingList) return;
        
        const duration = video.duration ? this.formatDuration(video.duration) : '0:00';
        const photographer = video.user?.name || 'Unknown';
        
        nowPlayingList.innerHTML = `
            <div class="list-group-item active">
                <div class="d-flex align-items-center">
                    <div class="queue-number">1</div>
                    <div class="queue-info">
                        <h6 class="queue-title">${photographer}</h6>
                        <div class="queue-duration">${duration}</div>
                    </div>
                    <div class="queue-actions">
                        <button class="btn btn-sm btn-outline-light">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    updateVideoCount() {
        const countElement = document.getElementById('videoCount');
        if (countElement) {
            // For Pexels, we can't get total count, so show approximate
            countElement.textContent = '10,000+';
        }
    }

    // Queue Management
    addToQueue(videoId, title, duration) {
        const queueItem = {
            id: videoId,
            title: title,
            duration: duration,
            addedAt: new Date().toISOString()
        };
        
        this.state.videoQueue.push(queueItem);
        this.saveQueue();
        this.updateQueueCount();
        this.showNotification(`Added "${this.truncateText(title, 20)}" to queue`);
    }

    updateQueueCount() {
        const countElement = document.getElementById('queueCount');
        if (countElement) {
            countElement.textContent = this.state.videoQueue.length;
        }
        
        // Save to localStorage
        localStorage.setItem('videoQueue', JSON.stringify(this.state.videoQueue));
    }

    saveQueue() {
        localStorage.setItem('videoQueue', JSON.stringify(this.state.videoQueue));
    }

    // Search History
    addToSearchHistory(query) {
        if (!query.trim()) return;
        
        // Remove duplicates
        this.state.searchHistory = this.state.searchHistory.filter(item => item !== query);
        
        // Add to beginning
        this.state.searchHistory.unshift(query);
        
        // Keep only last 10 items
        if (this.state.searchHistory.length > 10) {
            this.state.searchHistory.pop();
        }
        
        // Save to localStorage
        localStorage.setItem('searchHistory', JSON.stringify(this.state.searchHistory));
        
        // Update suggestions
        this.updateSearchSuggestions();
    }

    updateSearchSuggestions() {
        const suggestionsContainer = document.getElementById('searchSuggestions');
        if (!suggestionsContainer) return;
        
        if (this.state.searchHistory.length === 0) {
            suggestionsContainer.classList.remove('show');
            return;
        }
        
        suggestionsContainer.innerHTML = '';
        
        this.state.searchHistory.forEach(query => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.innerHTML = `
                <i class="fas fa-history me-2 text-muted"></i>
                ${query}
            `;
            
            item.addEventListener('click', () => {
                document.getElementById('searchInput').value = query;
                this.searchVideos(query);
                suggestionsContainer.classList.remove('show');
            });
            
            suggestionsContainer.appendChild(item);
        });
        
        // Add clear history option
        if (this.state.searchHistory.length > 0) {
            const clearItem = document.createElement('div');
            clearItem.className = 'suggestion-item text-danger';
            clearItem.innerHTML = `
                <i class="fas fa-trash me-2"></i>
                Clear history
            `;
            
            clearItem.addEventListener('click', () => {
                this.state.searchHistory = [];
                localStorage.removeItem('searchHistory');
                suggestionsContainer.classList.remove('show');
            });
            
            suggestionsContainer.appendChild(clearItem);
        }
    }

    // Theme Management
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.config.THEME = theme;
        localStorage.setItem('theme', theme);
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.innerHTML = theme === 'dark' 
                ? '<i class="fas fa-sun"></i>' 
                : '<i class="fas fa-moon"></i>';
        }
    }

    toggleTheme() {
        const newTheme = this.config.THEME === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    // Cache Management
    getCached(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this.config.CACHE_DURATION) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    setCached(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    // Event Listeners
    setupEventListeners() {
        // Search
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        
        if (searchInput && searchBtn) {
            searchBtn.addEventListener('click', () => this.handleSearch());
            
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSearch();
            });
            
            searchInput.addEventListener('input', () => {
                const suggestions = document.getElementById('searchSuggestions');
                if (searchInput.value.trim() && this.state.searchHistory.length > 0) {
                    suggestions.classList.add('show');
                } else {
                    suggestions.classList.remove('show');
                }
            });
            
            // Close suggestions when clicking outside
            document.addEventListener('click', (e) => {
                if (!searchInput.contains(e.target) && !document.getElementById('searchSuggestions').contains(e.target)) {
                    document.getElementById('searchSuggestions').classList.remove('show');
                }
            });
        }
        
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        
        // Video actions
        const likeBtn = document.getElementById('likeBtn');
        const saveBtn = document.getElementById('saveBtn');
        const shareBtn = document.getElementById('shareBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        
        if (likeBtn) likeBtn.addEventListener('click', () => this.likeVideo());
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveVideo());
        if (shareBtn) shareBtn.addEventListener('click', () => this.shareVideo());
        if (downloadBtn) downloadBtn.addEventListener('click', () => this.downloadVideo());
        
        // Load more
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadMoreVideos());
        }
        
        // Refresh
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshVideos());
        }
        
        // Populate category menu
        this.populateCategoryMenu();
        
        // Video player events
        const videoElement = document.getElementById('mainVideo');
        if (videoElement) {
            videoElement.addEventListener('ended', () => this.playNextInQueue());
            videoElement.addEventListener('error', () => {
                this.showError('Failed to play video. Trying alternative source...');
            });
        }
    }

    populateCategoryMenu() {
        const categoryMenu = document.getElementById('categoryMenu');
        if (!categoryMenu) return;
        
        categoryMenu.innerHTML = '';
        
        this.state.categories.forEach(category => {
            const item = document.createElement('li');
            item.innerHTML = `
                <a class="dropdown-item" href="#" data-category="${category.id}">
                    <i class="${category.icon} me-2"></i>${category.name}
                </a>
            `;
            
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.loadCategoryVideos(category.id);
            });
            
            categoryMenu.appendChild(item);
        });
    }

    // Event Handlers
    handleSearch() {
        const searchInput = document.getElementById('searchInput');
        const query = searchInput.value.trim();
        
        if (query) {
            this.searchVideos(query, 1);
            searchInput.blur();
            document.getElementById('searchSuggestions').classList.remove('show');
        }
    }

    async loadCategoryVideos(categoryId) {
        this.state.currentCategory = categoryId;
        this.showLoading(true);
        
        try {
            const response = await fetch(
                `${this.config.API_BASE_URL}/category/${categoryId}?per_page=${this.config.ITEMS_PER_PAGE}`
            );
            
            if (response.ok) {
                const data = await response.json();
                const videos = data.videos || [];
                this.displayVideos(videos, true);
                
                const category = this.state.categories.find(c => c.id === categoryId);
                this.showNotification(`Showing ${category?.name || categoryId} videos`);
            }
        } catch (error) {
            console.error('Category videos error:', error);
            this.showError('Failed to load category videos');
        } finally {
            this.showLoading(false);
        }
    }

    async loadMoreVideos() {
        if (!this.config.HAS_MORE || this.state.isLoading) return;
        
        this.config.CURRENT_PAGE += 1;
        
        if (this.state.currentCategory === 'all') {
            await this.loadTrendingVideos(this.config.CURRENT_PAGE);
        } else if (this.state.searchHistory.length > 0) {
            await this.searchVideos(this.state.searchHistory[0], this.config.CURRENT_PAGE);
        } else {
            await this.loadTrendingVideos(this.config.CURRENT_PAGE);
        }
    }

    async refreshVideos() {
        this.config.CURRENT_PAGE = 1;
        this.config.HAS_MORE = true;
        
        // Clear cache for fresh data
        this.cache.clear();
        
        if (this.state.currentCategory === 'all') {
            await this.loadTrendingVideos(1);
        } else {
            await this.loadCategoryVideos(this.state.currentCategory);
        }
        
        this.showNotification('Videos refreshed');
    }

    // Video Actions
    likeVideo() {
        if (!this.state.currentVideo) return;
        
        const likeBtn = document.getElementById('likeBtn');
        const likeCount = document.getElementById('likeCount');
        
        // Toggle like state
        const isLiked = likeBtn.classList.contains('active');
        
        if (isLiked) {
            likeBtn.classList.remove('active');
            likeBtn.innerHTML = '<i class="far fa-thumbs-up"></i> <span id="likeCount">0</span>';
            
            // Remove from liked videos
            this.state.likedVideos = this.state.likedVideos.filter(v => v.id !== this.state.currentVideo.id);
        } else {
            likeBtn.classList.add('active');
            likeBtn.innerHTML = '<i class="fas fa-thumbs-up"></i> <span id="likeCount">1</span>';
            
            // Add to liked videos
            this.state.likedVideos.push({
                id: this.state.currentVideo.id,
                title: this.state.currentVideo.user?.name,
                likedAt: new Date().toISOString()
            });
        }
        
        // Save to localStorage
        localStorage.setItem('likedVideos', JSON.stringify(this.state.likedVideos));
        
        this.showNotification(isLiked ? 'Video unliked' : 'Video liked');
    }

    saveVideo() {
        if (!this.state.currentVideo) return;
        
        const saveBtn = document.getElementById('saveBtn');
        
        // Toggle save state
        const isSaved = saveBtn.classList.contains('active');
        
        if (isSaved) {
            saveBtn.classList.remove('active');
            saveBtn.innerHTML = '<i class="far fa-bookmark"></i>';
            
            // Remove from saved videos
            this.state.savedVideos = this.state.savedVideos.filter(v => v.id !== this.state.currentVideo.id);
        } else {
            saveBtn.classList.add('active');
            saveBtn.innerHTML = '<i class="fas fa-bookmark"></i>';
            
            // Add to saved videos
            this.state.savedVideos.push({
                id: this.state.currentVideo.id,
                title: this.state.currentVideo.user?.name,
                savedAt: new Date().toISOString(),
                thumbnail: this.state.currentVideo.image
            });
        }
        
        // Save to localStorage
        localStorage.setItem('savedVideos', JSON.stringify(this.state.savedVideos));
        
        this.showNotification(isSaved ? 'Video removed from library' : 'Video saved to library');
    }

    shareVideo() {
        if (!this.state.currentVideo) return;
        
        const videoUrl = this.state.currentVideo.url || `https://www.pexels.com/video/${this.state.currentVideo.id}/`;
        const title = this.state.currentVideo.user?.name || 'Check out this video';
        
        if (navigator.share) {
            navigator.share({
                title: title,
                text: 'Watch this free video on FreeStream',
                url: videoUrl
            });
        } else {
            // Fallback: Copy to clipboard
            navigator.clipboard.writeText(videoUrl).then(() => {
                this.showNotification('Link copied to clipboard!');
            });
        }
    }

    downloadVideo() {
        if (!this.state.currentVideo) return;
        
        const videoFile = this.state.currentVideo.video_files?.[0];
        if (!videoFile) {
            this.showError('No downloadable video available');
            return;
        }
        
        // Create download link
        const link = document.createElement('a');
        link.href = videoFile.link;
        link.download = `freestream-${this.state.currentVideo.id}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('Download started...');
    }

    playNextInQueue() {
        if (this.state.videoQueue.length > 0) {
            const nextVideo = this.state.videoQueue.shift();
            this.loadVideoDetails(nextVideo.id);
            this.updateQueueCount();
        }
    }

    // Utility Methods
    formatDuration(seconds) {
        if (!seconds) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    formatNumber(num) {
        if (!num) return '0';
        
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        } else {
            return num.toString();
        }
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    showLoading(show) {
        this.state.isLoading = show;
        
        const loadSpinner = document.getElementById('loadSpinner');
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        
        if (show) {
            document.body.classList.add('loading');
            if (loadSpinner) loadSpinner.classList.remove('d-none');
            if (loadMoreBtn) loadMoreBtn.disabled = true;
        } else {
            document.body.classList.remove('loading');
            if (loadSpinner) loadSpinner.classList.add('d-none');
            if (loadMoreBtn) loadMoreBtn.disabled = false;
        }
    }

    showError(message) {
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const modal = new bootstrap.Modal('#infoModal');
        
        if (modalTitle && modalBody) {
            modalTitle.innerHTML = '<i class="fas fa-exclamation-triangle me-2 text-danger"></i>Error';
            modalBody.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    ${message}
                </div>
                <p class="mb-0">Please try again later or contact support if the problem persists.</p>
            `;
            modal.show();
        }
    }

    showNotification(message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'position-fixed bottom-0 end-0 p-3';
        toast.style.zIndex = '9999';
        
        toast.innerHTML = `
            <div class="toast align-items-center text-white bg-success border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">
                        <i class="fas fa-check-circle me-2"></i>${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;
        
        document.body.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast.querySelector('.toast'));
        bsToast.show();
        
        // Remove after animation
        toast.addEventListener('hidden.bs.toast', () => {
            document.body.removeChild(toast);
        });
    }

    addToHistory(video) {
        // Simple history tracking
        const history = JSON.parse(localStorage.getItem('watchHistory')) || [];
        
        history.unshift({
            id: video.id,
            title: video.user?.name,
            watchedAt: new Date().toISOString(),
            duration: video.duration
        });
        
        // Keep only last 50 items
        if (history.length > 50) history.pop();
        
        localStorage.setItem('watchHistory', JSON.stringify(history));
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.freeStream = new FreeStream();
});