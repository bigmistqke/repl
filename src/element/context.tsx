import { css, element, Element, ElementAttributes } from '@lume/element'
import { signal } from 'classy-solid'

export type ContextAttributes<T> = ElementAttributes<ContextBase<T>, 'value'>

class ContextBase<T> extends Element {
  @signal value: T | undefined = undefined
  template = () => <slot />
  static css = css`
    :host {
      display: contents;
    }
  `
}

// export function createContext<T>(name: string): (element: Element) => Accessor<T | null>
// export function createContext<T>(name: string, fallback: () => T): (element: Element) => Accessor<T>
export function createContext<T>(name: string, fallback?: () => T) {
  @element(name)
  class Context extends ContextBase<T> {}
  return function useContext(element: Element) {
    let current = element.parentElement
    while (current) {
      if (current instanceof Context) {
        return () => (current as Context).value
      }
      current = current.parentElement
    }
    if (fallback) {
      return fallback
    }
    throw `Should use ${element.tagName} inside ${name} tag`
  }
}
