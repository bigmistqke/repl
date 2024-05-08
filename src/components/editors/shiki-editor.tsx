import { createDeepSignal } from '@solid-primitives/resource'
import clsx from 'clsx'
import { BundledTheme, CodeOptionsSingleTheme, bundledThemesInfo, codeToHast } from 'shiki'
import {
  ComponentProps,
  Index,
  JSX,
  Show,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  splitProps,
} from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { useRepl } from 'src/use-repl'
// @ts-expect-error
import { whenever } from 'src/utils/conditionals'
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
  const themes = createMemo(() => ({ light: 'min-light', dark: 'min-dark', ...props.themes }))
  const currentTheme = () => themes()[repl.config.mode || 'dark']
  const repl = useRepl()

  const [characterWidth, setCharacterWidth] = createSignal<number>(0)

  // Get or create file
  const file = createMemo(
    () => repl.fileSystem.get(props.path) || repl.fileSystem.create(props.path),
  )
  // Get source
  const source = whenever(file, file => file.get())

  // Transform source to hast (hypertext abstract syntax tree)
  const [hast] = createResource(
    source,
    source => codeToHast(source, { lang: 'tsx', theme: currentTheme() }),
    { storage: createDeepSignal },
  )

  // Find the longest line-size whenever source changes
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
          console.log('color', colors)
          return {
            background: colors?.['editor.background'],
            'caret-color': colors?.['editor.foreground'],
            '--selection-bg-color': colors?.['editor.selectionHighlightBackground'],
          }
        }),
  )

  return (
    <div
      class={clsx(styles['outer-container'], props.class)}
      style={{ ...themeStyles(), ...props.style }}
      {...rest}
    >
      <div class={styles['inner-container']}>
        <div class={clsx(styles.output, props.editorClass)} style={props.editorStyle}>
          <Show when={hast()}>
            {hast => <Index each={hast().children}>{child => <HastNode node={child()} />}</Index>}
          </Show>
        </div>
        <textarea
          class={clsx(styles.input, props.editorClass)}
          onInput={e => file().set(e.currentTarget.value)}
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
