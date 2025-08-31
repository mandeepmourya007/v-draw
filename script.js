/**
 * @fileoverview Tutorial Maker - A web application for creating tutorials with drawing capabilities
 * 
 * Main Features:
 * - Draw on YouTube videos with timestamp management
 * - Infinite canvas for additional notes and drawings
 * - Multiple drawing tools (pencil, shapes, text, eraser)
 * - PDF and image support
 * - Auto-save functionality
 * 
 * @version 1.0.0
 * @license MIT
 */

// =============================================================================
// TUTORIAL MAKER - MAIN APPLICATION
// =============================================================================

// =============================================================================
// 1. GLOBAL APPLICATION STATE
// =============================================================================

/**
 * @namespace AppState
 * @description Central state management for the application
 * Tracks all the application state including UI, drawing tools, and media
 */
const AppState = {
        // YouTube Player State
    player: null,           // YouTube IFrame Player instance
    apiReady: false,        // Flag indicating if YouTube API is loaded
    
        // Canvas Elements and Contexts
    canvas: null,           // Main canvas element for video annotations
    ctx: null,              // 2D context for main canvas
    overlayCanvas: null,    // Overlay canvas for temporary drawings
    overlayCtx: null,       // 2D context for overlay canvas
    infiniteCanvas: null,   // Infinite canvas element for free-form notes
    infiniteCtx: null,      // 2D context for infinite canvas
    
        // Page Layout Settings
    a4WidthPercent: 95,     // A4 width as percentage of screen width
    a4HeightPercent: 100,   // A4 height as percentage of screen height
    infiniteHorizontal: false, // Toggle for infinite horizontal expansion mode
    
        // Drawing State
    isDrawing: false,       // Flag indicating if user is currently drawing
    drawingMode: false,     // Flag for drawing mode (video vs infinite canvas)
    infiniteDrawing: false, // Flag for infinite canvas drawing state
    currentTool: 'pencil',  // Currently selected drawing tool
    currentColor: '#ff0000', // Current drawing color
    brushSize: 4,           // Current brush size in pixels
    
        // Text Tool State
    fontSize: 24,           // Current font size for text tool
    fontFamily: 'Arial',    // Current font family for text tool
    isTyping: false,        // Flag indicating if user is currently typing
    currentTextInput: null, // Reference to active text input element
    
        // Drawing Coordinates
    startX: 0,              // Starting X coordinate for current drawing
    startY: 0,              // Starting Y coordinate for current drawing
    
        // Timestamp Management
    timestampedDrawings: [], // Array of drawings with timestamps
    currentTimestamp: null,  // Current video timestamp being viewed
    currentDrawingState: null, // Current drawing state for undo/redo
    
        // PDF Document State
    currentPDF: null,       // PDF.js document instance
    currentPage: 1,         // Currently displayed PDF page (1-based index)
    totalPages: 1,          // Total number of pages in current PDF
    lastUploadPosition: {   // Last position where content was uploaded
        x: 0,               // X coordinate
        y: 0                // Y coordinate
    },
    
        // Laser Tool State
    laserStrokes: [],       // Array to store laser strokes for fade animation
    laserAnimationId: null, // Animation frame ID for laser fade effect
    infiniteLaserCanvas: null, // Temporary canvas for infinite canvas laser strokes
    infiniteLaserCtx: null  // Context for infinite canvas laser overlay
};

// =============================================================================
// 2. LASER FADE UTILITIES
// =============================================================================

/**
 * @namespace LaserUtils
 * @description Handles laser tool fade-out effects
 */
const LaserUtils = {
    /**
     * Add a laser stroke to the fade animation queue
     * @param {Object} stroke - The laser stroke data
     */
    addLaserStroke(stroke) {
        const laserStroke = {
            ...stroke,
            opacity: 1.0,
            createdAt: Date.now(),
            fadeStartTime: Date.now() + 500 // Start fading after 1 second
        };
        
        AppState.laserStrokes.push(laserStroke);
        
        // Start animation if not already running
        if (!AppState.laserAnimationId) {
            this.startFadeAnimation();
        }
    },
    
    /**
     * Start the laser fade animation loop
     */
    startFadeAnimation() {
        const animate = () => {
            const now = Date.now();
            let hasActiveStrokes = false;
            
            // Update opacity for each laser stroke
            AppState.laserStrokes.forEach(stroke => {
                if (now > stroke.fadeStartTime) {
                    const fadeProgress = (now - stroke.fadeStartTime) / 2000; // 2 second fade
                    stroke.opacity = Math.max(0, 1 - fadeProgress);
                }
                if (stroke.opacity > 0) {
                    hasActiveStrokes = true;
                }
            });
            
            // Remove fully faded strokes
            AppState.laserStrokes = AppState.laserStrokes.filter(stroke => stroke.opacity > 0);
            
            // Redraw canvas with fading laser strokes
            this.redrawWithLaserFade();
            
            if (hasActiveStrokes) {
                AppState.laserAnimationId = requestAnimationFrame(animate);
            } else {
                AppState.laserAnimationId = null;
            }
        };
        
        AppState.laserAnimationId = requestAnimationFrame(animate);
    },
    
    /**
     * Redraw canvas with fading laser strokes
     */
    redrawWithLaserFade() {
        // Clear overlay canvas and redraw all active laser strokes with current opacity
        if (AppState.overlayCtx && !AppState.isDrawing) {
            AppState.overlayCtx.clearRect(0, 0, AppState.overlayCanvas.width, AppState.overlayCanvas.height);
            
            AppState.laserStrokes.forEach(stroke => {
                if (stroke.canvas === 'overlay' && stroke.opacity > 0) {
                    this.drawFadingStroke(AppState.overlayCtx, stroke);
                }
            });
        }
        
        // For infinite canvas - draw fading strokes on laser overlay
        if (AppState.infiniteLaserCtx && !AppState.infiniteDrawing && AppState.laserStrokes.some(s => s.canvas === 'infinite' && s.opacity > 0)) {
            // Clear laser overlay and redraw fading strokes
            AppState.infiniteLaserCtx.clearRect(0, 0, AppState.infiniteLaserCanvas.width, AppState.infiniteLaserCanvas.height);
            
            AppState.laserStrokes.forEach(stroke => {
                if (stroke.canvas === 'infinite' && stroke.opacity > 0) {
                    this.drawFadingStroke(AppState.infiniteLaserCtx, stroke);
                }
            });
        }
    },
    
    /**
     * Draw a single fading laser stroke
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} stroke - Stroke data with opacity
     */
    drawFadingStroke(ctx, stroke) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color + Math.floor(stroke.opacity * 128).toString(16).padStart(2, '0');
        ctx.lineWidth = stroke.width;
        ctx.shadowBlur = stroke.shadowBlur * stroke.opacity;
        ctx.shadowColor = stroke.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        if (stroke.points && stroke.points.length > 1) {
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
        }
        ctx.restore();
    }
};

// =============================================================================
// 3. CANVAS UTILITIES
// =============================================================================

/**
 * @namespace CanvasUtils
 * @description Utility functions for canvas manipulation and interaction
 * Handles all canvas-related operations including drawing, resizing, and state management
 */
const CanvasUtils = {
    /**
     * Gets the currently active canvas based on the application state
     * @returns {HTMLCanvasElement} The active canvas element (video or infinite canvas)
     */
    getActiveCanvas() {
        return AppState.drawingMode ? AppState.overlayCanvas : AppState.canvas;
    },

    /**
     * Gets the 2D rendering context for the active canvas
     * @returns {CanvasRenderingContext2D} The 2D rendering context
     */
    getActiveContext() {
        return AppState.drawingMode ? AppState.overlayCtx : AppState.ctx;
    },

    /**
     * Calculates the mouse position relative to the active canvas
     * @param {MouseEvent|TouchEvent} e - The mouse or touch event
     * @returns {Object|null} Object with x and y coordinates, or null if invalid
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
     * Clears the active canvas while preserving dimensions
     * @returns {void}
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
     * Handles window resize events and adjusts canvas dimensions
     * Maintains aspect ratio and redraws content when needed
     * @returns {void}
     */
    resize() {
        const container = AppState.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        // Save current main canvas content before resize
        const imageData = AppState.ctx ? AppState.ctx.getImageData(0, 0, AppState.canvas.width, AppState.canvas.height, { willReadFrequently: true }) : null;
        
        // Resize main canvas
        AppState.canvas.width = rect.width;
        AppState.canvas.height = rect.height;
        
        // Restore content after resize
        if (imageData && AppState.ctx) {
            AppState.ctx.putImageData(imageData, 0, 0);
        }
        
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

/**
 * @namespace DrawingUtils
 * @description Handles all drawing-related functionality
 * Manages different drawing tools, styles, and rendering
 */
const DrawingUtils = {
    /**
     * Updates the drawing styles for the active context
     * Applies current color, line width, and tool-specific styles
     * @returns {void}
     */
    updateStyles() {
        const activeCtx = CanvasUtils.getActiveContext();
        if (!activeCtx) return;
        
        if (AppState.currentTool === 'eraser') {
            activeCtx.globalCompositeOperation = 'destination-out';
            activeCtx.lineWidth = AppState.brushSize * 2;
        } else if (AppState.currentTool === 'laser') {
            activeCtx.globalCompositeOperation = 'source-over';
            activeCtx.strokeStyle = AppState.currentColor + '80'; // 50% transparency
            activeCtx.lineWidth = AppState.brushSize * 0.8;
            activeCtx.shadowBlur = 10;
            activeCtx.shadowColor = AppState.currentColor;
        } else {
            activeCtx.globalCompositeOperation = 'source-over';
            activeCtx.strokeStyle = AppState.currentColor;
            activeCtx.lineWidth = AppState.brushSize;
            activeCtx.shadowBlur = 0;
        }
        
        activeCtx.lineCap = 'round';
        activeCtx.lineJoin = 'round';
        
        // Update cursor if in drawing mode
        this.updateCursor();
    },

    /**
     * Updates the cursor style based on the current tool
     * Provides visual feedback for different drawing tools
     * @returns {void}
     */
    updateCursor() {
        if (!AppState.drawingMode || !AppState.overlayCanvas) return;
        
        const cursors = {
            pencil: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><text y=\'20\' font-size=\'20\'>✏️</text></svg>") 2 20, default',
            line: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><text y=\'20\' font-size=\'20\'>📏</text></svg>") 12 12, default',
            rectangle: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><text y=\'20\' font-size=\'20\'>⬜</text></svg>") 12 12, default',
            circle: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><text y=\'20\' font-size=\'20\'>⭕</text></svg>") 12 12, default',
            arrow: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><text y=\'20\' font-size=\'20\'>➡️</text></svg>") 12 12, default',
            eraser: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><text y=\'20\' font-size=\'20\'>🧽</text></svg>") 12 12, default',
            laser: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><circle cx=\'12\' cy=\'12\' r=\'4\' fill=\'red\' opacity=\'0.8\'><animate attributeName=\'r\' values=\'3;5;3\' dur=\'1s\' repeatCount=\'indefinite\'/></circle></svg>") 12 12, crosshair',
            text: 'text'
        };
        
        AppState.overlayCanvas.style.cursor = cursors[AppState.currentTool] || 'default';
    },

    /**
     * Toggles the visibility of text formatting controls
     * Shows/hides based on whether text tool is selected
     * @returns {void}
     */
    toggleTextControls() {
        const textControls = document.getElementById('textControls');
        if (AppState.currentTool === 'text') {
            textControls.classList.remove('hidden');
        } else {
            textControls.classList.add('hidden');
        }
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
        if (AppState.player ) {
            AppState.player.pauseVideo();
        }
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
        
        // Reset cursor
        AppState.overlayCanvas.style.cursor = 'default';
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
        
        // Save from main canvas (where all drawings are stored permanently)
        const drawingData = AppState.canvas.toDataURL('image/png');
        
        if (existing) {
            // Update existing
            existing.drawingData = drawingData;
            existing.created = new Date().toLocaleString();
            UI.showNotification(`Drawing updated at ${formattedTime}!`);
        } else {
            // Create new
            frame_data =  {
                id: Date.now(),
                time: currentTime,
                timeFormatted: TimeUtils.format(currentTime),
                drawingData: drawingData,
                created: new Date().toLocaleString(),
                videoTimestamp: formattedTime
            }
            AppState.timestampedDrawings.push(frame_data);
            UI.showNotification(`Drawing saved at ${formattedTime}!`);
        }
        
        // If in drawing mode, copy the overlay content to the main canvas before saving
        if (AppState.drawingMode && AppState.overlayCanvas && AppState.canvas) {
            AppState.ctx.drawImage(AppState.overlayCanvas, 0, 0);
        }

        // Close drawing mode if it's active
        if (AppState.drawingMode) {
            DrawingMode.close();
        }

        // Clear the main canvas after a short delay to ensure the drawing is saved
        // and to prevent it from showing when it shouldn't.
        setTimeout(() => {
            if (AppState.ctx) {
                AppState.ctx.clearRect(0, 0, AppState.canvas.width, AppState.canvas.height);
            }
        }, 100);
        
        AppState.currentTimestamp = currentTime;
        AppState.currentDrawingState = null;
        
        this.updateUI();
        
        // Auto-save after saving timestamp
        StorageManager.saveData();
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
        // Always load on main canvas to ensure visibility
        const mainCanvas = AppState.canvas;
        const mainCtx = AppState.ctx;
        
        const img = new Image();
        img.onload = function() {
            mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
            mainCtx.drawImage(img, 0, 0);
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
    checkAndDisplayDrawing(currentTime) {
        const drawing = AppState.timestampedDrawings.find(d => 
            currentTime >= d.time && (AppState.timestampedDrawings.find(next => next.time > d.time && next.time > d.time) ? currentTime < AppState.timestampedDrawings.find(next => next.time > d.time).time : true)
        );

        if (drawing && AppState.currentTimestamp !== drawing.time) {
            this.loadDrawing(drawing.drawingData, drawing.time);
        } else if (!drawing && AppState.currentTimestamp !== null) {
            CanvasUtils.clear();
            AppState.currentTimestamp = null;
        }
    },

    delete(id) {
        AppState.timestampedDrawings = AppState.timestampedDrawings.filter(d => d.id !== id);
        this.updateUI();
        UI.showNotification('Drawing deleted!');
        
        // Auto-save after deleting timestamp
        StorageManager.saveData();
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
// 8. MEDIA HANDLER - IMAGE/FILE MANIPULATION
// =============================================================================

/**
 * @namespace MediaHandler
 * @description Handles interactive manipulation of uploaded media (images, PDFs, videos)
 */
const MediaHandler = {
    // State management
    mediaObjects: [],           // Array of all uploaded media objects
    selectedMedia: null,        // Currently selected media object
    isDragging: false,         // Drag state
    isResizing: false,         // Resize state
    dragStartPos: null,        // Initial drag position
    resizeStartPos: null,      // Initial resize position
    resizeHandleSize: 12,      // Size of resize handles

    /**
     * Initialize media handler
     */
    init() {
        this.setupEventListeners();
        console.log('MediaHandler initialized');
    },

    /**
     * Setup event listeners for media interaction
     */
    setupEventListeners() {
        // Mouse events for desktop
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // Touch events for mobile
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        // Prevent context menu on media objects
        document.addEventListener('contextmenu', (e) => {
            if (this.isMediaElement(e.target) || e.target.classList.contains('media-resize-handle')) {
                e.preventDefault();
            }
        });
    },

    /**
     * Add a new media object to the handler
     * @param {Object} mediaData - Media object data
     */
    addMediaObject(mediaData) {
        const mediaObj = {
            id: 'media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: mediaData.type || 'image',
            x: mediaData.x || 0,
            y: mediaData.y || 0,
            width: mediaData.width || 200,
            height: mediaData.height || 200,
            originalWidth: mediaData.originalWidth || mediaData.width || 200,
            originalHeight: mediaData.originalHeight || mediaData.height || 200,
            src: mediaData.src,
            element: mediaData.element,
            canvas: mediaData.canvas || 'infinite', // 'infinite' or 'overlay'
            aspectRatio: (mediaData.originalWidth || mediaData.width || 200) / (mediaData.originalHeight || mediaData.height || 200)
        };

        this.mediaObjects.push(mediaObj);
        this.makeMediaInteractive(mediaObj);
        return mediaObj;
    },

    /**
     * Make a media object interactive
     * @param {Object} mediaObj - Media object to make interactive
     */
    makeMediaInteractive(mediaObj) {
        if (mediaObj.element) {
            mediaObj.element.style.cursor = 'move';
            mediaObj.element.style.userSelect = 'none';
            mediaObj.element.setAttribute('data-media-id', mediaObj.id);
        }
    },

    /**
     * Check if element is a media element
     * @param {Element} element - Element to check
     * @returns {boolean}
     */
    isMediaElement(element) {
        return element && element.hasAttribute && element.hasAttribute('data-media-id');
    },

    /**
     * Get media object by element
     * @param {Element} element - Element to find media object for
     * @returns {Object|null}
     */
    getMediaByElement(element) {
        if (!this.isMediaElement(element)) return null;
        const mediaId = element.getAttribute('data-media-id');
        return this.mediaObjects.find(obj => obj.id === mediaId);
    },

    /**
     * Handle mouse down events
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseDown(e) {
        // Skip if drawing tool is active (only work with select tool)
        if (AppState.currentTool !== 'select') return;

        // Check if clicking on resize handle first
        if (e.target.classList.contains('media-resize-handle')) {
            e.preventDefault();
            e.stopPropagation();
            
            if (this.selectedMedia) {
                this.startResize(e, this.selectedMedia);
            }
            return;
        }

        const mediaObj = this.getMediaByElement(e.target);
        if (!mediaObj) {
            this.deselectAll();
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        this.selectMedia(mediaObj);
        this.startDrag(e, mediaObj);
    },

    /**
     * Handle mouse move events
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseMove(e) {
        if (this.isDragging && this.selectedMedia) {
            this.updateDrag(e);
        } else if (this.isResizing && this.selectedMedia) {
            this.updateResize(e);
        }
    },

    /**
     * Handle mouse up events
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseUp(e) {
        if (this.isDragging) {
            this.endDrag();
        } else if (this.isResizing) {
            this.endResize();
        }
    },

    /**
     * Handle touch start events
     * @param {TouchEvent} e - Touch event
     */
    handleTouchStart(e) {
        if (e.touches.length === 1) {
            // Single touch - treat as mouse down
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                target: e.target
            });
            this.handleMouseDown(mouseEvent);
        } else if (e.touches.length === 2) {
            // Two finger pinch - start resize
            const mediaObj = this.getMediaByElement(e.target);
            if (mediaObj) {
                this.startPinchResize(e, mediaObj);
            }
        }
    },

    /**
     * Handle touch move events
     * @param {TouchEvent} e - Touch event
     */
    handleTouchMove(e) {
        e.preventDefault();
        
        if (e.touches.length === 1 && this.isDragging) {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.handleMouseMove(mouseEvent);
        } else if (e.touches.length === 2 && this.isResizing) {
            this.updatePinchResize(e);
        }
    },

    /**
     * Handle touch end events
     * @param {TouchEvent} e - Touch event
     */
    handleTouchEnd(e) {
        if (e.touches.length === 0) {
            this.handleMouseUp(e);
        }
    },

    /**
     * Select a media object
     * @param {Object} mediaObj - Media object to select
     */
    selectMedia(mediaObj) {
        this.deselectAll();
        this.selectedMedia = mediaObj;
        this.showResizeHandles(mediaObj);
    },

    /**
     * Deselect all media objects
     */
    deselectAll() {
        this.selectedMedia = null;
        this.hideAllResizeHandles();
    },

    /**
     * Show resize handles for media object
     * @param {Object} mediaObj - Media object to show handles for
     */
    showResizeHandles(mediaObj) {
        if (!mediaObj.element) return;

        // Remove existing handles
        this.hideAllResizeHandles();

        // Create resize handles
        const handles = ['nw', 'ne', 'sw', 'se'];
        handles.forEach(position => {
            const handle = document.createElement('div');
            handle.className = 'media-resize-handle';
            handle.setAttribute('data-position', position);
            handle.style.cssText = `
                position: absolute;
                width: ${this.resizeHandleSize}px;
                height: ${this.resizeHandleSize}px;
                background: #007bff;
                border: 2px solid white;
                border-radius: 50%;
                cursor: ${position}-resize;
                z-index: 1000;
                pointer-events: auto;
            `;
            
            // Position handle
            this.positionResizeHandle(handle, position, mediaObj);
            document.body.appendChild(handle);
            
            // Add event listeners to resize handles
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.startResize(e, mediaObj);
            });
        });
    },

    /**
     * Position a resize handle
     * @param {Element} handle - Handle element
     * @param {string} position - Handle position (nw, ne, sw, se)
     * @param {Object} mediaObj - Media object
     */
    positionResizeHandle(handle, position, mediaObj) {
        const rect = mediaObj.element.getBoundingClientRect();
        const offset = this.resizeHandleSize / 2;

        switch (position) {
            case 'nw':
                handle.style.left = (rect.left - offset) + 'px';
                handle.style.top = (rect.top - offset) + 'px';
                break;
            case 'ne':
                handle.style.left = (rect.right - offset) + 'px';
                handle.style.top = (rect.top - offset) + 'px';
                break;
            case 'sw':
                handle.style.left = (rect.left - offset) + 'px';
                handle.style.top = (rect.bottom - offset) + 'px';
                break;
            case 'se':
                handle.style.left = (rect.right - offset) + 'px';
                handle.style.top = (rect.bottom - offset) + 'px';
                break;
        }
    },

    /**
     * Hide all resize handles
     */
    hideAllResizeHandles() {
        const handles = document.querySelectorAll('.media-resize-handle');
        handles.forEach(handle => handle.remove());
    },

    /**
     * Check if point is on resize handle
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} width - Element width
     * @param {number} height - Element height
     * @returns {boolean}
     */
    isOnResizeHandle(x, y, width, height) {
        const handleSize = this.resizeHandleSize;
        const corners = [
            { x: 0, y: 0 }, // nw
            { x: width, y: 0 }, // ne
            { x: 0, y: height }, // sw
            { x: width, y: height } // se
        ];

        return corners.some(corner => {
            return Math.abs(x - corner.x) <= handleSize && Math.abs(y - corner.y) <= handleSize;
        });
    },

    /**
     * Start dragging
     * @param {MouseEvent} e - Mouse event
     * @param {Object} mediaObj - Media object to drag
     */
    startDrag(e, mediaObj) {
        this.isDragging = true;
        this.dragStartPos = { x: e.clientX, y: e.clientY };
        mediaObj.element.style.cursor = 'grabbing';
    },

    /**
     * Update drag position
     * @param {MouseEvent} e - Mouse event
     */
    updateDrag(e) {
        if (!this.selectedMedia || !this.dragStartPos) return;

        const deltaX = e.clientX - this.dragStartPos.x;
        const deltaY = e.clientY - this.dragStartPos.y;

        const newX = this.selectedMedia.x + deltaX;
        const newY = this.selectedMedia.y + deltaY;

        this.updateMediaPosition(this.selectedMedia, newX, newY);
        this.dragStartPos = { x: e.clientX, y: e.clientY };
    },

    /**
     * End dragging
     */
    endDrag() {
        if (this.selectedMedia) {
            this.selectedMedia.element.style.cursor = 'move';
        }
        this.isDragging = false;
        this.dragStartPos = null;
    },

    /**
     * Start resizing
     * @param {MouseEvent} e - Mouse event
     * @param {Object} mediaObj - Media object to resize
     */
    startResize(e, mediaObj) {
        this.isResizing = true;
        this.resizeStartPos = { x: e.clientX, y: e.clientY };
        this.resizeStartSize = { width: mediaObj.width, height: mediaObj.height };
    },

    /**
     * Update resize
     * @param {MouseEvent} e - Mouse event
     */
    updateResize(e) {
        if (!this.selectedMedia || !this.resizeStartPos) return;

        const deltaX = e.clientX - this.resizeStartPos.x;
        const deltaY = e.clientY - this.resizeStartPos.y;

        // Calculate new size maintaining aspect ratio
        const scaleFactor = 1 + (deltaX + deltaY) / 200;
        const newWidth = Math.max(50, this.resizeStartSize.width * scaleFactor);
        const newHeight = newWidth / this.selectedMedia.aspectRatio;

        this.updateMediaSize(this.selectedMedia, newWidth, newHeight);
        
        // Update resize handles position during resize
        this.showResizeHandles(this.selectedMedia);
    },

    /**
     * End resizing
     */
    endResize() {
        this.isResizing = false;
        this.resizeStartPos = null;
        this.resizeStartSize = null;
    },

    /**
     * Start pinch resize for touch devices
     * @param {TouchEvent} e - Touch event
     * @param {Object} mediaObj - Media object to resize
     */
    startPinchResize(e, mediaObj) {
        this.isResizing = true;
        this.selectMedia(mediaObj);
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        this.initialPinchDistance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) + 
            Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        this.initialSize = { width: mediaObj.width, height: mediaObj.height };
    },

    /**
     * Update pinch resize
     * @param {TouchEvent} e - Touch event
     */
    updatePinchResize(e) {
        if (!this.selectedMedia || !this.initialPinchDistance) return;

        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) + 
            Math.pow(touch2.clientY - touch1.clientY, 2)
        );

        const scaleFactor = currentDistance / this.initialPinchDistance;
        const newWidth = Math.max(50, this.initialSize.width * scaleFactor);
        const newHeight = newWidth / this.selectedMedia.aspectRatio;

        this.updateMediaSize(this.selectedMedia, newWidth, newHeight);
    },

    /**
     * Update media object position
     * @param {Object} mediaObj - Media object to update
     * @param {number} x - New X position
     * @param {number} y - New Y position
     */
    updateMediaPosition(mediaObj, x, y) {
        mediaObj.x = x;
        mediaObj.y = y;

        if (mediaObj.element) {
            mediaObj.element.style.left = x + 'px';
            mediaObj.element.style.top = y + 'px';
        }

        // Update associated label for PDF pages
        if (mediaObj.type === 'pdf-page' && mediaObj.label) {
            mediaObj.label.style.left = x + 'px';
            mediaObj.label.style.top = (y - 20) + 'px';
        }

        // Update resize handles if selected
        if (this.selectedMedia === mediaObj) {
            this.showResizeHandles(mediaObj);
        }
    },

    /**
     * Update media object size
     * @param {Object} mediaObj - Media object to update
     * @param {number} width - New width
     * @param {number} height - New height
     */
    updateMediaSize(mediaObj, width, height) {
        mediaObj.width = width;
        mediaObj.height = height;

        if (mediaObj.element) {
            mediaObj.element.style.width = width + 'px';
            mediaObj.element.style.height = height + 'px';
            
            // For PDF pages, we need to scale the content, not change canvas dimensions
            if (mediaObj.type === 'pdf-page') {
                // Don't change canvas internal dimensions, just CSS scaling
                // The canvas content will be scaled automatically by CSS
            }
        }

        // Update resize handles if selected
        if (this.selectedMedia === mediaObj) {
            this.showResizeHandles(mediaObj);
        }
    },

    /**
     * Remove a media object
     * @param {string} mediaId - ID of media object to remove
     */
    removeMedia(mediaId) {
        const index = this.mediaObjects.findIndex(obj => obj.id === mediaId);
        if (index !== -1) {
            const mediaObj = this.mediaObjects[index];
            
            if (mediaObj.element) {
                mediaObj.element.remove();
            }
            
            // Remove associated label for PDF pages
            if (mediaObj.type === 'pdf-page' && mediaObj.label) {
                mediaObj.label.remove();
            }
            
            if (this.selectedMedia === mediaObj) {
                this.deselectAll();
            }
            
            this.mediaObjects.splice(index, 1);
        }
    },

    /**
     * Get all media objects
     * @returns {Array} Array of media objects
     */
    getAllMedia() {
        return [...this.mediaObjects];
    },

    /**
     * Clear all media objects
     */
    clearAll() {
        this.mediaObjects.forEach(mediaObj => {
            if (mediaObj.element) {
                mediaObj.element.remove();
            }
        });
        this.mediaObjects = [];
        this.deselectAll();
    }
};

// =============================================================================
// 9. DRAWING EVENT HANDLERS
// =============================================================================
const DrawingEvents = {
    /**
     * Start drawing
     */
    start(e) {
        const pos = CanvasUtils.getMousePos(e);
        if (!pos) return;
        
        // Handle text tool differently
        if (AppState.currentTool === 'text') {
            this.handleTextClick(pos.x, pos.y);
            return;
        }
        
        AppState.isDrawing = true;
        AppState.startX = pos.x;
        AppState.startY = pos.y;
        
        CanvasUtils.getActiveCanvas().classList.add('drawing');
        
        if (AppState.currentTool === 'pencil' || AppState.currentTool === 'eraser') {
            // For pencil/eraser, draw on main canvas to preserve drawings
            const mainCtx = AppState.ctx;
            if (AppState.currentTool === 'eraser') {
                mainCtx.globalCompositeOperation = 'destination-out';
                mainCtx.lineWidth = AppState.brushSize * 2;
            } else {
                mainCtx.globalCompositeOperation = 'source-over';
                mainCtx.strokeStyle = AppState.currentColor;
                mainCtx.lineWidth = AppState.brushSize;
                mainCtx.shadowBlur = 0;
            }
            mainCtx.lineCap = 'round';
            mainCtx.lineJoin = 'round';
            mainCtx.beginPath();
            mainCtx.moveTo(pos.x, pos.y);
        } else if (AppState.currentTool === 'laser') {
            // For laser tool, initialize stroke data and draw on overlay only
            AppState.currentLaserStroke = {
                points: [{x: pos.x, y: pos.y}],
                color: AppState.currentColor,
                width: AppState.brushSize * 1.5,
                shadowBlur: 10,
                canvas: AppState.drawingMode ? 'overlay' : 'main'
            };
            
            // Clear overlay and set up for laser drawing
            const overlayCtx = AppState.overlayCtx;
            overlayCtx.clearRect(0, 0, AppState.overlayCanvas.width, AppState.overlayCanvas.height);
            overlayCtx.globalCompositeOperation = 'source-over';
            overlayCtx.strokeStyle = AppState.currentColor + '80';
            overlayCtx.lineWidth = AppState.brushSize * 1.5;
            overlayCtx.shadowBlur = 10;
            overlayCtx.shadowColor = AppState.currentColor;
            overlayCtx.lineCap = 'round';
            overlayCtx.lineJoin = 'round';
            overlayCtx.beginPath();
            overlayCtx.moveTo(pos.x, pos.y);
        }
    },

    /**
     * Continue drawing
     */
    draw(e) {
        if (!AppState.isDrawing) return;
        
        const pos = CanvasUtils.getMousePos(e);
        if (!pos) return;
        
        if (AppState.currentTool === 'pencil' || AppState.currentTool === 'eraser') {
            // Draw on main canvas to preserve drawings
            const mainCtx = AppState.ctx;
            mainCtx.lineTo(pos.x, pos.y);
            mainCtx.stroke();
        } else if (AppState.currentTool === 'laser') {
            // For laser tool, add point to current stroke and draw on overlay
            if (AppState.currentLaserStroke) {
                AppState.currentLaserStroke.points.push({x: pos.x, y: pos.y});
            }
            
            // Draw on overlay canvas for temporary effect
            const overlayCtx = AppState.overlayCtx;
            overlayCtx.lineTo(pos.x, pos.y);
            overlayCtx.stroke();
        } else {
            // Show preview for shape tools
            this.drawPreview(pos.x, pos.y);
        }
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
        
        // Handle laser stroke completion
        if (AppState.currentTool === 'laser' && AppState.currentLaserStroke) {
            // Add final point and trigger fade effect
            AppState.currentLaserStroke.points.push({x: pos.x, y: pos.y});
            LaserUtils.addLaserStroke(AppState.currentLaserStroke);
            AppState.currentLaserStroke = null;
            
            // Clear the overlay canvas immediately to remove the temporary laser stroke
            if (AppState.overlayCtx) {
                AppState.overlayCtx.clearRect(0, 0, AppState.overlayCanvas.width, AppState.overlayCanvas.height);
            }
        }
        
        // Draw shapes on mouse up
        if (AppState.currentTool !== 'pencil' && AppState.currentTool !== 'eraser' && AppState.currentTool !== 'laser') {
            // Clear preview from overlay
            AppState.overlayCtx.clearRect(0, 0, AppState.overlayCanvas.width, AppState.overlayCanvas.height);
            
            // Draw final shape on main canvas
            const mainCtx = AppState.ctx;
            
            // Set styles on main canvas
            mainCtx.strokeStyle = AppState.currentColor;
            mainCtx.lineWidth = AppState.brushSize;
            mainCtx.lineCap = 'round';
            mainCtx.lineJoin = 'round';
            mainCtx.globalCompositeOperation = 'source-over';
            
            switch (AppState.currentTool) {
                case 'line':
                    mainCtx.beginPath();
                    mainCtx.moveTo(AppState.startX, AppState.startY);
                    mainCtx.lineTo(pos.x, pos.y);
                    mainCtx.stroke();
                    break;
                case 'rectangle':
                    const width = pos.x - AppState.startX;
                    const height = pos.y - AppState.startY;
                    mainCtx.strokeRect(AppState.startX, AppState.startY, width, height);
                    break;
                case 'circle':
                    const radius = Math.sqrt(Math.pow(pos.x - AppState.startX, 2) + Math.pow(pos.y - AppState.startY, 2));
                    mainCtx.beginPath();
                    mainCtx.arc(AppState.startX, AppState.startY, radius, 0, Math.PI * 2);
                    mainCtx.stroke();
                    break;
                case 'arrow':
                    const headlen = 15;
                    const angle = Math.atan2(pos.y - AppState.startY, pos.x - AppState.startX);
                    
                    // Main line
                    mainCtx.beginPath();
                    mainCtx.moveTo(AppState.startX, AppState.startY);
                    mainCtx.lineTo(pos.x, pos.y);
                    mainCtx.stroke();
                    
                    // Arrowhead
                    mainCtx.beginPath();
                    mainCtx.moveTo(pos.x, pos.y);
                    mainCtx.lineTo(pos.x - headlen * Math.cos(angle - Math.PI / 6), pos.y - headlen * Math.sin(angle - Math.PI / 6));
                    mainCtx.moveTo(pos.x, pos.y);
                    mainCtx.lineTo(pos.x - headlen * Math.cos(angle + Math.PI / 6), pos.y - headlen * Math.sin(angle + Math.PI / 6));
                    mainCtx.stroke();
                    break;
            }
            
            // Auto-save after drawing completion
            setTimeout(() => StorageManager.saveData(), 100);
        }
    },

    /**
     * Draw preview for shape tools
     */
    drawPreview(currentX, currentY) {
        if (!AppState.overlayCtx) return;
        
        // Clear overlay canvas and copy main canvas content to show all previous drawings
        AppState.overlayCtx.clearRect(0, 0, AppState.overlayCanvas.width, AppState.overlayCanvas.height);
        
        // Always copy main canvas content to overlay to show all persistent drawings
        if (AppState.ctx && AppState.canvas.width > 0 && AppState.canvas.height > 0) {
            AppState.overlayCtx.drawImage(AppState.canvas, 0, 0);
        }
        
        // Set preview styles for the current shape being drawn
        AppState.overlayCtx.strokeStyle = AppState.currentColor;
        AppState.overlayCtx.lineWidth = AppState.brushSize;
        AppState.overlayCtx.lineCap = 'round';
        AppState.overlayCtx.lineJoin = 'round';
        AppState.overlayCtx.globalAlpha = 0.7; // Semi-transparent preview
        AppState.overlayCtx.globalCompositeOperation = 'source-over';
        
        // Draw preview shape
        switch (AppState.currentTool) {
            case 'line':
                AppState.overlayCtx.beginPath();
                AppState.overlayCtx.moveTo(AppState.startX, AppState.startY);
                AppState.overlayCtx.lineTo(currentX, currentY);
                AppState.overlayCtx.stroke();
                break;
            case 'rectangle':
                const width = currentX - AppState.startX;
                const height = currentY - AppState.startY;
                AppState.overlayCtx.strokeRect(AppState.startX, AppState.startY, width, height);
                break;
            case 'circle':
                const radius = Math.sqrt(Math.pow(currentX - AppState.startX, 2) + Math.pow(currentY - AppState.startY, 2));
                AppState.overlayCtx.beginPath();
                AppState.overlayCtx.arc(AppState.startX, AppState.startY, radius, 0, 2 * Math.PI);
                AppState.overlayCtx.stroke();
                break;
            case 'arrow':
                this.drawArrowPreview(AppState.startX, AppState.startY, currentX, currentY);
                break;
        }
        
        // Reset alpha and composite operation
        AppState.overlayCtx.globalAlpha = 1.0;
        AppState.overlayCtx.globalCompositeOperation = 'source-over';
    },

    /**
     * Draw arrow preview
     */
    drawArrowPreview(startX, startY, endX, endY) {
        const headLength = 20;
        const angle = Math.atan2(endY - startY, endX - startX);
        
        AppState.overlayCtx.beginPath();
        // Arrow line
        AppState.overlayCtx.moveTo(startX, startY);
        AppState.overlayCtx.lineTo(endX, endY);
        
        // Arrow head
        AppState.overlayCtx.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), endY - headLength * Math.sin(angle - Math.PI / 6));
        AppState.overlayCtx.moveTo(endX, endY);
        AppState.overlayCtx.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), endY - headLength * Math.sin(angle + Math.PI / 6));
        AppState.overlayCtx.stroke();
    },

    /**
     * Handle text tool click
     */
    handleTextClick(x, y) {
        console.log(`Text tool clicked at (${x}, ${y})`);
        
        // Remove any existing text input
        this.removeTextInput();
        
        // Create text input element
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.style.position = 'fixed';
        textInput.style.backgroundColor = 'white';
        textInput.style.border = '2px solid #3b82f6';
        textInput.style.outline = 'none';
        textInput.style.padding = '4px 8px';
        textInput.style.zIndex = '9999';
        textInput.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        textInput.style.borderRadius = '4px';
        textInput.style.fontSize = AppState.fontSize + 'px';
        textInput.style.fontFamily = AppState.fontFamily;
        textInput.style.color = AppState.currentColor;
        textInput.style.minWidth = '150px';
        textInput.style.height = 'auto';
        textInput.placeholder = 'Type text...';
        textInput.autocomplete = 'off';
        textInput.spellcheck = false;
        
        // Position relative to the active canvas
        const activeCanvas = CanvasUtils.getActiveCanvas();
        const canvasRect = activeCanvas.getBoundingClientRect();
        const screenX = canvasRect.left + x * (canvasRect.width / activeCanvas.width);
        const screenY = canvasRect.top + y * (canvasRect.height / activeCanvas.height);
        
        textInput.style.left = screenX + 'px';
        textInput.style.top = screenY + 'px';
        
        console.log(`Text input positioned at screen coordinates (${screenX}, ${screenY})`);
        
        // Add to document
        document.body.appendChild(textInput);
        AppState.currentTextInput = textInput;
        AppState.isTyping = true;
        
        // Force focus with delay to ensure element is rendered
        setTimeout(() => {
            textInput.focus();
            textInput.select();
            console.log('Text input focused and selected');
        }, 10);
        
        // Handle text completion
        const completeText = () => {
            const text = textInput.value.trim();
            console.log(`Completing text: "${text}"`);
            if (text) {
                this.drawText(text, x, y);
            }
            this.removeTextInput();
        };
        
        // Event listeners
        textInput.addEventListener('blur', completeText);
        textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                completeText();
            } else if (e.key === 'Escape') {
                this.removeTextInput();
            }
        });
    },

    /**
     * Draw text on canvas
     */
    drawText(text, x, y) {
        // Always draw on main canvas for persistence
        const mainCtx = AppState.ctx;
        if (mainCtx) {
            mainCtx.font = `${AppState.fontSize}px ${AppState.fontFamily}`;
            mainCtx.fillStyle = AppState.currentColor;
            mainCtx.textBaseline = 'top';
            mainCtx.fillText(text, x, y);
        }
        
        // If in drawing mode, also draw on overlay for immediate visibility
        if (AppState.drawingMode && AppState.overlayCtx) {
            AppState.overlayCtx.font = `${AppState.fontSize}px ${AppState.fontFamily}`;
            AppState.overlayCtx.fillStyle = AppState.currentColor;
            AppState.overlayCtx.textBaseline = 'top';
            AppState.overlayCtx.fillText(text, x, y);
        }
        
        console.log(`Drawing text: "${text}" at (${x}, ${y}) with font ${AppState.fontSize}px ${AppState.fontFamily}`);
    },

    /**
     * Remove text input element
     */
    removeTextInput() {
        if (AppState.currentTextInput) {
            document.body.removeChild(AppState.currentTextInput);
            AppState.currentTextInput = null;
            AppState.isTyping = false;
        }
    }
};

// =============================================================================
// 9. YOUTUBE INTEGRATION
// =============================================================================

/**
 * @namespace YouTubeManager
 * @description Handles all YouTube video player functionality
 * Manages video loading, playback control, and timestamp synchronization
 */
const YouTubeManager = {
    /**
     * Callback when YouTube API is loaded and ready
     * Initializes the YouTube player with default settings
     * @returns {void}
     */
    onAPIReady() {
        AppState.apiReady = true;
        console.log('YouTube API is ready');
    },

    /**
     * Show loading state
     */
    showLoader() {
        document.getElementById('videoPlaceholder').classList.add('hidden');
        document.getElementById('videoError').classList.add('hidden');
        document.getElementById('videoLoader').classList.remove('hidden');
    },

    /**
     * Show error state
     */
    showError(message = 'Please check the URL and try again') {
        document.getElementById('videoPlaceholder').classList.add('hidden');
        document.getElementById('videoLoader').classList.add('hidden');
        document.getElementById('videoError').classList.remove('hidden');
        document.getElementById('errorMessage').textContent = message;
    },

    /**
     * Hide all states (when video loads successfully)
     */
    hideStates() {
        document.getElementById('videoPlaceholder').classList.add('hidden');
        document.getElementById('videoLoader').classList.add('hidden');
        document.getElementById('videoError').classList.add('hidden');
    },

    /**
     * Show placeholder state
     */
    showPlaceholder() {
        document.getElementById('videoLoader').classList.add('hidden');
        document.getElementById('videoError').classList.add('hidden');
        document.getElementById('videoPlaceholder').classList.remove('hidden');
    },

    /**
     * Loads a YouTube video from the provided URL
     * Validates URL, extracts video ID, and initializes player
     * @returns {void}
     */
    loadVideo() {
        const url = document.getElementById('youtubeUrl').value.trim();
        
        if (!url) {
            this.showError('Please enter a YouTube URL');
            return;
        }
        
        const videoId = this.extractVideoId(url);
        if (!videoId) {
            this.showError('Invalid YouTube URL format. Please check the URL and try again.');
            return;
        }

        // Show loading state
        this.showLoader();

        if (!AppState.apiReady) {
            setTimeout(() => this.loadVideo(), 100);
            return;
        }
        
        // Clear previous player content but keep the state containers
        const playerDiv = document.getElementById('player');
        const existingIframe = playerDiv.querySelector('iframe');
        if (existingIframe) {
            existingIframe.remove();
        }
        
        if (!AppState.player) {
            this.createPlayer(videoId);
        } else {
            AppState.player.loadVideoById(videoId);
        }
        
        CanvasUtils.clear();
    },

    /**
     * Creates and initializes a YouTube player instance
     * @param {string} videoId - The YouTube video ID to load
     * @returns {void}
     */
    createPlayer(videoId) {
        // Create a temporary div for the player
        const tempDiv = document.createElement('div');
        tempDiv.id = 'temp-player';
        document.getElementById('player').appendChild(tempDiv);
        
        AppState.player = new YT.Player('temp-player', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'playsinline': 1,
                'rel': 0,
                'controls': 1,
                'enablejsapi': 1,
                'origin': window.location.protocol + '//' + window.location.host
            },
            events: {
                'onReady': (event) => {
                    console.log('Player is ready');
                    this.hideStates();
                    CanvasUtils.resize();
                    event.target.playVideo();
                    
                    // Start time update interval
                    this.startTimeUpdater();
                    
                    UI.showNotification('Video loaded successfully!');
                },
                'onStateChange': (event) => {
                    if (event.data === YT.PlayerState.PLAYING) {
                        // Start an interval to check the time and display drawings
                        if (this.timeUpdateInterval) clearInterval(this.timeUpdateInterval);
                        this.timeUpdateInterval = setInterval(() => {
                            const currentTime = AppState.player.getCurrentTime();
                            TimestampManager.checkAndDisplayDrawing(currentTime);
                        }, 250); // Check every 250ms
                    } else {
                        // Clear the interval when video is not playing
                        if (this.timeUpdateInterval) clearInterval(this.timeUpdateInterval);
                    }
                },
                'onError': (event) => {
                    console.error('YouTube Player Error:', event.data);
                    let errorMessage = 'Error loading video. Please check the URL and try again.';
                    
                    switch(event.data) {
                        case 2:
                            errorMessage = 'Invalid video ID. Please check the YouTube URL.';
                            break;
                        case 5:
                            errorMessage = 'Video cannot be played in HTML5 player.';
                            break;
                        case 100:
                            errorMessage = 'Video not found. It may have been removed or is private.';
                            break;
                        case 101:
                        case 150:
                            errorMessage = 'Video owner has restricted playback on other websites.';
                            break;
                        default:
                            errorMessage = 'Unknown error occurred while loading the video.';
                    }
                    
                    this.showError(errorMessage);
                }
            }
        });
    },

    /**
     * Starts the interval that updates the current video timestamp
     * Enables timestamp-based drawing synchronization
     * @returns {void}
     */
    startTimeUpdater() {
        // Clear any existing interval
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
        }
        
        // Update time every second
        this.timeUpdateInterval = setInterval(() => {
            if (AppState.player && typeof AppState.player.getCurrentTime === 'function') {
                try {
                    const currentTime = AppState.player.getCurrentTime();
                    const duration = AppState.player.getDuration();
                    
                    // Update time display
                    const currentTimeElement = document.getElementById('currentTime');
                    const totalTimeElement = document.getElementById('totalTime');
                    
                    if (currentTimeElement) {
                        currentTimeElement.textContent = TimeUtils.format(currentTime || 0);
                    }
                    if (totalTimeElement) {
                        totalTimeElement.textContent = TimeUtils.format(duration || 0);
                    }
                } catch (error) {
                    console.log('Time update error:', error);
                }
            }
        }, 1000);
    },

    /**
     * Extracts the YouTube video ID from various URL formats
     * Supports multiple YouTube URL patterns (short, long, embed, etc.)
     * @param {string} url - The YouTube URL to parse
     * @returns {string|null} The extracted video ID or null if invalid
     */
    extractVideoId(url) {
        // Handle different YouTube URL formats including share parameters
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^#&?]*)/,
            /youtube\.com\/v\/([^#&?]*)/,
            /youtube\.com\/user\/[^\/]*#[^\/]*\/[^\/]*\/[^\/]*\/([^#&?]*)/,
            /youtube\.com\/.*[?&]v=([^#&?]*)/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1] && match[1].length === 11) {
                return match[1];
            }
        }
        
        return null;
    }
};

// =============================================================================
// 10. INFINITE CANVAS MANAGEMENT
// =============================================================================
const InfiniteCanvas = {
    /**
     * Calculate A4 dimensions based on screen size
     */
    calculateA4Dimensions() {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        return {
            width: Math.floor((screenWidth * AppState.a4WidthPercent) / 100),
            height: Math.floor((screenHeight * AppState.a4HeightPercent) / 100)
        };
    },

    /**
     * Initialize infinite canvas
     */
    init() {
        AppState.infiniteCanvas = document.getElementById('infiniteCanvas');
        if (AppState.infiniteCanvas) {
            AppState.infiniteCtx = AppState.infiniteCanvas.getContext('2d', { willReadFrequently: true });
            
            // Set initial canvas size based on screen percentage
            const dimensions = this.calculateA4Dimensions();
            AppState.infiniteCanvas.width = dimensions.width;
            AppState.infiniteCanvas.height = dimensions.height;
            
            this.setupEventListeners();
            this.updateStyles();
            this.drawPageSeparators();
        }
    },

    /**
     * Setup event listeners for infinite canvas
     */
    setupEventListeners() {
        if (!AppState.infiniteCanvas) return;

        const container = document.getElementById('infiniteCanvasContainer');
        
        // Mouse events
        AppState.infiniteCanvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        AppState.infiniteCanvas.addEventListener('mousemove', (e) => this.draw(e));
        AppState.infiniteCanvas.addEventListener('mouseup', (e) => this.stopDrawing(e));
        AppState.infiniteCanvas.addEventListener('mouseout', (e) => this.stopDrawing(e));

        // Setup event listeners for infinite canvas
        if (container) {
            container.addEventListener('scroll', () => this.checkAndExpand());
        }

        // Window resize listener to recalculate dimensions
        window.addEventListener('resize', () => this.handleResize());

        // Touch events for mobile
        AppState.infiniteCanvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.startDrawing(mouseEvent);
        });

        AppState.infiniteCanvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.draw(mouseEvent);
        });

        AppState.infiniteCanvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            this.stopDrawing(mouseEvent);
        });

        // Button events
        document.getElementById('infiniteCanvasClear')?.addEventListener('click', () => this.clear());
        document.getElementById('infiniteCanvasSave')?.addEventListener('click', () => this.save());
        document.getElementById('toggleHorizontal')?.addEventListener('click', () => this.toggleHorizontalExpansion());
        document.getElementById('uploadFile')?.addEventListener('click', () => this.triggerFileUpload());
        document.getElementById('prevPage')?.addEventListener('click', () => this.previousPage());
        document.getElementById('nextPage')?.addEventListener('click', () => this.nextPage());
    },

    /**
     * Trigger file upload dialog
     */
    triggerFileUpload() {
        const fileInput = document.getElementById('fileInput');
        fileInput.click();
        
        // Add event listener for file selection
        fileInput.onchange = (e) => this.handleFileUpload(e);
    },

    /**
     * Handle file upload (images and PDFs)
     */
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const fileType = file.type;
        
        if (fileType.startsWith('image/')) {
            this.loadImage(file);
        } else if (fileType === 'application/pdf') {
            this.loadPDF(file);
        } else {
            UI.showNotification('Please select an image or PDF file');
        }
        
        // Clear the input so the same file can be selected again
        event.target.value = '';
    },

    /**
     * Load and display image on canvas
     */
    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Calculate position to place image (top-left of current view)
                const container = document.getElementById('infiniteCanvasContainer');
                const scrollTop = container.scrollTop;
                const scrollLeft = container.scrollLeft;
                
                // Store position for potential page navigation
                AppState.lastUploadPosition = { x: scrollLeft + 20, y: scrollTop + 20 };
                
                // Create interactive image element instead of drawing on canvas
                const imgElement = document.createElement('img');
                imgElement.src = e.target.result;
                imgElement.style.cssText = `
                    position: absolute;
                    left: ${AppState.lastUploadPosition.x}px;
                    top: ${AppState.lastUploadPosition.y}px;
                    width: ${img.width}px;
                    height: ${img.height}px;
                    z-index: 50;
                    user-select: none;
                    pointer-events: auto;
                `;
                
                // Add to canvas container
                container.appendChild(imgElement);
                
                // Register with MediaHandler for interaction
                const mediaObj = MediaHandler.addMediaObject({
                    type: 'image',
                    x: AppState.lastUploadPosition.x,
                    y: AppState.lastUploadPosition.y,
                    width: img.width,
                    height: img.height,
                    originalWidth: img.width,
                    originalHeight: img.height,
                    src: e.target.result,
                    element: imgElement,
                    canvas: 'infinite'
                });
                
                // Expand canvas if needed
                this.expandCanvasIfNeeded(AppState.lastUploadPosition.x + img.width + 20, AppState.lastUploadPosition.y + img.height + 20);
                
                // Hide page controls for single images
                this.hidePageControls();
                
                UI.showNotification(`Image loaded: ${file.name} - Use Select tool (👆) to move/resize`);
                
                // Auto-save after loading
                setTimeout(() => StorageManager.saveData(), 100);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    /**
     * Load and display PDF on canvas (first page only)
     */
    loadPDF(file) {
        if (typeof pdfjsLib === 'undefined') {
            UI.showNotification('PDF.js library not loaded. Please refresh the page.');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const typedArray = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument(typedArray).promise;
                
                // Store PDF reference and page info
                AppState.currentPDF = pdf;
                AppState.totalPages = pdf.numPages;
                
                // Calculate starting position to place PDF
                const container = document.getElementById('infiniteCanvasContainer');
                const scrollTop = container.scrollTop;
                const scrollLeft = container.scrollLeft;
                AppState.lastUploadPosition = { x: scrollLeft + 20, y: scrollTop + 20 };
                
                // Render all pages vertically
                await this.renderAllPDFPages();
                
                // Hide page controls since we show all pages
                this.hidePageControls();
                
                UI.showNotification(`PDF loaded: ${file.name} (${pdf.numPages} pages) - Use Select tool (👆) to move/resize pages`);
                
                // Auto-save after loading
                setTimeout(() => StorageManager.saveData(), 100);
                
            } catch (error) {
                console.error('Error loading PDF:', error);
                UI.showNotification('Failed to load PDF. Please try again.');
            }
        };
        reader.readAsArrayBuffer(file);
    },

    /**
     * Render all PDF pages vertically
     */
    async renderAllPDFPages() {
        if (!AppState.currentPDF) return;

        try {
            const container = document.getElementById('infiniteCanvasContainer');
            let currentY = AppState.lastUploadPosition.y;
            const startX = AppState.lastUploadPosition.x;
            let maxWidth = 0;
            
            // Render each page vertically as interactive elements
            for (let pageNum = 1; pageNum <= AppState.totalPages; pageNum++) {
                const page = await AppState.currentPDF.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.5 });
                
                // Create temporary canvas for PDF rendering
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = viewport.width;
                tempCanvas.height = viewport.height;
                
                // Render PDF page to temporary canvas
                await page.render({
                    canvasContext: tempCtx,
                    viewport: viewport
                }).promise;
                
                // Create page label
                const pageLabel = document.createElement('div');
                pageLabel.textContent = `Page ${pageNum}`;
                pageLabel.style.cssText = `
                    position: absolute;
                    left: ${startX}px;
                    top: ${currentY - 20}px;
                    font-size: 14px;
                    color: #666;
                    font-family: Arial;
                    z-index: 40;
                    pointer-events: none;
                `;
                container.appendChild(pageLabel);
                
                // Create interactive PDF page element
                const pdfPageElement = document.createElement('canvas');
                pdfPageElement.width = viewport.width;
                pdfPageElement.height = viewport.height;
                pdfPageElement.style.cssText = `
                    position: absolute;
                    left: ${startX}px;
                    top: ${currentY}px;
                    width: ${viewport.width}px;
                    height: ${viewport.height}px;
                    z-index: 50;
                    user-select: none;
                    pointer-events: auto;
                    border: 1px solid #ddd;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                `;
                
                // Draw PDF content to the page element
                const pageCtx = pdfPageElement.getContext('2d');
                pageCtx.drawImage(tempCanvas, 0, 0);
                
                // Add to canvas container
                container.appendChild(pdfPageElement);
                
                // Register with MediaHandler for interaction
                const mediaObj = MediaHandler.addMediaObject({
                    type: 'pdf-page',
                    x: startX,
                    y: currentY,
                    width: viewport.width,
                    height: viewport.height,
                    originalWidth: viewport.width,
                    originalHeight: viewport.height,
                    element: pdfPageElement,
                    canvas: 'infinite',
                    pageNumber: pageNum,
                    label: pageLabel
                });
                
                // Update position for next page (add some spacing)
                currentY += viewport.height + 30;
                maxWidth = Math.max(maxWidth, viewport.width);
            }
            
            // Expand canvas to fit all pages
            this.expandCanvasIfNeeded(
                startX + maxWidth + 20,
                currentY + 20
            );
            
        } catch (error) {
            console.error('Error rendering PDF pages:', error);
            UI.showNotification('Failed to render PDF pages');
        }
    },

    /**
     * Navigate to previous page (deprecated - now shows all pages)
     */
    previousPage() {
        // No longer needed since all pages are shown vertically
        UI.showNotification('All PDF pages are displayed vertically. Scroll to navigate.');
    },

    /**
     * Navigate to next page (deprecated - now shows all pages)
     */
    nextPage() {
        // No longer needed since all pages are shown vertically
        UI.showNotification('All PDF pages are displayed vertically. Scroll to navigate.');
    },

    /**
     * Show page navigation controls
     */
    showPageControls() {
        const controls = document.getElementById('pageControls');
        if (controls) {
            controls.style.display = 'flex';
            this.updatePageInfo();
        }
    },

    /**
     * Hide page navigation controls
     */
    hidePageControls() {
        const controls = document.getElementById('pageControls');
        if (controls) {
            controls.style.display = 'none';
        }
        
        // Reset PDF state
        AppState.currentPDF = null;
        AppState.currentPage = 1;
        AppState.totalPages = 1;
    },

    /**
     * Update page info display
     */
    updatePageInfo() {
        const pageInfo = document.getElementById('pageInfo');
        if (pageInfo) {
            pageInfo.textContent = `${AppState.currentPage}/${AppState.totalPages}`;
        }
    },

    /**
     * Get mouse position relative to infinite canvas
     */
    getMousePos(e) {
        if (!AppState.infiniteCanvas) return null;
        
        const rect = AppState.infiniteCanvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches?.[0]?.clientX);
        const clientY = e.clientY || (e.touches?.[0]?.clientY);
        
        if (!clientX || !clientY) return null;
        
        return {
            x: (clientX - rect.left) * (AppState.infiniteCanvas.width / rect.width),
            y: (clientY - rect.top) * (AppState.infiniteCanvas.height / rect.height)
        };
    },

    /**
     * Handle window resize - recalculate canvas dimensions
     */
    handleResize() {
        if (!AppState.infiniteCanvas) return;
        
        const dimensions = this.calculateA4Dimensions();
        const oldWidth = AppState.infiniteCanvas.width;
        const oldHeight = AppState.infiniteCanvas.height;
        
        // Only resize if dimensions changed significantly
        if (Math.abs(dimensions.width - oldWidth) > 10 || Math.abs(dimensions.height - oldHeight) > 10) {
            // Save current content
            const imageData = AppState.infiniteCtx.getImageData(0, 0, oldWidth, oldHeight);
            
            // Resize canvas
            AppState.infiniteCanvas.width = dimensions.width;
            AppState.infiniteCanvas.height = dimensions.height;
            
            // Restore content
            AppState.infiniteCtx.putImageData(imageData, 0, 0);
            
            // Redraw separators and update styles
            this.drawPageSeparators();
            this.updateStyles();
        }
    },

    /**
     * Redraw separators on top of content
     */
    redrawSeparators() {
        this.drawPageSeparators();
    },

    /**
     * Start drawing on infinite canvas
     */
    startDrawing(e) {
        if (!AppState.infiniteCanvas) return;
        
        const pos = this.getMousePos(e);
        if (!pos) return;
        
        // Handle text tool differently
        if (AppState.currentTool === 'text') {
            this.handleInfiniteTextClick(pos.x, pos.y);
            return;
        }
        
        AppState.infiniteDrawing = true;
        AppState.startX = pos.x;
        AppState.startY = pos.y;
        
        AppState.infiniteCanvas.classList.add('drawing');
        
        if (AppState.currentTool === 'pencil' || AppState.currentTool === 'eraser') {
            this.updateStyles(); // Apply correct styles before drawing
            AppState.infiniteCtx.beginPath();
            AppState.infiniteCtx.moveTo(pos.x, pos.y);
        } else if (AppState.currentTool === 'laser') {
            // For laser tool, initialize stroke data and use temporary overlay
            AppState.currentInfiniteLaserStroke = {
                points: [{x: pos.x, y: pos.y}],
                color: AppState.currentColor,
                width: AppState.brushSize * 1.5,
                shadowBlur: 10,
                canvas: 'infinite'
            };
            
            // Create temporary laser overlay if it doesn't exist
            if (!AppState.infiniteLaserCanvas) {
                AppState.infiniteLaserCanvas = document.createElement('canvas');
                AppState.infiniteLaserCanvas.width = AppState.infiniteCanvas.width;
                AppState.infiniteLaserCanvas.height = AppState.infiniteCanvas.height;
                AppState.infiniteLaserCanvas.style.position = 'absolute';
                AppState.infiniteLaserCanvas.style.top = '0';
                AppState.infiniteLaserCanvas.style.left = '0';
                AppState.infiniteLaserCanvas.style.pointerEvents = 'none';
                AppState.infiniteLaserCanvas.style.zIndex = '100';
                AppState.infiniteCanvas.parentElement.appendChild(AppState.infiniteLaserCanvas);
                AppState.infiniteLaserCtx = AppState.infiniteLaserCanvas.getContext('2d');
            }
            
            // Clear overlay and set laser styles
            AppState.infiniteLaserCtx.clearRect(0, 0, AppState.infiniteLaserCanvas.width, AppState.infiniteLaserCanvas.height);
            AppState.infiniteLaserCtx.globalCompositeOperation = 'source-over';
            AppState.infiniteLaserCtx.strokeStyle = AppState.currentColor + '80';
            AppState.infiniteLaserCtx.lineWidth = AppState.brushSize * 1.5;
            AppState.infiniteLaserCtx.shadowBlur = 10;
            AppState.infiniteLaserCtx.shadowColor = AppState.currentColor;
            AppState.infiniteLaserCtx.lineCap = 'round';
            AppState.infiniteLaserCtx.lineJoin = 'round';
            AppState.infiniteLaserCtx.beginPath();
            AppState.infiniteLaserCtx.moveTo(pos.x, pos.y);
        }
    },

    /**
     * Continue drawing on infinite canvas
     */
    draw(e) {
        if (!AppState.infiniteDrawing) return;
        
        const pos = this.getMousePos(e);
        if (!pos) return;

        if (AppState.currentTool === 'pencil' || AppState.currentTool === 'eraser') {
            AppState.infiniteCtx.lineTo(pos.x, pos.y);
            AppState.infiniteCtx.stroke();
        } else if (AppState.currentTool === 'laser') {
            // For laser tool, add point to current stroke and draw on overlay
            if (AppState.currentInfiniteLaserStroke) {
                AppState.currentInfiniteLaserStroke.points.push({x: pos.x, y: pos.y});
            }
            
            // Draw on laser overlay canvas
            if (AppState.infiniteLaserCtx) {
                AppState.infiniteLaserCtx.lineTo(pos.x, pos.y);
                AppState.infiniteLaserCtx.stroke();
            }
        }
    },

    /**
     * Stop drawing on infinite canvas
     */
    stopDrawing(e) {
        if (!AppState.infiniteDrawing) return;
        
        AppState.infiniteDrawing = false;
        
        const pos = this.getMousePos(e);
        if (!pos) return;

        // Handle laser stroke completion for infinite canvas
        if (AppState.currentTool === 'laser' && AppState.currentInfiniteLaserStroke) {
            // Add final point and trigger fade effect
            AppState.currentInfiniteLaserStroke.points.push({x: pos.x, y: pos.y});
            LaserUtils.addLaserStroke(AppState.currentInfiniteLaserStroke);
            AppState.currentInfiniteLaserStroke = null;
            
            // Clear the laser overlay canvas immediately
            if (AppState.infiniteLaserCtx) {
                AppState.infiniteLaserCtx.clearRect(0, 0, AppState.infiniteLaserCanvas.width, AppState.infiniteLaserCanvas.height);
                // Reset canvas state to prevent drawing continuation
                AppState.infiniteLaserCtx.beginPath();
            }
        }

        // Draw shapes for non-pencil tools
        if (AppState.currentTool !== 'pencil' && AppState.currentTool !== 'eraser' && AppState.currentTool !== 'laser') {
            this.updateStyles();
            
            switch (AppState.currentTool) {
                case 'line':
                    AppState.infiniteCtx.beginPath();
                    AppState.infiniteCtx.moveTo(AppState.startX, AppState.startY);
                    AppState.infiniteCtx.lineTo(pos.x, pos.y);
                    AppState.infiniteCtx.stroke();
                    break;
                case 'rectangle':
                    AppState.infiniteCtx.beginPath();
                    AppState.infiniteCtx.rect(AppState.startX, AppState.startY, pos.x - AppState.startX, pos.y - AppState.startY);
                    AppState.infiniteCtx.stroke();
                    break;
                case 'circle':
                    const radius = Math.sqrt(Math.pow(pos.x - AppState.startX, 2) + Math.pow(pos.y - AppState.startY, 2));
                    AppState.infiniteCtx.beginPath();
                    AppState.infiniteCtx.arc(AppState.startX, AppState.startY, radius, 0, 2 * Math.PI);
                    AppState.infiniteCtx.stroke();
                    break;
                case 'arrow':
                    const headlen = 20;
                    const angle = Math.atan2(pos.y - AppState.startY, pos.x - AppState.startX);
                    
                    AppState.infiniteCtx.beginPath();
                    AppState.infiniteCtx.moveTo(AppState.startX, AppState.startY);
                    AppState.infiniteCtx.lineTo(pos.x, pos.y);
                    AppState.infiniteCtx.stroke();
                    
                    AppState.infiniteCtx.beginPath();
                    AppState.infiniteCtx.moveTo(pos.x, pos.y);
                    AppState.infiniteCtx.lineTo(pos.x - headlen * Math.cos(angle - Math.PI / 6), pos.y - headlen * Math.sin(angle - Math.PI / 6));
                    AppState.infiniteCtx.moveTo(pos.x, pos.y);
                    AppState.infiniteCtx.lineTo(pos.x - headlen * Math.cos(angle + Math.PI / 6), pos.y - headlen * Math.sin(angle + Math.PI / 6));
                    AppState.infiniteCtx.stroke();
                    break;
            }
            
            // Auto-save after infinite canvas drawing completion
            setTimeout(() => StorageManager.saveData(), 100);
        }
        
        // Redraw page separators to keep them visible
        this.redrawSeparators();
    },

    /**
     * Update drawing styles for infinite canvas
     */
    updateStyles() {
        if (!AppState.infiniteCtx) return;

        if (AppState.currentTool === 'eraser') {
            AppState.infiniteCtx.globalCompositeOperation = 'destination-out';
            AppState.infiniteCtx.lineWidth = AppState.brushSize * 2;
        } else if (AppState.currentTool === 'laser') {
            AppState.infiniteCtx.globalCompositeOperation = 'source-over';
            AppState.infiniteCtx.strokeStyle = AppState.currentColor + '80'; // 50% transparency
            AppState.infiniteCtx.lineWidth = AppState.brushSize * 1.5;
            AppState.infiniteCtx.shadowBlur = 10;
            AppState.infiniteCtx.shadowColor = AppState.currentColor;
        } else {
            AppState.infiniteCtx.globalCompositeOperation = 'source-over';
            AppState.infiniteCtx.strokeStyle = AppState.currentColor;
            AppState.infiniteCtx.lineWidth = AppState.brushSize;
            AppState.infiniteCtx.shadowBlur = 0;
        }
        
        AppState.infiniteCtx.lineCap = 'round';
        AppState.infiniteCtx.lineJoin = 'round';
    },

    /**
     * Clear infinite canvas
     */
    clear() {
        if (AppState.infiniteCtx && AppState.infiniteCanvas) {
            AppState.infiniteCtx.clearRect(0, 0, AppState.infiniteCanvas.width, AppState.infiniteCanvas.height);
            // Redraw page separators after clearing
            this.drawPageSeparators();
        }
    },

    /**
     * Draw page separators for A4 pages
     */
    drawPageSeparators() {
        if (!AppState.infiniteCtx || !AppState.infiniteCanvas) return;

        const ctx = AppState.infiniteCtx;
        const canvasWidth = AppState.infiniteCanvas.width;
        const canvasHeight = AppState.infiniteCanvas.height;
        
        // Save current drawing state
        ctx.save();
        
        // Get current A4 dimensions
        const dimensions = this.calculateA4Dimensions();
        
        // Draw horizontal page separators (every A4 height) - BLACK SOLID LINES
        ctx.strokeStyle = '#000000'; // Black color
        ctx.lineWidth = 3; // Thick line
        ctx.setLineDash([]); // Solid line (no dashes)
        ctx.globalCompositeOperation = 'source-over'; // Ensure lines appear on top
        
        for (let y = dimensions.height; y < canvasHeight; y += dimensions.height) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvasWidth, y);
            ctx.stroke();
        }
        
        // Draw vertical page separators (every A4 width) - lighter lines
        ctx.strokeStyle = '#9ca3af'; // Light gray for vertical lines
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]); // Dashed line
        
        for (let x = dimensions.width; x < canvasWidth; x += dimensions.width) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvasHeight);
            ctx.stroke();
        }
        
        // Restore drawing state
        ctx.restore();
    },

    /**
     * Toggle horizontal expansion feature
     */
    toggleHorizontalExpansion() {
        AppState.infiniteHorizontal = !AppState.infiniteHorizontal;
        const button = document.getElementById('toggleHorizontal');
        
        if (AppState.infiniteHorizontal) {
            button.textContent = '↔️ Horizontal On';
            button.classList.remove('bg-gray-500', 'hover:bg-gray-600');
            button.classList.add('bg-green-500', 'hover:bg-green-600');
        } else {
            button.textContent = '↔️ Horizontal Off';
            button.classList.remove('bg-green-500', 'hover:bg-green-600');
            button.classList.add('bg-gray-500', 'hover:bg-gray-600');
        }
    },

    /**
     * Check if canvas needs to be expanded and expand it
     */
    checkAndExpand() {
        const container = document.getElementById('infiniteCanvasContainer');
        if (!container || !AppState.infiniteCanvas) return;

        const scrollLeft = container.scrollLeft;
        const scrollTop = container.scrollTop;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const canvasWidth = AppState.infiniteCanvas.width;
        const canvasHeight = AppState.infiniteCanvas.height;

        const expandThreshold = 100; // Expand when within 100px of edge
        let needsExpansion = false;
        let newWidth = canvasWidth;
        let newHeight = canvasHeight;

        // Get current A4 dimensions
        const dimensions = this.calculateA4Dimensions();

        // Check if we need to expand horizontally (only if toggle is enabled)
        if (AppState.infiniteHorizontal && scrollLeft + containerWidth > canvasWidth - expandThreshold) {
            newWidth = canvasWidth + dimensions.width;
            needsExpansion = true;
        }

        // Always allow vertical expansion (add new A4 pages)
        if (scrollTop + containerHeight > canvasHeight - expandThreshold) {
            newHeight = canvasHeight + dimensions.height;
            needsExpansion = true;
        }

        if (needsExpansion) {
            this.expandCanvas(newWidth, newHeight);
        }
    },

    /**
     * Expand canvas size while preserving existing content
     */
    expandCanvas(newWidth, newHeight) {
        if (!AppState.infiniteCanvas || !AppState.infiniteCtx) return;

        // Save current canvas content
        const imageData = AppState.infiniteCtx.getImageData(0, 0, AppState.infiniteCanvas.width, AppState.infiniteCanvas.height);
        
        // Resize canvas
        AppState.infiniteCanvas.width = newWidth;
        AppState.infiniteCanvas.height = newHeight;
        
        // Restore content
        AppState.infiniteCtx.putImageData(imageData, 0, 0);
        
        // Redraw page separators
        this.drawPageSeparators();
        
        // Reapply styles
        this.updateStyles();
        
        console.log(`Canvas expanded to ${newWidth}x${newHeight}`);
    },

    /**
     * Save infinite canvas as image
     */
    save() {
        if (!AppState.infiniteCanvas) return;
        
        const link = document.createElement('a');
        link.download = `infinite-canvas-${Date.now()}.png`;
        link.href = AppState.infiniteCanvas.toDataURL();
        link.click();
        
        UI.showNotification('Canvas saved as image!');
    },

    /**
     * Handle text tool click on infinite canvas
     */
    handleInfiniteTextClick(x, y) {
        console.log(`Infinite canvas text tool clicked at (${x}, ${y})`);
        
        // Remove any existing text input
        DrawingEvents.removeTextInput();
        
        // Create text input element
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.style.position = 'fixed';
        textInput.style.backgroundColor = 'white';
        textInput.style.border = '2px solid #3b82f6';
        textInput.style.outline = 'none';
        textInput.style.padding = '4px 8px';
        textInput.style.zIndex = '9999';
        textInput.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        textInput.style.borderRadius = '4px';
        textInput.style.fontSize = AppState.fontSize + 'px';
        textInput.style.fontFamily = AppState.fontFamily;
        textInput.style.color = AppState.currentColor;
        textInput.style.minWidth = '150px';
        textInput.style.height = 'auto';
        textInput.placeholder = 'Type text...';
        textInput.autocomplete = 'off';
        textInput.spellcheck = false;
        
        // Position relative to the infinite canvas
        const canvasRect = AppState.infiniteCanvas.getBoundingClientRect();
        const screenX = canvasRect.left + x * (canvasRect.width / AppState.infiniteCanvas.width);
        const screenY = canvasRect.top + y * (canvasRect.height / AppState.infiniteCanvas.height);
        
        textInput.style.left = screenX + 'px';
        textInput.style.top = screenY + 'px';
        
        console.log(`Infinite canvas text input positioned at screen coordinates (${screenX}, ${screenY})`);
        
        // Add to document
        document.body.appendChild(textInput);
        AppState.currentTextInput = textInput;
        AppState.isTyping = true;
        
        // Force focus with delay to ensure element is rendered
        setTimeout(() => {
            textInput.focus();
            textInput.select();
            console.log('Text input focused and selected');
        }, 10);
        
        // Handle text completion
        const completeText = () => {
            const text = textInput.value.trim();
            console.log(`Completing infinite canvas text: "${text}"`);
            if (text) {
                this.drawInfiniteText(text, x, y);
            }
            DrawingEvents.removeTextInput();
        };
        
        // Event listeners
        textInput.addEventListener('blur', completeText);
        textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                completeText();
            } else if (e.key === 'Escape') {
                DrawingEvents.removeTextInput();
            }
        });
    },

    /**
     * Draw text on infinite canvas
     */
    drawInfiniteText(text, x, y) {
        if (!AppState.infiniteCtx) {
            console.error('Infinite canvas context not available');
            return;
        }
        
        // Set text styles
        AppState.infiniteCtx.font = `${AppState.fontSize}px ${AppState.fontFamily}`;
        AppState.infiniteCtx.fillStyle = AppState.currentColor;
        AppState.infiniteCtx.textBaseline = 'top';
        
        // Draw text
        AppState.infiniteCtx.fillText(text, x, y);
        
        console.log(`Drew text "${text}" on infinite canvas at (${x}, ${y}) with font ${AppState.fontSize}px ${AppState.fontFamily}`);
    }
};

// =============================================================================
// 11. LOCAL STORAGE MANAGER
// =============================================================================

/**
 * @namespace StorageManager
 * @description Handles all data persistence functionality
 * Manages saving and loading application state to/from localStorage
 */
const StorageManager = {
    STORAGE_KEY: 'tutorial_maker_data',

    /**
     * Saves the current application state to localStorage
     * Includes drawings, settings, and video state
     * @returns {void}
     */
    saveData() {
        const data = {
            // Video information
            videoUrl: document.getElementById('youtubeUrl')?.value || '',
            
            // Timestamped drawings
            timestampedDrawings: AppState.timestampedDrawings,
            
            // Main canvas drawing (if any)
            mainCanvasData: AppState.canvas ? AppState.canvas.toDataURL() : null,
            
            // Infinite canvas drawing (if any)
            infiniteCanvasData: AppState.infiniteCanvas ? AppState.infiniteCanvas.toDataURL() : null,
            
            // Current settings
            currentColor: AppState.currentColor,
            brushSize: AppState.brushSize,
            fontSize: AppState.fontSize,
            fontFamily: AppState.fontFamily,
            
            // Canvas dimensions for infinite canvas
            infiniteCanvasWidth: AppState.infiniteCanvas?.width || 0,
            infiniteCanvasHeight: AppState.infiniteCanvas?.height || 0,
            
            // Infinite canvas settings
            infiniteHorizontal: AppState.infiniteHorizontal,
            a4WidthPercent: AppState.a4WidthPercent,
            a4HeightPercent: AppState.a4HeightPercent,
            
            // Save timestamp
            lastSaved: new Date().toISOString()
        };

        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            console.log('Data saved to localStorage');
            return true;
        } catch (error) {
            console.error('Failed to save data to localStorage:', error);
            UI.showNotification('Failed to save data - storage may be full');
            return false;
        }
    },

    /**
     * Loads saved application data from localStorage
     * @returns {Object|null} The parsed data or null if none exists
     */
    loadData() {
        try {
            const dataStr = localStorage.getItem(this.STORAGE_KEY);
            if (!dataStr) {
                console.log('No saved data found');
                return null;
            }

            const data = JSON.parse(dataStr);
            console.log('Loaded data from localStorage:', data);
            return data;
        } catch (error) {
            console.error('Failed to load data from localStorage:', error);
            return null;
        }
    },

    /**
     * Restores the application state from saved data
     * @param {Object} data - The data object containing saved state
     * @returns {void}
     */
    restoreData(data) {
        if (!data) return;

        // Restore video URL
        if (data.videoUrl) {
            const urlInput = document.getElementById('youtubeUrl');
            if (urlInput) {
                urlInput.value = data.videoUrl;
                // Auto-load the video
                setTimeout(() => YouTubeManager.loadVideo(), 1000);
            }
        }

        // Restore timestamped drawings
        if (data.timestampedDrawings && Array.isArray(data.timestampedDrawings)) {
            AppState.timestampedDrawings = data.timestampedDrawings;
            TimestampManager.updateUI();
        }

        // Restore settings
        if (data.currentColor) {
            AppState.currentColor = data.currentColor;
            const colorPicker = document.getElementById('colorPicker');
            if (colorPicker) colorPicker.value = data.currentColor;
        }

        if (data.brushSize) {
            AppState.brushSize = data.brushSize;
            const brushSizeInput = document.getElementById('brushSize');
            const sizeValue = document.getElementById('sizeValue');
            if (brushSizeInput) brushSizeInput.value = data.brushSize;
            if (sizeValue) sizeValue.textContent = data.brushSize + 'px';
        }

        if (data.fontSize) {
            AppState.fontSize = data.fontSize;
            const fontSizeInput = document.getElementById('fontSize');
            if (fontSizeInput) fontSizeInput.value = data.fontSize;
        }

        if (data.fontFamily) {
            AppState.fontFamily = data.fontFamily;
            const fontFamilySelect = document.getElementById('fontFamily');
            if (fontFamilySelect) fontFamilySelect.value = data.fontFamily;
        }

        // Restore infinite canvas settings
        if (typeof data.infiniteHorizontal === 'boolean') {
            AppState.infiniteHorizontal = data.infiniteHorizontal;
            const button = document.getElementById('toggleHorizontal');
            if (button) {
                if (data.infiniteHorizontal) {
                    button.textContent = '↔️ Horizontal On';
                    button.classList.remove('bg-gray-500', 'hover:bg-gray-600');
                    button.classList.add('bg-green-500', 'hover:bg-green-600');
                } else {
                    button.textContent = '↔️ Horizontal Off';
                    button.classList.remove('bg-green-500', 'hover:bg-green-600');
                    button.classList.add('bg-gray-500', 'hover:bg-gray-600');
                }
            }
        }

        if (data.a4WidthPercent) AppState.a4WidthPercent = data.a4WidthPercent;
        if (data.a4HeightPercent) AppState.a4HeightPercent = data.a4HeightPercent;

        // Restore canvas drawings
        setTimeout(() => {
            this.restoreCanvasDrawings(data);
        }, 500);

        UI.showNotification(`Data restored from ${new Date(data.lastSaved).toLocaleString()}`);
    },

    /**
     * Restore canvas drawings from saved data
     */
    restoreCanvasDrawings(data) {
        // Restore main canvas
        if (data.mainCanvasData && AppState.canvas && AppState.ctx) {
            const img = new Image();
            img.onload = () => {
                AppState.ctx.clearRect(0, 0, AppState.canvas.width, AppState.canvas.height);
                AppState.ctx.drawImage(img, 0, 0);
                console.log('Main canvas restored');
            };
            img.src = data.mainCanvasData;
        }

        // Restore infinite canvas
        if (data.infiniteCanvasData && AppState.infiniteCanvas && AppState.infiniteCtx) {
            // Restore canvas dimensions first
            if (data.infiniteCanvasWidth && data.infiniteCanvasHeight) {
                AppState.infiniteCanvas.width = data.infiniteCanvasWidth;
                AppState.infiniteCanvas.height = data.infiniteCanvasHeight;
            }

            const img = new Image();
            img.onload = () => {
                AppState.infiniteCtx.clearRect(0, 0, AppState.infiniteCanvas.width, AppState.infiniteCanvas.height);
                AppState.infiniteCtx.drawImage(img, 0, 0);
                // Redraw page separators on top
                InfiniteCanvas.drawPageSeparators();
                console.log('Infinite canvas restored');
            };
            img.src = data.infiniteCanvasData;
        }
    },

    /**
     * Clear all saved data
     */
    clearData() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            console.log('Saved data cleared');
            UI.showNotification('All saved data cleared');
            return true;
        } catch (error) {
            console.error('Failed to clear saved data:', error);
            return false;
        }
    },

    /**
     * Auto-save data periodically
     */
    startAutoSave() {
        // Save every 30 seconds
        setInterval(() => {
            this.saveData();
        }, 30000);

        // Save on page unload
        window.addEventListener('beforeunload', () => {
            this.saveData();
        });

        // Save on visibility change (when tab becomes hidden)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveData();
            }
        });
    }
};

// =============================================================================
// 12. INITIALIZATION
// =============================================================================

/**
 * Initializes the Tutorial Maker application
 * Sets up the UI, event listeners, and restores any saved state
 * @returns {void}
 */
function init() {
    console.log('Initializing Tutorial Maker...');
    
    // Setup canvas elements
    AppState.canvas = document.getElementById('drawingCanvas');
    if (AppState.canvas) {
        AppState.ctx = AppState.canvas.getContext('2d', { willReadFrequently: true });
    }
    
    AppState.overlayCanvas = document.getElementById('overlayCanvas');
    if (AppState.overlayCanvas) {
        AppState.overlayCtx = AppState.overlayCanvas.getContext('2d', { willReadFrequently: true });
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize infinite canvas
    InfiniteCanvas.init();
    
    // Initialize media handler
    MediaHandler.init();
    
    // Initialize drawing styles and set default tool
    const pencilBtn = document.getElementById('pencil');
    if (pencilBtn) {
        pencilBtn.classList.add('bg-indigo-500', 'border-indigo-600', 'text-white');
    }
    DrawingUtils.updateStyles();
    
    // Initialize storage and load saved data
    const savedData = StorageManager.loadData();
    if (savedData) {
        StorageManager.restoreData(savedData);
    }
    
    // Start auto-save
    StorageManager.startAutoSave();
    
    console.log('Tutorial Maker initialized successfully');
    console.log('Canvas:', AppState.canvas);
    console.log('Overlay Canvas:', AppState.overlayCanvas);
    console.log('Infinite Canvas:', AppState.infiniteCanvas);
}

/**
 * Sets up all event listeners for the application
 * Handles user interactions with tools, canvas, and UI elements
 * @returns {void}
 */
function setupEventListeners() {
    // Tool buttons
    const toolButtons = ['pencil', 'line', 'rectangle', 'circle', 'arrow', 'eraser', 'text', 'select', 'laser'];
    toolButtons.forEach(tool => {
        document.getElementById(tool).addEventListener('click', () => {
            AppState.currentTool = tool;
            
            // Update active tool UI
            document.querySelectorAll('.tool-btn').forEach(btn => {
                btn.classList.remove('bg-indigo-500', 'border-indigo-600', 'text-white');
                btn.classList.add('bg-white', 'border-gray-200');
            });
            
            const selectedBtn = document.getElementById(tool);
            selectedBtn.classList.remove('bg-white', 'border-gray-200');
            selectedBtn.classList.add('bg-indigo-500', 'border-indigo-600', 'text-white');
            
            DrawingUtils.updateStyles();
            DrawingUtils.toggleTextControls();
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
    
    // Text controls
    document.getElementById('fontSize').addEventListener('input', (e) => {
        AppState.fontSize = e.target.value;
        document.getElementById('fontSizeValue').textContent = AppState.fontSize + 'px';
    });
    
    document.getElementById('fontFamily').addEventListener('change', (e) => {
        AppState.fontFamily = e.target.value;
    });
    
    // Action buttons
    document.getElementById('clearCanvas').addEventListener('click', () => CanvasUtils.clear());
    
    // Save drawing button (commented out in HTML)
    const saveDrawingBtn = document.getElementById('saveDrawing');
    if (saveDrawingBtn) {
        saveDrawingBtn.addEventListener('click', () => {
            const activeCanvas = CanvasUtils.getActiveCanvas();
            const link = document.createElement('a');
            link.download = 'tutorial-' + new Date().toISOString().slice(0, 10) + '.png';
            link.href = activeCanvas.toDataURL('image/png');
            link.click();
            AppState.isDrawing = false;
        });
    }
    document.getElementById('saveWithTimestamp').addEventListener('click', () => TimestampManager.save());
    document.getElementById('drawModeBtn').addEventListener('click', () => DrawingMode.toggle());
    document.getElementById('closeDrawingBtn').addEventListener('click', () => DrawingMode.close());
    
    // Paste URL button
    document.getElementById('pasteUrl').addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            document.getElementById('youtubeUrl').value = text;
            UI.showNotification('URL pasted from clipboard!');
        } catch (err) {
            UI.showNotification('Failed to paste from clipboard. Please paste manually.');
            console.error('Clipboard access failed:', err);
        }
    });
    
    // Canvas events - setup immediately since init() runs after DOM is loaded
    if (AppState.overlayCanvas) {
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
            DrawingEvents.start(mouseEvent);
        });
        
        AppState.overlayCanvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            DrawingEvents.draw(mouseEvent);
        });
        
        AppState.overlayCanvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            DrawingEvents.stop(mouseEvent);
        });
    }
    
    // Video input
    document.getElementById('youtubeUrl').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') YouTubeManager.loadVideo();
    });
    document.getElementById('loadVideo').addEventListener('click', () => YouTubeManager.loadVideo());
    
    // Retry button for video loading errors
    document.getElementById('retryButton').addEventListener('click', () => YouTubeManager.loadVideo());
    
    // Storage action buttons
    document.getElementById('manualSave')?.addEventListener('click', () => {
        if (StorageManager.saveData()) {
            UI.showNotification('All data saved successfully!');
        }
    });
    
    document.getElementById('clearStorage')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all data? This will clear:\n• All saved drawings timeline\n• Video canvas drawings\n• Infinite canvas drawings\n• All stored data\n\nThis cannot be undone.')) {
            // Clear all canvases
            if (AppState.ctx && AppState.canvas) {
                AppState.ctx.clearRect(0, 0, AppState.canvas.width, AppState.canvas.height);
            }
            if (AppState.overlayCtx && AppState.overlayCanvas) {
                AppState.overlayCtx.clearRect(0, 0, AppState.overlayCanvas.width, AppState.overlayCanvas.height);
            }
            if (AppState.infiniteCtx && AppState.infiniteCanvas) {
                AppState.infiniteCtx.clearRect(0, 0, AppState.infiniteCanvas.width, AppState.infiniteCanvas.height);
                // Redraw page separators for infinite canvas
                InfiniteCanvas.drawPageSeparators();
            }
            
            // Reset all drawing state
            AppState.isDrawing = false;
            AppState.drawingMode = false;
            AppState.infiniteDrawing = false;
            AppState.startX = 0;
            AppState.startY = 0;
            
            // Reset text state
            AppState.isTyping = false;
            AppState.currentTextInput = null;
            
            // Clear timestamped drawings and reset timestamp state
            AppState.timestampedDrawings = [];
            AppState.currentTimestamp = null;
            AppState.currentDrawingState = null;
            TimestampManager.updateUI();
            
            // Reset PDF state
            AppState.currentPDF = null;
            AppState.currentPage = 1;
            AppState.totalPages = 1;
            AppState.lastUploadPosition = { x: 0, y: 0 };
            InfiniteCanvas.hidePageControls();
            
            // Close drawing mode if active
            if (AppState.drawingMode) {
                DrawingMode.close();
            }
            
            // Clear all stored data
            StorageManager.clearData();
            
            UI.showNotification('All data cleared successfully!');
        }
    });
    
    // Window events
    window.addEventListener('resize', CanvasUtils.resize);
}

/**
 * Global callback function called by the YouTube IFrame API when ready
 * This function name must match what the YouTube API expects
 * @global
 * @returns {void}
 */
function onYouTubeIframeAPIReady() {
    YouTubeManager.onAPIReady();
}

// Initialize when DOM is ready
window.addEventListener('DOMContentLoaded', init);
