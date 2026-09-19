import { createMemo, latest, omit } from 'solid-js'
import type { ComponentProps } from '@solidjs/web'
import { createFileUrlSystem } from '../core/create-file-url-system.ts'
import type { Extension, FileUrlSystem } from '../types.ts'

export interface ReplRef {
  fileUrls: FileUrlSystem
  element: HTMLIFrameElement
}

export interface ReplProps extends Omit<ComponentProps<'iframe'>, 'src' | 'ref'> {
  /** A map of file extensions to their transformation behavior and MIME types. Set once — not reactive. */
  extensions: Record<string, Extension>
  /** Reads a file's source by path. May be re-invoked whenever its return value should be re-read. */
  readFile: (path: string) => string | Promise<string> | undefined
  /** Path of the file to load into the iframe. Defaults to `/index.html`. */
  entry?: string
  /** Called once, when the iframe mounts, with the repl's `fileUrls` and iframe element. */
  ref?: (api: ReplRef) => void
}

/**
 * `<Repl/>` — a sandboxed iframe that runs a set of virtual files, reactively
 * recompiling and reloading as they change.
 *
 * Carries no opinion about what a file extension means: `extensions` (the
 * same map `createFileUrlSystem` takes) decides whether `.ts`/`.tsx` get
 * compiled at all, and with what — an app with no TypeScript files can pass
 * an `extensions` map with no `ts`/`tsx` entries.
 *
 * This is a thin Solid component over `createFileUrlSystem`, the JSX
 * equivalent of `ReplElement`. Any other `<iframe>` prop (`class`, `style`,
 * `sandbox`, ...) is passed through.
 *
 * @example
 * <Repl
 *   readFile={fs.readFile}
 *   entry="/index.html"
 *   extensions={{ html: htmlExtension, ts: tsExtension }}
 *   sandbox="allow-scripts allow-same-origin"
 *   ref={({ fileUrls, element }) => console.log(fileUrls, element)}
 * />
 */
export function Repl(props: ReplProps) {
  const rest = omit(props, 'extensions', 'readFile', 'entry', 'ref')

  const fileUrls = createFileUrlSystem({
    readFile: path => props.readFile(path),
    extensions: props.extensions,
  })

  const entryUrl = createMemo(() => latest(() => fileUrls.get(props.entry ?? '/index.html')))

  return (
    <iframe
      {...rest}
      src={entryUrl() ?? 'about:blank'}
      ref={element => props.ref?.({ fileUrls, element })}
    />
  )
}
