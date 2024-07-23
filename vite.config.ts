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
  ],
  server: { port: 3000 },
  build: {
    lib: {
      entry: {
        index: path.resolve(__dirname, 'src/index.ts'),
        plugins: path.resolve(__dirname, 'src/plugins/index.ts'),
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
