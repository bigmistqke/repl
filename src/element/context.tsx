import { css, element, Element, ElementAttributes } from '@lume/element'
import { signal } from 'classy-solid'

export type ContextAttributes<T> = ElementAttributes<ReplContextBase<T>, 'value'>

class ReplContextBase<T> extends Element {
  @signal value: T | undefined = undefined
  template = () => <slot />
  static css = css`
    :host {
      display: contents;
    }
  `
}

export function createContext<T>(name: string) {
  @element(name)
  class ReplContext extends ReplContextBase<T> {}
  return function useRuntime(element: Element) {
    let current = element.parentElement
    while (current) {
      if (current instanceof ReplContext) {
        return () => (current as ReplContext).value
      }
      current = current.parentElement
    }
    return null
  }
}
