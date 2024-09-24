import { resolve } from 'path'
import { defineConfig } from 'vite'
import dtsBundleGenerator from 'vite-plugin-dts-bundle-generator'
import { libInjectCss } from 'vite-plugin-lib-inject-css'
import solid from 'vite-plugin-solid'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    solid({
      babel: {
        plugins: [['@babel/plugin-proposal-decorators', { version: '2023-05' }]],
      },
    }),
    libInjectCss(),
    dtsBundleGenerator(
      {
        fileName: name => `${name}.d.ts`,
        libraries: {
          importedLibraries: [
            'solid-js',
            'typescript',
            '@monaco-editor/loader',
            '@babel/standalone',
          ],
        },
        output: {
          sortNodes: true, // Helps in maintaining the order but check if additional flags are necessary
        },
      },
      {
        preferredConfigPath: './tsconfig.json',
      },
    ),
  ],
  server: { port: 3000 },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/runtime/index.ts'),
        element: resolve(__dirname, 'src/element/index.ts'),
        'element/tm-editor': resolve(__dirname, 'src/element/editor/tm.tsx'),
        'element/monaco-editor': resolve(__dirname, 'src/element/editor/monaco.tsx'),
        solid: resolve(__dirname, 'src/solid/index.ts'),
        'solid/monaco-editor': resolve(__dirname, 'src/solid/editor/monaco/index.ts'),
        'solid/tm-editor': resolve(__dirname, 'src/solid/editor/tm.tsx'),
        std: resolve(__dirname, 'src/std/index.ts'),
        'extensions/css-module': resolve(__dirname, 'src/extensions/css-module.ts'),
        'extensions/wat': resolve(__dirname, 'src/extensions/wat.ts'),
        'plugins/babel-solid-repl': resolve(__dirname, 'src/plugins/babel-solid-repl.ts'),
        'plugins/rollup-service-worker': resolve(
          __dirname,
          'src/plugins/rollup-service-worker/index.ts',
        ),
        'transform/babel': resolve(__dirname, 'src/transform/babel.ts'),
        'transform/typescript': resolve(__dirname, 'src/transform/typescript.ts'),
        'transform-module-paths/typescript': resolve(
          __dirname,
          'src/transform-module-paths/typescript.ts',
        ),
      },
      name: 'repl',
      fileName: (format, name) => `${name}.js`,
      formats: ['es'],
    },
    rollupOptions: {
      external: ['solid-js', '@monaco-editor/loader'],
      output: {
        globals: {
          'solid-js': 'solidjs',
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
