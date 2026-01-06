---
name: Magic Notes Improvements
overview: Improve Magic Notes output quality by enhancing arrow connections, fixing text/container sizing, and overhauling the icon system to produce cleaner, more connected diagrams.
todos:
  - id: arrows
    content: Update Agent 1 prompt to enforce arrow connections between concepts
    status: completed
  - id: text-sizing
    content: Add validateTextFit() function to fix text overflow programmatically
    status: completed
  - id: icons
    content: Remove Agent 2 icon enhancement or replace with integrated approach
    status: completed
  - id: layout-validation
    content: Add programmatic layout spacing and overlap validation
    status: completed
---

# Magic Notes Quality Improvements

## Problem Analysis

From the example output, I identified these core issues:

1. **Missing Arrows**: Related concepts (Core Features, Tech Stack, etc.) have no connecting arrows showing relationships
2. **Text Overflow**: Text extends beyond container boundaries (especially visible in "Hotkeys" section)
3. **Poor Icons**: Technology icons are just basic rectangles/ellipses - not visually distinctive
4. **Disconnected Layout**: Icons placed randomly at bottom with no integration to relevant sections

## Root Causes in Code

The issues stem from [visualize.ts](server/src/routes/visualize.ts):

- **Agent 1 (Structure)**: Mentions arrows but doesn't enforce them as a requirement
- **Agent 2 (Icons)**: Creates overly simplistic shape+label pairs that look poor
- **Text sizing formula**: `character_count * 8 + 60px` doesn't match actual font rendering
- **No programmatic validation**: Layout issues pass through unchecked

## Proposed Solutions

### 1. Enforce Arrow Connections (Agent 1 Prompt)

Add explicit arrow requirements to `getSystemPrompt()`:

- Make arrows MANDATORY between related concepts
- Require a minimum arrow count based on concept count
- Add a "CONNECTION CHECKLIST" similar to the existing "COMPLETENESS CHECKLIST"
- Provide better arrow examples showing concept-to-concept connections

### 2. Fix Text-to-Container Sizing

Improve the sizing formula and add server-side validation:

- Update formula to more accurate: `char_count * fontSize * 0.6 + 60px` (more generous)
- Add `validateTextFit()` function that programmatically checks all text elements and expands containers if needed
- Apply this after AI generation but before returning response

### 3. Overhaul Icon System (Agent 2)

Two options (recommend Option A):**Option A - Remove Icon Enhancement Agent**: The current approach produces poor results. Remove Agent 2 entirely and rely on Agent 1 to create well-labeled shapes. This simplifies the pipeline and avoids the "generic shapes at bottom" problem.**Option B - Improve Icon Compositions**: If keeping icons, require multi-shape composed icons (e.g., database = cylinder shape = stacked ellipses) and place them WITHIN relevant sections, not as a disconnected row.

### 4. Add Programmatic Layout Validation

Add server-side functions after AI generation:

```typescript
function validateAndFixLayout(elements: Element[]): Element[] {
  // 1. Check text fits within containers
  // 2. Verify no overlapping elements  
  // 3. Ensure arrows exist between concept shapes
  // 4. Fix spacing between elements
}
```



## Files to Modify

- [server/src/routes/visualize.ts](server/src/routes/visualize.ts) - Main changes to prompts and validation

## Implementation Priority

1. **High**: Fix arrow generation in Agent 1 prompt (biggest UX improvement)
2. **High**: Add programmatic text overflow detection/fix
3. **Medium**: Remove or improve icon system (Agent 2)