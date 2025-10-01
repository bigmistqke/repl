import fs from 'fs/promises'
import * as ts from 'typescript'
import { getModuleDependencies } from '../src/utils/get-module-dependencies.ts'
import { resolvePath } from '../src/utils/path-utils.ts'

console.log(
  await getModuleDependencies({
    entry: '../dev/App.tsx',
    readFile: path => {
      const resolvedPath = resolvePath(import.meta.url, path).replace('file://', '')
      return fs.readFile(resolvedPath, {
        encoding: 'utf-8',
      })
    },
    ts,
  }),
)
