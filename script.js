// =============================================================================
// TUTORIAL MAKER - REFACTORED CODE
// Draw on YouTube videos with timestamp management
// =============================================================================

// =============================================================================
// 1. GLOBAL STATE
// =============================================================================
const AppState = {
    // YouTube Integration
    player: null,
    apiReady: false,
    
    // Canvas Management
    canvas: null,
    ctx: null,
    overlayCanvas: null,
    overlayCtx: null,
    
    // Drawing State
    isDrawing: false,
    drawingMode: false,
    currentTool: 'pencil',
    currentColor: '#ff0000',
    brushSize: 4,
    isEraser: false,
    
    // Drawing Coordinates
    lastX: 0,
    lastY: 0,
    startX: 0,
    startY: 0,
    
    // Timestamp Management
    timestampedDrawings: [],
    currentTimestamp: null,
    currentDrawingState: null
};

// =============================================================================
// 2. CANVAS UTILITIES
// =============================================================================
const CanvasUtils = {
    /**
     * Get active canvas based on current mode
     */
    getActiveCanvas() {
        return AppState.drawingMode ? AppState.overlayCanvas : AppState.canvas;
    },

    /**
     * Get active context based on current mode
     */
    getActiveContext() {
        return AppState.drawingMode ? AppState.overlayCtx : AppState.ctx;
    },

    /**
     * Get mouse position relative to active canvas
     */
    getMousePos(e) {
        const activeCanvas = this.getActiveCanvas();
        if (!activeCanvas) return null;
        
        const rect = activeCanvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches?.[0]?.clientX);
        const clientY = e.clientY || (e.touches?.[0]?.clientY);
        
        if (!clientX || !clientY) return null;
        
        return {
            x: (clientX - rect.left) * (activeCanvas.width / rect.width),
            y: (clientY - rect.top) * (activeCanvas.height / rect.height)
        };
    },

    /**
     * Clear active canvas
     */
    clear() {
        const activeCtx = this.getActiveContext();
        const activeCanvas = this.getActiveCanvas();
        
        if (activeCtx && activeCanvas) {
            activeCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
        }
        
        AppState.currentDrawingState = null;
    },

    /**
     * Resize both canvases to match container
     */
    resize() {
        const container = AppState.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        // Resize main canvas
        AppState.canvas.width = rect.width;
        AppState.canvas.height = rect.height;
        
        // Resize overlay canvas
        if (AppState.overlayCanvas) {
            AppState.overlayCanvas.width = rect.width;
            AppState.overlayCanvas.height = rect.height;
        }
        
        DrawingUtils.updateStyles();
    }
};

// =============================================================================
// 3. DRAWING UTILITIES
// =============================================================================
const DrawingUtils = {
    /**
     * Update drawing styles for active context
     */
    updateStyles() {
        const activeCtx = CanvasUtils.getActiveContext();
        if (!activeCtx) return;
        
        if (AppState.isEraser) {
            activeCtx.globalCompositeOperation = 'destination-out';
            activeCtx.lineWidth = AppState.brushSize * 2;
        } else {
            activeCtx.globalCompositeOperation = 'source-over';
            activeCtx.strokeStyle = AppState.currentColor;
            activeCtx.lineWidth = AppState.brushSize;
        }
        
        activeCtx.lineCap = 'round';
        activeCtx.lineJoin = 'round';
    },

    /**
     * Draw line between two points
     */
    drawLine(x1, y1, x2, y2) {
        const activeCtx = CanvasUtils.getActiveContext();
        activeCtx.beginPath();
        activeCtx.moveTo(x1, y1);
        activeCtx.lineTo(x2, y2);
        activeCtx.stroke();
    },

    /**
     * Draw rectangle
     */
    drawRectangle(x1, y1, x2, y2) {
        const activeCtx = CanvasUtils.getActiveContext();
        const width = x2 - x1;
        const height = y2 - y1;
        activeCtx.strokeRect(x1, y1, width, height);
    },

    /**
     * Draw circle
     */
    drawCircle(x1, y1, x2, y2) {
        const activeCtx = CanvasUtils.getActiveContext();
        const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        activeCtx.beginPath();
        activeCtx.arc(x1, y1, radius, 0, Math.PI * 2);
        activeCtx.stroke();
    },

    /**
     * Draw arrow with arrowhead
     */
    drawArrow(x1, y1, x2, y2) {
        const activeCtx = CanvasUtils.getActiveContext();
        const headlen = 15;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        
        // Main line
        activeCtx.beginPath();
        activeCtx.moveTo(x1, y1);
        activeCtx.lineTo(x2, y2);
        activeCtx.stroke();
        
        // Arrowhead
        activeCtx.beginPath();
        activeCtx.moveTo(x2, y2);
        activeCtx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
        activeCtx.moveTo(x2, y2);
        activeCtx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
        activeCtx.stroke();
    }
};

// =============================================================================
// 4. TIME UTILITIES
// =============================================================================
const TimeUtils = {
    /**
     * Format seconds to MM:SS or HH:MM:SS (smart format)
     */
    format(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours === 0) {
            return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
};

// =============================================================================
// 5. DRAWING MODE MANAGEMENT
// =============================================================================
const DrawingMode = {
    /**
     * Toggle drawing mode on/off
     */
    toggle() {
        AppState.drawingMode ? this.close() : this.open();
    },

    /**
     * Open drawing mode with overlay
     */
    open() {
        AppState.drawingMode = true;
        
        document.getElementById('drawingOverlay').classList.remove('hidden');
        
        const btn = document.getElementById('drawModeBtn');
        btn.textContent = '🎨 Drawing Mode Active';
        btn.classList.remove('bg-green-500', 'hover:bg-green-600');
        btn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        
        DrawingUtils.updateStyles();
    },

    /**
     * Close drawing mode and hide overlay
     */
    close() {
        AppState.drawingMode = false;
        AppState.isDrawing = false;
        
        document.getElementById('drawingOverlay').classList.add('hidden');
        
        const btn = document.getElementById('drawModeBtn');
        btn.textContent = '✏️ Start Drawing';
        btn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        btn.classList.add('bg-green-500', 'hover:bg-green-600');
    }
};

// =============================================================================
// 6. TIMESTAMP MANAGEMENT
// =============================================================================
const TimestampManager = {
    /**
     * Save drawing with current video timestamp
     */
    save() {
        if (!AppState.player) {
            alert('Please load a video first!');
            return;
        }
        
        const currentTime = AppState.player.getCurrentTime();
        const formattedTime = TimeUtils.format(currentTime);
        
        // Check for existing timestamp
        const existing = AppState.timestampedDrawings.find(drawing => 
            Math.abs(drawing.time - currentTime) < 1
        );
        
        const drawingData = CanvasUtils.getActiveCanvas().toDataURL('image/png');
        
        if (existing) {
            // Update existing
            existing.drawingData = drawingData;
            existing.created = new Date().toLocaleString();
            UI.showNotification(`Drawing updated at ${formattedTime}!`);
        } else {
            // Create new
            AppState.timestampedDrawings.push({
                id: Date.now(),
                time: currentTime,
                timeFormatted: TimeUtils.format(currentTime),
                drawingData: drawingData,
                created: new Date().toLocaleString(),
                videoTimestamp: formattedTime
            });
            UI.showNotification(`Drawing saved at ${formattedTime}!`);
        }
        
        // Cleanup
        AppState.currentTimestamp = currentTime;
        AppState.currentDrawingState = null;
        CanvasUtils.clear();
        
        if (AppState.drawingMode) {
            DrawingMode.close();
        }
        
        this.updateUI();
    },

    /**
     * Jump to specific timestamp
     */
    jumpTo(time) {
        if (!AppState.player) return;
        
        AppState.player.seekTo(time, true);
        
        const drawing = AppState.timestampedDrawings.find(d => d.time === time);
        
        if (drawing) {
            this.loadDrawing(drawing.drawingData, time);
            UI.showNotification(`Showing drawings from ${TimeUtils.format(time)}`);
        } else {
            CanvasUtils.clear();
            AppState.currentTimestamp = time;
            UI.showNotification(`Ready to draw at ${TimeUtils.format(time)}`);
        }
    },

    /**
     * Load drawing for specific timestamp
     */
    loadDrawing(drawingData, timestamp = null) {
        const activeCanvas = CanvasUtils.getActiveCanvas();
        const activeCtx = CanvasUtils.getActiveContext();
        
        const img = new Image();
        img.onload = function() {
            activeCtx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
            activeCtx.drawImage(img, 0, 0);
        };
        img.src = drawingData;
        
        if (timestamp !== null) {
            AppState.currentTimestamp = timestamp;
            AppState.currentDrawingState = drawingData;
        }
    },

    /**
     * Delete timestamp
     */
    delete(id) {
        AppState.timestampedDrawings = AppState.timestampedDrawings.filter(d => d.id !== id);
        this.updateUI();
        UI.showNotification('Drawing deleted!');
    },

    /**
     * Update timestamp list UI
     */
    updateUI() {
        const container = document.getElementById('timestampList');
        
        if (AppState.timestampedDrawings.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">No drawings saved yet. Use "⏰ Save at Time" to create timestamped drawings.</p>';
            return;
        }
        
        const sorted = [...AppState.timestampedDrawings].sort((a, b) => a.time - b.time);
        
        container.innerHTML = sorted.map(drawing => `
            <div onclick="TimestampManager.jumpTo(${drawing.time})" class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-8 bg-white rounded border overflow-hidden">
                        <img src="${drawing.drawingData}" alt="Drawing thumbnail" class="w-full h-full object-cover">
                    </div>
                    <div>
                        <div class="font-medium text-gray-800">${drawing.timeFormatted}</div>
                        <div class="text-xs text-gray-500">Saved: ${drawing.videoTimestamp}</div>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="event.stopPropagation(); TimestampManager.loadDrawing('${drawing.drawingData}')" class="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors">
                        📋 Load Only
                    </button>
                    <button onclick="event.stopPropagation(); TimestampManager.delete(${drawing.id})" class="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }
};

// =============================================================================
// 7. UI UTILITIES
// =============================================================================
const UI = {
    /**
     * Show notification message
     */
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }
};

// =============================================================================
// 8. DRAWING EVENT HANDLERS
// =============================================================================
const DrawingEvents = {
    /**
     * Start drawing
     */
    start(e) {
        const pos = CanvasUtils.getMousePos(e);
        if (!pos) return;
        
        AppState.isDrawing = true;
        AppState.startX = AppState.lastX = pos.x;
        AppState.startY = AppState.lastY = pos.y;
        
        CanvasUtils.getActiveCanvas().classList.add('drawing');
        
        if (AppState.currentTool === 'pencil') {
            DrawingUtils.updateStyles();
            CanvasUtils.getActiveContext().beginPath();
            CanvasUtils.getActiveContext().moveTo(pos.x, pos.y);
        }
    },

    /**
     * Continue drawing
     */
    draw(e) {
        if (!AppState.isDrawing) return;
        
        const pos = CanvasUtils.getMousePos(e);
        if (!pos) return;
        
        if (AppState.currentTool === 'pencil') {
            CanvasUtils.getActiveContext().lineTo(pos.x, pos.y);
            CanvasUtils.getActiveContext().stroke();
        }
        
        AppState.lastX = pos.x;
        AppState.lastY = pos.y;
    },

    /**
     * Stop drawing
     */
    stop(e) {
        if (!AppState.isDrawing) return;
        
        AppState.isDrawing = false;
        CanvasUtils.getActiveCanvas().classList.remove('drawing');
        
        const pos = CanvasUtils.getMousePos(e);
        if (!pos) return;
        
        // Draw shapes on mouse up
        if (AppState.currentTool !== 'pencil') {
            DrawingUtils.updateStyles();
            
            switch (AppState.currentTool) {
                case 'line':
                    DrawingUtils.drawLine(AppState.startX, AppState.startY, pos.x, pos.y);
                    break;
                case 'rectangle':
                    DrawingUtils.drawRectangle(AppState.startX, AppState.startY, pos.x, pos.y);
                    break;
                case 'circle':
                    DrawingUtils.drawCircle(AppState.startX, AppState.startY, pos.x, pos.y);
                    break;
                case 'arrow':
                    DrawingUtils.drawArrow(AppState.startX, AppState.startY, pos.x, pos.y);
                    break;
            }
        }
    }
};

// =============================================================================
// 9. YOUTUBE INTEGRATION
// =============================================================================
const YouTubeManager = {
    /**
     * YouTube API ready callback
     */
    onAPIReady() {
        AppState.apiReady = true;
        console.log('YouTube API is ready');
    },

    /**
     * Load video from URL
     */
    loadVideo() {
        const url = document.getElementById('youtubeUrl').value.trim();
        
        if (!url) {
            alert('Please enter a YouTube URL');
            return;
        }
        
        const videoId = this.extractVideoId(url);
        if (!videoId) {
            alert('Please enter a valid YouTube URL');
            return;
        }

        if (!AppState.apiReady) {
            setTimeout(() => this.loadVideo(), 100);
            return;
        }
        
        document.getElementById('player').innerHTML = '';
        
        if (!AppState.player) {
            this.createPlayer(videoId);
        } else {
            AppState.player.loadVideoById(videoId);
        }
        
        CanvasUtils.clear();
    },

    /**
     * Create YouTube player
     */
    createPlayer(videoId) {
        AppState.player = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'playsinline': 1,
                'rel': 0,
                'controls': 1,
                'enablejsapi': 1,
                'origin': window.location.origin
            },
            events: {
                'onReady': (event) => {
                    console.log('Player is ready');
                    CanvasUtils.resize();
                    event.target.playVideo();
                },
                'onStateChange': (event) => {
                    console.log('Player state changed:', event.data);
                },
                'onError': (event) => {
                    console.error('YouTube Player Error:', event.data);
                    alert('Error loading video. Please check the URL and try again.');
                }
            }
        });
    },

    /**
     * Extract video ID from YouTube URL
     */
    extractVideoId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }
};

// =============================================================================
// 10. INITIALIZATION
// =============================================================================
function init() {
    // Setup canvas elements
    AppState.canvas = document.getElementById('drawingCanvas');
    AppState.ctx = AppState.canvas.getContext('2d');
    AppState.overlayCanvas = document.getElementById('overlayCanvas');
    AppState.overlayCtx = AppState.overlayCanvas.getContext('2d');
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize drawing styles
    DrawingUtils.updateStyles();
    
    console.log('Tutorial Maker initialized');
}

function setupEventListeners() {
    // Tool buttons
    ['pencil', 'line', 'rectangle', 'circle', 'arrow', 'eraser'].forEach(tool => {
        document.getElementById(tool).addEventListener('click', () => {
            AppState.currentTool = tool;
            AppState.isEraser = (tool === 'eraser');
            DrawingUtils.updateStyles();
            
            // Update active tool UI
            document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active:bg-indigo-500', 'active:border-indigo-600', 'active:text-white'));
            document.getElementById(tool).classList.add('active:bg-indigo-500', 'active:border-indigo-600', 'active:text-white');
        });
    });
    
    // Drawing controls
    document.getElementById('colorPicker').addEventListener('input', (e) => {
        AppState.currentColor = e.target.value;
        DrawingUtils.updateStyles();
    });
    
    document.getElementById('brushSize').addEventListener('input', (e) => {
        AppState.brushSize = e.target.value;
        document.getElementById('sizeValue').textContent = AppState.brushSize + 'px';
        DrawingUtils.updateStyles();
    });
    
    // Action buttons
    document.getElementById('clearCanvas').addEventListener('click', () => CanvasUtils.clear());
    document.getElementById('saveDrawing').addEventListener('click', () => {
        const activeCanvas = CanvasUtils.getActiveCanvas();
        const link = document.createElement('a');
        link.download = 'tutorial-' + new Date().toISOString().slice(0, 10) + '.png';
        link.href = activeCanvas.toDataURL('image/png');
        link.click();
        AppState.isDrawing = false;
    });
    document.getElementById('saveWithTimestamp').addEventListener('click', () => TimestampManager.save());
    document.getElementById('drawModeBtn').addEventListener('click', () => DrawingMode.toggle());
    document.getElementById('closeDrawingBtn').addEventListener('click', () => DrawingMode.close());
    
    // Canvas events
    AppState.overlayCanvas.addEventListener('mousedown', DrawingEvents.start);
    AppState.overlayCanvas.addEventListener('mousemove', DrawingEvents.draw);
    AppState.overlayCanvas.addEventListener('mouseup', DrawingEvents.stop);
    AppState.overlayCanvas.addEventListener('mouseout', DrawingEvents.stop);
    
    // Touch events
    AppState.overlayCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        AppState.overlayCanvas.dispatchEvent(mouseEvent);
    }, { passive: false });
    
    AppState.overlayCanvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        AppState.overlayCanvas.dispatchEvent(mouseEvent);
    }, { passive: false });
    
    AppState.overlayCanvas.addEventListener('touchend', DrawingEvents.stop);
    
    // Video input
    document.getElementById('youtubeUrl').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') YouTubeManager.loadVideo();
    });
    document.getElementById('loadVideo').addEventListener('click', YouTubeManager.loadVideo);
    
    // Window events
    window.addEventListener('resize', CanvasUtils.resize);
}

// YouTube API callback
function onYouTubeIframeAPIReady() {
    YouTubeManager.onAPIReady();
}

// Initialize when page loads
window.addEventListener('load', init);
