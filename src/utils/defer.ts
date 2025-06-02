export function defer<T = void>() {
  let resolve: (value: T) => void = null!
  return {
    promise: new Promise<T>(_resolve => (resolve = _resolve)),
    resolve,
  }
}
