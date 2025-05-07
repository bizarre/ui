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
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  plugins: [
    react(),
    dts({
      entryRoot: 'src',
      outDir: 'dist',
      rollupTypes: true
    })
  ],
  build: {
    sourcemap: false,
    lib: {
      entry: entries,
      formats: ['es', 'cjs'],
      fileName: (format, entryName) =>
        entryName === 'index'
          ? `bizarre-ui.${format}.js`
          : `${entryName}/index.${format}.js`
    },
    rollupOptions: {
      external: [
        /^react($|\/.*)/,
        /^react-dom($|\/.*)/,
        '@radix-ui/react-compose-refs',
        '@radix-ui/react-context',
        '@radix-ui/react-dismissable-layer',
        '@radix-ui/react-slot',
        '@radix-ui/react-use-controllable-state',
        'chrono-node',
        'date-fns',
        'timezone-enum',
        /^@formatjs($|\/.*)/
      ],
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
