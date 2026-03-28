import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  if (mode === 'client') {
    return {
      build: {
        rollupOptions: {
          input: './src/client.ts',
          output: {
            entryFileNames: 'static/client.js',
          },
        },
      },
    }
  }

  return {
    plugins: [
      devServer({
        entry: 'src/index.tsx',
      }),
      build({
        entry: 'src/index.tsx',
      }),
    ],
    define: {
      // Evitar que o bundler injete process.env
    },
  }
})
