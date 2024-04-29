import { Monaco } from '@monaco-editor/loader'
import { Accessor } from 'solid-js'

export type Model = ReturnType<Monaco['editor']['createModel']>

export abstract class File {
  abstract model: Model
  abstract moduleUrl: Accessor<string | undefined>
  abstract toJSON(): string | undefined
  abstract set(value: string): void
  abstract get(): void
}
