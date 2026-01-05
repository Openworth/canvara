import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'
import { vTooltip } from './directives/tooltip'

// Router configuration
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./views/HomeView.vue'),
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('./views/AuthCallbackView.vue'),
    },
    {
      path: '/:roomId',
      name: 'room',
      component: () => import('./views/HomeView.vue'),
      props: true,
    },
  ],
})

// Create and mount app
const app = createApp(App)
const pinia = createPinia()

// Register global directives
app.directive('tooltip', vTooltip)

app.use(pinia)
app.use(router)
app.mount('#app')
