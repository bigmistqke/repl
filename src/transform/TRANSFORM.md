# Transform Utilities

Transform utilities in `@bigmistqke/repl` enable the integration of JavaScript and TypeScript code transformation within the repl environment. These utilities are designed to support dynamic transpilation of TypeScript and other code transformations directly in the browser.

`@bigmistqke/repl` allows users to provide their own transform functions instead of bundling specific tools. This approach offers developers flexibility to use the repl with different toolsets according to their project requirements.

The transform utilities currently support:

1. **TypeScript:** Facilitates the conversion of TypeScript code to JavaScript, handling TypeScript syntax and features.
2. **Babel:** Enables transformations of modern JavaScript, including JSX for frameworks like SolidJS and experimental JavaScript features not standard in browsers.

Future releases will include more integrations with other (PRs welcome!).

Developers need to supply a function that matches the following type signature:

```typescript
type TransformFn = (source: string, path: string) => string
```

This function takes the source code and its path, returning the transformed code as a string. This design allows for customization beyond the default functionality, such as integrating additional syntax processing, code optimizations, or other transpilers.

## @bigmistqke/repl/transform/babel

This utility provides integration of [babel](https://babeljs.io/)-library within the `@bigmistqke/repl` environment.

```typescript
interface BabelConfig {
  /** Required dynamic or static import of babel standalone library */
  babel: typeof Babel | Promise<typeof Babel>
  /** Optional cdn from where to download given babel-plugins. Defaults to `esm.sh`. */
  cdn?: string
  /** Optional list of presets */
  presets?: string[]
  /** Optional list of plugins. If urls are provided, they will be resolved according to the given cdn. */
  plugins?: (string | babel.PluginItem)[]
}

async function babelTransform(config: BabelConfig): TransformFn
```

### Usage

```typescript
import { babelTransform } from '@bigmistqke/repl/transform/babel'

const repl = (
  <Repl
    transform={babelTransform({
      babel: import('https://esm.sh/@babel/standalone'),
      presets: ['babel-preset-solid'],
      plugins: [],
      cdn: `https://esm.sh`,
    })}
  />
)
```

## @bigmistqke/repl/transform/typescript

This utility provides integration of typescript-compiler within the `@bigmistqke/repl` environment.

```typescript
interface TypescriptConfig {
  /** Required dynamic or static import of typescript compiler */
  typescript: typeof TS | Promise<typeof TS>
  /** Optional compiler options */
  tsconfig?: TS.CompilerOptions
}

async function typescriptTransform(config: TypescriptConfig): TransformFn
```

### Usage

```typescript
import { typescriptTransform } from '@bigmistqke/repl/transform/typescript';

const repl = (
  <Repl
    transform={typescriptTransform({
      typescript: import('https://esm.sh/typescript'),
      tsconfig: {
        ...
      }
    })}
  />
)
```
