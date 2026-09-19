import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import solid from 'vite-plugin-solid'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  resolve: {
    alias: {
      'solid-js/web': '@solidjs/web',
    },
  },
  build: {
    minify: false,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        solid: resolve(__dirname, 'src/element/repl.tsx'),
        element: resolve(__dirname, 'src/element/repl-element.tsx'),
      },
      name: 'repl',
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'solid-js',
        '@solidjs/web',
        '@solidjs/router',
        'typescript',
        '@babel/standalone',
        'dom-serializer',
        'domutils',
        'htmlparser2',
        'monaco-editor',
      ],
    },
  },
  plugins: [
    tsconfigPaths(),
    solid(),
    dts({
      tsconfigPath: './tsconfig.json',
      entryRoot: 'src',
    }),
  ],
  server: { port: 3000 },
  css: {
    modules: {
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
  },
})
