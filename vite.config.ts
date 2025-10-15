import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    target: 'node18',
    lib: {
      entry: {
        index: 'src/index.ts',
        runtime: 'src/runtime/index.ts'
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'node:crypto'
      ],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]'
      }
    },
    ssr: true,
  },
}) 
