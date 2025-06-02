/**
 * Creates an object URL representing a virtual text-based file.
 *
 * This function wraps a given text `source` into a `Blob` with a MIME type of `text/{type}`,
 * then returns an object URL that can be used as a file source (e.g., in an `<iframe src>` or `<script src>`).
 *
 * @param source - The text content to include in the virtual file.
 * @param type - An optional text subtype (e.g., `"html"`, `"javascript"`, `"css"`). Defaults to `"plain"`.
 *
 * @returns A string representing the object URL pointing to the created virtual file.
 *
 * @example
 * const url = createFileUrl('<div>Hello</div>', 'html');
 * const iframe = document.createElement('iframe');
 * iframe.src = url;
 * document.body.appendChild(iframe);
 */
export function createFileUrl(source: string, type?: string) {
  const blob = new Blob([source], {
    type: `text/${type || 'plain'}`,
  })
  return URL.createObjectURL(blob)
}
