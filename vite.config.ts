import { resolve } from 'path'
import { defineConfig } from 'vite'
import dtsBundleGenerator from 'vite-plugin-dts-bundle-generator'
import { libInjectCss } from 'vite-plugin-lib-inject-css'
import solid from 'vite-plugin-solid'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    solid(),
    libInjectCss(),
    dtsBundleGenerator(
      {
        fileName: name => `${name}.d.ts`,
        libraries: {
          importedLibraries: ['shiki', 'solid-js'],
        },
      },
      {
        preferredConfigPath: './tsconfig.json',
      },
    ),
    viteStaticCopy({
      targets: [
        {
          src: 'src/components/monaco/themes/*.json',
          dest: 'monaco-themes',
        },
      ],
    }),
  ],
  server: { port: 3000 },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
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
      external: ['solid-js', 'shiki'],
      output: {
        globals: {
          'solid-js': 'solidjs',
          shiki: 'shiki',
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
