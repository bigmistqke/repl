/**
 * Standard library that is included in each FileSystem, aliased to `@repl/std`
 */

const cleanups = new Map<string, () => void>()
/** Add function to clean-up side-effects after module is reload. */
export const dispose = (id: string, callback: () => void) => cleanups.set(id, callback)

// Extend the Window interface in the same file
declare global {
  interface Window {
    repl?: {
      dispose: (id?: string) => void
    }
  }
}

window.repl = {
  dispose(id?: string) {
    if (id) {
      cleanups.get(id)?.()
    } else {
      cleanups.forEach(cleanup => cleanup())
    }
  },
}
