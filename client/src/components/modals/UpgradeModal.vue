<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import ToolIcon from '../toolbar/ToolIcon.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const authStore = useAuthStore()
const isLoading = ref(false)
const error = ref<string | null>(null)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function handleUpgrade() {
  isLoading.value = true
  error.value = null

  try {
    const response = await fetch(`${API_URL}/api/billing/checkout`, {
      method: 'POST',
      credentials: 'include',
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to create checkout session')
    }

    const data = await response.json()
    
    // Redirect to Stripe checkout
    if (data.url) {
      window.location.href = data.url
    }
  } catch (e) {
    error.value = (e as Error).message
    console.error('Checkout failed:', e)
  } finally {
    isLoading.value = false
  }
}

async function handleManageSubscription() {
  isLoading.value = true
  error.value = null

  try {
    const response = await fetch(`${API_URL}/api/billing/portal`, {
      method: 'POST',
      credentials: 'include',
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to open billing portal')
    }

    const data = await response.json()
    
    // Redirect to Stripe customer portal
    if (data.url) {
      window.location.href = data.url
    }
  } catch (e) {
    error.value = (e as Error).message
    console.error('Portal failed:', e)
  } finally {
    isLoading.value = false
  }
}

const features = [
  { icon: 'cloud', text: 'Unlimited cloud projects' },
  { icon: 'save', text: 'Auto-save to cloud' },
  { icon: 'folder', text: 'Access from any device' },
  { icon: 'zap', text: 'Priority support' },
]
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <!-- Close button -->
      <button class="close-btn" @click="emit('close')">
        <ToolIcon name="close" />
      </button>

      <!-- Already subscribed view -->
      <template v-if="authStore.isPaidUser">
        <div class="modal-header">
          <div class="pro-badge-large">PRO</div>
          <h2>Manage Subscription</h2>
          <p class="subtitle">You're currently on the Pro plan</p>
        </div>

        <div class="subscription-info">
          <div class="info-row">
            <span class="label">Status</span>
            <span class="value active">Active</span>
          </div>
          <div v-if="authStore.user?.subscriptionEndDate" class="info-row">
            <span class="label">Next billing</span>
            <span class="value">
              {{ new Date(authStore.user.subscriptionEndDate * 1000).toLocaleDateString() }}
            </span>
          </div>
        </div>

        <div v-if="error" class="error-message">{{ error }}</div>

        <button 
          class="manage-btn"
          :disabled="isLoading"
          @click="handleManageSubscription"
        >
          {{ isLoading ? 'Loading...' : 'Manage Subscription' }}
        </button>

        <p class="portal-hint">
          Update payment method, cancel subscription, or view invoices
        </p>
      </template>

      <!-- Upgrade view -->
      <template v-else>
        <div class="modal-header">
          <div class="pro-badge-large">PRO</div>
          <h2>Upgrade to Pro</h2>
          <p class="subtitle">Store your projects in the cloud</p>
        </div>

        <div class="price-section">
          <span class="price">$5</span>
          <span class="period">/month</span>
        </div>

        <ul class="features-list">
          <li v-for="feature in features" :key="feature.text" class="feature-item">
            <ToolIcon :name="feature.icon" class="feature-icon" />
            <span>{{ feature.text }}</span>
          </li>
        </ul>

        <div class="comparison">
          <div class="plan free">
            <span class="plan-name">Free</span>
            <span class="plan-desc">Local storage only</span>
          </div>
          <div class="vs">→</div>
          <div class="plan pro">
            <span class="plan-name">Pro</span>
            <span class="plan-desc">Cloud storage</span>
          </div>
        </div>

        <div v-if="error" class="error-message">{{ error }}</div>

        <button 
          v-if="authStore.isAuthenticated"
          class="upgrade-btn"
          :disabled="isLoading"
          @click="handleUpgrade"
        >
          <ToolIcon v-if="!isLoading" name="zap" />
          {{ isLoading ? 'Redirecting to checkout...' : 'Upgrade Now' }}
        </button>

        <button 
          v-else
          class="upgrade-btn signin"
          @click="authStore.login()"
        >
          Sign in to upgrade
        </button>

        <p class="terms">
          Cancel anytime. Powered by Stripe.
        </p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
  padding: 20px;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  position: relative;
  width: 100%;
  max-width: 400px;
  background: var(--color-toolbar-bg-solid);
  border-radius: 20px;
  padding: 32px;
  animation: slideUp 0.25s ease;
  text-align: center;
}

@keyframes slideUp {
  from { 
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to { 
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
}

.modal-header {
  margin-bottom: 24px;
}

.pro-badge-large {
  display: inline-block;
  padding: 6px 16px;
  font-size: 14px;
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary));
  border-radius: 20px;
  margin-bottom: 16px;
}

.modal-header h2 {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 8px 0;
}

.subtitle {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}

.price-section {
  margin-bottom: 24px;
}

.price {
  font-size: 48px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.period {
  font-size: 16px;
  color: var(--color-text-secondary);
}

.features-list {
  list-style: none;
  padding: 0;
  margin: 0 0 24px 0;
  text-align: left;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  font-size: 14px;
  color: var(--color-text-primary);
}

.feature-icon {
  width: 18px;
  height: 18px;
  color: var(--color-accent-primary);
}

.comparison {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  background: var(--color-toolbar-hover);
  border-radius: 12px;
  margin-bottom: 24px;
}

.plan {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.plan-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.plan-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.plan.pro .plan-name {
  color: var(--color-accent-primary);
}

.vs {
  font-size: 18px;
  color: var(--color-accent-primary);
}

.error-message {
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 16px;
}

.upgrade-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px 24px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary));
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.upgrade-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.upgrade-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.upgrade-btn.signin {
  background: var(--color-toolbar-hover);
  color: var(--color-text-primary);
  border: 1px solid var(--color-toolbar-border);
}

.terms {
  margin: 16px 0 0 0;
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* Subscription management styles */
.subscription-info {
  background: var(--color-toolbar-hover);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
}

.info-row:not(:last-child) {
  border-bottom: 1px solid var(--color-toolbar-border);
}

.info-row .label {
  color: var(--color-text-secondary);
  font-size: 14px;
}

.info-row .value {
  font-weight: 500;
  color: var(--color-text-primary);
  font-size: 14px;
}

.info-row .value.active {
  color: #22c55e;
}

.manage-btn {
  width: 100%;
  padding: 14px 24px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  background: var(--color-toolbar-hover);
  border: 1px solid var(--color-toolbar-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.manage-btn:hover:not(:disabled) {
  background: var(--color-toolbar-bg-solid);
  border-color: var(--color-accent-primary);
}

.manage-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.portal-hint {
  margin: 16px 0 0 0;
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>

