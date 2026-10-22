// Local-only fixture. Activated only by this server, never by the production build.
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const server = await createServer({
  configFile: false,
  envDir: false,
  root,
  plugins: [
    {
      name: 'ignored-local-account-fixture', enforce: 'pre',
      resolveId(source) {
        if (/^(?:\.\.\/|\.\/)lib\/foodService$/.test(source)) return path.join(here, 'food-service.ts')
      },
      transformIndexHtml(html) {
        return html.replace('/src/main.tsx', '/tests/browser/fixture/main.tsx')
      },
      configureServer(vite) {
        vite.middlewares.use((request, response, next) => {
          response.setHeader('Content-Security-Policy', "connect-src 'self' ws://127.0.0.1:5182; img-src 'self' data:; form-action 'self'; object-src 'none'")
          if (request.url?.startsWith('/__fixture/food.svg')) {
            response.setHeader('Content-Type', 'image/svg+xml')
            response.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#ece3cf"/><circle cx="160" cy="106" r="72" fill="#fff" stroke="#bcab89" stroke-width="6"/><circle cx="160" cy="106" r="48" fill="#b7874f"/><text x="160" y="216" font-size="20" text-anchor="middle" fill="#57442d">本地测试图片</text></svg>')
            return
          }
          next()
        })
      },
    },
    react(),
  ],
  server: { host: '127.0.0.1', port: 5182, strictPort: true },
})
await server.listen()
console.log('Isolated fixture only: http://127.0.0.1:5182/account')
