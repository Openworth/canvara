---
name: Visual Notes Feature
overview: Add an AI-powered feature that converts uploaded images, PDFs, or pasted text into visual canvas elements (diagrams, mind maps, structured layouts) using OpenRouter with Sonnet 3.5 or Gemini 2.5 Flash.
todos:
  - id: server-route
    content: Create /api/visualize route with OpenRouter integration and PDF parsing
    status: completed
  - id: register-route
    content: Register visualize route in server/src/index.ts
    status: completed
  - id: client-store
    content: Create visualNotes.ts store for state management
    status: completed
  - id: modal-component
    content: Build VisualNotesModal.vue with file upload and text input
    status: completed
  - id: toolbar-integration
    content: Add Visual Notes button to toolbar with icon
    status: completed
  - id: canvas-integration
    content: Handle element placement and viewport centering after generation
    status: completed
---

# Visual Notes Feature Implementation

## Architecture Overview

```mermaid
flowchart LR
    subgraph client [Client]
        UI[Upload Modal] --> Store[visualNotes Store]
        Store --> API[API Call]
    end
    subgraph server [Server]
        Route[/api/visualize] --> Process[Process Input]
        Process --> OpenRouter[OpenRouter API]
        OpenRouter --> Generate[Generate Elements]
    end
    API --> Route
    Generate --> Store
    Store --> Canvas[Canvas Elements]
```



## Server-Side Implementation

### 1. New API Route: `server/src/routes/visualize.ts`

Create a new route that:

- Accepts multipart form data (image/PDF file) or JSON (text content)
- Extracts text from PDFs using `pdf-parse` package
- Sends content to OpenRouter (Sonnet 3.5 or Gemini 2.5 Flash) with a structured prompt
- Returns an array of `ExcalidrawElement` objects ready for the canvas

Key dependencies to add:

- `pdf-parse` - for PDF text extraction
- OpenRouter API call via `fetch` (no SDK needed)

The AI prompt will instruct the model to:

- Analyze the content structure (notes, lists, concepts, relationships)
- Generate appropriate element types (rectangles for containers, text for labels, arrows for relationships)
- Return valid JSON matching the `ExcalidrawElement` schema
- Position elements in a logical layout (left-to-right or hierarchical)

### 2. Register Route in [`server/src/index.ts`](server/src/index.ts)

Add the new route: `app.use('/api/visualize', visualizeRoutes)`

## Client-Side Implementation

### 3. New Store: `client/src/stores/visualNotes.ts`

Manage the feature state:

- `isProcessing` - loading indicator
- `error` - error messages
- `uploadAndVisualize(file | text)` - main action
- Handle API communication and error states

### 4. New Modal: `client/src/components/modals/VisualNotesModal.vue`

A modal dialog with:

- Three input tabs: Upload Image, Upload PDF, Paste Text
- File dropzone for drag-and-drop
- Text area for pasting content
- Model selector (Sonnet 3.5 / Gemini 2.5 Flash)
- Processing indicator with progress feedback
- Preview of detected content type

### 5. Entry Points

**Toolbar** - Add new tool button in [`client/src/components/toolbar/Toolbar.vue`](client/src/components/toolbar/Toolbar.vue):

- New "Visual Notes" button with sparkles/magic icon
- Opens the VisualNotesModal

**Menu** - Add menu item in TopBar/MenuDropdown (if exists) or as a keyboard shortcut

### 6. Canvas Integration

After AI returns elements:

- Add all elements to canvas via `canvasStore.addElement()`
- Position elements relative to current viewport center
- Auto-select generated elements
- Center view on new content using `canvasStore.centerOnContent()`

## Data Flow

1. User opens modal via toolbar/menu
2. User uploads file or pastes text
3. Client sends to `/api/visualize` endpoint
4. Server extracts content (PDF text / image base64 / raw text)
5. Server calls OpenRouter with structured prompt
6. AI returns JSON array of element specifications
7. Server validates and returns elements
8. Client adds elements to canvas and centers view

## Environment Configuration

Add to server `.env`:

```javascript
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=anthropic/claude-sonnet-3.5  # or google/gemini-2.5-flash





```