export function mapObject<T, U>(
  object: Record<string, T>,
  callback: (value: T, path: string) => U,
): Record<string, U> {
  return Object.fromEntries(
    Object.entries(object).map(entry => [entry[0], callback(entry[1], entry[0])]),
  )
}
