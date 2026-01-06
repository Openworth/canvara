import express, { Router, Request, Response, RequestHandler } from 'express'
import multer from 'multer'
import { createRequire } from 'module'
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js'
import { getDb } from '../db/index.js'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

const router = Router()

// Feature limits - configurable via environment variables
const LIMITS = {
  MAX_TEXT_CHARS: parseInt(process.env.VISUAL_NOTES_MAX_TEXT_CHARS || '50000'),
  MAX_PDF_TEXT_CHARS: parseInt(process.env.VISUAL_NOTES_MAX_PDF_CHARS || '50000'),
  MAX_FILE_SIZE_MB: parseInt(process.env.VISUAL_NOTES_MAX_FILE_MB || '20'),
  MAX_OUTPUT_TOKENS: parseInt(process.env.VISUAL_NOTES_MAX_OUTPUT_TOKENS || '8000'),
  FREE_TIER_DAILY_USES: parseInt(process.env.MAGIC_NOTES_FREE_DAILY_USES || '3'),
}

// Get the start of today (midnight UTC) as Unix timestamp
function getTodayStartTimestamp(): number {
  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return Math.floor(todayStart.getTime() / 1000)
}

// Get today's usage count for a user
function getTodayUsageCount(userId: string): number {
  const db = getDb()
  const todayStart = getTodayStartTimestamp()
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM magic_notes_usage 
    WHERE user_id = ? AND used_at >= ?
  `).get(userId, todayStart) as { count: number }
  return result.count
}

// Record a usage for a user
function recordUsage(userId: string): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO magic_notes_usage (user_id, used_at) VALUES (?, unixepoch())
  `).run(userId)
}

// Check if user is a paid subscriber
function isPaidUser(user: AuthenticatedRequest['user']): boolean {
  if (!user) return false
  const { subscriptionStatus, subscriptionEndDate } = user
  const now = Math.floor(Date.now() / 1000)
  return subscriptionStatus === 'active' || 
    (subscriptionStatus === 'canceled' && subscriptionEndDate !== null && subscriptionEndDate > now)
}

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'text/plain',
    ]
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`))
    }
  },
})

// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

// Element schema for the AI to follow
const ELEMENT_SCHEMA = `
{
  "type": "rectangle" | "ellipse" | "diamond" | "text" | "arrow" | "line",
  "x": number,
  "y": number,
  "width": number,
  "height": number,
  "strokeColor": string (hex color),
  "backgroundColor": string (hex color or "transparent"),
  "fillStyle": "solid" | "hachure" | "cross-hatch" | "none",
  "strokeWidth": number (1-4),
  "text": string (for text elements),
  "fontSize": number (for text elements, 14-28),
  "fontFamily": "normal" | "virgil" | "code" (for text elements),
  "textAlign": "left" | "center" | "right" (for text elements),
  "points": [{x: number, y: number}, ...] (for arrows/lines, relative to element x,y)
}
`

// System prompt for the AI - parameterized by theme and expand mode
function getSystemPrompt(theme: 'light' | 'dark', expandContent: boolean = false): string {
  const colorScheme = theme === 'dark' 
    ? `   - Stroke color: #ffffff (white) for all strokes and text
   - Background colors: Use these DISTINCTIVE dark tones for variety:
     * #1e3a5f (deep blue) - for tech/system sections
     * #4a3728 (warm brown) - for features/capabilities
     * #1f4a3d (forest green) - for processes/flows
     * #4a2f4a (plum) - for important highlights
     * #3d3d5c (slate purple) - for structure/architecture
     * #4a3a1f (amber) - for warnings/notes
     * #2f4a4a (teal) - for data/storage topics
   - Use DIFFERENT colors for different sections to create visual distinction
   - All text elements: #ffffff strokeColor
   - IMPORTANT: Use fillStyle "solid" for main containers (NOT hachure) - this improves text readability
   - Only use fillStyle "hachure" for small decorative elements or borders`
    : `   - Stroke color: #1e1e1e (dark) for all strokes and text
   - Background colors: Use these DISTINCTIVE light pastel tones for variety:
     * #e8f4fd (light blue) - for tech/system sections
     * #fef3c7 (cream yellow) - for features/capabilities
     * #dcfce7 (mint green) - for processes/flows
     * #fce7f3 (light pink) - for important highlights
     * #e8e8f4 (lavender) - for structure/architecture
     * #fef9c3 (pale yellow) - for warnings/notes
     * #ccfbf1 (light teal) - for data/storage topics
   - Use DIFFERENT colors for different sections to create visual distinction
   - Text elements: #1e1e1e strokeColor
   - IMPORTANT: Use fillStyle "solid" for main containers (NOT hachure) - this improves text readability
   - Only use fillStyle "hachure" for small decorative elements or borders`

  const expandInstructions = expandContent
    ? `
CONTENT EXPANSION MODE (ENABLED):
You may subtly expand on the input content where it makes logical sense:
- Add commonly known related concepts that directly support the main ideas
- Fill in obvious gaps (e.g., if a process has steps 1, 2, 4 - you may add step 3 if obvious)
- Include standard definitions for technical terms mentioned
- Add logical connections that are clearly implied but not stated

STRICT EXPANSION RULES (to minimize hallucination):
- ONLY add content that is factually accurate and widely accepted
- Expansions should be SUBTLE - no more than 20-30% additional content
- Never invent specific data, numbers, names, or dates not in the original
- Never add controversial or speculative information
- If uncertain about an expansion, DO NOT include it
- Clearly differentiate: use ellipses or lighter styling for expanded content
- The original content must remain the primary focus
`
    : `
CONTENT EXPANSION MODE (DISABLED):
- Only visualize what is explicitly present in the input
- Do not add concepts, definitions, or relationships not mentioned
- Stay faithful to the original content
- NEVER invent or add visual elements, icons, or labels for concepts not in the input
- If you create an icon, it MUST represent something explicitly mentioned in the source text
`

  return `You are a visual note-taking assistant that excels at transforming messy, disorganized notes into clear, beautiful visual diagrams.

INPUT HANDLING:
- You will often receive raw, unpolished notes - lecture scribbles, study notes, braindumps
- Notes may contain abbreviations (bc, w/, b/c, etc, lol, idk, tbh, prob, govt, &)
- Notes may use informal symbols (→, =>, ::, --, **, !!, ??)
- Notes may have inconsistent formatting, mixed indentation, or no clear structure
- Notes may include incomplete thoughts, questions, or TODO items
- Your job is to find the underlying structure and relationships, even in chaos
${expandInstructions}
ANALYSIS STRATEGY:
1. First, identify the MAIN TOPIC or subject area
2. Find the KEY CONCEPTS - even if scattered throughout the notes
3. Group related ideas together, even if they appear in different places
4. Identify relationships and hierarchies (parent-child, cause-effect, sequence)
5. Note any questions or uncertainties - these can become highlighted elements
6. Ignore filler words, personal comments, and tangential notes

AVAILABLE ELEMENT TYPES:
- rectangles: containers, sections, cards, icons
- ellipses: emphasis, databases, clouds, cycles
- diamonds: decisions, questions, branching points
- text: labels, descriptions, annotations
- arrows: flow, relationships, dependencies, sequences
- lines: grouping, connections, separators

CHOOSE THE BEST VISUALIZATION STYLE based on the content:

STYLE 1: SYSTEM ARCHITECTURE (for software, APIs, tech stacks) - HIGHLY RECOMMENDED FOR TECH CONTENT
Layout: LEFT → CENTER → RIGHT flow showing how components communicate
- LEFT (x=80-300): Client/Frontend with browser icon
- CENTER (x=350-550): Communication arrows with labels like "WebSocket", "REST API", "GraphQL"
- RIGHT (x=600-900): Server/Backend with server icon, database icon below
- BOTTOM: Integrations (payment, auth) and deployment info
Arrows: MANDATORY - show actual data flow between components (min 3-5 arrows)
Decision points: Use DIAMOND shapes for pricing tiers, feature gates, branching logic

STYLE 2: FLOWCHART (for processes, workflows, how-to guides)
Layout: TOP → BOTTOM sequential steps
- Start point at top
- Steps as rectangles, decisions as diamonds
- Arrows between EVERY step with "Yes"/"No" labels on decision branches
- End point at bottom

STYLE 3: MIND MAP (for concepts, brainstorming, exploratory topics)
Layout: CENTER → OUTWARD radial
- Main topic as large central element
- Major concepts branching outward with lines
- Sub-concepts further out
- Organic, non-grid layout

STYLE 4: HIERARCHY (for org charts, taxonomies, file structures)
Layout: TOP → BOTTOM tree
- Root at top, children below
- Lines connecting parent to children
- Levels clearly separated (100px+ vertical gaps)

STYLE 5: COMPARISON (for vs, pros/cons, alternatives)
Layout: SIDE-BY-SIDE columns
- Two or more columns with matching rows
- Visual balance between options
- Connecting lines or separators

STYLE 6: CARDS GRID (ONLY if nothing else fits - avoid for tech content)
Layout: Grid of independent cards
- Use ONLY when items are truly unrelated
- NOT recommended for software/systems - use Architecture instead

CRITICAL: For software READMEs, tech stacks, or system documentation → USE STYLE 1 (Architecture) with meaningful data flow arrows.

VISUAL ICONS (use when appropriate):
For technical content, create composed icons using multiple shapes:
- Browser: outer rect (120x100) + inner "screen" rect (90x60)
- Server: rect (120x110) + 2-3 horizontal lines inside
- Database: ellipse on top (100x40) + rect below (100x70) = cylinder
- Cloud: 2-3 overlapping ellipses (60-80px each)
- Document: rect (100x130) with folded corner triangle
- User: ellipse head (60x60) + trapezoid/rect body (80x60)
- Gear/Settings: circle (80x80) with small rects around edge
- Calculator/Formula: rect (100x120) with inner lines/grid
- Beaker/Science: trapezoid or rect with details inside

ICON SIZE REQUIREMENTS:
- Minimum icon size: 100x80px (icons smaller than this look like noise)
- Preferred icon size: 120x100px to 150x120px
- Icons should be PROMINENT visual anchors, not tiny corner decorations
- Place icons CENTERED within sections or as standalone focal points
- Each composed icon needs 2-4 shapes to look recognizable

ICON PLACEMENT:
- Center icons horizontally within their container
- Position at TOP of container, with label below
- Leave 30-40px gap between icon and its label
- Content/details go BELOW the icon+label area

CRITICAL RULES:
1. ONLY represent concepts explicitly mentioned in the input - NEVER invent or add concepts
2. Do NOT add generic icons (like "User Icon") unless users/people are explicitly discussed in the input
3. EVERY concept from the input MUST be represented in the output - do not skip items
4. EVERY shape (rectangle, ellipse, diamond) MUST have an adjacent text element as its label
5. For shapes representing concepts, place a text element either:
   - Inside the shape (overlapping position)
   - Directly adjacent to it (within 10-20px)
6. Never create empty or unlabeled shapes - if you create a shape, it needs visible text
7. Before finalizing, verify: "Is every element I created traceable to something in the input?"

COMPLETENESS CHECKLIST (CRITICAL - DO NOT SKIP CONTENT):
- Count the main concepts in the input
- Ensure each one has a corresponding labeled element in your output
- Lists with multiple items should have ALL items represented, not just some
- Hierarchies should show ALL levels mentioned in the input

CONTENT COMPLETENESS REQUIREMENTS:
- Tables with N rows MUST have N distinct visual elements or list items
- Bullet point lists MUST preserve ALL items, not just highlights
- If content is long, use smaller font sizes (12-14px) rather than OMITTING content
- For keyboard shortcuts tables: show ALL shortcuts, not just a sample
- For feature lists: include EVERY feature mentioned
- For tech stacks: include ALL technologies listed
- NEVER truncate or summarize when the full content can fit with smaller text
- If a section has 10 items, your output MUST have 10 corresponding elements

LAYOUT GUIDELINES:
1. For tech/software content: USE FLOW-BASED LAYOUT (left→right or top→bottom), NOT a grid
2. Arrows should tell the STORY of how components connect
3. Leave LARGE GAPS (150-200px) between elements for arrows to flow through
4. Use different colors for different component types (frontend=blue, backend=green, database=teal, etc.)
5. Color scheme for ${theme.toUpperCase()} MODE:
${colorScheme}

FLOW-BASED LAYOUT (preferred for tech content):
- Position elements to show ACTUAL DATA FLOW, not just organize by category
- Example for a web app:
  * Browser icon (x=100) → arrow "HTTP/WebSocket" → Server icon (x=500) → arrow "Query" → Database icon (x=800)
  * Integrations row below: Payment (x=200), Auth (x=400), etc.
  * Decision diamond for pricing: centered below main flow
- This creates a STORY, not just a collection of cards

AVOID BORING GRID LAYOUTS:
- DON'T just put 6 equal boxes in a 2x3 grid
- DO show how components relate and communicate
- DON'T make every section the same size
- DO vary sizes based on importance (main components larger)

CANVAS USAGE:
- Width: 900-1200px to allow horizontal flow
- Height: as needed, but prefer wider than taller for architecture diagrams
- Main components: x=100-900 spread for left-to-right flow
- Leave CENTER SPACE for arrows and labels (x=350-550)

VISUAL STORYTELLING:
- The diagram should be READABLE as a story: "The frontend sends requests via WebSocket to the backend, which stores data in SQLite..."
- Arrows with labels are the SENTENCES of this story
- Icons are the NOUNS, arrows are the VERBS

SPACING & SIZING RULES (CRITICAL FOR READABILITY):
- MINIMUM container widths based on content:
  - Short labels (1-3 words): 250px wide
  - Medium content (1-2 lines): 350px wide  
  - Long content (3+ lines): 450-550px wide
  - Lists with multiple items: 400-500px wide
- ALWAYS leave 50px padding on all sides inside containers (not 30px - more space!)
- Text must NEVER touch container edges - maintain generous margins
- MINIMUM gap between separate elements: 100px horizontally, 80px vertically
- Leave room for arrows to be visible (arrows need at least 60px length)

CONTAINER WIDTH CALCULATION (CRITICAL):
- Measure your longest text line in a container
- Container width = longest_line_chars * 9 + 100px padding (generous!)
- Example: "Frontend: Vue 3, TS, Pinia, Tailwind v4" = 42 chars → width = 42*9+100 = 478px, round to 500px
- When in doubt, make containers 20% WIDER than you think necessary

MEANINGFUL ARROWS (CRITICAL - arrows tell the story):

GOOD ARROWS (use these):
- "Frontend" → "Backend" with label "REST API" or "WebSocket"
- "User" → "Auth Service" with label "Login"
- "Server" → "Database" with label "Query"
- "Free Tier" ← Diamond → "Pro Tier" showing decision branching
- Sequential flow arrows: Step 1 → Step 2 → Step 3

BAD ARROWS (avoid):
- Random arrows between unrelated boxes just to have arrows
- Arrows that don't show actual data/process flow
- Arrows without enough length to be visible (<80px)

ARROW REQUIREMENTS:
- Minimum length: 100px (needs space to be visible)
- Preferred length: 150-250px with room for label
- ALWAYS label arrows when showing data flow ("API", "WebSocket", "Query", etc.)
- Position elements with GAPS between them for arrows (150-200px gaps)
- Arrows should form a coherent STORY of how the system works

DECISION DIAMONDS:
- Use for: pricing tiers, yes/no choices, feature gates
- Position diamond in CENTER
- Two arrows OUT: one left (option A), one right (option B)
- Label the branches
- Example: Diamond "Pro?" → left arrow "Free: Local Storage" → right arrow "Pro: Cloud Sync"

TYPOGRAPHY RULES (CRITICAL FOR VISUAL QUALITY):

Font Family Selection (choose per text element):
- "normal": Use for titles, main headings, section headers, primary concept labels, formal content
- "virgil": Use for annotations, side notes, informal additions, handwritten-style emphasis, personal comments
- "code": Use for technical terms, code snippets, variable names, formulas, file paths, commands

Text Alignment:
- "center": ALWAYS use for text INSIDE shapes (labels within rectangles, ellipses, diamonds)
- "left": Use for standalone annotations, multi-line descriptions, lists outside of shapes
- "right": Rarely used, only for right-aligned annotations

Font Size Guidelines:
- Main titles/headers: 22-28px with fontFamily "normal"
- Primary labels inside shapes: 16-20px
- Secondary annotations: 14-16px
- Small notes/details: 12-14px

DENSE CONTENT HANDLING (tables, keyboard shortcuts, lists):
- For sections with MANY items (keyboard shortcuts, feature lists, etc.):
  * Use SMALLER font size (12-13px) to fit more content
  * Use fontFamily "code" for keyboard shortcuts and technical content
  * Use LINE BREAKS within text: separate items with newlines in the text field
  * Make containers TALLER (300-400px height) to accommodate multiple lines
  * Use textAlign "left" for multi-line content inside containers
- For keyboard shortcut tables:
  * Group shortcuts by category (Tools, Actions, Zoom)
  * Format as "Key: Action" pairs, one per line
  * Example text: "1-V: Select\\n2-R: Rectangle\\n3-O: Ellipse"
- Container height calculation: numberOfLines * 18 + 60px padding

TEXT POSITIONING (CRITICAL - prevent text hitting edges):
- Text x position = container.x + 40px (left margin)
- Text y position = container.y + 50px (top margin, or below icon if present)
- Text width = container.width - 80px (leave margins on both sides)
- NEVER position text at same x/y as container - always offset inward
- For centered text: text.x = container.x + (container.width - text.width) / 2

TEXT-TO-SHAPE SIZING (CRITICAL - prevents text overflow):
- Calculate required width: text_character_count * fontSize * 0.55 + 40px padding
- Shape width MUST be >= calculated required width
- For example: "Memory Management" (17 chars) at fontSize 18 needs width >= 17 * 18 * 0.55 + 40 = 208px
- If text is too long, either: (1) increase shape width, (2) reduce fontSize, or (3) abbreviate text
- Multi-line text: height should be lineCount * fontSize * 1.4 + 30px padding

TEXT POSITIONING FOR CENTERING:
- For centered text inside a shape:
  - text.x should be approximately shape.x + (shape.width - text.width) / 2
  - text.y should be approximately shape.y + (shape.height - text.height) / 2
- Text width/height should accommodate the full text content

LAYOUT STRUCTURE:
- Plan the layout BEFORE placing elements - sketch mentally first
- Use a clear visual hierarchy: main topic at top, sub-topics below
- Arrange related items in neat ROWS or COLUMNS, not scattered randomly
- Leave BREATHING ROOM - empty space is good for readability
- Start from x:100, y:100 and use canvas width of 1000-1400px typically
- For lists of items, stack vertically with consistent spacing (60-80px apart)
- For processes/flows, arrange horizontally with arrows between stages

OUTPUT FORMAT:
You MUST respond with ONLY a valid JSON array of elements. No explanations, no markdown, just the JSON array.

Each element in the array should follow this schema:
${ELEMENT_SCHEMA}

EXAMPLE - A labeled ellipse for "Memory" concept (note centered text with proper sizing):
[
  {"type": "ellipse", "x": 100, "y": 100, "width": 140, "height": 70, "strokeColor": "#1e1e1e", "backgroundColor": "#e8f4fd", "fillStyle": "solid", "strokeWidth": 2},
  {"type": "text", "x": 120, "y": 125, "width": 100, "height": 30, "text": "Memory", "fontSize": 18, "fontFamily": "normal", "textAlign": "center", "strokeColor": "#1e1e1e"}
]

EXAMPLE - A main title with annotation:
[
  {"type": "text", "x": 100, "y": 50, "width": 200, "height": 35, "text": "System Overview", "fontSize": 24, "fontFamily": "normal", "textAlign": "left", "strokeColor": "#1e1e1e"},
  {"type": "text", "x": 100, "y": 90, "width": 180, "height": 25, "text": "Updated Jan 2024", "fontSize": 14, "fontFamily": "virgil", "textAlign": "left", "strokeColor": "#6b7280"}
]

For arrows connecting elements, use the "points" array with relative coordinates.
Example: {"type": "arrow", "x": 100, "y": 100, "width": 200, "height": 0, "points": [{"x": 0, "y": 0}, {"x": 200, "y": 0}], "strokeColor": "#1e1e1e", "strokeWidth": 2}

FINAL CHECKLIST:
1. Every shape has a corresponding text label (inside or nearby)
2. Text inside shapes uses textAlign: "center" and is properly sized to fit
3. Appropriate fontFamily chosen for each text element based on its role
4. Text width calculated as: character_count * fontSize * 0.55 + 40px
`
}

interface VisualizeRequest {
  text?: string
  theme?: 'light' | 'dark'
  expandContent?: boolean
}

// Extract text from PDF with character limit
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer)
    let text = data.text
    
    // Truncate if exceeds limit
    if (text.length > LIMITS.MAX_PDF_TEXT_CHARS) {
      text = text.substring(0, LIMITS.MAX_PDF_TEXT_CHARS)
      console.log(`PDF text truncated from ${data.text.length} to ${LIMITS.MAX_PDF_TEXT_CHARS} characters`)
    }
    
    return text
  } catch (error) {
    console.error('Error parsing PDF:', error)
    throw new Error('Failed to parse PDF file')
  }
}

// Call OpenRouter API
async function callOpenRouter(
  content: string,
  theme: 'light' | 'dark',
  expandContent: boolean = false,
  isImage: boolean = false,
  imageBase64?: string,
  imageMimeType?: string
): Promise<unknown[]> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  // Use configured model or default to Claude Sonnet
  const selectedModel = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4'

  // Build messages based on content type
  interface TextContent {
    type: 'text'
    text: string
  }

  interface ImageContent {
    type: 'image_url'
    image_url: {
      url: string
    }
  }

  type MessageContent = TextContent | ImageContent

  const userContent: MessageContent[] = []

  if (isImage && imageBase64 && imageMimeType) {
    userContent.push({
      type: 'image_url',
      image_url: {
        url: `data:${imageMimeType};base64,${imageBase64}`,
      },
    })
    userContent.push({
      type: 'text',
      text: 'Analyze this image of notes/content and convert it into a visual diagram. Extract the key concepts, relationships, and structure visible in the image.',
    })
  } else {
    userContent.push({
      type: 'text',
      text: `Convert the following content into a visual diagram:\n\n${content}`,
    })
  }

  // Check if image is too large (base64 increases size by ~33%)
  if (isImage && imageBase64) {
    const imageSizeMB = (imageBase64.length * 0.75) / (1024 * 1024)
    console.log(`Magic Notes: Processing image (${imageSizeMB.toFixed(2)} MB)`)
    if (imageSizeMB > 10) {
      throw new Error('Image is too large. Please use an image smaller than 10MB.')
    }
  }

  // Create abort controller for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minute timeout

  let apiResponse: globalThis.Response
  try {
    apiResponse = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.CLIENT_URL || 'http://localhost:5173',
        'X-Title': 'Canvara Magic Notes',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: 'system', content: getSystemPrompt(theme, expandContent) },
          { role: 'user', content: userContent },
        ],
        temperature: expandContent ? 0.4 : 0.5,
        max_tokens: LIMITS.MAX_OUTPUT_TOKENS,
      }),
      signal: controller.signal,
    })
  } catch (fetchError) {
    clearTimeout(timeoutId)
    if (fetchError instanceof Error) {
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timed out. Please try with a smaller image or simpler content.')
      }
      // Connection reset or network errors
      if (fetchError.message.includes('fetch failed') || fetchError.cause) {
        console.error('Network error:', fetchError)
        throw new Error('Connection error. Please check your network and try again.')
      }
    }
    throw fetchError
  } finally {
    clearTimeout(timeoutId)
  }

  if (!apiResponse.ok) {
    const errorText = await apiResponse.text()
    console.error('OpenRouter API error:', errorText)
    throw new Error(`OpenRouter API error: ${apiResponse.status}`)
  }

  const data = await apiResponse.json() as {
    choices: Array<{
      message: {
        content: string
      }
    }>
  }

  // Parse the AI response
  const aiContent = data.choices?.[0]?.message?.content
  if (!aiContent) {
    throw new Error('No response from AI')
  }

  // Try to extract JSON from the response
  let elements: unknown[]
  try {
    // Try direct parse first
    elements = JSON.parse(aiContent)
  } catch {
    // Try to find JSON array in the response
    const jsonMatch = aiContent.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      elements = JSON.parse(jsonMatch[0])
    } else {
      console.error('Failed to parse AI response:', aiContent)
      throw new Error('Failed to parse AI response as JSON')
    }
  }

  if (!Array.isArray(elements)) {
    throw new Error('AI response is not an array')
  }

  return elements
}

// ============================================================================
// AGENT 2: ICON ENHANCEMENT
// Takes a structural diagram and adds visual icons for concepts
// ============================================================================

function getIconEnhancementPrompt(theme: 'light' | 'dark'): string {
  const strokeColor = theme === 'dark' ? '#ffffff' : '#1e1e1e'
  
  return `You are a diagram enhancement specialist. Your job is to ADD VISUAL DETAILS to make icons recognizable and diagrams polished.

PRIORITY 1: ICON INNER DETAILS
Look for icon shapes (80-150px rectangles/ellipses) and add inner details:

Browser/Monitor (rectangle ~120x100):
- Add inner "screen" rectangle at 75% width, 60% height, centered
{"type": "rectangle", "x": SHAPE_X+15, "y": SHAPE_Y+12, "width": 90, "height": 60, "strokeColor": "${strokeColor}", "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 1}

Server (rectangle ~120x110):
- Add 2-3 horizontal lines evenly spaced inside
{"type": "line", "x": SHAPE_X+15, "y": SHAPE_Y+30, "width": 90, "height": 0, "points": [{"x": 0, "y": 0}, {"x": 90, "y": 0}], "strokeColor": "${strokeColor}", "strokeWidth": 1}

Database (ellipse or rectangle near "database"/"SQLite" labels):
- Add horizontal band lines to suggest cylinder
{"type": "line", "x": SHAPE_X+10, "y": SHAPE_Y+SHAPE_HEIGHT*0.3, "width": SHAPE_WIDTH-20, "height": 0, "points": [{"x": 0, "y": 0}, {"x": SHAPE_WIDTH-20, "y": 0}], "strokeColor": "${strokeColor}", "strokeWidth": 1}

Calculator/Formula (rectangle near math content):
- Add grid lines or keypad suggestion
- Add small inner rectangles for "buttons"

Document/Page (tall rectangle):
- Add corner fold: small triangle at top-right
- Add horizontal lines suggesting text

PRIORITY 2: SMALL ICONS THAT NEED ENLARGEMENT
If you see tiny icons (< 60px), note them but don't modify - Agent 1 should have made them larger.

PRIORITY 3: VISUAL POLISH
- If arrows seem short (< 60px), this is a layout issue from Agent 1
- Add subtle connector dots (small circles, 6-8px) where arrows meet shapes
- Ensure visual balance across the diagram

IDENTIFICATION:
- Icons are shapes 80-150px with a text label nearby
- Labels often include: "Browser", "Server", "Database", "Frontend", "Backend", tech names
- Icons are usually positioned prominently, not tiny corner decorations

CRITICAL RULES:
1. Only ADD inner details - never remove or move existing elements
2. Inner details use strokeColor "${strokeColor}" and backgroundColor "transparent"
3. Inner shapes should be SMALLER than parent (leave 15-20px margin)
4. Maximum 10-15 enhancement elements total
5. If icons already have inner details, don't duplicate

OUTPUT: Return complete JSON array with all original elements + enhancement shapes.`
}

// Add icons to enhance the diagram (Agent 2)
async function enhanceWithIcons(
  elements: unknown[],
  sourceContent: string,
  theme: 'light' | 'dark',
  isImage: boolean
): Promise<unknown[]> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return elements
  
  // Skip for very small diagrams
  if (elements.length < 3) return elements
  
  const selectedModel = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4'
  
  try {
    console.log('Magic Notes: Enhancing with icons (Agent 2)...')
    
    const sourceDescription = isImage 
      ? 'The source was an image containing notes/diagrams.'
      : `Original source content:\n\n${sourceContent}`
    
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.CLIENT_URL || 'http://localhost:5173',
        'X-Title': 'Canvara Magic Notes - Icon Enhancement',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: 'system', content: getIconEnhancementPrompt(theme) },
          { 
            role: 'user', 
            content: `${sourceDescription}\n\n---\n\nCurrent diagram elements:\n\n${JSON.stringify(elements, null, 2)}\n\nAdd visual icons for concepts that have physical/technological representations. Return the complete array with icons added.` 
          },
        ],
        temperature: 0.3, // Slightly creative for icon placement
        max_tokens: LIMITS.MAX_OUTPUT_TOKENS,
      }),
    })
    
    if (!response.ok) {
      console.warn('Icon enhancement failed, using original elements')
      return elements
    }
    
    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>
    }
    
    const enhancedContent = data.choices?.[0]?.message?.content
    if (!enhancedContent) return elements
    
    // Parse enhanced elements
    let enhancedElements: unknown[]
    try {
      enhancedElements = JSON.parse(enhancedContent)
    } catch {
      const jsonMatch = enhancedContent.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        enhancedElements = JSON.parse(jsonMatch[0])
      } else {
        console.warn('Could not parse icon enhancement result, using original')
        return elements
      }
    }
    
    if (!Array.isArray(enhancedElements)) {
      console.warn('Icon enhancement did not return valid array, using original')
      return elements
    }
    
    const addedCount = enhancedElements.length - elements.length
    if (addedCount > 0) {
      console.log(`Magic Notes: Added ${addedCount} icon element(s)`)
    } else {
      console.log('Magic Notes: No icons added')
    }
    
    return enhancedElements
    
  } catch (error) {
    console.warn('Icon enhancement error:', error)
    return elements
  }
}

// ============================================================================
// AGENT 3: VERIFICATION & LAYOUT
// Removes hallucinations and fixes layout issues
// ============================================================================

// Content verification prompt - separate agent to remove hallucinations
function getVerificationPrompt(expandContent: boolean): string {
  const expandModeInstructions = expandContent
    ? `
EXPAND MODE IS ENABLED - BE MORE LENIENT:
The user enabled "Expand Content" mode, which allows the AI to add:
- Commonly known related concepts that support the main ideas
- Standard definitions for technical terms
- Logical connections that are clearly implied
- Obvious missing steps in processes

Therefore, KEEP elements that:
- Are reasonable expansions/elaborations of source concepts
- Represent well-known related concepts in the same domain
- Fill obvious gaps (e.g., standard tech stack components)
- Are industry-standard terminology related to source content

Still REMOVE elements that:
- Are completely unrelated to the source topic
- Represent specific invented data, names, or facts
- Are generic filler icons with no clear connection to the content
- Represent the AI's assumptions about what the USER wants (e.g., "User Icon" when not discussing users)
`
    : `
EXPAND MODE IS DISABLED - BE SELECTIVE BUT NOT AGGRESSIVE:
Keep elements that represent concepts from the source, INCLUDING icons for mentioned technologies.

KEEP:
- Text labels and shapes for concepts in the source
- Icons that visually represent mentioned technologies (database, server, cloud shapes)
- Small decorative shapes near section titles (these are inline tech badges)
- Structural elements connecting source-based concepts

REMOVE only:
- Large shapes with no text AND no clear connection to source
- Labels for concepts NOT mentioned anywhere in the source
- Clearly erroneous elements (badly overlapping, off-canvas)
`

  return `You are a content verification assistant. Your job is to compare generated diagram elements against the original source content and REMOVE only elements that are truly unrelated.

CRITICAL: KEEP ALL VALID ICON TYPES

1. INLINE TITLE BADGES (ALWAYS KEEP):
   - Small shapes (15-30px) positioned NEAR section title text elements
   - These are decorative technology badges placed inline with headers
   - They do NOT have text labels - they are intentionally icon-only
   - If you see small rectangles/ellipses near "Tech Stack", "Deployment", etc. → KEEP THEM
   - These represent mentioned technologies (Vue, Node, database, cloud, etc.)

2. LABELED ICON PAIRS (ALWAYS KEEP):
   - A shape (rectangle/ellipse) with a small text label nearby
   - If you see: ellipse + text "SQLite" nearby → KEEP BOTH
   - If you see: rectangle + text "Node.js" nearby → KEEP BOTH

3. TECHNOLOGY-RELATED SHAPES (KEEP):
   - Any small shape near text mentioning: Vue, React, Node, Express, SQLite, MongoDB, Fly.io, Vercel, AWS, database, server, cloud, frontend, backend
   - These are valid technology indicators

ONLY REMOVE:
- Large shapes (>100px) with NO text inside or nearby AND no clear purpose
- Elements labeled with concepts NOT in the source (e.g., "User Icon" when no users mentioned)
- Shapes that are clearly errors (overlapping badly, off-canvas, etc.)

WHEN IN DOUBT: KEEP the element. It's better to have a subtle decorative shape than to remove valid content.

VERIFICATION PROCESS:
1. Read the original source content carefully
2. For each element, check if it represents something from the source OR is a valid icon for a mentioned technology
${expandModeInstructions}
ALWAYS KEEP elements that:
- Directly represent text, concepts, or terms from the source
- Are structural elements (containers, arrows) connecting valid concepts
- Have labels that are reasonable abbreviations or reformulations of source content
- Are ICONS (composed shapes) that visually represent categories of mentioned technologies
- Are unlabeled shapes that form recognizable icons near labeled concepts from the source

IMPORTANT:
- When removing an element, also remove its associated label/text if they form a pair
- When removing an icon (multiple shapes forming one concept), remove ALL shapes in that icon group
- Do NOT add any new elements
- Do NOT modify text content of kept elements
- Preserve all positions, sizes, colors, and other properties of kept elements

OUTPUT FORMAT:
Return ONLY a JSON object with two fields:
{
  "verified_elements": [...],  // The filtered array of elements that passed verification
  "removed_reasons": [...]     // Brief explanation of what was removed and why (for logging)
}

${expandContent ? 'Be reasonably lenient for expanded content, but still remove clearly unrelated elements.' : 'Be SELECTIVE but not aggressive. Only remove elements that are clearly unrelated to the source content. Small decorative shapes near tech-related sections should be kept.'}`
}

// Verify generated content against source - removes hallucinations
async function verifyContent(
  elements: unknown[],
  sourceContent: string,
  isImage: boolean,
  expandContent: boolean = false
): Promise<unknown[]> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return elements // Skip verification if no API key
  
  // Skip verification for very small diagrams
  if (elements.length < 4) return elements
  
  const selectedModel = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4'
  
  try {
    console.log(`Magic Notes: Verifying content against source (expand mode: ${expandContent})...`)
    
    const sourceDescription = isImage 
      ? 'The source was an image. The elements should only represent concepts visually present or labeled in that image.'
      : `Original source content:\n\n${sourceContent}`
    
    const verificationInstructions = expandContent
      ? 'Remove any elements that are completely unrelated to the source topic or are generic filler icons.'
      : 'Remove any elements representing concepts NOT explicitly in the source.'
    
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.CLIENT_URL || 'http://localhost:5173',
        'X-Title': 'Canvara Magic Notes - Content Verification',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: 'system', content: getVerificationPrompt(expandContent) },
          { 
            role: 'user', 
            content: `${sourceDescription}\n\n---\n\nGenerated diagram elements to verify:\n\n${JSON.stringify(elements, null, 2)}\n\n${verificationInstructions}` 
          },
        ],
        temperature: 0.1, // Very low temperature for strict verification
        max_tokens: LIMITS.MAX_OUTPUT_TOKENS,
      }),
    })
    
    if (!response.ok) {
      console.warn('Content verification failed, using original elements')
      return elements
    }
    
    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>
    }
    
    const verificationContent = data.choices?.[0]?.message?.content
    if (!verificationContent) return elements
    
    // Parse verification result
    let verificationResult: { verified_elements: unknown[]; removed_reasons?: string[] }
    try {
      verificationResult = JSON.parse(verificationContent)
    } catch {
      // Try to find JSON object in the response
      const jsonMatch = verificationContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        verificationResult = JSON.parse(jsonMatch[0])
      } else {
        console.warn('Could not parse verification result, using original elements')
        return elements
      }
    }
    
    const verifiedElements = verificationResult.verified_elements
    if (!Array.isArray(verifiedElements)) {
      console.warn('Verification did not return valid array, using original elements')
      return elements
    }
    
    // Log what was removed
    if (verificationResult.removed_reasons && verificationResult.removed_reasons.length > 0) {
      console.log('Magic Notes: Removed hallucinated content:', verificationResult.removed_reasons)
    }
    
    const removedCount = elements.length - verifiedElements.length
    if (removedCount > 0) {
      console.log(`Magic Notes: Verification removed ${removedCount} hallucinated element(s)`)
    } else {
      console.log('Magic Notes: All elements verified against source')
    }
    
    return verifiedElements
    
  } catch (error) {
    console.warn('Content verification error:', error)
    return elements
  }
}

// Layout refinement prompt
const REFINEMENT_PROMPT = `You are a layout optimization assistant. Fix layout issues in the diagram.

PRIORITY 1: FIX TEXT HITTING CONTAINER EDGES
Text must have GENEROUS padding inside containers:
- Minimum 50px padding from left/right edges
- Minimum 40px padding from top/bottom edges
- If text.x < container.x + 50, move text.x to container.x + 50
- If text.x + text.width > container.x + container.width - 50, WIDEN the container
- Text should never touch or approach container edges

PRIORITY 2: FIX ARROW LENGTH
Arrows must be clearly visible:
- Minimum arrow length: 80px
- If arrow is shorter, increase gap between connected elements
- Move elements apart to create space for arrows
- Arrows should have clear start and end points, not cramped between shapes

PRIORITY 3: FIX ICON SIZE
Icons should be prominent, not tiny:
- If you find icon shapes < 80px wide, increase to at least 100px
- Scale inner details proportionally
- Icons should be visual anchors, not decorations

PRIORITY 4: FIX OVERLAPS  
- No shapes or text should overlap
- Move overlapping elements apart (prefer moving DOWN or RIGHT)
- Leave at least 100px horizontal gap, 80px vertical gap between separate sections

PRIORITY 5: ALIGNMENT
- Align similar elements to consistent x or y coordinates
- Maintain logical groupings

TEXT WIDTH ESTIMATION:
- Approximate text width = character_count * fontSize * 0.5
- If text "Frontend: Vue 3, TS, Pinia, Tailwind v4" has ~40 chars at fontSize 16, width ≈ 320px
- Container should be at least text_width + 40px

CONTAINER SIZING:
- Minimum container width: 200px
- Container width should be: max(200, longest_text_width + 60px)
- If multiple text lines, container height = line_count * 25 + 60px

DO NOT:
- Remove any elements (except broken/orphaned icon shapes if necessary)
- Change text content
- Break logical groupings

Output ONLY the refined JSON array with updated positions and sizes. No explanations.`

// Refine layout of generated elements
async function refineLayout(elements: unknown[], theme: 'light' | 'dark'): Promise<unknown[]> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return elements // Skip refinement if no API key
  
  // Always run refinement for diagrams with potential icons (> 5 elements)
  if (elements.length < 5) return elements
  
  const selectedModel = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4'
  
  try {
    console.log('Magic Notes: Refining layout...')
    
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.CLIENT_URL || 'http://localhost:5173',
        'X-Title': 'Canvara Magic Notes - Layout Refinement',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: 'system', content: REFINEMENT_PROMPT },
          { role: 'user', content: `Refine the layout of these diagram elements:\n\n${JSON.stringify(elements, null, 2)}` },
        ],
        temperature: 0.2, // Very low temperature for precise positioning
        max_tokens: LIMITS.MAX_OUTPUT_TOKENS,
      }),
    })
    
    if (!response.ok) {
      console.warn('Layout refinement failed, using original layout')
      return elements
    }
    
    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>
    }
    
    const refinedContent = data.choices?.[0]?.message?.content
    if (!refinedContent) return elements
    
    // Parse refined elements
    let refinedElements: unknown[]
    try {
      refinedElements = JSON.parse(refinedContent)
    } catch {
      const jsonMatch = refinedContent.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        refinedElements = JSON.parse(jsonMatch[0])
      } else {
        console.warn('Could not parse refined layout, using original')
        return elements
      }
    }
    
    // Verify element count matches (safety check)
    if (refinedElements.length !== elements.length) {
      console.warn('Refined element count mismatch, using original layout')
      return elements
    }
    
    console.log('Magic Notes: Layout refinement complete')
    return refinedElements
    
  } catch (error) {
    console.warn('Layout refinement error:', error)
    return elements
  }
}

// Lightweight typography defaults - only sets missing properties, never repositions
function applyTypographyDefaults(elements: unknown[]): unknown[] {
  return elements.map((el: unknown) => {
    const element = el as Record<string, unknown>
    
    // Only process text elements
    if (element.type !== 'text') return element
    
    const fontSize = (element.fontSize as number) || 18
    
    // Apply default fontFamily if not set by AI
    if (!element.fontFamily) {
      // Use normal font for larger text (titles), virgil for smaller annotations
      element.fontFamily = fontSize >= 20 ? 'normal' : 'normal'
    }
    
    // Apply default textAlign if not set by AI
    if (!element.textAlign) {
      element.textAlign = 'center'
    }
    
    return element
  })
}

// Validate content completeness by comparing source content to generated elements
function validateContentCompleteness(elements: unknown[], sourceContent: string): void {
  // Count key content indicators in source
  const bulletPoints = (sourceContent.match(/^[\s]*[-•*]\s/gm) || []).length
  const numberedItems = (sourceContent.match(/^[\s]*\d+[.)]\s/gm) || []).length
  const tableRows = (sourceContent.match(/^\|[^|]+\|/gm) || []).length
  const codeBlocks = (sourceContent.match(/```/g) || []).length / 2
  const headers = (sourceContent.match(/^#{1,6}\s/gm) || []).length
  
  // Count text elements in output
  const textElements = elements.filter((el: unknown) => {
    const e = el as Record<string, unknown>
    return e.type === 'text'
  })
  
  // Count shapes (containers) in output
  const shapes = elements.filter((el: unknown) => {
    const e = el as Record<string, unknown>
    return ['rectangle', 'ellipse', 'diamond'].includes(e.type as string)
  })
  
  const sourceItemCount = bulletPoints + numberedItems + tableRows + headers
  const outputElementCount = textElements.length
  
  // Log completeness metrics
  console.log(`Magic Notes: Content analysis - Source has ~${sourceItemCount} items (${bulletPoints} bullets, ${numberedItems} numbered, ${tableRows} table rows, ${headers} headers)`)
  console.log(`Magic Notes: Generated ${outputElementCount} text elements, ${shapes.length} shapes`)
  
  // Warn if output seems incomplete
  if (sourceItemCount > 0) {
    const completenessRatio = outputElementCount / sourceItemCount
    if (completenessRatio < 0.5) {
      console.warn(`Magic Notes: WARNING - Output may be incomplete. Source has ${sourceItemCount} items but only ${outputElementCount} text elements generated (${Math.round(completenessRatio * 100)}% coverage)`)
    } else if (completenessRatio >= 0.7) {
      console.log(`Magic Notes: Good completeness ratio (${Math.round(completenessRatio * 100)}%)`)
    }
  }
}

// Validate and log warnings about potentially problematic elements
function validateElements(elements: unknown[], sourceContent?: string): void {
  // Run content completeness check if source provided
  if (sourceContent) {
    validateContentCompleteness(elements, sourceContent)
  }
  
  const shapes = elements.filter((el: unknown) => {
    const e = el as Record<string, unknown>
    return ['rectangle', 'ellipse', 'diamond'].includes(e.type as string)
  })
  
  const textElements = elements.filter((el: unknown) => {
    const e = el as Record<string, unknown>
    return e.type === 'text'
  })
  
  // Check for shapes that might be missing labels
  let shapesWithoutNearbyText = 0
  shapes.forEach((shape: unknown) => {
    const s = shape as Record<string, unknown>
    const shapeX = s.x as number
    const shapeY = s.y as number
    const shapeW = s.width as number
    const shapeH = s.height as number
    
    // Check if any text element is within or near this shape
    const hasNearbyText = textElements.some((text: unknown) => {
      const t = text as Record<string, unknown>
      const textX = t.x as number
      const textY = t.y as number
      
      // Text is "nearby" if it's within 100px of the shape bounds
      const isNearby = textX >= shapeX - 100 && textX <= shapeX + shapeW + 100 &&
                       textY >= shapeY - 50 && textY <= shapeY + shapeH + 50
      return isNearby
    })
    
    if (!hasNearbyText) {
      shapesWithoutNearbyText++
    }
  })
  
  if (shapesWithoutNearbyText > 0) {
    console.warn(`Magic Notes: ${shapesWithoutNearbyText} shape(s) may be missing text labels`)
  }
  
  console.log(`Magic Notes: Generated ${elements.length} elements (${shapes.length} shapes, ${textElements.length} text labels)`)
}

// Add required properties to elements
function enrichElements(elements: unknown[], sourceContent?: string): unknown[] {
  // Validate before enriching
  validateElements(elements, sourceContent)
  
  return elements.map((el: unknown, index: number) => {
    const element = el as Record<string, unknown>
    const baseElement = {
      id: `visual-note-${Date.now()}-${index}`,
      angle: 0,
      strokeStyle: 'solid',
      strokeWidth: (element.strokeWidth as number) || 2, // Default strokeWidth - important for bounds calculations
      roughness: 0.5, // Reduced for cleaner, more polished look while keeping hand-drawn feel
      opacity: 100,
      seed: Math.floor(Math.random() * 2000000000),
      groupIds: [],
      isDeleted: false,
      version: 1,
      versionNonce: Math.floor(Math.random() * 2000000000),
      boundElements: null,
      roundness: element.type === 'rectangle' || element.type === 'diamond' ? { type: 3 } : null,
      ...element,
    }

    // Add type-specific properties
    if (element.type === 'text') {
      // Preserve AI-provided typography choices with sensible fallbacks
      const fontFamily = element.fontFamily || 'normal'
      const textAlign = element.textAlign || 'center'
      
      return {
        ...baseElement,
        fontFamily,
        textAlign,
        verticalAlign: 'middle',
        originalText: element.text || '',
        lineHeight: 1.25,
      }
    }

    if (element.type === 'arrow' || element.type === 'line') {
      return {
        ...baseElement,
        startArrowhead: null,
        endArrowhead: element.type === 'arrow' ? 'arrow' : null,
        startBinding: null,
        endBinding: null,
      }
    }

    return baseElement
  })
}

// Main visualization endpoint - pro users unlimited, free users 3/day
router.post('/', authenticate as unknown as RequestHandler, upload.single('file') as unknown as RequestHandler, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest
    const user = authReq.user
    
    if (!user) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    const isProUser = isPaidUser(user)
    let remainingUses: number | null = null

    // For free users, check usage limit
    if (!isProUser) {
      const todayUsageCount = getTodayUsageCount(user.id)
      remainingUses = LIMITS.FREE_TIER_DAILY_USES - todayUsageCount
      
      if (remainingUses <= 0) {
        res.status(403).json({ 
          error: 'Daily limit reached. Upgrade to Pro for unlimited Magic Notes.',
          remainingUses: 0,
          dailyLimit: LIMITS.FREE_TIER_DAILY_USES,
        })
        return
      }
    }

    const { text, theme = 'light', expandContent = false } = req.body as VisualizeRequest
    const file = req.file
    const effectiveTheme: 'light' | 'dark' = theme === 'dark' ? 'dark' : 'light'
    // Handle string "true"/"false" from form data
    const shouldExpand = expandContent === true || expandContent === 'true' as unknown as boolean

    let content = ''
    let isImage = false
    let imageBase64 = ''
    let imageMimeType = ''

    if (file) {
      // Handle file upload
      if (file.mimetype === 'application/pdf') {
        // Extract text from PDF
        content = await extractTextFromPDF(file.buffer)
        if (!content.trim()) {
          res.status(400).json({ error: 'PDF appears to be empty or contains only images' })
          return
        }
      } else if (file.mimetype.startsWith('image/')) {
        // Handle image - send to AI for visual analysis
        isImage = true
        imageBase64 = file.buffer.toString('base64')
        imageMimeType = file.mimetype
      } else if (file.mimetype === 'text/plain') {
        content = file.buffer.toString('utf-8')
      }
    } else if (text) {
      content = text
    } else {
      res.status(400).json({ error: 'No content provided. Please upload a file or provide text.' })
      return
    }

    if (!isImage && !content.trim()) {
      res.status(400).json({ error: 'No content to visualize' })
      return
    }

    // Enforce text character limit
    if (content.length > LIMITS.MAX_TEXT_CHARS) {
      content = content.substring(0, LIMITS.MAX_TEXT_CHARS)
      console.log(`Text content truncated to ${LIMITS.MAX_TEXT_CHARS} characters`)
    }

    // ========================================
    // 3-AGENT PIPELINE
    // ========================================
    
    // AGENT 1: Generate diagram structure (text, containers, relationships)
    console.log('Magic Notes: Starting Agent 1 - Diagram Structure...')
    const structuralElements = await callOpenRouter(
      content,
      effectiveTheme,
      shouldExpand,
      isImage,
      imageBase64,
      imageMimeType
    )
    console.log(`Magic Notes: Agent 1 complete - ${structuralElements.length} elements`)

    // AGENT 2: Enhance with visual icons
    console.log('Magic Notes: Starting Agent 2 - Icon Enhancement...')
    const iconEnhancedElements = await enhanceWithIcons(
      structuralElements,
      content,
      effectiveTheme,
      isImage
    )
    console.log(`Magic Notes: Agent 2 complete - ${iconEnhancedElements.length} elements`)

    // AGENT 3: Verify content and remove hallucinations
    console.log('Magic Notes: Starting Agent 3 - Verification...')
    const verifiedElements = await verifyContent(iconEnhancedElements, content, isImage, shouldExpand)
    console.log(`Magic Notes: Agent 3 complete - ${verifiedElements.length} elements`)

    // Final layout refinement (for larger diagrams)
    const layoutRefinedElements = await refineLayout(verifiedElements, effectiveTheme)

    // Apply lightweight typography defaults (font family, text align) without repositioning
    const typographyElements = applyTypographyDefaults(layoutRefinedElements)

    // Enrich elements with required properties and validate completeness
    const elements = enrichElements(typographyElements, content)

    // Record usage for free users after successful generation
    if (!isProUser) {
      recordUsage(user.id)
      remainingUses = remainingUses !== null ? remainingUses - 1 : null
    }

    // Build response
    const response: { elements: unknown[]; remainingUses?: number; dailyLimit?: number } = { elements }
    if (!isProUser && remainingUses !== null) {
      response.remainingUses = remainingUses
      response.dailyLimit = LIMITS.FREE_TIER_DAILY_USES
    }

    res.json(response)
  } catch (error) {
    console.error('Visualization error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate visualization'
    res.status(500).json({ error: message })
  }
})

// Get remaining usage for free users
router.get('/usage', authenticate as unknown as RequestHandler, (req: Request, res: Response): void => {
  const authReq = req as AuthenticatedRequest
  const user = authReq.user

  if (!user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const isProUser = isPaidUser(user)
  
  if (isProUser) {
    // Pro users have unlimited access
    res.json({ remainingUses: null, dailyLimit: null, isPro: true })
    return
  }

  const todayUsageCount = getTodayUsageCount(user.id)
  const remaining = Math.max(0, LIMITS.FREE_TIER_DAILY_USES - todayUsageCount)

  res.json({
    remainingUses: remaining,
    dailyLimit: LIMITS.FREE_TIER_DAILY_USES,
    isPro: false,
  })
})

export { router as visualizeRoutes }

