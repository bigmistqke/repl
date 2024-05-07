import { JsFile } from '@bigmistqke/repl/runtime'
import clsx from 'clsx'
import { BundledTheme, CodeOptionsSingleTheme, bundledThemesInfo, codeToHtml } from 'shiki'
import {
  ComponentProps,
  JSX,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  mergeProps,
  on,
  onCleanup,
  onMount,
  splitProps,
} from 'solid-js'
import { useRepl } from 'src/use-repl'
// @ts-expect-error
import styles from './shiki-editor.module.css'

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
  const themes = () => mergeProps({ light: 'min-light', dark: 'min-dark' }, props.themes)
  const repl = useRepl()

  const [html, setHtml] = createSignal('')
  const [maxLineSize, setMaxLineSize] = createSignal<number>(0)
  const [characterWidth, setCharacterWidth] = createSignal<number>(0)

  let char: HTMLElement

  // Get or create file
  const file = createMemo(
    () => repl.fileSystem.get(props.path) || repl.fileSystem.create(props.path),
  )

  const [themeStyles] = createResource(
    () =>
      bundledThemesInfo
        .find(theme => theme.id === themes()[repl.config.mode || 'dark'])
        ?.import()
        .then(module => {
          const colors = module.default.colors
          console.log(colors, module.default)
          return {
            background: colors?.['editor.background'],
            'caret-color': colors?.['editor.foreground'],
          }
        }),
  )

  createEffect(() => {
    codeToHtml(file().get(), {
      lang: file() instanceof JsFile ? 'tsx' : 'css',
      themes: themes(),
    }).then(setHtml)
  })

  createEffect(
    on(
      () => file().get(),
      source => {
        let max = -Infinity
        source.split('\n').forEach(line => {
          if (line.length > max) {
            max = line.length
          }
        })
        setMaxLineSize(max)
      },
    ),
  )

  onMount(() => {
    const resizeObserver = new ResizeObserver(() => {
      const { width } = char.getBoundingClientRect()
      setCharacterWidth(width)
    })
    resizeObserver.observe(char)
    onCleanup(() => resizeObserver.disconnect())
  })

  return (
    <div
      class={clsx(styles['outer-container'], props.class)}
      style={{ ...themeStyles(), ...props.style }}
      {...rest}
    >
      <div class={styles['inner-container']}>
        <textarea
          class={clsx(styles.input, props.editorClass)}
          onInput={e => file().set(e.currentTarget.value)}
          spellcheck={false}
          style={{ ...props.editorStyle, 'min-width': maxLineSize() * characterWidth() + 'px' }}
          value={file().get()}
        />
        <code ref={char!}>m</code>
        <div
          class={clsx(styles.output, props.editorClass)}
          innerHTML={html()}
          style={props.editorStyle}
        />
      </div>
    </div>
  )
}
