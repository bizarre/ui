// landing/vite.config.ts
import { defineConfig, mergeConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import ssr from 'vike/plugin'
import path from 'path'

export default async () => {
  const vikeReact = (await import('vike-react/config')).default

  return mergeConfig(
    vikeReact,
    defineConfig({
      plugins: [react(), ssr()],
      resolve: {
        alias: {
          '@lib': path.resolve(__dirname, '../src')
        },
        dedupe: ['react', 'react-dom']
      },
      css: {
        postcss: path.resolve(__dirname, 'postcss.config.ts')
      }
    })
  )
}
