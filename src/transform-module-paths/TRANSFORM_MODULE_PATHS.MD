# Transform Module Path Utilities

In the `@bigmistqke/repl` environment, managing module paths effectively addresses several specific challenges:

1. **Resolution of External Modules:** Ensuring that imports from sources such as CDNs are correctly resolved is crucial for external library integration.
2. **Resolution of Relative Paths:** Accurately mapping relative paths within the repl's virtual file system is essential for maintaining functional links between files.
3. **Removal of CSS Imports:** Since CSS imports in JavaScript or TypeScript files are not supported in-browser, these imports need to be transformed or removed to ensure compatibility.
4. **Collect Types of External Modules** To successfully import the types of external modules, `@bigmistqke/repl` needs to be able to map over the module-paths of the external module's `.d.ts` files.

To provide maximum flexibility and adaptability in tooling for these tasks, `@bigmistqke/repl` does not bundle specific tooling. Instead [`Repl`](#repl-component) and [`Runtime`](#runtime-class) require a generic function to be defined that can parse the module paths and transform these:

```tsx
type TransformModulePaths = (
  code: string,
  //** Callback to modify module-declaration node. Return `null` to remove node from code. */
  callback: (source: string) => string | null,
) => string | undefined
```

This modular approach lets users choose their tooling and update it as needed without being locked into a specific technology stack predefined by the repl. Currently, `@bigmistqke/repl` provides a TypeScript-based utility, future expansions will include more diverse tooling options (PRs welcome!).

## @bigmistqke/repl/transform-module-paths/typescript

```typescript
import { typescriptTransformModulePaths } from '@bigmistqke/repl/transform-module-paths/typescript'

const repl = (
  <Repl
    transformModulePaths={typescriptTransformModulePaths({
      typescript: import('https://esm.sh/typescript'),
    })}
  />
)
```
