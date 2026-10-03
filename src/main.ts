import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { autoAnimatePlugin } from '@formkit/auto-animate/vue'
import App from './App.vue'
import { applyTheme, cachedTheme } from './lib/theme'
import './style.css'

// Apply the last chosen theme before the first paint.
applyTheme(cachedTheme())

// Registers the v-auto-animate directive. It turns itself off when the OS asks for reduced motion.
createApp(App).use(createPinia()).use(autoAnimatePlugin).mount('#app')
