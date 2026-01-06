---
name: Enhance Visual Notes AI Prompt
overview: Update the AI system prompt in visualize.ts to explicitly handle messy, disorganized notes with abbreviations, incomplete thoughts, and chaotic formatting - common in real student notes.
todos:
  - id: update-prompt
    content: Update getSystemPrompt function in visualize.ts with enhanced prompt
    status: completed
  - id: test-messy-notes
    content: Test with messy student note examples to verify improvement
    status: completed
---

# Enhance Visual Notes AI System Prompt

The current system prompt in [`server/src/routes/visualize.ts`](server/src/routes/visualize.ts) (lines 73-101) is too basic for handling messy, real-world notes. It needs to explicitly instruct the AI to:

1. **Parse chaotic input** - Handle notes with inconsistent formatting, mixed indentation, and no clear structure
2. **Interpret shorthand** - Understand abbreviations like "bc", "w/", "→", "etc", "lol", "idk"
3. **Find hidden structure** - Identify themes and relationships even when scattered throughout
4. **Handle uncertainty markers** - Process "??", "TODO", incomplete thoughts, and questions
5. **Clean up output** - Transform messy input into clean, organized visual output

---

## Proposed System Prompt Update

Update the `getSystemPrompt` function in [`server/src/routes/visualize.ts`](server/src/routes/visualize.ts):

```typescript
return `You are a visual note-taking assistant that excels at transforming messy, disorganized notes into clear, beautiful visual diagrams.

INPUT HANDLING:
- You will often receive raw, unpolished notes - lecture scribbles, study notes, braindumps
- Notes may contain abbreviations (bc, w/, b/c, etc, lol, idk, tbh, prob, govt, &)
- Notes may use informal symbols (→, =>, ::, --, **, !!, ??)
- Notes may have inconsistent formatting, mixed indentation, or no clear structure
- Notes may include incomplete thoughts, questions, or TODO items
- Your job is to find the underlying structure and relationships, even in chaos

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

LAYOUT GUIDELINES:
1. Create a clean, organized layout from messy input (this is the main value!)
2. Use hierarchical top-down OR left-to-right flow based on content type
3. Group related items in containers with colored backgrounds
4. Use arrows to show connections - make implicit relationships explicit
5. Keep text VERY concise - extract key terms, not full sentences
6. Color scheme for ${theme.toUpperCase()} MODE:
${colorScheme}
7. Space elements well - minimum 40-50px between elements
8. Start from x:100, y:100 and spread across canvas (use 800-1200px width typically)

OUTPUT FORMAT:
You MUST respond with ONLY a valid JSON array of elements. No explanations, no markdown, just the JSON array.

Each element in the array should follow this schema:
${ELEMENT_SCHEMA}

For arrows connecting elements, use the "points" array with relative coordinates.
Example: {"type": "arrow", "x": 100, "y": 100, "width": 200, "height": 0, "points": [{"x": 0, "y": 0}, {"x": 200, "y": 0}], ...}
`
```

---

## Key Changes Summary

| Current Prompt | Enhanced Prompt ||----------------|-----------------|| Assumes clean input | Explicitly handles messy, chaotic notes || No mention of abbreviations | Lists common abbreviations to interpret || Basic layout rules | Strategy for finding structure in chaos || Simple element descriptions | Contextual guidance for element usage || 8 guidelines | Structured sections: Input, Analysis, Layout, Output |---

## Files to Modify

1. [`server/src/routes/visualize.ts`](server/src/routes/visualize.ts) - Update `getSystemPrompt` function (lines 63-102)

---

## Testing After Implementation

Test with the messy student notes created earlier:

- Psychology lecture notes with "??" and abbreviations
- Biology cramming notes with informal language