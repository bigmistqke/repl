import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { getModulePathRanges } from '../src/utils/get-module-path-ranges'

describe('getModulePathRanges', () => {
  it('should extract basic import declarations', () => {
    const source = `import { foo } from './bar.js'`
    const ranges = getModulePathRanges({ ts, source })

    expect(ranges).toEqual([
      {
        start: 21,
        end: 29,
        path: './bar.js',
        isImport: true,
        isDynamic: false,
      },
    ])
  })

  it('should extract multiple imports', () => {
    const source = `
      import { a } from './a.ts'
      import { b } from './b.ts'
      import { c } from './c.ts'
    `
    const ranges = getModulePathRanges({ ts, source })

    expect(ranges).toHaveLength(3)
    expect(ranges[0].path).toBe('./a.ts')
    expect(ranges[1].path).toBe('./b.ts')
    expect(ranges[2].path).toBe('./c.ts')
    expect(ranges.every(r => r.isImport)).toBe(true)
  })

  it('should extract export declarations', () => {
    const source = `export { helper } from './helper.ts'`
    const ranges = getModulePathRanges({ ts, source })

    expect(ranges).toEqual([
      {
        start: 24,
        end: 35,
        path: './helper.ts',
        isImport: false,
        isDynamic: false,
      },
    ])
  })

  it('should extract dynamic imports', () => {
    const source = `const module = await import('./dynamic.ts')`
    const ranges = getModulePathRanges({ ts, source })

    expect(ranges).toEqual([
      {
        start: 29,
        end: 41,
        path: './dynamic.ts',
        isImport: true,
        isDynamic: true,
      },
    ])
  })

  it('should handle mixed import types', () => {
    const source = `
      import { static1 } from './static.ts'
      const dynamic = await import('./dynamic.ts')
      export { reexport } from './reexport.ts'
    `
    const ranges = getModulePathRanges({ ts, source })

    expect(ranges).toHaveLength(3)
    expect(ranges[0]).toMatchObject({ path: './static.ts', isImport: true, isDynamic: false })
    expect(ranges[1]).toMatchObject({ path: './dynamic.ts', isImport: true, isDynamic: true })
    expect(ranges[2]).toMatchObject({ path: './reexport.ts', isImport: false, isDynamic: false })
  })

  it('should handle imports with different quote styles', () => {
    const source = `
      import { a } from "./double.ts"
      import { b } from './single.ts'
    `
    const ranges = getModulePathRanges({ ts, source })

    expect(ranges).toHaveLength(2)
    expect(ranges[0].path).toBe('./double.ts')
    expect(ranges[1].path).toBe('./single.ts')
  })

  it('should handle imports without specifiers', () => {
    const source = `import './side-effects.ts'`
    const ranges = getModulePathRanges({ ts, source })

    expect(ranges).toEqual([
      {
        start: 8,
        end: 25,
        path: './side-effects.ts',
        isImport: true,
        isDynamic: false,
      },
    ])
  })

  it('should handle namespace imports', () => {
    const source = `import * as utils from './utils.ts'`
    const ranges = getModulePathRanges({ ts, source })

    expect(ranges).toEqual([
      {
        start: 24,
        end: 34,
        path: './utils.ts',
        isImport: true,
        isDynamic: false,
      },
    ])
  })

  it('should handle default imports', () => {
    const source = `import Component from './Component.ts'`
    const ranges = getModulePathRanges({ ts, source })

    expect(ranges).toEqual([
      {
        start: 23,
        end: 37,
        path: './Component.ts',
        isImport: true,
        isDynamic: false,
      },
    ])
  })

  it('should handle export all declarations', () => {
    const source = `export * from './module.ts'`
    const ranges = getModulePathRanges({ ts, source })

    expect(ranges).toEqual([
      {
        start: 15,
        end: 26,
        path: './module.ts',
        isImport: false,
        isDynamic: false,
      },
    ])
  })

  it('should handle dynamic imports in different contexts', () => {
    const source = `
      // In variable declaration
      const lazy = import('./lazy.ts')
      
      // In await expression
      await import('./await.ts')
      
      // In conditional
      if (condition) {
        import('./conditional.ts')
      }
      
      // In promise chain
      import('./promise.ts').then(m => console.log(m))
    `
    const ranges = getModulePathRanges({ ts, source })

    expect(ranges).toHaveLength(4)
    expect(ranges[0].path).toBe('./lazy.ts')
    expect(ranges[1].path).toBe('./await.ts')
    expect(ranges[2].path).toBe('./conditional.ts')
    expect(ranges[3].path).toBe('./promise.ts')
    expect(ranges.every(r => r.isImport)).toBe(true)
  })

  it('should ignore non-string dynamic imports', () => {
    const source = `
      const path = './dynamic.ts'
      import(path) // Should be ignored
      import(\`./template.ts\`) // Should be ignored
    `
    const ranges = getModulePathRanges({ ts, source })

    expect(ranges).toHaveLength(0)
  })

  it('should ignore require statements (CommonJS)', () => {
    const source = `
      const module = require('./module.js')
      const { foo } = require('./foo.js')
    `
    const ranges = getModulePathRanges({ ts, source })

    expect(ranges).toHaveLength(0)
  })

  it('should handle imports from node_modules', () => {
    const source = `
      import React from 'react'
      import { useState } from 'react'
      export { Component } from '@mui/material'
    `
    const ranges = getModulePathRanges({ ts, source })

    expect(ranges).toHaveLength(3)
    expect(ranges[0].path).toBe('react')
    expect(ranges[1].path).toBe('react')
    expect(ranges[2].path).toBe('@mui/material')
  })

  it('should handle empty source', () => {
    const source = ``
    const ranges = getModulePathRanges({ ts, source })

    expect(ranges).toEqual([])
  })

  it('should handle source with no imports', () => {
    const source = `
      const x = 1
      function foo() {
        return x + 1
      }
      export default foo
    `
    const ranges = getModulePathRanges({ ts, source })

    expect(ranges).toEqual([])
  })

  it('should handle imports with complex paths', () => {
    const source = `
      import { a } from '../../../utils/helper.ts'
      import { b } from './components/Button/index.ts'
      import { c } from '@/utils/config.ts'
    `
    const ranges = getModulePathRanges({ ts, source })

    expect(ranges).toHaveLength(3)
    expect(ranges[0].path).toBe('../../../utils/helper.ts')
    expect(ranges[1].path).toBe('./components/Button/index.ts')
    expect(ranges[2].path).toBe('@/utils/config.ts')
  })

  describe('include options', () => {
    const source = `
      import { static1 } from './static.ts'
      const dynamic = await import('./dynamic.ts')
      export { reexport } from './reexport.ts'
    `

    it('should include only imports when imports=true, exports=false, dynamicImports=false', () => {
      const ranges = getModulePathRanges({ 
        ts, 
        source, 
        include: { imports: true, exports: false, dynamicImports: false } 
      })

      expect(ranges).toHaveLength(1)
      expect(ranges[0]).toMatchObject({ path: './static.ts', isImport: true, isDynamic: false })
    })

    it('should include only exports when imports=false, exports=true, dynamicImports=false', () => {
      const ranges = getModulePathRanges({ 
        ts, 
        source, 
        include: { imports: false, exports: true, dynamicImports: false } 
      })

      expect(ranges).toHaveLength(1)
      expect(ranges[0]).toMatchObject({ path: './reexport.ts', isImport: false, isDynamic: false })
    })

    it('should include only dynamic imports when imports=false, exports=false, dynamicImports=true', () => {
      const ranges = getModulePathRanges({ 
        ts, 
        source, 
        include: { imports: false, exports: false, dynamicImports: true } 
      })

      expect(ranges).toHaveLength(1)
      expect(ranges[0]).toMatchObject({ path: './dynamic.ts', isImport: true, isDynamic: true })
    })

    it('should include all when all options are true', () => {
      const ranges = getModulePathRanges({ 
        ts, 
        source, 
        include: { imports: true, exports: true, dynamicImports: true } 
      })

      expect(ranges).toHaveLength(3)
      expect(ranges[0]).toMatchObject({ path: './static.ts', isImport: true, isDynamic: false })
      expect(ranges[1]).toMatchObject({ path: './dynamic.ts', isImport: true, isDynamic: true })
      expect(ranges[2]).toMatchObject({ path: './reexport.ts', isImport: false, isDynamic: false })
    })

    it('should include nothing when all options are false', () => {
      const ranges = getModulePathRanges({ 
        ts, 
        source, 
        include: { imports: false, exports: false, dynamicImports: false } 
      })

      expect(ranges).toHaveLength(0)
    })

    it('should use default options when include is not provided', () => {
      const ranges = getModulePathRanges({ ts, source })

      expect(ranges).toHaveLength(3)
      expect(ranges[0]).toMatchObject({ path: './static.ts', isImport: true, isDynamic: false })
      expect(ranges[1]).toMatchObject({ path: './dynamic.ts', isImport: true, isDynamic: true })
      expect(ranges[2]).toMatchObject({ path: './reexport.ts', isImport: false, isDynamic: false })
    })
  })
})
