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
  createResource,
  createSignal,
  onCleanup,
  splitProps,
  useTransition,
  type ComponentProps,
  type JSX,
} from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { useRuntime } from 'src/use-runtime'
import { whenever } from 'src/utils/conditionals'
// @ts-expect-error
import styles from './shiki-editor.module.css'

type Root = Awaited<ReturnType<typeof codeToHast>>
type HastNode = Root['children'][number]

export function ReplShikiEditor(
  props: Omit<ComponentProps<'div'>, 'style' | 'theme'> & {
    editorStyle?: JSX.CSSProperties
    editorClass?: string
    style?: JSX.CSSProperties
    path: string
    themes?: {
      light?: CodeOptionsSingleTheme<BundledTheme>['theme']
      dark?: CodeOptionsSingleTheme<BundledTheme>['theme']
    }
  },
) {
  const [, rest] = splitProps(props, ['style', 'themes', 'editorStyle', 'editorClass'])
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
    source => codeToHast(source, { lang: 'tsx', theme: currentTheme() }),
    { storage: createDeepSignal },
  )

  // Signal referring to the width of a single character
  const [characterWidth, setCharacterWidth] = createSignal<number>(0)

  // Get the longest line-size whenever source changes
  const lineSize = createMemo(
    whenever(
      source,
      source => {
        let lineSize = -Infinity
        source.split('\n').forEach(line => {
          if (line.length > lineSize) {
            lineSize = line.length
          }
        })
        return lineSize
      },
      () => 0,
    ),
  )

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

  const updateSource = (value: string) => startTransition(() => file().set(value))

  return (
    <div
      class={clsx(styles['outer-container'], props.class)}
      style={{ ...themeStyles(), ...props.style }}
      {...rest}
    >
      <div class={styles['inner-container']}>
        <Suspense>
          <div class={clsx(styles.output, props.editorClass)} style={props.editorStyle}>
            <Index each={hast()?.children}>{child => <HastNode node={child()} />}</Index>
          </div>
        </Suspense>
        <textarea
          class={clsx(styles.input, props.editorClass)}
          onInput={e => updateSource(e.currentTarget.value)}
          spellcheck={false}
          style={{ ...props.editorStyle, 'min-width': lineSize() * characterWidth() + 'px' }}
          value={file().get()}
        />
        <Character onResize={setCharacterWidth} />
      </div>
    </div>
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
