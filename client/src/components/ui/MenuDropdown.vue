<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '../../stores/app'
import { useAuthStore } from '../../stores/auth'
import ToolIcon from '../toolbar/ToolIcon.vue'

const props = defineProps<{
  isMobile?: boolean
}>()

const emit = defineEmits<{
  close: []
  export: []
  share: []
  clearCanvas: []
  openUpgrade: []
  openVisualNotes: []
  openProjects: []
}>()

const appStore = useAppStore()
const authStore = useAuthStore()

// Animation state
const isVisible = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    isVisible.value = true
  })
})

// Handle escape key
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

function handleClearCanvas() {
  emit('clearCanvas')
  emit('close')
}

function handleExport() {
  emit('export')
  emit('close')
}

function handleShare() {
  emit('share')
  emit('close')
}

function handleOpenVisualNotes() {
  emit('openVisualNotes')
  emit('close')
}

function handleToggleTheme() {
  appStore.toggleDarkMode()
}

function handleLogin() {
  authStore.login()
  emit('close')
}

function handleLogout() {
  authStore.logout()
  emit('close')
}

function handleOpenProjects() {
  emit('openProjects')
  emit('close')
}

function handleOpenUpgrade() {
  emit('openUpgrade')
  emit('close')
}

interface MenuItem {
  label: string
  icon: string
  shortcut?: string
  action: () => void
  danger?: boolean
  mobileOnly?: boolean
}

const menuItems: MenuItem[] = [
  {
    label: 'Share',
    icon: 'share',
    action: handleShare,
    mobileOnly: true,
  },
  {
    label: 'Export',
    icon: 'download',
    action: handleExport,
  },
  {
    label: 'Clear canvas',
    icon: 'trash',
    action: handleClearCanvas,
    danger: true,
  },
]

// Filter items based on mobile/desktop
const visibleItems = computed(() => 
  props.isMobile 
    ? menuItems 
    : menuItems.filter(item => !item.mobileOnly)
)
</script>

<template>
  <Teleport to="body">
    <div class="drawer-overlay" :class="{ visible: isVisible }" @click.self="emit('close')">
      <div class="drawer-panel" :class="{ visible: isVisible }">
        <!-- Decorative accent bar -->
        <div class="accent-bar" />
        
        <!-- Menu content -->
        <div class="menu-container">
            <!-- Header -->
            <div class="drawer-header">
              <div class="drawer-brand">
                <img :src="appStore.isDarkMode ? '/logo-full.svg' : '/logo-full-light.svg'" alt="Canvara" class="drawer-logo" />
              </div>
              <button class="drawer-close" @click="emit('close')" aria-label="Close menu">
                <ToolIcon name="close" />
              </button>
            </div>

            <!-- User section (when authenticated) -->
            <template v-if="authStore.isAuthenticated">
              <div class="user-section">
                <div class="user-avatar-wrapper">
                  <img
                    v-if="authStore.user?.avatarUrl"
                    :src="authStore.user.avatarUrl"
                    :alt="authStore.displayName || 'User'"
                    class="user-avatar"
                  />
                  <span v-else class="user-avatar-initials">
                    {{ authStore.initials }}
                  </span>
                  <span v-if="authStore.isPaidUser && !authStore.isSubscriptionCanceled" class="avatar-pro-ring" />
                </div>
                <div class="user-details">
                  <span class="user-name">{{ authStore.displayName }}</span>
                  <span class="user-email">{{ authStore.user?.email }}</span>
                </div>
                <span :class="['plan-badge', authStore.isPaidUser ? (authStore.isSubscriptionCanceled ? 'canceled' : 'pro') : 'free']">
                  {{ authStore.isPaidUser ? 'Pro' : 'Free' }}
                </span>
              </div>

              <!-- Cancellation notice -->
              <div v-if="authStore.isSubscriptionCanceled" class="cancel-notice">
                <div class="cancel-icon-wrap">
                  <ToolIcon name="zap" class="cancel-icon" />
                </div>
                <div class="cancel-text">
                  <span class="cancel-title">Subscription ending</span>
                  <span class="cancel-date">Access until {{ authStore.subscriptionEndDateFormatted }}</span>
                </div>
              </div>
            </template>

          <!-- Sign in prompt (when not authenticated) -->
          <template v-else>
            <div class="signin-section">
              <div class="signin-illustration">
                <div class="signin-shapes">
                  <div class="shape-circle" />
                  <div class="shape-square" />
                  <div class="shape-triangle" />
                </div>
              </div>
              <div class="signin-content">
                <h3 class="signin-title">Welcome to Canvara</h3>
                <p class="signin-text">Sign in to save your work and unlock Pro features</p>
              </div>
              <button class="google-signin-btn" @click="handleLogin">
                <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>
          </template>

            <!-- Menu content -->
            <div class="drawer-content">
              <!-- AI Tools section -->
              <div class="menu-section" style="--section-delay: 0">
                <span class="section-label">AI Tools</span>
                <button class="menu-item ai-item" @click="handleOpenVisualNotes">
                  <div class="ai-icon-wrap">
                    <ToolIcon name="sparkles" />
                  </div>
                  <span>Magic Notes</span>
                  <span class="ai-badge">AI</span>
                </button>
              </div>

              <!-- Canvas section -->
              <div class="menu-section" style="--section-delay: 1">
                <span class="section-label">Canvas</span>
                <button
                  v-for="(item, index) in visibleItems"
                  :key="item.label"
                  class="menu-item"
                  :class="{ 'danger': item.danger }"
                  :style="{ '--item-delay': index }"
                  @click="item.action"
                >
                  <ToolIcon :name="item.icon" />
                  <span>{{ item.label }}</span>
                </button>
              </div>

              <!-- Preferences section -->
              <div class="menu-section" style="--section-delay: 2">
                <span class="section-label">Preferences</span>
                <button class="menu-item toggle-item" @click="handleToggleTheme">
                  <ToolIcon :name="appStore.isDarkMode ? 'moon' : 'sun'" />
                  <span>Dark mode</span>
                  <div class="toggle-switch" :class="{ active: appStore.isDarkMode }">
                    <div class="toggle-thumb">
                      <ToolIcon :name="appStore.isDarkMode ? 'moon' : 'sun'" class="toggle-icon" />
                    </div>
                  </div>
                </button>
              </div>

              <!-- Account section (authenticated) -->
              <template v-if="authStore.isAuthenticated">
                <div class="menu-section" style="--section-delay: 3">
                  <span class="section-label">Account</span>
                  
                  <button 
                    v-if="authStore.isPaidUser" 
                    class="menu-item nav-item"
                    @click="handleOpenProjects"
                  >
                    <ToolIcon name="folder" />
                    <span>My Projects</span>
                    <ToolIcon name="chevronUp" class="nav-arrow" />
                  </button>

                  <button 
                    v-if="!authStore.isPaidUser" 
                    class="menu-item upgrade-item"
                    @click="handleOpenUpgrade"
                  >
                    <div class="upgrade-icon-wrap">
                      <ToolIcon name="zap" />
                    </div>
                    <div class="upgrade-content">
                      <span class="upgrade-label">Upgrade to Pro</span>
                      <span class="upgrade-hint">Unlimited saves, AI features & more</span>
                    </div>
                    <span class="upgrade-price">$6<small>/mo</small></span>
                  </button>

                  <button 
                    v-if="authStore.isPaidUser" 
                    class="menu-item"
                    @click="handleOpenUpgrade"
                  >
                    <ToolIcon name="creditCard" />
                    <span>Manage Subscription</span>
                  </button>
                </div>
              </template>
            </div>

          <!-- Footer -->
          <div v-if="authStore.isAuthenticated" class="drawer-footer">
            <button class="menu-item logout-item" @click="handleLogout">
              <ToolIcon name="logOut" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ============================================
   OVERLAY
   ============================================ */
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0);
  backdrop-filter: blur(0px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-overlay.visible {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.dark .drawer-overlay.visible {
  background: rgba(0, 0, 0, 0.65);
}

/* ============================================
   PANEL
   ============================================ */
.drawer-panel {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 320px;
  max-width: 85vw;
  background: var(--color-toolbar-bg-solid);
  border-right: 1px solid var(--color-toolbar-border);
  box-shadow: 12px 0 48px -12px rgba(0, 0, 0, 0.15);
  transform: translateX(-100%);
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  overflow: hidden;
}

.drawer-panel.visible {
  transform: translateX(0);
}

.dark .drawer-panel {
  box-shadow: 12px 0 48px -12px rgba(0, 0, 0, 0.6);
}

/* Decorative accent bar */
.accent-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, 
    var(--color-accent-primary) 0%, 
    var(--color-accent-secondary) 50%,
    #a855f7 100%
  );
  z-index: 10;
}

/* Menu container */
.menu-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-top: 3px; /* Account for accent bar */
}

/* ============================================
   HEADER
   ============================================ */
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 14px;
  border-bottom: 1px solid var(--color-toolbar-border);
  flex-shrink: 0;
  background: linear-gradient(180deg, 
    rgba(99, 102, 241, 0.03) 0%, 
    transparent 100%
  );
}

.drawer-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.drawer-logo {
  height: 28px;
  transition: transform 0.2s ease;
}

.drawer-brand:hover .drawer-logo {
  transform: scale(1.02);
}

.drawer-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-close:hover {
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
  transform: rotate(90deg);
}

.drawer-close:active {
  transform: rotate(90deg) scale(0.9);
}

/* ============================================
   USER SECTION (Authenticated)
   ============================================ */
.user-section {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, 
    var(--color-toolbar-hover) 0%, 
    rgba(99, 102, 241, 0.04) 100%
  );
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-toolbar-border);
}

.user-avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.user-avatar,
.user-avatar-initials {
  width: 48px;
  height: 48px;
  border-radius: 14px;
}

.user-avatar {
  object-fit: cover;
  border: 2px solid var(--color-toolbar-border);
}

.user-avatar-initials {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary));
  color: white;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

/* Pro ring around avatar */
.avatar-pro-ring {
  position: absolute;
  inset: -3px;
  border-radius: 16px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b, #fbbf24);
  background-size: 200% 200%;
  animation: shimmer 3s ease-in-out infinite;
  z-index: -1;
}

@keyframes shimmer {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.user-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.user-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.2px;
}

.user-email {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.plan-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 5px 10px;
  border-radius: 8px;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.plan-badge:hover {
  transform: scale(1.05);
}

.plan-badge.free {
  color: var(--color-text-secondary);
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-toolbar-border);
}

.plan-badge.pro {
  color: white;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
  border: none;
}

.plan-badge.canceled {
  color: #a8a29e;
  background: linear-gradient(135deg, #78716c, #57534e);
}

/* ============================================
   CANCELLATION NOTICE
   ============================================ */
.cancel-notice {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: linear-gradient(135deg, 
    rgba(245, 158, 11, 0.08) 0%, 
    rgba(245, 158, 11, 0.04) 100%
  );
  border-bottom: 1px solid rgba(245, 158, 11, 0.15);
  flex-shrink: 0;
}

.cancel-icon-wrap {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(245, 158, 11, 0.15);
  border-radius: 8px;
  flex-shrink: 0;
}

.cancel-icon-wrap :deep(svg) {
  width: 16px;
  height: 16px;
  color: #f59e0b;
}

.cancel-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cancel-title {
  font-size: 13px;
  font-weight: 600;
  color: #f59e0b;
}

.cancel-date {
  font-size: 11px;
  color: var(--color-text-secondary);
}

/* ============================================
   SIGN IN SECTION (Unauthenticated)
   ============================================ */
.signin-section {
  padding: 20px 16px;
  background: linear-gradient(180deg, 
    var(--color-toolbar-hover) 0%, 
    transparent 100%
  );
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-toolbar-border);
}

.signin-illustration {
  position: relative;
  width: 64px;
  height: 64px;
}

.signin-shapes {
  position: relative;
  width: 100%;
  height: 100%;
}

.shape-circle {
  position: absolute;
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary));
  border-radius: 50%;
  top: 0;
  right: 4px;
  animation: float 4s ease-in-out infinite;
}

.shape-square {
  position: absolute;
  width: 22px;
  height: 22px;
  background: linear-gradient(135deg, #a855f7, #8b5cf6);
  border-radius: 6px;
  bottom: 4px;
  left: 0;
  animation: float 4s ease-in-out infinite 0.5s;
  transform: rotate(15deg);
}

.shape-triangle {
  position: absolute;
  width: 0;
  height: 0;
  border-left: 12px solid transparent;
  border-right: 12px solid transparent;
  border-bottom: 20px solid #f59e0b;
  bottom: 8px;
  right: 8px;
  animation: float 4s ease-in-out infinite 1s;
}

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-6px) rotate(3deg); }
}

.shape-square {
  animation: floatSquare 4s ease-in-out infinite 0.5s;
}

@keyframes floatSquare {
  0%, 100% { transform: translateY(0) rotate(15deg); }
  50% { transform: translateY(-6px) rotate(18deg); }
}

.signin-content {
  text-align: center;
}

.signin-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 4px;
  letter-spacing: -0.3px;
}

.signin-text {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.4;
  max-width: 220px;
}

.google-signin-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 20px;
  border-radius: 10px;
  border: 1px solid var(--color-toolbar-border);
  background: white;
  color: #1f1f1f;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: var(--font-ui);
  width: 100%;
  max-width: 260px;
  position: relative;
  overflow: hidden;
}

.google-signin-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, 
    rgba(66, 133, 244, 0.1) 0%, 
    rgba(52, 168, 83, 0.1) 50%,
    rgba(251, 188, 5, 0.1) 100%
  );
  opacity: 0;
  transition: opacity 0.25s ease;
}

.dark .google-signin-btn {
  background: #1a1a1a;
  color: #e3e3e3;
  border-color: rgba(255, 255, 255, 0.12);
}

.google-signin-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
}

.google-signin-btn:hover::before {
  opacity: 1;
}

.dark .google-signin-btn:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  border-color: rgba(255, 255, 255, 0.2);
}

.google-signin-btn:active {
  transform: translateY(0);
}

.google-icon {
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.google-signin-btn span {
  position: relative;
  z-index: 1;
}

/* ============================================
   CONTENT AREA
   ============================================ */
.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0 16px;
  scrollbar-width: thin;
  scrollbar-color: var(--color-text-tertiary) transparent;
}

.drawer-content::-webkit-scrollbar {
  width: 5px;
}

.drawer-content::-webkit-scrollbar-track {
  background: transparent;
}

.drawer-content::-webkit-scrollbar-thumb {
  background: var(--color-text-tertiary);
  border-radius: 3px;
}

/* ============================================
   MENU SECTIONS
   ============================================ */
.menu-section {
  padding: 8px 12px;
  animation: sectionFadeIn 0.4s ease backwards;
  animation-delay: calc(var(--section-delay, 0) * 0.05s + 0.15s);
}

@keyframes sectionFadeIn {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.section-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-text-tertiary);
  padding: 10px 12px 8px;
}

/* ============================================
   MENU ITEMS
   ============================================ */
.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  text-align: left;
  color: var(--color-text-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 14px;
  font-weight: 500;
  position: relative;
}

.menu-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 0;
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary));
  border-radius: 0 2px 2px 0;
  transition: height 0.2s ease;
}

.menu-item:hover {
  background: var(--color-toolbar-hover);
}

.menu-item:hover::before {
  height: 60%;
}

.menu-item:active {
  transform: scale(0.98);
}

.menu-item :deep(svg) {
  width: 18px;
  height: 18px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.menu-item:hover :deep(svg) {
  color: var(--color-accent-primary);
}

.menu-item span {
  flex: 1;
}

/* Danger items */
.menu-item.danger {
  color: #ef4444;
}

.menu-item.danger :deep(svg) {
  color: #ef4444;
}

.menu-item.danger::before {
  background: #ef4444;
}

.menu-item.danger:hover {
  background: rgba(239, 68, 68, 0.08);
}

.menu-item.danger:hover :deep(svg) {
  color: #ef4444;
}

/* Nav item with arrow */
.menu-item.nav-item .nav-arrow {
  transform: rotate(90deg);
  width: 14px;
  height: 14px;
  color: var(--color-text-tertiary);
  transition: transform 0.2s ease;
}

.menu-item.nav-item:hover .nav-arrow {
  transform: rotate(90deg) translateY(2px);
  color: var(--color-accent-primary);
}

/* ============================================
   TOGGLE ITEM (Dark Mode)
   ============================================ */
.menu-item.toggle-item {
  gap: 12px;
}

.menu-item.toggle-item::before {
  display: none;
}

.toggle-switch {
  width: 48px;
  height: 26px;
  border-radius: 13px;
  background: var(--color-toolbar-active);
  border: 1px solid var(--color-toolbar-border);
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

.toggle-switch.active {
  background: linear-gradient(135deg, #312e81, #1e1b4b);
  border-color: #4338ca;
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  box-shadow: 0 2px 6px rgba(251, 191, 36, 0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-switch.active .toggle-thumb {
  transform: translateX(22px);
  background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.toggle-icon {
  width: 12px !important;
  height: 12px !important;
  color: white !important;
}

.toggle-switch.active .toggle-icon {
  color: #475569 !important;
}

/* ============================================
   AI ITEM (Magic Notes)
   ============================================ */
.menu-item.ai-item {
  background: linear-gradient(135deg, 
    rgba(139, 92, 246, 0.08) 0%, 
    rgba(99, 102, 241, 0.08) 100%
  );
  border: 1px solid rgba(139, 92, 246, 0.15);
}

.menu-item.ai-item::before {
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
}

.menu-item.ai-item:hover {
  background: linear-gradient(135deg, 
    rgba(139, 92, 246, 0.15) 0%, 
    rgba(99, 102, 241, 0.15) 100%
  );
  border-color: rgba(139, 92, 246, 0.25);
}

.ai-icon-wrap {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  border-radius: 8px;
  flex-shrink: 0;
}

.ai-icon-wrap :deep(svg) {
  width: 14px;
  height: 14px;
  color: white !important;
}

.menu-item.ai-item:hover .ai-icon-wrap {
  animation: sparkle 0.6s ease;
}

@keyframes sparkle {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.ai-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 3px 7px;
  border-radius: 5px;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
  max-width: 30px;
  box-shadow: 0 2px 6px rgba(139, 92, 246, 0.3);
}

/* ============================================
   UPGRADE ITEM
   ============================================ */
.menu-item.upgrade-item {
  background: linear-gradient(135deg, 
    rgba(99, 102, 241, 0.1) 0%, 
    rgba(168, 85, 247, 0.1) 100%
  );
  border: 1px solid rgba(99, 102, 241, 0.2);
  padding: 14px;
  flex-wrap: wrap;
}

.menu-item.upgrade-item::before {
  display: none;
}

.menu-item.upgrade-item:hover {
  background: linear-gradient(135deg, 
    rgba(99, 102, 241, 0.15) 0%, 
    rgba(168, 85, 247, 0.15) 100%
  );
  border-color: rgba(99, 102, 241, 0.3);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.15);
}

.upgrade-icon-wrap {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-accent-primary), #a855f7);
  border-radius: 10px;
  flex-shrink: 0;
}

.upgrade-icon-wrap :deep(svg) {
  width: 18px;
  height: 18px;
  color: white !important;
}

.upgrade-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.upgrade-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.upgrade-hint {
  font-size: 11px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.upgrade-price {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-accent-primary);
  flex-shrink: 0;
}

.upgrade-price small {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

/* ============================================
   LOGOUT ITEM
   ============================================ */
.menu-item.logout-item {
  color: var(--color-text-secondary);
}

.menu-item.logout-item :deep(svg) {
  color: var(--color-text-secondary);
}

.menu-item.logout-item::before {
  background: #ef4444;
}

.menu-item.logout-item:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
}

.menu-item.logout-item:hover :deep(svg) {
  color: #ef4444;
}

/* ============================================
   FOOTER
   ============================================ */
.drawer-footer {
  margin-top: auto;
  padding: 12px;
  border-top: 1px solid var(--color-toolbar-border);
  flex-shrink: 0;
  background: linear-gradient(0deg, 
    var(--color-toolbar-hover) 0%, 
    transparent 100%
  );
}

/* ============================================
   MOBILE RESPONSIVE
   ============================================ */
@media (max-width: 767px) {
  .drawer-panel {
    width: 100%;
    max-width: 100%;
    border-right: none;
  }
  
  .menu-item {
    padding: 14px 16px;
  }
  
  .section-label {
    padding: 12px 14px 8px;
  }
}

/* ============================================
   REDUCED MOTION
   ============================================ */
@media (prefers-reduced-motion: reduce) {
  .drawer-overlay,
  .drawer-panel,
  .menu-item,
  .toggle-thumb,
  .toggle-switch,
  .drawer-close,
  .google-signin-btn,
  .menu-section {
    transition: none;
    animation: none;
  }
  
  .shape-circle,
  .shape-square,
  .shape-triangle,
  .avatar-pro-ring {
    animation: none;
  }
}
</style>
