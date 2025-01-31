import { describe, expect, test } from 'vitest'
import { resolvePackageEntries } from './resolve-package-entries.ts'

describe('resolvePackage', () => {
  test('resolves basic main field', () => {
    const pkg = { main: './dist/index.js' }
    expect(resolvePackageEntries(pkg)).toBe('./dist/index.js')
  })

  test('prefers module over main in browser', () => {
    const pkg = {
      main: './dist/index.cjs',
      module: './dist/index.mjs',
    }
    expect(resolvePackageEntries(pkg)).toBe('./dist/index.mjs')
  })

  test('handles browser field string', () => {
    const pkg = {
      main: './dist/index.node.js',
      browser: './dist/index.browser.js',
    }
    expect(resolvePackageEntries(pkg)).toBe('./dist/index.browser.js')
  })

  test('handles browser field object mapping', () => {
    const pkg = {
      main: './dist/index.js',
      browser: {
        './dist/index.js': './dist/index.browser.js',
      },
    }
    expect(resolvePackageEntries(pkg)).toBe('./dist/index.browser.js')
  })

  test('handles exports field with conditions', () => {
    const pkg = {
      exports: {
        browser: './dist/index.browser.js',
        import: './dist/index.mjs',
        require: './dist/index.cjs',
        default: './dist/index.js',
      },
    }
    expect(resolvePackageEntries(pkg)).toBe('./dist/index.browser.js')
  })

  test('handles nested exports field', () => {
    const pkg = {
      exports: {
        '.': {
          browser: './dist/index.browser.js',
          default: './dist/index.js',
        },
      },
    }
    expect(resolvePackageEntries(pkg)).toBe('./dist/index.browser.js')
  })

  test('handles exports array', () => {
    const pkg = {
      exports: [
        {
          browser: './dist/index.browser.js',
        },
        './dist/index.js',
      ],
    }
    expect(resolvePackageEntries(pkg)).toBe('./dist/index.browser.js')
  })

  test('falls back to default when no conditions match', () => {
    const pkg = {
      exports: {
        node: './dist/index.node.js',
        default: './dist/index.js',
      },
    }
    expect(resolvePackageEntries(pkg)).toBe('./dist/index.js')
  })

  test('defaults to index.js when no fields present', () => {
    const pkg = {}
    expect(resolvePackageEntries(pkg)).toBe('./index.js')
  })
})
