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
        runtime: 'src/runtime/index.ts',
        analytics: 'src/analytics.ts',
        graph: 'src/graph.ts',
        graphAnalysis: 'src/graphAnalysis.ts',
        linkResolver: 'src/linkResolver.ts',
        folderHierarchy: 'src/folderHierarchy.ts',
        search: 'src/search.ts',
        jsonExporter: 'src/jsonExporter.ts'
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
