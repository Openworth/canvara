<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '../../stores/canvas'
import { useAppStore } from '../../stores/app'

const canvasStore = useCanvasStore()
const appStore = useAppStore()

// Only show hints when canvas is empty
const isEmpty = computed(() => canvasStore.visibleElements.length === 0)

// Mobile detection
const isMobile = ref(false)

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
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
    <div v-if="isEmpty && !isMobile" class="empty-hints-container">
      <!-- Hint pointing to toolbar (left side) -->
      <div class="hint-toolbar">
        <svg 
          width="130" 
          height="40" 
          viewBox="0 0 130 40" 
          fill="none"
          class="hint-arrow"
        >
          <!-- Hand-drawn style wavy arrow pointing left -->
          <path 
            d="M125 20 C 105 18, 85 23, 65 20 C 45 17, 30 22, 12 20"
            :stroke="hintColor"
            stroke-width="2"
            stroke-linecap="round"
            fill="none"
            class="arrow-line"
          />
          <!-- Arrowhead -->
          <path 
            d="M24 12 L8 20 L24 28"
            :stroke="hintColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
            class="arrow-head"
          />
        </svg>
        <div class="hint-text">
          <span>Start by adding</span>
          <span>a new shape</span>
        </div>
      </div>

      <!-- Hint pointing to share/collab (top right) -->
      <div class="hint-collab">
        <div class="hint-text hint-text-right">
          <span>Invite others to</span>
          <span>collaborate in</span>
          <span>real-time</span>
        </div>
        <svg 
          width="70" 
          height="60" 
          viewBox="0 0 70 60" 
          fill="none"
          class="hint-arrow-curved"
        >
          <!-- Hand-drawn curved arrow curving up towards Share button -->
          <path 
            d="M10 58 C 18 45, 28 32, 38 22 C 48 12, 52 8, 58 3"
            :stroke="hintColor"
            stroke-width="2"
            stroke-linecap="round"
            fill="none"
            class="arrow-line"
          />
          <!-- Arrowhead pointing up -->
          <path 
            d="M50 0 L59 2 L58 12"
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
}

/* Toolbar hint - positioned further from left toolbar */
.hint-toolbar {
  position: absolute;
  left: 85px;
  top: 42%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
}

.hint-arrow {
  flex-shrink: 0;
}

.hint-text {
  display: flex;
  flex-direction: column;
  font-family: 'Caveat', 'Virgil', cursive;
  font-size: 26px;
  font-style: italic;
  line-height: 1.15;
  color: var(--color-text-secondary);
  opacity: 0.85;
  white-space: nowrap;
}

/* Collaboration hint - positioned top right, pointing to Share button */
.hint-collab {
  position: absolute;
  right: 260px;
  top: 115px;
}

.hint-text-right {
  text-align: right;
}

.hint-arrow-curved {
  position: absolute;
  top: -58px;
  right: -50px;
}

/* Subtle animation for the arrows */
.arrow-line {
  stroke-dasharray: 220;
  stroke-dashoffset: 220;
  animation: drawLine 1s ease-out forwards;
  animation-delay: 0.4s;
}

.arrow-head {
  opacity: 0;
  animation: fadeInArrowHead 0.3s ease-out forwards;
  animation-delay: 1.2s;
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
  animation: fadeInText 0.4s ease-out forwards;
}

.hint-text span:nth-child(1) {
  animation-delay: 0.6s;
}

.hint-text span:nth-child(2) {
  animation-delay: 0.75s;
}

.hint-text span:nth-child(3) {
  animation-delay: 0.9s;
}

@keyframes fadeInText {
  to {
    opacity: 1;
  }
}
</style>

