import { defineConfig } from 'vite'
import { agentApi } from './server/vitePlugin.js'

export default defineConfig({
  plugins: [agentApi()],
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  test: { environment: 'node', include: ['tests/**/*.test.js'], testTimeout: 30000 },
})
