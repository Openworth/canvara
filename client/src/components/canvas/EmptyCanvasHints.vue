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

// Feature highlights
const features = [
  { icon: 'users', label: 'Real-time collaboration' },
  { icon: 'infinity', label: 'Infinite canvas' },
  { icon: 'cloud', label: 'Cloud sync' },
  { icon: 'download', label: 'Export anywhere' },
]
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

        <!-- Feature Pills -->
        <div class="features-row">
          <div 
            v-for="(feature, index) in features" 
            :key="feature.label"
            class="feature-pill"
            :style="{ '--pill-index': index }"
          >
            <!-- Feature Icons -->
            <svg v-if="feature.icon === 'users'" class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <svg v-else-if="feature.icon === 'infinity'" class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z"/>
            </svg>
            <svg v-else-if="feature.icon === 'cloud'" class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
            </svg>
            <svg v-else-if="feature.icon === 'download'" class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span class="feature-label">{{ feature.label }}</span>
          </div>
        </div>

        <!-- Getting Started Hint -->
        <div class="getting-started">
          <span class="getting-started-text">
            Press <kbd>R</kbd> for rectangle, <kbd>O</kbd> for ellipse, or click the toolbar to begin
          </span>
        </div>
      </div>

      <!-- Hint pointing to toolbar (left side) -->
      <div class="hint-toolbar">
        <svg 
          width="100" 
          height="40" 
          viewBox="0 0 100 40" 
          fill="none"
          class="hint-arrow"
        >
          <!-- Hand-drawn style wavy arrow pointing left -->
          <path 
            d="M95 20 C 80 18, 65 23, 50 20 C 35 17, 25 22, 12 20"
            :stroke="hintColor"
            stroke-width="2"
            stroke-linecap="round"
            fill="none"
            class="arrow-line"
          />
          <!-- Arrowhead -->
          <path 
            d="M22 12 L8 20 L22 28"
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
   FEATURE PILLS
   ============================================ */

.features-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 28px;
}

.feature-pill {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  background: var(--color-toolbar-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 100px;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  opacity: 0;
  animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: calc(0.55s + var(--pill-index) * 0.08s);
  transition: all 0.2s ease;
}

.feature-pill:hover {
  border-color: var(--color-accent-primary);
  color: var(--color-text-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px -4px var(--color-accent-glow);
  pointer-events: auto;
}

.feature-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.feature-label {
  white-space: nowrap;
}

/* ============================================
   GETTING STARTED HINT
   ============================================ */

.getting-started {
  margin-top: 32px;
  opacity: 0;
  animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: 0.95s;
}

.getting-started-text {
  font-family: var(--font-virgil);
  font-size: 18px;
  font-style: italic;
  color: var(--color-text-tertiary);
}

.getting-started-text kbd {
  display: inline-block;
  padding: 2px 7px;
  margin: 0 2px;
  font-family: var(--font-ui);
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  color: var(--color-text-primary);
  background: var(--color-toolbar-hover);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 4px;
  box-shadow: 0 1px 0 var(--color-toolbar-border);
}

/* ============================================
   ARROW HINTS - Repositioned
   ============================================ */

/* Toolbar hint - positioned left, vertically centered */
.hint-toolbar {
  position: absolute;
  left: 80px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
}

.hint-arrow {
  flex-shrink: 0;
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
    bottom: 110px;
    transform: translateX(-50%);
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  
  .hint-toolbar .hint-text {
    order: -1; /* Text above arrow */
    text-align: center;
    margin-bottom: 30px;
  }
  
  .hint-toolbar .hint-arrow {
    /* Rotate arrow to point down - counterclockwise so arrowhead ends at bottom */
    transform: rotate(-90deg);
  }
  
  /* Collab hint: positioned top-left, pointing to sidebar toggle */
  .hint-collab {
    left: 120px;
    right: auto;
    top: 120px;
  }
  
  .hint-collab .hint-text-right {
    text-align: left;
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
  
  .features-row {
    gap: 8px;
    margin-top: 24px;
  }
  
  .feature-pill {
    padding: 6px 12px;
    font-size: 12px;
  }
  
  .feature-icon {
    width: 14px;
    height: 14px;
  }
  
  /* Hide keyboard shortcut hint on mobile */
  .getting-started {
    display: none;
  }
}

@media (max-width: 480px) {
  .tagline {
    font-size: 20px;
  }
  
  .subtitle {
    font-size: 13px;
  }
  
  .feature-pill {
    padding: 5px 10px;
    font-size: 11px;
    gap: 5px;
  }
  
  .feature-icon {
    width: 12px;
    height: 12px;
  }
}
</style>
