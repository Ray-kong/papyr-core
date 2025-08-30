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
        index: 'src/index.ts'
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'node:crypto'
      ],
    },
    ssr: true,
  },
}) 