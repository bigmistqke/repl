import { Repl } from '@bigmistqke/repl'
import { solidReplPlugin } from '@bigmistqke/repl/plugins/solid-repl'
import { Resizable } from 'corvu/resizable'

import { createEffect, createSignal, onCleanup, type Component } from 'solid-js'
import { JsxEmit } from 'typescript'

import styles from './App.module.css'

const App: Component = () => {
  const [dragging, setDragging] = createSignal(false)
  const [currentFile, setCurrentFile] = createSignal('src/index.tsx')

  return (
    <Repl
      babel={{
        presets: ['babel-preset-solid'],
        plugins: [solidReplPlugin],
      }}
      typescript={{
        resolveJsonModule: true,
        esModuleInterop: true,
        noEmit: true,
        isolatedModules: true,
        skipLibCheck: true,
        allowSyntheticDefaultImports: true,
        forceConsistentCasingInFileNames: true,
        noUncheckedIndexedAccess: true,
        paths: {},
        jsx: JsxEmit.Preserve,
        jsxImportSource: 'solid-js',
        strict: true,
      }}
      initialState={{
        /* types: cached.types, */
        files: {
          'src/index.tsx': `
import { render } from "solid-js/web";
import { createSignal } from "solid-js";
import * as THREE from "three";
import { Vector3 } from "three";
import {Canvas, T, extend, useFrame, useThree } from "solid-three"
import "solid-js/jsx-runtime"

extend(THREE);


function Box() {
  let mesh: THREE.Mesh | undefined;
  const [hovered, setHovered] = createSignal(false);

  useFrame(() => (mesh!.rotation.y += 0.01));

  return (
    <>
      <T.Mesh
        ref={mesh}
        onPointerEnter={e => setHovered(true)}
        onPointerLeave={e => setHovered(false)}
      >
        <T.BoxGeometry />
        <T.MeshStandardMaterial color={hovered() ? "green" : "red"} />
      </T.Mesh>
    </>
  );
}


export const App = () => {
  return (
    <Canvas camera={{ position: new Vector3(0, 0, 5) }}>
      <T.AmbientLight intensity={0.4} color={[0.5, 0.5, 0.5]} />
      <T.PointLight decay={0} position={[2, 2, 5]} rotation={[0, Math.PI / 3, 0]} />
      <Box />
    </Canvas>
  );
};

render(() => <App />, document.body);
          
          
`,
        },
      }}
      class={styles.repl}
      onReady={async ({ fs, frames }) => {
        createEffect(() => {
          const frame = frames.get('default')
          const moduleUrl = fs.get('src/index.tsx')?.moduleUrl()

          if (!frame || !moduleUrl) return

          onCleanup(() => {
            frame.document.body.removeChild(script)
            // NOTE:  solid-repl-plugin transforms
            //        render(() => ...) to
            //        window.dispose = render(() => ...)
            frame.window.dispose?.()
          })

          const script = frame.document.createElement('script')
          script.type = 'module'
          script.src = moduleUrl
          frame.document.body.appendChild(script)
        })
        await fs.addPackage('./solid-three')
      }}
    >
      <Resizable style={{ width: '100vw', height: '100vh', display: 'flex' }}>
        <Resizable.Panel
          style={{ overflow: 'hidden', display: 'flex', 'flex-direction': 'column' }}
        >
          <Repl.TabBar>
            {({ path }) => <button onClick={() => setCurrentFile(path)}>{path}</button>}
          </Repl.TabBar>
          <Repl.Editor style={{ flex: 1 }} path={currentFile()} />
        </Resizable.Panel>
        <Resizable.Handle />
        <Resizable.Panel style={{ display: 'flex' }}>
          <Repl.Frame
            style={{ flex: 1 }}
            bodyStyle={{
              padding: '0px',
              margin: '0px',
            }}
          />
        </Resizable.Panel>
      </Resizable>
    </Repl>
  )
}

export default App
