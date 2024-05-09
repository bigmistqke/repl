import { createDeepSignal } from '@solid-primitives/resource'
import clsx from 'clsx'
import {
  bundledThemesInfo,
  codeToHast,
  type BundledTheme,
  type CodeOptionsSingleTheme,
} from 'shiki'
import {
  Index,
  Show,
  Suspense,
  createMemo,
  createRenderEffect,
  createResource,
  createSignal,
  onCleanup,
  untrack,
  useTransition,
  type JSX,
} from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { useRuntime } from 'src/use-runtime'
import { when, whenever } from 'src/utils/conditionals'
// @ts-expect-error
import styles from './shiki-editor.module.css'

type Root = Awaited<ReturnType<typeof codeToHast>>
type HastNode = Root['children'][number]

export function ReplShikiEditor(props: {
  class?: string
  path: string
  style?: JSX.CSSProperties
  themes?: {
    light?: CodeOptionsSingleTheme<BundledTheme>['theme']
    dark?: CodeOptionsSingleTheme<BundledTheme>['theme']
  }
}) {
  const startTransition = useTransition()[1]
  const runtime = useRuntime()

  const themes = createMemo(() => ({ light: 'min-light', dark: 'min-dark', ...props.themes }))
  const currentTheme = () => themes()[runtime.config.mode || 'dark']

  // Get or create file
  const file = createMemo(
    () => runtime.fileSystem.get(props.path) || runtime.fileSystem.create(props.path),
  )

  // Get source of file
  const source = whenever(file, file => file.get())

  // Transform source to hast (hypertext abstract syntax tree)
  const [hast] = createResource(
    source,
    async source => (await codeToHast(source, { lang: 'tsx', theme: currentTheme() })).children[0],
    { storage: createDeepSignal },
  )

  const [characterWidth, setCharacterWidth] = createSignal<number>(0)
  const [lineSize, setLineSize] = createSignal(0)

  // Get the longest line-size of a given string
  const updateLineSize = (source: string) => {
    let lineSize = -Infinity
    source.split('\n').forEach(line => {
      if (line.length > lineSize) {
        lineSize = line.length
      }
    })
    setLineSize(lineSize)
  }

  // Whenever file changes get the source a single time and update the line-size
  createRenderEffect(whenever(file, file => updateLineSize(untrack(file.get.bind(file)))))

  // Get styles from current theme
  const [themeStyles] = createResource(
    () =>
      bundledThemesInfo
        .find(theme => theme.id === currentTheme())
        ?.import()
        .then(module => {
          const colors = module.default.colors
          return {
            background: colors?.['editor.background'],
            'caret-color': colors?.['editor.foreground'],
            '--selection-bg-color': colors?.['editor.selectionHighlightBackground'],
          }
        }),
  )

  const onUpdate = (e: { currentTarget: HTMLTextAreaElement }) => {
    const value = e.currentTarget.value
    // Update line-size with the maximum linesize of the given string
    updateLineSize(value)
    // Update source with startTransition so Suspense is not triggered.
    startTransition(() => file().set(value))
  }

  return (
    <Suspense>
      <div class={clsx(styles.editor, props.class)} style={{ ...themeStyles(), ...props.style }}>
        <div class={styles.container}>
          <Show when={when(hast, hast => 'children' in hast && hast.children)}>
            {children => <Index each={children()}>{child => <HastNode node={child()} />}</Index>}
          </Show>
          <textarea
            class={styles.input}
            onInput={onUpdate}
            spellcheck={false}
            style={{ width: lineSize() * characterWidth() + 'px' }}
            value={file().get()}
          />
          <Character onResize={setCharacterWidth} />
        </div>
      </div>
    </Suspense>
  )
}

function Character(props: { onResize: (width: number) => void }) {
  const character = (<code class={styles.character} innerText="m" />) as HTMLElement

  const resizeObserver = new ResizeObserver(() => {
    const { width } = character.getBoundingClientRect()
    props.onResize(width)
  })
  resizeObserver.observe(character)
  onCleanup(() => resizeObserver.disconnect())

  return character
}

function HastNode(props: { node: any }) {
  return (
    <Show when={props.node.type !== 'text' && props.node} fallback={props.node.value}>
      {node => (
        <Dynamic component={node().tagName || 'div'} {...node().properties}>
          <Index each={node().children}>{child => <HastNode node={child()} />}</Index>
        </Dynamic>
      )}
    </Show>
  )
}
