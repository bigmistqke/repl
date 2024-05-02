export type Mandatory<TTarget, TKeys extends keyof TTarget> = Required<Pick<TTarget, TKeys>> &
  Omit<TTarget, TKeys>
