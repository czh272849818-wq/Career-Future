import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    hmr: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
    headers: mode !== 'production' ? {
      // Relax CSP in dev to avoid eval blocking from tooling/bundler
      'Content-Security-Policy': [
        "default-src 'self'",
        // Allow eval only in dev to satisfy tooling; include blob for source maps/workers
        "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        // Allow local API and DeepSeek; include ws for dev tooling if needed
        "connect-src 'self' ws: http://localhost:3001 https://api.deepseek.com",
        "worker-src 'self' blob:",
        "frame-ancestors 'self'"
      ].join('; ')
    } : undefined,
  },
  // Preview server (for npm run preview / production build testing)
  preview: {
    headers: {
      // Preview/prod CSP: allow eval only if required by tooling/libs
      // If you aim for strict CSP in production, remove 'unsafe-eval' and 'wasm-unsafe-eval' after replacing libs that depend on them.
      'Content-Security-Policy': [
        "default-src 'self'",
        // Permit eval for preview to avoid CSP blocking errors from certain libs (e.g., sourcemap processing, WASM)
        "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        // Add ws: to support dev tools or SSE during preview if needed
        "connect-src 'self' ws: http://localhost:3001 https://api.deepseek.com",
        "worker-src 'self' blob:",
        "frame-ancestors 'self'"
      ].join('; ')
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
}));