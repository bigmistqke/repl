# Plugins

`@bigmistqke/repl` offers a variety of plugins for different tools to aid in creating playgrounds. These plugins are provided as distinct entries within the package.

# Table of Content

- [@bigmistqke/repl/plugins/rollup-service-worker](#bigmistqkereplpluginsrollup-service-worker)
- [@bigmistqke/repl/plugins/babel-solid-repl](#bigmistqkereplpluginsbabel-solid-repl)

## @bigmistqke/repl/plugins/rollup-service-worker

The `rollup-service-worker` plugin is designed to facilitate the integration of a service worker into your application during the build process using Rollup. The service worker caches requests to the CDN (specifically `esm.sh`), improving load times and reducing network dependency.

### Usage

Include the `rollup-service-worker` plugin in your Rollup configuration. The plugin will inject a service worker that caches network requests to `esm.sh`.

```ts
import { rollupServiceWorkerPlugin } from '@bigmistqke/repl/plugins/rollup-service-worker'

export default {
  // Other Rollup configuration options
  plugins: [rollupServiceWorkerPlugin()],
}
```

## @bigmistqke/repl/plugins/babel-solid-repl

The `babel-solid-repl` plugin is designed to enhance the integration of SolidJS with a repl environment. It ensures that previous render calls are cleaned up properly, simulating a form of Hot Module Replacement by disposing of artifacts from earlier render calls.

### Usage

Include the `babel-solid-repl` plugin in your Babel configuration. The plugin modifies the behavior of the `render` function from `solid-js/web` to assign the result to `window.dispose`, ensuring proper cleanup of previous render artifacts.

```ts
import { babelTransform } from '@bigmistqke/repl/transform/babel'
import { babelSolidReplPlugin } from '@bigmistqke/repl/plugins/babel-solid-repl'
;<Repl
  transform={babelTransform({
    babel: import('https://esm.sh/babel-standalone'),
    plugins: [babelSolidReplPlugin],
  })}
/>
```

### Transformation Example

The plugin modifies the following code:

```jsx
import { render } from 'solid-js/web'
import App from './App'

render(() => <App />, document.getElementById('root'))
```

to:

```jsx
import { render } from 'solid-js/web'
import App from './App'

window.dispose = render(() => <App />, document.getElementById('root'))
```

This ensures that each render call is properly disposed of, simulating Hot Module Replacement (HMR) behavior.
