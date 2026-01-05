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
- **Backend**: Node.js, Express, WebSocket (ws), SQLite
- **Graphics**: HTML5 Canvas, rough.js
- **Auth**: Google OAuth 2.0, JWT
- **Payments**: Stripe

## Freemium Model

Canvara offers a freemium model similar to Excalidraw:

- **Free tier**: Projects stored locally in browser storage
- **Pro tier ($5/month)**: Cloud storage for projects, accessible from any device

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

3. Configure environment variables:

**Server (`server/.env`):**
```bash
# Server Configuration
PORT=3001
NODE_ENV=development
SERVER_URL=http://localhost:3001
CLIENT_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173

# Google OAuth (https://console.cloud.google.com/apis/credentials)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Stripe (https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID=price_xxx

# JWT Secret
JWT_SECRET=your-secure-random-string
```

**Client (`client/.env`):**
```bash
VITE_API_URL=http://localhost:3001
```

4. Start development servers:

```bash
# Terminal 1 - Start the backend server
cd server
npm run dev

# Terminal 2 - Start the frontend dev server
cd client
npm run dev
```

5. Open http://localhost:5173 in your browser

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

## Deployment

### Server (Fly.io)

1. Install the Fly CLI: https://fly.io/docs/hands-on/install-flyctl/

2. Create a persistent volume for SQLite:
```bash
cd server
fly volumes create canvara_data --size 1 --region iad
```

3. Set secrets:
```bash
fly secrets set GOOGLE_CLIENT_ID=xxx
fly secrets set GOOGLE_CLIENT_SECRET=xxx
fly secrets set STRIPE_SECRET_KEY=sk_xxx
fly secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
fly secrets set STRIPE_PRICE_ID=price_xxx
fly secrets set JWT_SECRET=xxx
fly secrets set CLIENT_URL=https://your-frontend-url.com
```

4. Deploy:
```bash
fly deploy
```

### Client (Vercel)

1. Set environment variable `VITE_API_URL` to your Fly.io server URL
2. Deploy via Vercel dashboard or CLI

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
│       ├── db/             # Database (SQLite)
│       ├── middleware/     # Auth middleware
│       ├── routes/         # REST API routes
│       ├── websocket/      # WebSocket handlers
│       └── rooms/          # Room management
└── shared/                 # Shared types
```

## License

MIT

