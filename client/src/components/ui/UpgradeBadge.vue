<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'
import ToolIcon from '../toolbar/ToolIcon.vue'

const emit = defineEmits<{
  (e: 'click'): void
}>()

const authStore = useAuthStore()
</script>

<template>
  <!-- Pro Badge for paid users -->
  <div v-if="authStore.isPaidUser" class="pro-badge">
    <div class="crown-icon">
      <ToolIcon name="crown" />
    </div>
    <span class="pro-text">PRO</span>
  </div>

  <!-- Upgrade prompt for free authenticated users -->
  <button 
    v-else-if="authStore.isAuthenticated" 
    class="upgrade-badge"
    @click="emit('click')"
  >
    <div class="icon-container">
      <ToolIcon name="zap" class="zap-icon" />
    </div>
    <span class="upgrade-text">Go Pro</span>
    <div class="shine"></div>
  </button>
</template>

<style scoped>
/* Pro Badge - Gold theme with crown */
.pro-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
  border-radius: 20px;
  box-shadow: 
    0 2px 8px -2px rgba(251, 191, 36, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  position: relative;
  overflow: hidden;
}

.pro-badge::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.crown-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2));
}

.crown-icon :deep(svg) {
  width: 14px;
  height: 14px;
}

.pro-text {
  font-size: 11px;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
}

/* Upgrade Badge - Theme-matched badge for free users */
.upgrade-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px 7px 10px;
  background: linear-gradient(135deg, var(--color-accent-primary) 0%, var(--color-accent-secondary) 100%);
  border: none;
  border-radius: 20px;
  cursor: pointer;
  box-shadow: 
    0 2px 12px -2px var(--color-accent-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.upgrade-badge:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 
    0 6px 20px -4px var(--color-accent-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.upgrade-badge:hover .shine {
  transform: translateX(200%);
}

.upgrade-badge:active {
  transform: translateY(0) scale(1);
}

.icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}

.zap-icon {
  width: 14px;
  height: 14px;
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.4));
}

.upgrade-text {
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.3px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.25),
    transparent
  );
  transition: transform 0.6s ease;
}
</style>

