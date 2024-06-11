import path from 'path'
import { defineConfig } from 'vite'
import dtsBundleGenerator from 'vite-plugin-dts-bundle-generator'
import { libInjectCss } from 'vite-plugin-lib-inject-css'
import solid from 'vite-plugin-solid'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    solid(),
    dtsBundleGenerator(
      {
        fileName: 'index.d.ts',
      },
      {
        // compilation options
      },
    ),
    libInjectCss(),
  ],
  server: { port: 3000 },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'repl',
      fileName: format => `index.${format}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['solid-js', 'shiki'],
      output: {
        globals: {
          'solid-js': 'SolidJS',
        },
      },
    },
  },
  css: {
    modules: {
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
  },
})
