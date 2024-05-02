export function deepMerge<TTarget extends Record<string, any>, TSource extends Record<string, any>>(
  target: TTarget,
  source: TSource,
) {
  const output: Record<string, any> = Array.isArray(source) ? [] : {}

  for (const key in target) {
    if (target.hasOwnProperty(key)) {
      output[key] = target[key]
    }
  }

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !((source[key] as Record<string, any>) instanceof Date) &&
        !((source[key] as Record<string, any>) instanceof Function)
      ) {
        output[key] = target[key] ? deepMerge(target[key], source[key]) : source[key]
      } else {
        // Preserve getters by defining them as properties
        const descriptor = Object.getOwnPropertyDescriptor(source, key)
        if (descriptor && typeof descriptor.get === 'function') {
          Object.defineProperty(output, key, descriptor)
        } else {
          output[key] = source[key]
        }
      }
    }
  }
  return output as TTarget & TSource
}
