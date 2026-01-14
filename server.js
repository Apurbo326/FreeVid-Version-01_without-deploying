require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false // Disable for development
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Pexels API Configuration
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || 'YOUR_PEXELS_API_KEY';
const PEXELS_API_URL = 'https://api.pexels.com/videos';

// Cache for API responses (simple in-memory cache)
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper function to make Pexels API requests
async function makePexelsRequest(endpoint, params = {}) {
    const cacheKey = `${endpoint}_${JSON.stringify(params)}`;
    const cached = cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        console.log(`Cache hit for: ${endpoint}`);
        return cached.data;
    }
    
    try {
        const response = await axios.get(`${PEXELS_API_URL}/${endpoint}`, {
            headers: {
                'Authorization': PEXELS_API_KEY,
                'User-Agent': 'FreeVideoStreamer/1.0'
            },
            params: params
        });
        
        const data = response.data;
        cache.set(cacheKey, {
            data: data,
            timestamp: Date.now()
        });
        
        return data;
    } catch (error) {
        console.error('Pexels API Error:', error.message);
        throw error;
    }
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        api: 'Pexels',
        cacheSize: cache.size
    });
});

// Get trending/popular videos
app.get('/api/trending', async (req, res) => {
    try {
        const { page = 1, per_page = 15 } = req.query;
        const data = await makePexelsRequest('popular', {
            page: parseInt(page),
            per_page: Math.min(parseInt(per_page), 80),
            min_width: 640,
            min_duration: 5
        });
        res.json(data);
    } catch (error) {
        console.error('Trending error:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch trending videos',
            message: error.response?.data || error.message
        });
    }
});

// Search videos
app.get('/api/search', async (req, res) => {
    try {
        const { q, page = 1, per_page = 15, orientation = 'landscape' } = req.query;
        
        if (!q || q.trim() === '') {
            return res.status(400).json({ error: 'Search query is required' });
        }
        
        const data = await makePexelsRequest('search', {
            query: q,
            page: parseInt(page),
            per_page: Math.min(parseInt(per_page), 80),
            orientation: orientation,
            size: 'medium',
            min_duration: 5
        });
        
        res.json(data);
    } catch (error) {
        console.error('Search error:', error.message);
        res.status(500).json({ 
            error: 'Failed to search videos',
            message: error.response?.data || error.message
        });
    }
});

// Get video by ID
app.get('/api/video/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = await makePexelsRequest(`videos/${id}`);
        res.json(data);
    } catch (error) {
        console.error('Video details error:', error.message);
        res.status(404).json({ 
            error: 'Video not found',
            message: error.response?.data || error.message
        });
    }
});

// Get videos by category
app.get('/api/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const { page = 1, per_page = 15 } = req.query;
        
        const categories = {
            'nature': 'nature landscape',
            'technology': 'technology',
            'business': 'business office',
            'people': 'people',
            'animals': 'animals wildlife',
            'travel': 'travel city',
            'sports': 'sports',
            'food': 'food cooking',
            'music': 'music concert',
            'art': 'art creative'
        };
        
        const query = categories[category] || category;
        
        const data = await makePexelsRequest('search', {
            query: query,
            page: parseInt(page),
            per_page: Math.min(parseInt(per_page), 80),
            orientation: 'landscape'
        });
        
        res.json(data);
    } catch (error) {
        console.error('Category error:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch category videos',
            message: error.response?.data || error.message
        });
    }
});

// Get curated collections
app.get('/api/collections', async (req, res) => {
    const collections = [
        {
            id: 'featured',
            name: 'Featured Videos',
            description: 'Hand-picked high quality videos',
            thumbnail: 'https://images.pexels.com/videos/3209298/free-video-3209298.jpg',
            count: 50
        },
        {
            id: '4k',
            name: '4K Ultra HD',
            description: 'Stunning 4K resolution videos',
            thumbnail: 'https://images.pexels.com/videos/3045163/free-video-3045163.jpg',
            count: 100
        },
        {
            id: 'slowmo',
            name: 'Slow Motion',
            description: 'Beautiful slow motion footage',
            thumbnail: 'https://images.pexels.com/videos/3015520/free-video-3015520.jpg',
            count: 75
        },
        {
            id: 'aerial',
            name: 'Aerial & Drone',
            description: 'Breathtaking aerial views',
            thumbnail: 'https://images.pexels.com/videos/3121459/free-video-3121459.jpg',
            count: 60
        },
        {
            id: 'time-lapse',
            name: 'Time Lapse',
            description: 'Time lapse videos of nature and cities',
            thumbnail: 'https://images.pexels.com/videos/3561874/free-video-3561874.jpg',
            count: 45
        },
        {
            id: 'underwater',
            name: 'Underwater',
            description: 'Marine life and underwater scenes',
            thumbnail: 'https://images.pexels.com/videos/3362061/free-video-3362061.jpg',
            count: 30
        }
    ];
    
    res.json(collections);
});

// Get videos from a collection
app.get('/api/collection/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, per_page = 15 } = req.query;
        
        const collectionQueries = {
            'featured': '4k beautiful cinematic',
            '4k': '4k ultra hd quality',
            'slowmo': 'slow motion cinematic',
            'aerial': 'drone aerial view',
            'time-lapse': 'time lapse',
            'underwater': 'underwater ocean'
        };
        
        const query = collectionQueries[id] || id;
        
        const data = await makePexelsRequest('search', {
            query: query,
            page: parseInt(page),
            per_page: Math.min(parseInt(per_page), 80),
            orientation: 'landscape'
        });
        
        res.json(data);
    } catch (error) {
        console.error('Collection error:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch collection videos',
            message: error.response?.data || error.message
        });
    }
});

// Get video statistics (mock data)
app.get('/api/stats', (req, res) => {
    const stats = {
        totalVideos: 15000,
        categories: 10,
        collections: 6,
        cacheHits: cache.size,
        uptime: process.uptime()
    };
    res.json(stats);
});

// Clear cache (admin endpoint)
app.delete('/api/cache', (req, res) => {
    const { secret } = req.query;
    if (secret === process.env.ADMIN_SECRET) {
        const cleared = cache.size;
        cache.clear();
        res.json({ message: `Cache cleared (${cleared} items)` });
    } else {
        res.status(403).json({ error: 'Unauthorized' });
    }
});

// Get video download links (proxied to avoid CORS)
app.get('/api/proxy/video', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }
        
        const response = await axios.get(url, {
            responseType: 'stream',
            headers: {
                'Referer': 'https://www.pexels.com/',
                'User-Agent': 'FreeVideoStreamer/1.0'
            }
        });
        
        res.setHeader('Content-Type', response.headers['content-type']);
        res.setHeader('Content-Length', response.headers['content-length']);
        
        response.data.pipe(res);
    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).json({ error: 'Failed to proxy video' });
    }
});

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
    🎬 FREE Video Streaming Platform
    📍 Port: ${PORT}
    🔑 API: Pexels (Free)
    💾 Cache: Enabled
    🚀 Server ready at http://localhost:${PORT}
    `);
    
    console.log(`
    📺 Available Endpoints:
    ----------------------
    GET  /api/health           - Health check
    GET  /api/trending         - Trending videos
    GET  /api/search?q=query   - Search videos
    GET  /api/video/:id        - Get video details
    GET  /api/category/:name   - Get videos by category
    GET  /api/collections      - List collections
    GET  /api/collection/:id   - Get collection videos
    GET  /api/stats            - Platform statistics
    DELETE /api/cache?secret=  - Clear cache (admin)
    `);
});