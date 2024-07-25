export const getExtensionFromPath = (path: string) => path.split('/').pop()?.split('.')[1]
