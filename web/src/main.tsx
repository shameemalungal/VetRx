import { StrictMode } from 'react'
import { Capacitor } from '@capacitor/core'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/utilities.css'
import App from './App.tsx'

// Route every existing relative /api request to the shared production API when
// running inside the packaged Android WebView. Web builds retain normal same-origin behavior.
const nativeApiBase = import.meta.env.VITE_API_URL?.replace(/\/+$/, '')
if (Capacitor.isNativePlatform() && nativeApiBase) {
  const originalFetch = window.fetch.bind(window)
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    let target: RequestInfo | URL = input

    if (typeof input === 'string' && input.startsWith('/api/')) {
      target = `${nativeApiBase}${input}`
    } else if (input instanceof URL && input.origin === window.location.origin && input.pathname.startsWith('/api/')) {
      target = `${nativeApiBase}${input.pathname}${input.search}`
    } else if (input instanceof Request) {
      const url = new URL(input.url)
      if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
        target = new Request(`${nativeApiBase}${url.pathname}${url.search}`, input)
      }
    }

    return originalFetch(target, init)
  }) as typeof window.fetch
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
