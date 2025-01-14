# EXTENSIONS.md

Additional, Derived File-Types
These are not included in the main bundle but are available under @bigmistqke/repl/file-extra/....

## CssModuleFile

The CssModuleFile class represents a CSS module file that transforms CSS class names and generates a corresponding JavaScript file. This JavaScript file exports an object mapping original class names to transformed class names, functioning similarly to how CSS modules work. This class essentially composes a CSS file into a JavaScript module, making it easier to handle scoped styles in your application.

Example Usage

```tsx
import { CssModuleFile } from '@bigmistqke/repl/file-extra/css-module'
const repl = <Repl extensions={{ 'module.css': CssModuleFile }} />
```

## WatFile

The WatFile class represents a WebAssembly Text (WAT) file that compiles to a corresponding WebAssembly (WASM) file. The WASM file content is set in Base64 encoding. This class composes a WAT file into a WebAssembly (WASM) file, enabling the seamless integration and execution of WebAssembly code in your application.

Example Usage

```tsx
import { WatFile } from '@bigmistqke/repl/file-extra/wat'
const repl = <Repl extensions={{ wat: WatFile }} />
```
