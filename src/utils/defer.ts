export function defer<T>() {
  let resolve: (value: T) => void = null!
  return {
    promise: new Promise<T>(_resolve => (resolve = _resolve)),
    resolve,
  }
}
