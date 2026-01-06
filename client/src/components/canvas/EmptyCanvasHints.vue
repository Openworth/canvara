<script setup lang="ts">
import { computed } from 'vue'
import { useCanvasStore } from '../../stores/canvas'
import { useAppStore } from '../../stores/app'

const canvasStore = useCanvasStore()
const appStore = useAppStore()

// Default/passive tools that don't indicate user is starting to draw
const defaultTools = ['selection', 'hand']

// Show marketing UI only when canvas is empty AND no drawing tool is selected
const shouldShow = computed(() => {
  const hasNoElements = canvasStore.visibleElements.length === 0
  const isDefaultTool = defaultTools.includes(canvasStore.activeTool)
  return hasNoElements && isDefaultTool
})

// Color based on theme
const hintColor = computed(() => appStore.isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(30, 30, 30, 0.45)')

</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-500 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-300 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="shouldShow" class="empty-hints-container">
      <!-- Central Welcome Section -->
      <div class="welcome-section">
        <!-- Logo -->
        <div class="logo-container">
          <img :src="appStore.isDarkMode ? '/logo-full.svg' : '/logo-full-light.svg'" alt="Canvara" class="welcome-logo" />
        </div>

        <!-- Tagline -->
        <h2 class="tagline">
          Sketch ideas together, in real-time
        </h2>

        <!-- Subtitle -->
        <p class="subtitle">
          The collaborative whiteboard for teams and creatives — free to start
        </p>

        <!-- Get Started Options -->
        <div class="start-options">
          <!-- Manual drawing hint -->
          <div class="start-option start-option-keyboard">
            <span class="start-option-text">
              Press <kbd>R</kbd> for rectangle, <kbd>O</kbd> for ellipse
            </span>
          </div>

          <span class="start-divider">or</span>

          <!-- Magic Notes button -->
          <button class="start-option start-option-magic" @click="appStore.openVisualNotesModal()">
            <svg class="magic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" stroke-linejoin="round"/>
              <path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1z" stroke-linejoin="round"/>
            </svg>
            <span>Generate with AI</span>
          </button>
        </div>
      </div>

      <!-- Hint pointing to toolbar (top-left) -->
      <div class="hint-toolbar">
        <svg 
          width="60" 
          height="80" 
          viewBox="0 0 60 80" 
          fill="none"
          class="hint-arrow"
        >
          <!-- Hand-drawn curved arrow pointing up-left towards toolbar -->
          <path 
            d="M50 78 C 45 60, 35 45, 25 30 C 18 20, 12 12, 8 5"
            :stroke="hintColor"
            stroke-width="2"
            stroke-linecap="round"
            fill="none"
            class="arrow-line"
          />
          <!-- Arrowhead pointing up-left -->
          <path 
            d="M3 14 L6 3 L17 6"
            :stroke="hintColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
            class="arrow-head"
          />
        </svg>
        <div class="hint-text">
          <span>Pick a tool</span>
          <span>to start</span>
        </div>
      </div>

      <!-- Hint pointing to share/collab (top right) -->
      <div class="hint-collab">
        <div class="hint-text hint-text-right">
          <span>Share &amp; invite</span>
          <span>collaborators</span>
        </div>
        <svg 
          width="70" 
          height="60" 
          viewBox="0 0 70 60" 
          fill="none"
          class="hint-arrow-curved"
        >
          <!-- Hand-drawn curved arrow curving up-right towards Share button -->
          <path 
            d="M8 58 C 18 45, 30 32, 42 22 C 52 14, 58 8, 65 4"
            :stroke="hintColor"
            stroke-width="2"
            stroke-linecap="round"
            fill="none"
            class="arrow-line"
          />
          <!-- Arrowhead pointing up-right -->
          <path 
            d="M58 0 L67 3 L64 12"
            :stroke="hintColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
            class="arrow-head"
          />
        </svg>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.empty-hints-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ============================================
   CENTRAL WELCOME SECTION
   ============================================ */

.welcome-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 560px;
  padding: 0 24px;
}

.logo-container {
  opacity: 0;
  animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: 0.15s;
}

.welcome-logo {
  height: 42px;
  width: auto;
}

.tagline {
  margin-top: 20px;
  font-family: var(--font-ui);
  font-size: 28px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
  opacity: 0;
  animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: 0.3s;
}

.subtitle {
  margin-top: 10px;
  font-family: var(--font-ui);
  font-size: 15px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--color-text-secondary);
  opacity: 0;
  animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: 0.45s;
}

/* ============================================
   GET STARTED OPTIONS
   ============================================ */

.start-options {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 28px;
  opacity: 0;
  animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: 0.6s;
}

.start-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--color-toolbar-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 10px;
  font-family: var(--font-ui);
  font-size: 14px;
  color: var(--color-text-secondary);
  transition: all 0.2s ease;
}

.start-option-text {
  font-family: var(--font-virgil);
  font-size: 15px;
  font-style: italic;
  color: var(--color-text-tertiary);
}

.start-option-text kbd {
  display: inline-block;
  padding: 2px 6px;
  margin: 0 2px;
  font-family: var(--font-ui);
  font-size: 11px;
  font-style: normal;
  font-weight: 600;
  color: var(--color-text-primary);
  background: var(--color-toolbar-hover);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 4px;
  box-shadow: 0 1px 0 var(--color-toolbar-border);
}

.start-divider {
  font-family: var(--font-virgil);
  font-size: 14px;
  font-style: italic;
  color: var(--color-text-tertiary);
  opacity: 0.6;
}

.start-option-magic {
  cursor: pointer;
  pointer-events: auto;
  font-weight: 500;
  color: var(--color-text-primary);
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%);
  border-color: rgba(168, 85, 247, 0.3);
}

.start-option-magic:hover {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%);
  border-color: rgba(168, 85, 247, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px -4px rgba(168, 85, 247, 0.3);
}

.start-option-magic:active {
  transform: translateY(0);
}

.magic-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  stroke: #a855f7;
}

/* ============================================
   ARROW HINTS - Repositioned
   ============================================ */

/* Toolbar hint - positioned to point to top-left toolbar */
.hint-toolbar {
  position: absolute;
  left: 180px;
  top: 150px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.hint-arrow {
  flex-shrink: 0;
  position: absolute;
  top: -80px;
  left: -10px;
  transform: translateX(-50%);
}

.hint-text {
  display: flex;
  flex-direction: column;
  font-family: var(--font-virgil);
  font-size: 22px;
  font-style: italic;
  line-height: 1.15;
  color: var(--color-text-secondary);
  opacity: 0.8;
  white-space: nowrap;
  margin-top: 14px;
}

/* Collaboration hint - positioned top right, pointing to Share button */
.hint-collab {
  position: absolute;
  right: 130px;
  top: 140px;
}

.hint-text-right {
  text-align: right;
}

.hint-arrow-curved {
  position: absolute;
  top: -58px;
  right: -55px;
}

/* ============================================
   ANIMATIONS
   ============================================ */

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Arrow line animation */
.arrow-line {
  stroke-dasharray: 180;
  stroke-dashoffset: 180;
  animation: drawLine 0.8s ease-out forwards;
  animation-delay: 1.1s;
}

.arrow-head {
  opacity: 0;
  animation: fadeInArrowHead 0.25s ease-out forwards;
  animation-delay: 1.7s;
}

@keyframes drawLine {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes fadeInArrowHead {
  to {
    opacity: 1;
  }
}

/* Fade in text with delay */
.hint-text span {
  opacity: 0;
  animation: fadeInText 0.35s ease-out forwards;
}

.hint-text span:nth-child(1) {
  animation-delay: 1.25s;
}

.hint-text span:nth-child(2) {
  animation-delay: 1.4s;
}

.hint-text span:nth-child(3) {
  animation-delay: 1.55s;
}

@keyframes fadeInText {
  to {
    opacity: 1;
  }
}

/* ============================================
   RESPONSIVE - Adjust for smaller screens
   ============================================ */

/* Reposition arrow hints for tablet/mobile (bottom toolbar, left sidebar) */
@media (max-width: 900px) {
  /* Toolbar hint: positioned bottom center, arrow pointing down to bottom toolbar */
  .hint-toolbar {
    left: 50%;
    top: auto;
    bottom: 100px;
    transform: translateX(-50%);
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  
  .hint-toolbar .hint-text {
    order: -1; /* Text above arrow */
    text-align: center;
    margin-bottom: 10px;
  }
  
  .hint-toolbar .hint-arrow {
    position: static;
    /* Flip arrow to point down toward bottom toolbar */
    transform: rotate(195deg);
  }
  
  /* Collab hint: positioned top-left, pointing to sidebar toggle */
  .hint-collab {
    left: 120px;
    right: auto;
    top: 120px;
  }
  
  .hint-collab .hint-text-right {
    text-align: left;
    margin-top: 14px;
  }
  
  .hint-collab .hint-arrow-curved {
    /* Mirror horizontally to point top-left instead of top-right */
    transform: scaleX(-1);
    left: -55px;
    right: auto;
  }
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .welcome-section {
    padding: 0 20px;
    padding-bottom: 100px; /* Account for mobile toolbar */
  }
  
  .welcome-logo {
    height: 36px;
  }
  
  .tagline {
    font-size: 22px;
    margin-top: 16px;
  }
  
  .subtitle {
    font-size: 14px;
  }
  
  .start-options {
    flex-direction: column;
    gap: 12px;
    margin-top: 24px;
  }
  
  /* Hide keyboard hint on mobile - just show AI button */
  .start-option-keyboard {
    display: none;
  }
  
  .start-divider {
    display: none;
  }
  
  .start-option-magic {
    padding: 12px 20px;
  }
}

@media (max-width: 480px) {
  .tagline {
    font-size: 20px;
  }
  
  .subtitle {
    font-size: 13px;
  }
  
  .start-option-magic {
    padding: 10px 16px;
    font-size: 13px;
  }
  
  .magic-icon {
    width: 14px;
    height: 14px;
  }
}
</style>
