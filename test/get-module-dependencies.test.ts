import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { getModuleDependencies } from '../src/utils/get-module-dependencies'

describe('walkModulePaths', () => {
  const createMockFileSystem = (files: Record<string, string>) => {
    return {
      readFile: async (path: string) => {
        if (!(path in files)) {
          throw new Error(`File not found: ${path}`)
        }
        return files[path]
      },
    }
  }

  it('should handle a single file with no imports', async () => {
    const files = {
      'index.ts': 'const x = 1; console.log(x);',
    }
    const { readFile } = createMockFileSystem(files)

    const result = await getModuleDependencies({
      entry: 'index.ts',
      readFile,
      ts,
    })

    expect(result).toEqual({
      local: {
        'index.ts': files['index.ts'],
      },
      external: [],
    })
  })

  it('should walk through relative imports', async () => {
    const files = {
      'index.ts': "import { helper } from './helper.ts'",
      'helper.ts': 'export const helper = () => console.log("Helper");',
    }
    const { readFile } = createMockFileSystem(files)

    const result = await getModuleDependencies({
      entry: 'index.ts',
      readFile,
      ts,
    })

    expect(result).toEqual({
      local: files,
      external: [],
    })
  })

  it('should handle nested imports', async () => {
    const files = {
      'index.ts': "import { main } from './main.ts'",
      'main.ts': "import { helper } from './helper.ts'",
      'helper.ts': 'export const helper = () => "test";',
    }
    const { readFile } = createMockFileSystem(files)

    const result = await getModuleDependencies({
      entry: 'index.ts',
      readFile,
      ts,
    })

    expect(result).toEqual({
      local: files,
      external: [],
    })
  })

  it('should handle circular dependencies', async () => {
    const files = {
      'a.ts': "import { b } from './b.ts'; export const a = 'a';",
      'b.ts': "import { a } from './a.ts'; export const b = 'b';",
    }
    const { readFile } = createMockFileSystem(files)

    const result = await getModuleDependencies({
      entry: 'a.ts',
      readFile,
      ts,
    })

    expect(result).toEqual({
      local: files,
      external: [],
    })
  })

  it('should collect external dependencies', async () => {
    const files = {
      'index.ts':
        "import { something } from 'external-package'; import { helper } from './helper.ts'",
      'helper.ts': 'export const helper = () => {};',
    }
    const { readFile } = createMockFileSystem(files)

    const result = await getModuleDependencies({
      entry: 'index.ts',
      readFile,
      ts,
    })

    expect(result).toEqual({
      local: files,
      external: ['external-package'],
    })
  })

  it('should handle complex import paths', async () => {
    const files = {
      'src/index.ts': "import { util } from '../utils/util.ts'",
      'utils/util.ts': "import { helper } from './helper.ts'",
      'utils/helper.ts': 'export const helper = () => {};',
    }
    const { readFile } = createMockFileSystem(files)

    const result = await getModuleDependencies({
      entry: 'src/index.ts',
      readFile,
      ts,
    })

    expect(result).toEqual({
      local: files,
      external: [],
    })
  })

  it('should handle multiple imports in a single file', async () => {
    const files = {
      'index.ts': `
        import { a } from './a.ts'
        import { b } from './b.ts'
        import { c } from './c.ts'
      `,
      'a.ts': 'export const a = 1;',
      'b.ts': 'export const b = 2;',
      'c.ts': 'export const c = 3;',
    }
    const { readFile } = createMockFileSystem(files)

    const result = await getModuleDependencies({
      entry: 'index.ts',
      readFile,
      ts,
    })

    expect(result).toEqual({
      local: files,
      external: [],
    })
  })

  it('should handle export statements with re-exports', async () => {
    const files: {
      'index.ts': string
      'helper.ts'?: string
    } = {
      'index.ts': "export { helper } from './helper.ts'",
      'helper.ts': 'export const helper = () => {};',
    }
    const { readFile } = createMockFileSystem(files)

    const result = await getModuleDependencies({
      entry: 'index.ts',
      readFile,
      ts,
    })

    expect(result).toEqual({
      local: files,
      external: [],
    })
  })

  it('should handle dynamic imports', async () => {
    const files = {
      'index.ts': "const module = await import('./dynamic.ts')",
      'dynamic.ts': 'export default { value: 42 };',
    }
    const { readFile } = createMockFileSystem(files)

    const result = await getModuleDependencies({
      entry: 'index.ts',
      readFile,
      ts,
    })

    expect(result).toEqual({
      local: files,
      external: [],
    })
  })

  it('should handle files with mixed import types', async () => {
    const files: {
      'index.ts': string
      'static.ts': string
      'dynamic.ts': string
      'reexport.ts'?: string
    } = {
      'index.ts': `
        import { static1 } from './static.ts'
        const dynamic = await import('./dynamic.ts')
        export { reexport } from './reexport.ts'
      `,
      'static.ts': 'export const static1 = "static";',
      'dynamic.ts': 'export default "dynamic";',
      'reexport.ts': 'export const reexport = "reexport";',
    }
    const { readFile } = createMockFileSystem(files)

    const result = await getModuleDependencies({
      entry: 'index.ts',
      readFile,
      ts,
    })

    // Should include all imports and exports
    expect(result).toEqual({
      local: files,
      external: [],
    })
  })

  it('should handle deeply nested directory structures', async () => {
    const files = {
      'src/components/App.ts': "import { Button } from './Button/Button.ts'",
      'src/components/Button/Button.ts': "import { styles } from './styles.ts'",
      'src/components/Button/styles.ts': "import { theme } from '../../theme/theme.ts'",
      'src/theme/theme.ts': 'export const theme = { color: "blue" };',
    }
    const { readFile } = createMockFileSystem(files)

    const result = await getModuleDependencies({
      entry: 'src/components/App.ts',
      readFile,
      ts,
    })

    expect(result).toEqual({
      local: files,
      external: [],
    })
  })

  it('should not detect CommonJS require statements (not supported by getModulePathRanges)', async () => {
    const files = {
      'index.js': "const helper = require('./helper.js')",
      'helper.js': 'module.exports = { helper: () => {} };',
    }
    const { readFile } = createMockFileSystem(files)

    const result = await getModuleDependencies({
      entry: 'index.js',
      readFile,
      ts,
    })

    // Should only include the entry file since require is not detected
    expect(result).toEqual({
      local: {
        'index.js': files['index.js'],
      },
      external: [],
    })
  })

  describe('include options', () => {
    const files = {
      'index.ts': `
        import { static1 } from './static.ts'
        const dynamic = await import('./dynamic.ts')
        export { reexport } from './reexport.ts'
      `,
      'static.ts': 'export const static1 = "static";',
      'dynamic.ts': 'export default "dynamic";',
      'reexport.ts': 'export const reexport = "reexport";',
    }
    const { readFile } = createMockFileSystem(files)

    it('should include only import files when imports=true, exports=false, dynamicImports=false', async () => {
      const result = await getModuleDependencies({
        entry: 'index.ts',
        readFile,
        ts,
        include: { imports: true, exports: false, dynamicImports: false },
      })

      expect(result).toEqual({
        local: {
          'index.ts': files['index.ts'],
          'static.ts': files['static.ts'],
        },
        external: [],
      })
    })

    it('should include only dynamic import files when imports=false, exports=false, dynamicImports=true', async () => {
      const result = await getModuleDependencies({
        entry: 'index.ts',
        readFile,
        ts,
        include: { imports: false, exports: false, dynamicImports: true },
      })

      expect(result).toEqual({
        local: {
          'index.ts': files['index.ts'],
          'dynamic.ts': files['dynamic.ts'],
        },
        external: [],
      })
    })

    it('should include no additional files when all options are false', async () => {
      const result = await getModuleDependencies({
        entry: 'index.ts',
        readFile,
        ts,
        include: { imports: false, exports: false, dynamicImports: false },
      })

      expect(result).toEqual({
        local: {
          'index.ts': files['index.ts'],
        },
        external: [],
      })
    })

    it('should include all files when all options are true (default)', async () => {
      const result = await getModuleDependencies({
        entry: 'index.ts',
        readFile,
        ts,
        include: { imports: true, exports: true, dynamicImports: true },
      })

      expect(result).toEqual({
        local: {
          'index.ts': files['index.ts'],
          'static.ts': files['static.ts'],
          'dynamic.ts': files['dynamic.ts'],
          'reexport.ts': files['reexport.ts'],
        },
        external: [],
      })
    })
  })

  describe('external dependencies', () => {
    it('should collect npm package names', async () => {
      const files = {
        'index.ts': `
          import React from 'react'
          import { useState } from 'react'
          import { Button } from '@mui/material'
          import axios from 'axios'
        `,
      }
      const { readFile } = createMockFileSystem(files)

      const result = await getModuleDependencies({
        entry: 'index.ts',
        readFile,
        ts,
      })

      expect(result).toEqual({
        local: files,
        external: ['react', '@mui/material', 'axios'],
      })
    })

    it('should collect URL imports', async () => {
      const files = {
        'index.ts': `
          import { something } from 'https://cdn.skypack.dev/lodash'
          import { other } from 'https://esm.sh/react@18'
        `,
      }
      const { readFile } = createMockFileSystem(files)

      const result = await getModuleDependencies({
        entry: 'index.ts',
        readFile,
        ts,
      })

      expect(result).toEqual({
        local: files,
        external: ['https://cdn.skypack.dev/lodash', 'https://esm.sh/react@18'],
      })
    })

    it('should collect mixed local and external dependencies', async () => {
      const files = {
        'index.ts': `
          import { local } from './local.ts'
          import React from 'react'
          import { helper } from './utils/helper.ts'
          import axios from 'axios'
        `,
        'local.ts': 'export const local = "local";',
        'utils/helper.ts': 'export const helper = () => {};',
      }
      const { readFile } = createMockFileSystem(files)

      const result = await getModuleDependencies({
        entry: 'index.ts',
        readFile,
        ts,
      })

      expect(result).toEqual({
        local: files,
        external: ['react', 'axios'],
      })
    })

    it('should collect external dependencies from nested files', async () => {
      const files = {
        'index.ts': `
          import { component } from './component.ts'
          import React from 'react'
        `,
        'component.ts': `
          import { useState } from 'react'
          import axios from 'axios'
          export const component = () => {};
        `,
      }
      const { readFile } = createMockFileSystem(files)

      const result = await getModuleDependencies({
        entry: 'index.ts',
        readFile,
        ts,
      })

      expect(result).toEqual({
        local: files,
        external: ['react', 'axios'],
      })
    })

    it('should collect external dependencies from dynamic imports', async () => {
      const files = {
        'index.ts': `
          const lodash = await import('lodash')
          const local = await import('./local.ts')
        `,
        'local.ts': 'export default "local";',
      }
      const { readFile } = createMockFileSystem(files)

      const result = await getModuleDependencies({
        entry: 'index.ts',
        readFile,
        ts,
      })

      expect(result).toEqual({
        local: files,
        external: ['lodash'],
      })
    })

    it('should collect external dependencies from re-exports', async () => {
      const files = {
        'index.ts': `
          export { Button } from '@mui/material'
          export { helper } from './helper.ts'
          export { React } from 'react'
        `,
        'helper.ts': 'export const helper = () => {};',
      }
      const { readFile } = createMockFileSystem(files)

      const result = await getModuleDependencies({
        entry: 'index.ts',
        readFile,
        ts,
      })

      expect(result).toEqual({
        local: {
          'index.ts': files['index.ts'],
          'helper.ts': files['helper.ts'],
        },
        external: ['@mui/material', 'react'],
      })
    })

    it('should handle scoped packages', async () => {
      const files = {
        'index.ts': `
          import { Component } from '@angular/core'
          import { Button } from '@mui/material'
          import { styled } from '@emotion/styled'
        `,
      }
      const { readFile } = createMockFileSystem(files)

      const result = await getModuleDependencies({
        entry: 'index.ts',
        readFile,
        ts,
      })

      expect(result).toEqual({
        local: files,
        external: ['@angular/core', '@mui/material', '@emotion/styled'],
      })
    })

    it('should handle subpath imports', async () => {
      const files = {
        'index.ts': `
          import { merge } from 'lodash/merge'
          import { Button } from '@mui/material/Button'
          import { isArray } from 'lodash/isArray'
        `,
      }
      const { readFile } = createMockFileSystem(files)

      const result = await getModuleDependencies({
        entry: 'index.ts',
        readFile,
        ts,
      })

      expect(result).toEqual({
        local: files,
        external: ['lodash/merge', '@mui/material/Button', 'lodash/isArray'],
      })
    })

    describe('with include options', () => {
      const files = {
        'index.ts': `
          import { static1 } from './static.ts'
          import { external1 } from 'external-package'
          const dynamic = await import('./dynamic.ts')
          const externalDynamic = await import('external-dynamic')
          export { reexport } from './reexport.ts'
          export { externalReexport } from 'external-reexport'
        `,
        'static.ts': 'export const static1 = "static";',
        'dynamic.ts': 'export default "dynamic";',
        'reexport.ts': 'export const reexport = "reexport";',
      }
      const { readFile } = createMockFileSystem(files)

      it('should include only static import externals when imports=true, exports=false, dynamicImports=false', async () => {
        const result = await getModuleDependencies({
          entry: 'index.ts',
          readFile,
          ts,
          include: { imports: true, exports: false, dynamicImports: false },
        })

        expect(result).toEqual({
          local: {
            'index.ts': files['index.ts'],
            'static.ts': files['static.ts'],
          },
          external: ['external-package'],
        })
      })

      it('should include only export externals when imports=false, exports=true, dynamicImports=false', async () => {
        const result = await getModuleDependencies({
          entry: 'index.ts',
          readFile,
          ts,
          include: { imports: false, exports: true, dynamicImports: false },
        })

        expect(result).toEqual({
          local: {
            'index.ts': files['index.ts'],
            'reexport.ts': files['reexport.ts'],
          },
          external: ['external-reexport'],
        })
      })

      it('should include only dynamic import externals when imports=false, exports=false, dynamicImports=true', async () => {
        const result = await getModuleDependencies({
          entry: 'index.ts',
          readFile,
          ts,
          include: { imports: false, exports: false, dynamicImports: true },
        })

        expect(result).toEqual({
          local: {
            'index.ts': files['index.ts'],
            'dynamic.ts': files['dynamic.ts'],
          },
          external: ['external-dynamic'],
        })
      })

      it('should include all externals when all options are true', async () => {
        const result = await getModuleDependencies({
          entry: 'index.ts',
          readFile,
          ts,
          include: { imports: true, exports: true, dynamicImports: true },
        })

        expect(result).toEqual({
          local: {
            'index.ts': files['index.ts'],
            'static.ts': files['static.ts'],
            'dynamic.ts': files['dynamic.ts'],
            'reexport.ts': files['reexport.ts'],
          },
          external: ['external-package', 'external-dynamic', 'external-reexport'],
        })
      })
    })
  })
})
