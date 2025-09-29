import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// 👇 import vite-plugin-pwa helper
import { registerSW } from 'virtual:pwa-register'

// 👇 register service worker (auto updates when you redeploy)
registerSW({
  onNeedRefresh() {
    console.log("New content available, please refresh.")
  },
  onOfflineReady() {
    console.log("App is ready to work offline!")
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
