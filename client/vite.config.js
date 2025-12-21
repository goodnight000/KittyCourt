import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devHost = env.VITE_DEV_HOST || '127.0.0.1'
  const devPort = Number(env.VITE_DEV_PORT || 5173)
  const apiBase = env.VITE_API_URL
  const apiTarget = apiBase ? String(apiBase).replace(/\/api\/?$/, '') : `http://${devHost}:3001`

  return {
    plugins: [react()],
    server: {
      host: devHost,
      port: devPort,
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
