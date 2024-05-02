import { onCleanup } from 'solid-js'

const concatTemplate = (template: TemplateStringsArray, values: string[]) =>
  template.reduce((acc, str, i) => acc + str + (values[i] || ''), '')

/**
 * Creates a URL for a dynamically generated HTML blob from a template literal.
 * This function combines template strings and values to form an HTML content,
 * converts it to a Blob, and then creates an object URL for it.
 * It automatically revokes the ObjectURL on cleanup.
 *
 * @param {TemplateStringsArray} template - The template strings array, containing the static parts of the template.
 * @param {...string} values - The dynamic values to be interpolated into the template.
 * @returns {string} The URL of the created HTML blob, which can be used in contexts such as iframes or as a link href.
 * @example
 * const userContent = "<p>Hello, ${username}</p>";
 * const safeUrl = html`<div>${userContent}</div>`;
 * iframe.src = safeUrl;
 */
export function html(template: TemplateStringsArray, ...values: string[]) {
  const url = URL.createObjectURL(
    new Blob([concatTemplate(template, values)], { type: 'text/html' }),
  )
  onCleanup(() => URL.revokeObjectURL(url))
  return url
}

/**
 * Creates a URL for a dynamically generated ESM blob from a template literal.
 * Similar to the `html` function, it uses a tagged template to construct JavaScript content,
 * encapsulates it in a Blob, and then creates an object URL for the Blob.
 * It automatically revokes the ObjectURL on cleanup.
 *
 * @param template - The template strings array, part of the tagged template literal.
 * @param values - The interpolated values that will be included in the JavaScript code.
 * @returns  The URL of the created JavaScript blob, which can be used to dynamically load scripts.
 * @example
 
 * const scriptUrl = js`console.log('Hello, ${username}');`;
 * someElement.src = scriptUrl;
 */
export function javascript(template: TemplateStringsArray, ...values: string[]) {
  const url = URL.createObjectURL(
    new Blob([concatTemplate(template, values)], { type: 'text/javascript' }),
  )
  onCleanup(() => URL.revokeObjectURL(url))
  return url
}
