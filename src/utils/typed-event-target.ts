export class TypedEventTarget<T extends Record<string, Event>> extends EventTarget {
  addEventListener<K extends keyof T>(
    type: K,
    listener: ((this: EventTarget, ev: T[K]) => any) | EventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    super.addEventListener(type as string, listener as EventListenerOrEventListenerObject, options)
  }

  removeEventListener<K extends keyof T>(
    type: K,
    listener: ((this: EventTarget, ev: T[K]) => any) | EventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    super.removeEventListener(
      type as string,
      listener as EventListenerOrEventListenerObject,
      options,
    )
  }

  dispatchEvent<K extends keyof T>(event: T[K]): boolean {
    return super.dispatchEvent(event)
  }
}
