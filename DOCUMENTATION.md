# Tutorial Maker - Documentation

## Table of Contents
1. [Overview](#overview)
2. [Core Components](#core-components)
3. [Drawing Tools](#drawing-tools)
4. [Canvas Management](#canvas-management)
5. [YouTube Integration](#youtube-integration)
6. [Storage Management](#storage-management)
7. [Infinite Canvas](#infinite-canvas)
8. [PDF Support](#pdf-support)
9. [Event Handling](#event-handling)
10. [Initialization](#initialization)

## Overview

Tutorial Maker is a web application that allows users to create tutorials by drawing on top of YouTube videos or PDF documents. It features an infinite canvas, various drawing tools, and the ability to save and load work.

## Core Components

### AppState
Central state management object that maintains the application state including:
- Canvas references and contexts
- Current tool and drawing settings
- YouTube player state
- PDF document state
- Canvas dimensions and scaling

### UI (User Interface)
Handles all UI updates and interactions including:
- Tool selection feedback
- Color picker
- Brush size adjustment
- Notification system
- Page navigation controls

## Drawing Tools

### Pencil Tool
- Draws freehand lines with the selected color and brush size
- Supports pressure sensitivity on compatible devices

### Shape Tools
- **Line**: Draws straight lines between two points
- **Rectangle**: Creates rectangles with outline or fill
- **Circle**: Draws circles/ellipses with outline or fill
- **Arrow**: Draws arrows with customizable head size

### Eraser
- Removes drawn content by painting with transparency
- Adjustable size for precise erasing

### Text Tool
- Adds text annotations to the canvas
- Customizable font, size, and color
- Click to place and type, click outside to finish

## Canvas Management

### Main Canvas
- Fixed-size canvas for video annotations
- Automatically scales with the video player
- Supports all drawing tools

### Infinite Canvas
- Expandable canvas for additional content
- Supports multiple pages with A4 dimensions
- Scrollable and zoomable interface

## YouTube Integration

### Video Playback
- Load and play YouTube videos by URL
- Frame-by-frame navigation
- Current time display and seek functionality

### Timestamp Management
- Save and load drawings at specific timestamps
- Auto-save drawings when switching timestamps
- Clear drawings for current timestamp

## Storage Management

### Auto-Save
- Automatically saves work to localStorage
- Recovers unsaved work on page reload
- Configurable save frequency

### Manual Save/Load
- Save current work to browser storage
- Load previously saved work
- Clear all saved data

## PDF Support

### PDF Upload
- Upload and display PDF documents
- Multi-page support with navigation
- Automatic canvas expansion for large documents

### PDF Annotation
- Draw on top of PDF pages
- Annotations are preserved when switching pages
- Export annotated PDF (if implemented)

## Event Handling

### Mouse/Touch Events
- Unified event handling for mouse and touch inputs
- Supports drawing with both input methods
- Responsive to different screen sizes

### Keyboard Shortcuts
- Quick access to common functions
- Tool selection shortcuts
- Undo/Redo functionality

## Initialization

The application initializes in this order:
1. Set up canvas elements and contexts
2. Initialize YouTube API
3. Set up event listeners
4. Load any saved state
5. Initialize the UI

## Usage Guide

### Basic Drawing
1. Select a drawing tool from the toolbar
2. Choose a color and brush size
3. Click and drag on the canvas to draw

### Working with Videos
1. Paste a YouTube URL and press Enter
2. Use the player controls to navigate
3. Draw on the video at any timestamp

### Using the Infinite Canvas
1. Click the "+" button to add a new page
2. Scroll to navigate between pages
3. Use the upload button to add images or PDFs

### Saving and Loading
- Work is auto-saved as you go
- Use the save button to force a save
- Your work will be available when you return

## Troubleshooting

### Common Issues
- **Drawings not appearing**: Check if the correct layer is selected (video or infinite canvas)
- **Tool not working**: Try selecting it again or refreshing the page
- **Performance issues**: Reduce brush size or clear old drawings

## Browser Support
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License
[Specify your license here]

---
*Documentation generated on August 31, 2025*
