import { describe, expect, it } from 'vitest'
import { resolvePath } from '../src/utils/path-utils'

describe('resolvePath', () => {
  it('should handle basic relative paths with ../', () => {
    expect(resolvePath('../../example.ts', './other.ts')).toBe('../../other.ts')
    expect(resolvePath('../module.ts', './sibling.ts')).toBe('../sibling.ts')
    expect(resolvePath('./local.ts', '../parent.ts')).toBe('../parent.ts')
  })

  it('should handle paths without relative prefixes', () => {
    expect(resolvePath('src/index.ts', '../utils.ts')).toBe('utils.ts')
    expect(resolvePath('src/deep/file.ts', './sibling.ts')).toBe('src/deep/sibling.ts')
  })

  it('should handle absolute paths', () => {
    expect(resolvePath('/absolute/path.ts', './same-dir.ts')).toBe('/absolute/same-dir.ts')
    expect(resolvePath('/root/dir/file.ts', '../other.ts')).toBe('/root/other.ts')
  })

  it('should handle complex relative navigation', () => {
    expect(resolvePath('../../../deep/file.ts', '../../up.ts')).toBe('../../../../up.ts')
    expect(resolvePath('./a/b/c.ts', '../../../d.ts')).toBe('../d.ts')
    expect(resolvePath('../a/b.ts', '../../c/d.ts')).toBe('../../c/d.ts')
    expect(resolvePath('../../a/b/c.ts', '../d/e.ts')).toBe('../../a/d/e.ts')
  })

  it('should handle ./ prefixed paths correctly', () => {
    expect(resolvePath('./file.ts', './other.ts')).toBe('other.ts')
    expect(resolvePath('./dir/file.ts', './sibling.ts')).toBe('dir/sibling.ts')
    expect(resolvePath('./a/b.ts', '../../c.ts')).toBe('../c.ts')
  })

  it('should handle URLs', () => {
    expect(resolvePath('https://example.com/path/file.js', './other.js')).toBe(
      'https://example.com/path/other.js',
    )
    expect(resolvePath('https://example.com/path/file.js', '../parent.js')).toBe(
      'https://example.com/parent.js',
    )
    expect(resolvePath('https://example.com/dir/file.js', '../../root.js')).toBe(
      'https://example.com/root.js',
    )
  })

  it('should handle blob URLs', () => {
    expect(resolvePath('blob:http://example.com/123/file.js', './other.js')).toBe(
      'blob:http://example.com/123/other.js',
    )
  })

  it('should handle edge cases with multiple ../', () => {
    expect(resolvePath('a/b/c/d.ts', '../../../../e.ts')).toBe('e.ts')
    expect(resolvePath('../a/b/c.ts', '../../../d/e.ts')).toBe('../../d/e.ts')
    expect(resolvePath('../../file.ts', '../../../other.ts')).toBe('../../../../../other.ts')
  })

  it('should handle paths with trailing slashes', () => {
    expect(resolvePath('src/dir/', './file.ts')).toBe('src/dir/file.ts')
    expect(resolvePath('src/dir/', '../file.ts')).toBe('src/file.ts')
  })

  it('should handle empty relative paths', () => {
    expect(resolvePath('src/file.ts', '.')).toBe('src')
    expect(resolvePath('src/file.ts', './')).toBe('src')
  })
})
