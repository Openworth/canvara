import { Router, Request, Response } from 'express'
import multer from 'multer'
import { createRequire } from 'module'
import { authenticate, requirePaidSubscription } from '../middleware/auth.js'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

const router = Router()

// Feature limits - configurable via environment variables
const LIMITS = {
  MAX_TEXT_CHARS: parseInt(process.env.VISUAL_NOTES_MAX_TEXT_CHARS || '50000'),
  MAX_PDF_TEXT_CHARS: parseInt(process.env.VISUAL_NOTES_MAX_PDF_CHARS || '50000'),
  MAX_FILE_SIZE_MB: parseInt(process.env.VISUAL_NOTES_MAX_FILE_MB || '20'),
  MAX_OUTPUT_TOKENS: parseInt(process.env.VISUAL_NOTES_MAX_OUTPUT_TOKENS || '8000'),
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
   - Background colors: dark, muted tones (#1e3a5f, #3d2c1f, #1a3d2e, #3d1f3a, #2d2d3d)
   - Use "transparent" or very dark backgrounds for containers
   - All text elements: #ffffff strokeColor`
    : `   - Stroke color: #1e1e1e (dark) for all strokes and text
   - Background colors: light pastel tones (#e8f4fd, #fef3c7, #dcfce7, #fce7f3)
   - Text elements: #1e1e1e strokeColor`

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

Create a visual representation using these element types:
- rectangles: for main concepts, containers, categories, or sections
- ellipses: for key terms, definitions, or emphasis points
- diamonds: for decision points, questions, or important warnings
- text: for labels, brief descriptions, and annotations
- arrows: to show relationships, flow, cause-effect, or sequence
- lines: for grouping, separation, or visual organization

VISUAL ICONS & PICTOGRAMS:
You have creative freedom to compose the basic shapes (rectangles, ellipses, diamonds, lines) into simple, recognizable icons representing real-world objects. This makes diagrams more visual and engaging.

APPROACH:
- Think about the essential visual characteristics of any object mentioned
- Use 2-6 shapes composed together to create a simplified, iconic representation
- Layer shapes, overlap them, or arrange them to suggest the object's form
- Add a text label near the icon for clarity

You can represent ANY commonly known object - computers, cells, buildings, organs, devices, animals, plants, scientific equipment, vehicles, furniture, tools, symbols, logos, etc. Be creative and use your judgment to determine how best to represent each object with the available shapes.

EXAMPLES (for inspiration, not exhaustive):
- A monitor might be a rectangle with a smaller rectangle base
- A cell might be an ellipse containing a smaller ellipse
- A stack/layers could be overlapping rectangles
- A network might be ellipses connected by lines

The key is making diagrams more visually intuitive - when you see a concept that has a real-world physical form, try to represent it iconically rather than just as a labeled box.

CRITICAL LABELING RULES:
1. EVERY concept from the input MUST be represented in the output - do not skip items
2. EVERY shape (rectangle, ellipse, diamond) MUST have an adjacent text element as its label
3. For shapes representing concepts, place a text element either:
   - Inside the shape (overlapping position)
   - Directly adjacent to it (within 10-20px)
4. Never create empty or unlabeled shapes - if you create a shape, it needs visible text
5. Before finalizing, mentally verify: "Have I included ALL items from the input?"

COMPLETENESS CHECKLIST:
- Count the main concepts in the input
- Ensure each one has a corresponding labeled element in your output
- Lists with multiple items should have ALL items represented, not just some
- Hierarchies should show ALL levels mentioned in the input

LAYOUT GUIDELINES:
1. Create a clean, organized layout from messy input (this is the main value!)
2. Use hierarchical top-down OR left-to-right flow based on content type
3. Group related items in containers with colored backgrounds
4. Use arrows to show connections - make implicit relationships explicit
5. Keep text VERY concise - extract key terms, not full sentences
6. Color scheme for ${theme.toUpperCase()} MODE:
${colorScheme}

SPACING & SIZING RULES (CRITICAL FOR READABILITY):
- MINIMUM shape sizes: rectangles 150x80px, ellipses 120x70px, diamonds 100x100px
- Shapes containing text labels should be sized to FIT the text with 20-30px padding
- For multi-word labels, make shapes WIDER (200-300px) not taller
- MINIMUM gap between separate elements: 60-80px horizontally, 50-70px vertically
- Container rectangles should be 100-150px larger than their contents on each side
- Align elements to an implicit GRID - use consistent x or y coordinates for rows/columns

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

// Layout refinement prompt
const REFINEMENT_PROMPT = `You are a layout optimization assistant. You will receive a JSON array of diagram elements and must REFINE their positions and sizes for better readability.

REFINEMENT RULES:
1. Fix OVERLAPPING elements - ensure no shapes or text overlap each other
2. Ensure MINIMUM SPACING: 60px horizontal, 50px vertical between separate elements
3. ALIGN elements to a grid - similar items should share x or y coordinates
4. RESIZE shapes that are too small for their text labels (minimum 150x80 for rectangles)
5. CENTER text labels within their associated shapes
6. Maintain the SAME logical structure and relationships
7. Keep grouped elements together, just optimize their arrangement

DO NOT:
- Add or remove any elements
- Change element types or colors
- Alter text content
- Break logical groupings

Output ONLY the refined JSON array with updated x, y, width, height values. No explanations.`

// Refine layout of generated elements
async function refineLayout(elements: unknown[], theme: 'light' | 'dark'): Promise<unknown[]> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return elements // Skip refinement if no API key
  
  // Skip refinement for small diagrams
  if (elements.length < 8) return elements
  
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

// Validate and log warnings about potentially problematic elements
function validateElements(elements: unknown[]): void {
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
function enrichElements(elements: unknown[]): unknown[] {
  // Validate before enriching
  validateElements(elements)
  
  return elements.map((el: unknown, index: number) => {
    const element = el as Record<string, unknown>
    const baseElement = {
      id: `visual-note-${Date.now()}-${index}`,
      angle: 0,
      strokeStyle: 'solid',
      roughness: 1,
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

// Main visualization endpoint - requires paid subscription
router.post('/', authenticate, requirePaidSubscription, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
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

    // Call OpenRouter to generate elements
    const rawElements = await callOpenRouter(
      content,
      effectiveTheme,
      shouldExpand,
      isImage,
      imageBase64,
      imageMimeType
    )

    // Refine layout for better spacing and alignment (for larger diagrams)
    const layoutRefinedElements = await refineLayout(rawElements, effectiveTheme)

    // Apply lightweight typography defaults (font family, text align) without repositioning
    const typographyElements = applyTypographyDefaults(layoutRefinedElements)

    // Enrich elements with required properties
    const elements = enrichElements(typographyElements)

    res.json({ elements })
  } catch (error) {
    console.error('Visualization error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate visualization'
    res.status(500).json({ error: message })
  }
})

export { router as visualizeRoutes }

