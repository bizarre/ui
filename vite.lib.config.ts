import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import dts from 'vite-plugin-dts'
import path from 'path'
import fs from 'fs'

const components = fs
  .readdirSync(path.resolve(__dirname, 'src'))
  .filter((f) => fs.statSync(path.resolve(__dirname, 'src', f)).isDirectory())

const entries = {
  index: path.resolve(__dirname, 'src/index.ts'),
  ...Object.fromEntries(
    components.map((name) => [
      name,
      path.resolve(__dirname, `src/${name}/index.ts`)
    ])
  )
}

export default defineConfig({
  plugins: [
    react(),
    dts({
      entryRoot: 'src',
      outDir: 'dist'
    })
  ],
  build: {
    lib: {
      entry: entries,
      formats: ['es', 'cjs'],
      fileName: (format, entryName) =>
        entryName === 'index'
          ? `bizarre-ui.${format}.js`
          : `${entryName}/index.${format}.js`
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: `[name]/index.[format].js`,
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    }
  }
})
