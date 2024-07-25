export function formatInfo(title: string, ...value: any[]) {
  return [`%c[REPL]%c ${title}`, 'color: green', '', ...value]
}

export function formatError(title: string, ...value: any[]) {
  return [`%c[REPL]%c ${title}`, 'color: red', '', ...value]
}

export function formatWarn(title: string, ...value: any[]) {
  return [`%c[REPL]%c ${title}`, 'color: orange', '', ...value]
}
