# Canvara - Collaborative Whiteboard

A full-featured Excalidraw clone built with Vue 3 and Node.js, featuring real-time collaboration, an infinite canvas, and hand-drawn style graphics.

## Features

- **Infinite Canvas** - Pan and zoom with mouse/trackpad/touch
- **Drawing Tools** - Rectangle, ellipse, diamond, arrow, line, freehand draw, text
- **Hand-drawn Style** - Sketchy, hand-drawn appearance using rough.js
- **Selection & Transform** - Select, move, resize, and rotate elements
- **Styling** - Customizable stroke color, fill, opacity, and more
- **Real-time Collaboration** - Work together with WebSocket-based sync
- **Cursor Presence** - See collaborators' cursors in real-time
- **Undo/Redo** - Full history support with Ctrl+Z/Ctrl+Shift+Z
- **Export** - Save as PNG, SVG, or JSON
- **Library** - Save and reuse element collections
- **Dark Mode** - Toggle between light and dark themes
- **Local Persistence** - Auto-saves to browser storage

## Tech Stack

- **Frontend**: Vue 3, TypeScript, Pinia, Tailwind CSS v4, Vite
- **Backend**: Node.js, Express, WebSocket (ws)
- **Graphics**: HTML5 Canvas, rough.js

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd canvara
```

2. Install dependencies:
```bash
# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

3. Start development servers:

```bash
# Terminal 1 - Start the backend server
cd server
npm run dev

# Terminal 2 - Start the frontend dev server
cd client
npm run dev
```

4. Open http://localhost:5173 in your browser

## Keyboard Shortcuts

### Tools
| Key | Tool |
|-----|------|
| 1 or V | Selection |
| 2 or R | Rectangle |
| 3 or O | Ellipse |
| 4 or D | Diamond |
| 5 or A | Arrow |
| 6 or L | Line |
| 7 or P | Pencil (freehand) |
| 8 or T | Text |
| E | Eraser |
| H | Hand (pan) |
| Space (hold) | Temporary pan mode |

### Actions
| Shortcut | Action |
|----------|--------|
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Ctrl+A | Select all |
| Ctrl+C | Copy |
| Ctrl+V | Paste |
| Ctrl+D | Duplicate |
| Ctrl+G | Toggle grid |
| Ctrl+L | Toggle library |
| Delete/Backspace | Delete selected |
| Escape | Clear selection |
| [ | Send backward |
| ] | Bring forward |
| { | Send to back |
| } | Bring to front |

### Zoom
| Shortcut | Action |
|----------|--------|
| Ctrl+0 | Reset zoom |
| Ctrl++ | Zoom in |
| Ctrl+- | Zoom out |
| Scroll wheel | Zoom at cursor |

## Collaboration

1. Click the **Share** button in the top-right corner
2. Click **Start Live Session** to create a room
3. Share the generated link with collaborators
4. Everyone with the link can see and edit in real-time

## Project Structure

```
canvara/
├── client/                 # Vue 3 Frontend
│   ├── src/
│   │   ├── components/     # Vue components
│   │   ├── composables/    # Vue composables
│   │   ├── engine/         # Canvas rendering engine
│   │   ├── stores/         # Pinia stores
│   │   ├── types/          # TypeScript types
│   │   └── views/          # Page views
│   └── ...
├── server/                 # Node.js Backend
│   └── src/
│       ├── routes/         # REST API routes
│       ├── websocket/      # WebSocket handlers
│       └── rooms/          # Room management
└── shared/                 # Shared types
```

## License

MIT

