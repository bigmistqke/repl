import { resolve } from 'path'
import { defineConfig } from 'vite'
import dtsBundleGenerator from 'vite-plugin-dts-bundle-generator'
import solid from 'vite-plugin-solid'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  build: {
    minify: false,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
      },
      name: 'repl',
      fileName: (_, name) => `${name}.js`,
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'solid-js',
        'solid-js/store',
        '@solidjs/router',
        'typescript',
        '@babel/standalone',
      ],
    },
  },
  plugins: [
    tsconfigPaths(),
    solid(),
    dtsBundleGenerator(
      {
        fileName: name => `${name}.d.ts`,
        libraries: {
          importedLibraries: ['solid-js'],
        },
      },
      {
        preferredConfigPath: './tsconfig.json',
      },
    ),
  ],
  server: { port: 3000 },
  css: {
    modules: {
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
  },
})
