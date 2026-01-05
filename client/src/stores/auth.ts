import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface User {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  subscriptionStatus: 'free' | 'active' | 'canceled' | 'past_due'
  subscriptionEndDate: number | null
  isAdmin: boolean
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isAuthenticated = computed(() => !!user.value)
  
  const isPaidUser = computed(() => {
    if (!user.value) return false
    const { subscriptionStatus, subscriptionEndDate } = user.value
    const now = Math.floor(Date.now() / 1000)
    
    return subscriptionStatus === 'active' || 
      (subscriptionStatus === 'canceled' && subscriptionEndDate && subscriptionEndDate > now)
  })

  const isAdmin = computed(() => user.value?.isAdmin || false)

  const displayName = computed(() => {
    if (!user.value) return null
    return user.value.name || user.value.email.split('@')[0]
  })

  const initials = computed(() => {
    if (!displayName.value) return '?'
    return displayName.value
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  })

  // Actions
  async function checkAuth(): Promise<boolean> {
    isLoading.value = true
    error.value = null

    try {
      const response = await fetch(`${API_URL}/api/auth/status`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to check auth status')
      }

      const data = await response.json()
      
      if (data.authenticated && data.user) {
        user.value = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          avatarUrl: data.user.avatar_url,
          subscriptionStatus: data.user.subscription_status,
          subscriptionEndDate: data.user.subscription_end_date,
          isAdmin: data.user.is_admin || false,
        }
        return true
      } else {
        user.value = null
        return false
      }
    } catch (e) {
      console.error('Auth check failed:', e)
      user.value = null
      return false
    } finally {
      isLoading.value = false
    }
  }

  function login() {
    // Redirect to Google OAuth
    window.location.href = `${API_URL}/api/auth/google`
  }

  async function logout(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (e) {
      console.error('Logout failed:', e)
    } finally {
      user.value = null
      isLoading.value = false
    }
  }

  async function refreshUser(): Promise<void> {
    if (!isAuthenticated.value) return

    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        user.value = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          avatarUrl: data.user.avatarUrl,
          subscriptionStatus: data.user.subscriptionStatus,
          subscriptionEndDate: data.user.subscriptionEndDate,
          isAdmin: data.user.isAdmin || false,
        }
      }
    } catch (e) {
      console.error('Failed to refresh user:', e)
    }
  }

  return {
    // State
    user,
    isLoading,
    error,

    // Computed
    isAuthenticated,
    isPaidUser,
    isAdmin,
    displayName,
    initials,

    // Actions
    checkAuth,
    login,
    logout,
    refreshUser,
  }
})

