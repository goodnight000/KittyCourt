import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devHost = env.VITE_DEV_HOST || '127.0.0.1'
  const devPort = Number(env.VITE_DEV_PORT || 5173)
  const apiBase = env.VITE_API_URL
  const apiTarget = apiBase ? String(apiBase).replace(/\/api\/?$/, '') : `http://${devHost}:3001`
  const repoRoot = path.resolve(__dirname, '..')
  const manualChunks = (id) => {
    if (!id.includes('node_modules')) return

    if (
      id.includes('/react/') ||
      id.includes('/react-dom/') ||
      id.includes('/react-router/') ||
      id.includes('/react-router-dom/') ||
      id.includes('/scheduler/')
    ) {
      return 'vendor-react'
    }

    if (id.includes('/framer-motion/')) {
      return 'vendor-motion'
    }

    if (id.includes('/@supabase/')) {
      return 'vendor-supabase'
    }

    if (
      id.includes('/socket.io-client/') ||
      id.includes('/engine.io-client/') ||
      id.includes('/socket.io-parser/')
    ) {
      return 'vendor-realtime'
    }

    if (
      id.includes('/@capacitor/') ||
      id.includes('/@revenuecat/') ||
      id.includes('/@sentry/')
    ) {
      return 'vendor-native'
    }

    if (id.includes('/lucide-react/')) {
      return 'vendor-icons'
    }

    return 'vendor'
  }

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
    server: {
      host: devHost,
      port: devPort,
      fs: {
        allow: [repoRoot],
      },
      proxy: {
        // Proxy API calls in dev so the client can use same-origin '/api'.
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
