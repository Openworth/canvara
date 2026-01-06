<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import ToolIcon from '../toolbar/ToolIcon.vue'

const emit = defineEmits<{
  (e: 'openProjects'): void
  (e: 'openUpgrade'): void
}>()

const authStore = useAuthStore()
const showDropdown = ref(false)
const menuRef = ref<HTMLElement | null>(null)

function toggleDropdown() {
  showDropdown.value = !showDropdown.value
}

function closeDropdown() {
  showDropdown.value = false
}

function handleClickOutside(event: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

function handleLogout() {
  closeDropdown()
  authStore.logout()
}

function handleOpenProjects() {
  closeDropdown()
  emit('openProjects')
}

function handleOpenUpgrade() {
  closeDropdown()
  emit('openUpgrade')
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="menuRef" class="user-menu-container">
    <!-- User avatar button -->
    <button
      class="user-avatar-btn"
      :class="{ 
        'is-pro': authStore.isPaidUser && !authStore.isSubscriptionCanceled,
        'is-canceling': authStore.isSubscriptionCanceled
      }"
      @click="toggleDropdown"
    >
      <img
        v-if="authStore.user?.avatarUrl"
        :src="authStore.user.avatarUrl"
        :alt="authStore.displayName || 'User'"
        class="avatar-img"
      />
      <span v-else class="avatar-initials">
        {{ authStore.initials }}
      </span>
      
      <!-- Pro crown badge -->
      <div 
        v-if="authStore.isPaidUser" 
        :class="['pro-crown-badge', { 'is-canceling': authStore.isSubscriptionCanceled }]"
      >
        <ToolIcon name="crown" />
      </div>
    </button>

    <!-- Dropdown menu -->
    <Transition name="dropdown">
      <div v-if="showDropdown" class="dropdown-menu">
        <!-- User info header -->
        <div class="user-info">
          <img
            v-if="authStore.user?.avatarUrl"
            :src="authStore.user.avatarUrl"
            :alt="authStore.displayName || 'User'"
            class="user-info-avatar"
          />
          <span v-else class="user-info-avatar-initials">
            {{ authStore.initials }}
          </span>
          <div class="user-info-text">
            <span class="user-name">{{ authStore.displayName }}</span>
            <span class="user-email">{{ authStore.user?.email }}</span>
          </div>
        </div>

        <!-- Plan info -->
        <div class="plan-info">
          <span class="plan-label">Current plan:</span>
          <span :class="['plan-value', authStore.isPaidUser ? (authStore.isSubscriptionCanceled ? 'canceled' : 'pro') : 'free']">
            {{ authStore.isPaidUser ? 'Pro' : 'Free' }}
          </span>
        </div>

        <!-- Cancellation notice -->
        <div v-if="authStore.isSubscriptionCanceled" class="cancel-notice">
          <ToolIcon name="zap" class="cancel-icon" />
          <div class="cancel-text">
            <span class="cancel-title">Subscription canceled</span>
            <span class="cancel-date">Access until {{ authStore.subscriptionEndDateFormatted }}</span>
          </div>
        </div>

        <div class="menu-divider" />

        <!-- Menu items -->
        <button 
          v-if="authStore.isPaidUser" 
          class="menu-item"
          @click="handleOpenProjects"
        >
          <ToolIcon name="folder" class="menu-icon" />
          <span>My Projects</span>
        </button>

        <button 
          v-if="!authStore.isPaidUser" 
          class="menu-item upgrade"
          @click="handleOpenUpgrade"
        >
          <ToolIcon name="zap" class="menu-icon" />
          <span>Upgrade to Pro</span>
          <span class="upgrade-price">$6/mo</span>
        </button>

        <button 
          v-if="authStore.isPaidUser" 
          class="menu-item"
          @click="handleOpenUpgrade"
        >
          <ToolIcon name="creditCard" class="menu-icon" />
          <span>Manage Subscription</span>
        </button>

        <div class="menu-divider" />

        <button class="menu-item logout" @click="handleLogout">
          <ToolIcon name="logOut" class="menu-icon" />
          <span>Sign out</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.user-menu-container {
  position: relative;
}

.user-avatar-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid var(--color-toolbar-border);
  background: var(--color-toolbar-bg-solid);
  cursor: pointer;
  transition: all 0.15s ease;
  overflow: hidden;
}

.user-avatar-btn:hover {
  border-color: var(--color-accent-primary);
}

.user-avatar-btn.is-pro {
  border-color: #f59e0b;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
}

.user-avatar-btn.is-pro:hover {
  border-color: #fbbf24;
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.3);
}

.user-avatar-btn.is-canceling {
  border-color: #78716c;
  box-shadow: 0 0 0 2px rgba(120, 113, 108, 0.2);
}

.user-avatar-btn.is-canceling:hover {
  border-color: #a8a29e;
  box-shadow: 0 0 0 3px rgba(168, 162, 158, 0.3);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-initials {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.pro-crown-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  border-radius: 50%;
  border: 2px solid var(--color-toolbar-bg-solid);
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.4);
}

.pro-crown-badge :deep(svg) {
  width: 10px;
  height: 10px;
  color: white;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2));
}

.pro-crown-badge.is-canceling {
  background: linear-gradient(135deg, #78716c 0%, #57534e 100%);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 260px;
  background: var(--color-toolbar-bg-solid);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 12px;
  box-shadow: 0 8px 32px -4px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 100;
}

.dark .dropdown-menu {
  box-shadow: 0 8px 32px -4px rgba(0, 0, 0, 0.4);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--color-toolbar-hover);
}

.user-info-avatar,
.user-info-avatar-initials {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}

.user-info-avatar {
  object-fit: cover;
}

.user-info-avatar-initials {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent-primary);
  color: white;
  font-size: 14px;
  font-weight: 600;
}

.user-info-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.plan-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--color-toolbar-hover);
}

.plan-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.plan-value {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.plan-value.free {
  color: var(--color-text-secondary);
  background: var(--color-toolbar-bg-solid);
}

.plan-value.pro {
  color: white;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
}

.plan-value.canceled {
  color: #a8a29e;
  background: linear-gradient(135deg, #78716c, #57534e);
}

.cancel-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(245, 158, 11, 0.1);
  border-top: 1px solid rgba(245, 158, 11, 0.2);
}

.cancel-icon {
  width: 18px;
  height: 18px;
  color: #f59e0b;
  flex-shrink: 0;
}

.cancel-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cancel-title {
  font-size: 12px;
  font-weight: 600;
  color: #f59e0b;
}

.cancel-date {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.menu-divider {
  height: 1px;
  background: var(--color-toolbar-border);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease;
  text-align: left;
}

.menu-item:hover {
  background: var(--color-toolbar-hover);
}

.menu-icon {
  width: 16px;
  height: 16px;
  color: var(--color-text-secondary);
}

.menu-item.upgrade {
  color: var(--color-accent-primary);
}

.menu-item.upgrade .menu-icon {
  color: var(--color-accent-primary);
}

.upgrade-price {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-toolbar-hover);
  padding: 2px 6px;
  border-radius: 4px;
}

.menu-item.logout {
  color: #ef4444;
}

.menu-item.logout .menu-icon {
  color: #ef4444;
}

/* Dropdown animation */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}
</style>

