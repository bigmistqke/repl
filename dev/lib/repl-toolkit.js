import {
  createResource,
  untrack,
  createEffect,
  mapArray,
  createSignal,
  createMemo,
  onCleanup,
  mergeProps,
} from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import typescript from 'typescript'
function getExtension(path) {
  var _a2
  return ((_a2 = path.split('/').slice(-1)[0]) == null ? void 0 : _a2.split('.')[1]) || ''
}
function getName(path) {
  const parts = path.split('/')
  return parts[parts.length - 1] || ''
}
function getParentPath(path) {
  const parts = path.split('/')
  return parts.slice(0, -1).join('/')
}
function normalizePath$1(path) {
  return path.replace(/^\/+/, '')
}
function resolvePath(currentPath, relativePath) {
  const pathIsUrl = isUrl$1(currentPath)
  const base = pathIsUrl ? currentPath : new URL(currentPath, 'http://example.com/')
  const absoluteUrl = new URL(relativePath, base)
  return normalizePath$1(pathIsUrl ? absoluteUrl.href : absoluteUrl.pathname)
}
function isUrl$1(path) {
  return path.startsWith('blob:') || path.startsWith('http:') || path.startsWith('https:')
}
function createAsync(fn, options) {
  let resource
  let prev = () => (!resource || resource.state === 'unresolved' ? void 0 : resource.latest)
  ;[resource] = createResource(
    () => fn(untrack(prev)),
    v => v,
    options,
  )
  const resultAccessor = () => resource()
  Object.defineProperty(resultAccessor, 'latest', {
    get() {
      return resource.latest
    },
  })
  return resultAccessor
}
function createExecutables(fs, extensions2) {
  const [actions, setActions] = createStore({})
  const executables = {
    get(path) {
      var _a2
      return (_a2 = actions[path]) == null ? void 0 : _a2.get()
    },
    invalidate(path) {
      var _a2
      return (_a2 = actions[path]) == null ? void 0 : _a2.invalidate()
    },
    create(path) {
      var _a2
      return (_a2 = actions[path]) == null ? void 0 : _a2.create()
    },
  }
  createEffect(
    mapArray(
      () => Object.keys(fs).filter(path => fs[path] !== null),
      path => {
        const extension = getExtension(path)
        const [listen, invalidateExecutable] = createSignal(null, { equals: false })
        const transformed = createAsync(async () => {
          var _a2, _b
          return (
            ((_b = (_a2 = extensions2[extension]) == null ? void 0 : _a2.transform) == null
              ? void 0
              : _b.call(_a2, { path, source: fs[path], executables })) || fs[path]
          )
        })
        function createExecutable() {
          var _a2
          const _transformed = transformed()
          if (!_transformed) return
          const blob = new Blob([_transformed], {
            type: `text/${((_a2 = extensions2[extension]) == null ? void 0 : _a2.type) || 'plain'}`,
          })
          return URL.createObjectURL(blob)
        }
        const getExecutable = createMemo(previous => {
          if (previous) URL.revokeObjectURL(previous)
          listen()
          return createExecutable()
        })
        setActions({
          [path]: {
            get: getExecutable,
            create: createExecutable,
            invalidate: invalidateExecutable,
          },
        })
        onCleanup(() => setActions({ [path]: void 0 }))
      },
    ),
  )
  return executables
}
function getParentDirectory(path) {
  return path.split('/').slice(0, -1).join('/')
}
function globToRegex(glob) {
  const regex = glob.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.')
  return new RegExp(`^${regex}$`)
}
function createFileSystem(extensions2) {
  const [fs, setFs] = createStore({})
  const executables = createExecutables(fs, extensions2)
  const [match, setMatch] = createSignal(glob => {
    const regex = globToRegex(glob)
    return paths => paths.filter(path => regex.test(path))
  })
  function createGlobEffect(glob, cb) {
    const matchFn = createMemo(() => match()(glob))
    createEffect(
      mapArray(
        () => matchFn()(api.getPaths()),
        path => createEffect(() => cb(path)),
      ),
    )
  }
  function assertPathExists(path) {
    const parts = path.split('/')
    const pathExists = parts
      .map((_, index) => parts.slice(0, index + 1).join('/'))
      .filter(Boolean)
      .every(path2 => path2 in executables)
    if (!pathExists) {
      throw `Path is invalid ${path}`
    }
    return true
  }
  function readdir(path, options) {
    path = normalizePath$1(path)
    assertPathExists(path)
    if (options == null ? void 0 : options.withFileTypes) {
      return Object.entries(fs)
        .filter(([_path]) => getParentDirectory(_path) === path && path !== _path)
        .map(([path2, file]) => {
          var _a2
          return {
            type:
              file === null
                ? 'dir'
                : ((_a2 = extensions2[getExtension(path2)]) == null ? void 0 : _a2.type) || 'plain',
            path: path2,
          }
        })
    }
    return Object.keys(fs).filter(_path => getParentDirectory(_path) === path)
  }
  const api = {
    executables,
    getPaths: () => Object.keys(fs),
    getType(path) {
      var _a2
      path = normalizePath$1(path)
      assertPathExists(path)
      return fs[path] === null
        ? 'dir'
        : ((_a2 = extensions2[getExtension(path)]) == null ? void 0 : _a2.type) || 'plain'
    },
    readdir,
    mkdir(path, options) {
      path = normalizePath$1(path)
      if (options == null ? void 0 : options.recursive) {
        const parts = path.split('/')
        parts.forEach((_, index) => {
          setFs(parts.slice(0, index + 1).join('/'), null)
        })
        return
      }
      assertPathExists(getParentDirectory(path))
      setFs(path, null)
    },
    readFile(path) {
      path = normalizePath$1(path)
      const file = fs[path]
      if (file === null) {
        throw `Path is not a file ${path}`
      }
      return file
    },
    rename(previous, next) {
      previous = normalizePath$1(previous)
      next = normalizePath$1(next)
      assertPathExists(previous)
      setFs(
        produce(files => {
          Object.keys(fs).forEach(path => {
            if (path.startsWith(previous)) {
              const newPath = path.replace(previous, next)
              files[newPath] = files[path]
              delete files[path]
            }
          })
        }),
      )
    },
    rm(path, options) {
      path = normalizePath$1(path)
      if (!options || !options.force) {
        assertPathExists(path)
      }
      if (!options || !options.recursive) {
        const _dirEnts = Object.keys(executables).filter(value => {
          if (value === path) return false
          return value.includes(path)
        })
        if (_dirEnts.length > 0) {
          throw `Directory is not empty ${_dirEnts}`
        }
      }
      setFs(
        produce(files => {
          Object.keys(files)
            .filter(value => value.includes(path))
            .forEach(path2 => delete files[path2])
        }),
      )
    },
    writeFile(path, source) {
      path = normalizePath$1(path)
      assertPathExists(getParentDirectory(path))
      if (fs[path] === null) {
        throw `A directory already exist with the same name: ${path}`
      }
      setFs(path, source)
    },
    // Watchers
    watchExecutable(glob, cb) {
      createGlobEffect(glob, path => cb(api.executables.get(path), path))
    },
    watchFile(glob, cb) {
      createGlobEffect(glob, path => cb(api.readFile(path), path))
    },
    watchDir(path, cb) {
      cb(api.readdir(path, { withFileTypes: true }), path)
    },
    watchPaths(cb) {
      createEffect(() => cb(api.getPaths()))
    },
    // Set match function
    setMatch,
  }
  return api
}
function transformModulePaths(code, callback) {
  const sourceFile = typescript.createSourceFile(
    '',
    code,
    typescript.ScriptTarget.Latest,
    true,
    typescript.ScriptKind.TS,
  )
  let shouldPrint = false
  const result = typescript.transform(sourceFile, [
    context => {
      const visit = node => {
        if (
          (typescript.isImportDeclaration(node) || typescript.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          typescript.isStringLiteral(node.moduleSpecifier)
        ) {
          const isImport = typescript.isImportDeclaration(node)
          const previous = node.moduleSpecifier.text
          const result2 = callback(node.moduleSpecifier.text, isImport)
          if (result2 === null) {
            shouldPrint = true
            return
          }
          node.moduleSpecifier.text = result2
          if (previous !== node.moduleSpecifier.text) {
            shouldPrint = true
            if (isImport) {
              return typescript.factory.updateImportDeclaration(
                node,
                node.modifiers,
                node.importClause,
                typescript.factory.createStringLiteral(result2),
                node.assertClause,
                // Preserve the assert clause if it exists
              )
            } else {
              return typescript.factory.updateExportDeclaration(
                node,
                node.modifiers,
                false,
                node.exportClause,
                typescript.factory.createStringLiteral(result2),
                node.assertClause,
                // Preserve the assert clause if it exists
              )
            }
          }
        }
        return typescript.visitEachChild(node, visit, context)
      }
      return node => typescript.visitNode(node, visit)
    },
  ])
  if (!result.transformed[0]) return void 0
  if (!shouldPrint) return code
  const printer = typescript.createPrinter({
    newLine: typescript.NewLineKind.LineFeed,
  })
  return printer.printFile(result.transformed[0])
}
function defer() {
  let resolve = null
  return {
    promise: new Promise(_resolve => (resolve = _resolve)),
    resolve,
  }
}
function isUrl(path) {
  return path.startsWith('blob:') || path.startsWith('http:') || path.startsWith('https:')
}
function isRelativePath(path) {
  return path.startsWith('.')
}
const extensions = ['.js.d.ts', '.jsx.d.ts', '.ts.d.ts', '.tsx.d.ts', '.js', '.jsx', '.tsx']
function normalizePath(path) {
  for (const extension of extensions) {
    if (path.endsWith(extension)) {
      return path.replace(extension, '.d.ts')
    }
  }
  return path
}
function getVirtualPath(url, cdn = 'https://esm.sh') {
  const [first, ...path] = url.replace(`${cdn}/`, '').split('/')
  const library = (first == null ? void 0 : first.startsWith('@'))
    ? `@${first.slice(1).split('@')[0]}`
    : first.split('@')[0]
  return `${library}/${path.join('/')}`
}
const URL_CACHE = /* @__PURE__ */ new Map()
async function downloadTypesFromUrl({ url, declarationFiles = {}, cdn = 'https://esm.sh' }) {
  async function downloadPath(path) {
    if (URL_CACHE.has(path)) return await URL_CACHE.get(path)
    const { promise, resolve } = defer()
    URL_CACHE.set(path, promise)
    const virtualPath = getVirtualPath(path)
    if (virtualPath in declarationFiles) return
    const response = await fetch(path)
    if (response.status !== 200) {
      throw new Error(`Error while loading ${url}`)
    }
    const code = await response.text()
    resolve(code)
    const promises = new Array()
    const transformedCode = transformModulePaths(code, modulePath => {
      if (isRelativePath(modulePath)) {
        let newPath = resolvePath(path, modulePath)
        promises.push(downloadPath(normalizePath(newPath)))
        return normalizePath(modulePath)
      } else if (isUrl(modulePath)) {
        promises.push(
          downloadTypesFromUrl({
            url: modulePath,
            declarationFiles,
            cdn,
          }),
        )
        return getVirtualPath(modulePath)
      } else {
        promises.push(downloadTypesfromPackage({ name: modulePath, declarationFiles, cdn }))
      }
      return modulePath
    })
    if (!transformedCode) {
      throw new Error(`Transform returned undefined for ${virtualPath}`)
    }
    await Promise.all(promises)
    declarationFiles[virtualPath] = transformedCode
  }
  await downloadPath(url)
  return declarationFiles
}
const TYPE_URL_CACHE = /* @__PURE__ */ new Map()
async function downloadTypesfromPackage({ name, declarationFiles = {}, cdn = 'https://esm.sh' }) {
  const typeUrl = await (TYPE_URL_CACHE.get(name) ??
    TYPE_URL_CACHE.set(
      name,
      fetch(`${cdn}/${name}`)
        .then(result => result.headers.get('X-TypeScript-Types'))
        .catch(error => {
          console.info(error)
          return null
        }),
    ).get(name))
  if (!typeUrl) throw `No type url was found for package ${name}`
  return {
    path: getVirtualPath(typeUrl),
    types: await downloadTypesFromUrl({ url: typeUrl, declarationFiles, cdn }),
  }
}
function mapObject(object, callback) {
  return Object.fromEntries(
    Object.entries(object).map(entry => [entry[0], callback(entry[1], entry[0])]),
  )
}
function createMonacoTypeDownloader(tsconfig) {
  const [types, setTypes] = createStore({})
  const [aliases, setAliases] = createSignal({})
  function addAlias(alias, path) {
    setAliases(paths => {
      paths[alias] = [`file:///${path}`]
      return { ...paths }
    })
  }
  const methods = {
    tsconfig() {
      return {
        ...tsconfig,
        paths: {
          ...mapObject(tsconfig.paths || {}, value => value.map(path => `file:///${path}`)),
          ...aliases(),
        },
      }
    },
    types() {
      return types
    },
    addDeclaration(path, source, alias) {
      setTypes(path, source)
      if (alias) {
        addAlias(alias, path)
      }
    },
    async downloadModule(name) {
      if (!(name in aliases())) {
        const { types: types2, path } = await downloadTypesfromPackage({ name })
        setTypes(types2)
        addAlias(name, path)
      }
    },
    // Watchers
    watchTsconfig(cb) {
      createEffect(() => cb(methods.tsconfig()))
    },
    watchTypes(cb) {
      createEffect(() => cb({ ...types }))
    },
  }
  return methods
}
function bindMonaco(props) {
  const languages = mergeProps(
    {
      tsx: 'typescript',
      ts: 'typescript',
    },
    () => props.languages,
  )
  function getType(path) {
    let type = props.fs.getType(path)
    const extension = getExtension(path)
    if (extension && extension in languages) {
      type = languages[extension]
    }
    return type
  }
  createEffect(() => {
    props.editor.onDidChangeModelContent(() => {
      props.fs.writeFile(props.path, props.editor.getModel().getValue())
    })
  })
  createEffect(
    mapArray(props.fs.getPaths, path => {
      createEffect(() => {
        const type = getType(path)
        if (type === 'dir') return
        const uri = props.monaco.Uri.parse(`file:///${path}`)
        const model =
          props.monaco.editor.getModel(uri) || props.monaco.editor.createModel('', type, uri)
        createEffect(() => {
          const value = props.fs.readFile(path) || ''
          if (value !== model.getValue()) {
            model.setValue(props.fs.readFile(path) || '')
          }
        })
        onCleanup(() => model.dispose())
      })
    }),
  )
  createEffect(() => {
    const uri = props.monaco.Uri.parse(`file:///${props.path}`)
    let type = getType(props.path)
    const model =
      props.monaco.editor.getModel(uri) || props.monaco.editor.createModel('', type, uri)
    props.editor.setModel(model)
  })
  createEffect(() => {
    if (props.tsconfig) {
      props.monaco.languages.typescript.typescriptDefaults.setCompilerOptions(props.tsconfig)
      props.monaco.languages.typescript.javascriptDefaults.setCompilerOptions(props.tsconfig)
    }
  })
  createEffect(
    mapArray(
      () => Object.keys(props.types ?? {}),
      name => {
        createEffect(() => {
          var _a2
          const declaration = (_a2 = props.types) == null ? void 0 : _a2[name]
          if (!declaration) return
          const path = `file:///${name}`
          props.monaco.languages.typescript.typescriptDefaults.addExtraLib(declaration, path)
          props.monaco.languages.typescript.javascriptDefaults.addExtraLib(declaration, path)
        })
      },
    ),
  )
}
var ElementType
;(function (ElementType2) {
  ElementType2['Root'] = 'root'
  ElementType2['Text'] = 'text'
  ElementType2['Directive'] = 'directive'
  ElementType2['Comment'] = 'comment'
  ElementType2['Script'] = 'script'
  ElementType2['Style'] = 'style'
  ElementType2['Tag'] = 'tag'
  ElementType2['CDATA'] = 'cdata'
  ElementType2['Doctype'] = 'doctype'
})(ElementType || (ElementType = {}))
function isTag$1(elem) {
  return (
    elem.type === ElementType.Tag ||
    elem.type === ElementType.Script ||
    elem.type === ElementType.Style
  )
}
const Root = ElementType.Root
const Text$1 = ElementType.Text
const Directive = ElementType.Directive
const Comment$1 = ElementType.Comment
const Script = ElementType.Script
const Style = ElementType.Style
const Tag = ElementType.Tag
const CDATA$1 = ElementType.CDATA
const Doctype = ElementType.Doctype
const xmlReplacer = /["&'<>$\x80-\uFFFF]/g
const xmlCodeMap = /* @__PURE__ */ new Map([
  [34, '&quot;'],
  [38, '&amp;'],
  [39, '&apos;'],
  [60, '&lt;'],
  [62, '&gt;'],
])
const getCodePoint =
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  String.prototype.codePointAt != null
    ? (str, index) => str.codePointAt(index)
    : // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
      (c, index) =>
        (c.charCodeAt(index) & 64512) === 55296
          ? (c.charCodeAt(index) - 55296) * 1024 + c.charCodeAt(index + 1) - 56320 + 65536
          : c.charCodeAt(index)
function encodeXML(str) {
  let ret = ''
  let lastIdx = 0
  let match
  while ((match = xmlReplacer.exec(str)) !== null) {
    const i = match.index
    const char = str.charCodeAt(i)
    const next = xmlCodeMap.get(char)
    if (next !== void 0) {
      ret += str.substring(lastIdx, i) + next
      lastIdx = i + 1
    } else {
      ret += `${str.substring(lastIdx, i)}&#x${getCodePoint(str, i).toString(16)};`
      lastIdx = xmlReplacer.lastIndex += Number((char & 64512) === 55296)
    }
  }
  return ret + str.substr(lastIdx)
}
function getEscaper(regex, map) {
  return function escape(data) {
    let match
    let lastIdx = 0
    let result = ''
    while ((match = regex.exec(data))) {
      if (lastIdx !== match.index) {
        result += data.substring(lastIdx, match.index)
      }
      result += map.get(match[0].charCodeAt(0))
      lastIdx = match.index + 1
    }
    return result + data.substring(lastIdx)
  }
}
const escapeAttribute = getEscaper(
  /["&\u00A0]/g,
  /* @__PURE__ */ new Map([
    [34, '&quot;'],
    [38, '&amp;'],
    [160, '&nbsp;'],
  ]),
)
const escapeText = getEscaper(
  /[&<>\u00A0]/g,
  /* @__PURE__ */ new Map([
    [38, '&amp;'],
    [60, '&lt;'],
    [62, '&gt;'],
    [160, '&nbsp;'],
  ]),
)
const elementNames = new Map(
  [
    'altGlyph',
    'altGlyphDef',
    'altGlyphItem',
    'animateColor',
    'animateMotion',
    'animateTransform',
    'clipPath',
    'feBlend',
    'feColorMatrix',
    'feComponentTransfer',
    'feComposite',
    'feConvolveMatrix',
    'feDiffuseLighting',
    'feDisplacementMap',
    'feDistantLight',
    'feDropShadow',
    'feFlood',
    'feFuncA',
    'feFuncB',
    'feFuncG',
    'feFuncR',
    'feGaussianBlur',
    'feImage',
    'feMerge',
    'feMergeNode',
    'feMorphology',
    'feOffset',
    'fePointLight',
    'feSpecularLighting',
    'feSpotLight',
    'feTile',
    'feTurbulence',
    'foreignObject',
    'glyphRef',
    'linearGradient',
    'radialGradient',
    'textPath',
  ].map(val => [val.toLowerCase(), val]),
)
const attributeNames = new Map(
  [
    'definitionURL',
    'attributeName',
    'attributeType',
    'baseFrequency',
    'baseProfile',
    'calcMode',
    'clipPathUnits',
    'diffuseConstant',
    'edgeMode',
    'filterUnits',
    'glyphRef',
    'gradientTransform',
    'gradientUnits',
    'kernelMatrix',
    'kernelUnitLength',
    'keyPoints',
    'keySplines',
    'keyTimes',
    'lengthAdjust',
    'limitingConeAngle',
    'markerHeight',
    'markerUnits',
    'markerWidth',
    'maskContentUnits',
    'maskUnits',
    'numOctaves',
    'pathLength',
    'patternContentUnits',
    'patternTransform',
    'patternUnits',
    'pointsAtX',
    'pointsAtY',
    'pointsAtZ',
    'preserveAlpha',
    'preserveAspectRatio',
    'primitiveUnits',
    'refX',
    'refY',
    'repeatCount',
    'repeatDur',
    'requiredExtensions',
    'requiredFeatures',
    'specularConstant',
    'specularExponent',
    'spreadMethod',
    'startOffset',
    'stdDeviation',
    'stitchTiles',
    'surfaceScale',
    'systemLanguage',
    'tableValues',
    'targetX',
    'targetY',
    'textLength',
    'viewBox',
    'viewTarget',
    'xChannelSelector',
    'yChannelSelector',
    'zoomAndPan',
  ].map(val => [val.toLowerCase(), val]),
)
const unencodedElements = /* @__PURE__ */ new Set([
  'style',
  'script',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
  'plaintext',
  'noscript',
])
function replaceQuotes(value) {
  return value.replace(/"/g, '&quot;')
}
function formatAttributes(attributes, opts) {
  var _a2
  if (!attributes) return
  const encode =
    ((_a2 = opts.encodeEntities) !== null && _a2 !== void 0 ? _a2 : opts.decodeEntities) === false
      ? replaceQuotes
      : opts.xmlMode || opts.encodeEntities !== 'utf8'
      ? encodeXML
      : escapeAttribute
  return Object.keys(attributes)
    .map(key => {
      var _a3, _b
      const value = (_a3 = attributes[key]) !== null && _a3 !== void 0 ? _a3 : ''
      if (opts.xmlMode === 'foreign') {
        key = (_b = attributeNames.get(key)) !== null && _b !== void 0 ? _b : key
      }
      if (!opts.emptyAttrs && !opts.xmlMode && value === '') {
        return key
      }
      return `${key}="${encode(value)}"`
    })
    .join(' ')
}
const singleTag = /* @__PURE__ */ new Set([
  'area',
  'base',
  'basefont',
  'br',
  'col',
  'command',
  'embed',
  'frame',
  'hr',
  'img',
  'input',
  'isindex',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])
function render(node, options = {}) {
  const nodes = 'length' in node ? node : [node]
  let output = ''
  for (let i = 0; i < nodes.length; i++) {
    output += renderNode(nodes[i], options)
  }
  return output
}
function renderNode(node, options) {
  switch (node.type) {
    case Root:
      return render(node.children, options)
    case Doctype:
    case Directive:
      return renderDirective(node)
    case Comment$1:
      return renderComment(node)
    case CDATA$1:
      return renderCdata(node)
    case Script:
    case Style:
    case Tag:
      return renderTag(node, options)
    case Text$1:
      return renderText(node, options)
  }
}
const foreignModeIntegrationPoints = /* @__PURE__ */ new Set([
  'mi',
  'mo',
  'mn',
  'ms',
  'mtext',
  'annotation-xml',
  'foreignObject',
  'desc',
  'title',
])
const foreignElements = /* @__PURE__ */ new Set(['svg', 'math'])
function renderTag(elem, opts) {
  var _a2
  if (opts.xmlMode === 'foreign') {
    elem.name = (_a2 = elementNames.get(elem.name)) !== null && _a2 !== void 0 ? _a2 : elem.name
    if (elem.parent && foreignModeIntegrationPoints.has(elem.parent.name)) {
      opts = { ...opts, xmlMode: false }
    }
  }
  if (!opts.xmlMode && foreignElements.has(elem.name)) {
    opts = { ...opts, xmlMode: 'foreign' }
  }
  let tag = `<${elem.name}`
  const attribs = formatAttributes(elem.attribs, opts)
  if (attribs) {
    tag += ` ${attribs}`
  }
  if (
    elem.children.length === 0 &&
    (opts.xmlMode
      ? // In XML mode or foreign mode, and user hasn't explicitly turned off self-closing tags
        opts.selfClosingTags !== false
      : // User explicitly asked for self-closing tags, even in HTML mode
        opts.selfClosingTags && singleTag.has(elem.name))
  ) {
    if (!opts.xmlMode) tag += ' '
    tag += '/>'
  } else {
    tag += '>'
    if (elem.children.length > 0) {
      tag += render(elem.children, opts)
    }
    if (opts.xmlMode || !singleTag.has(elem.name)) {
      tag += `</${elem.name}>`
    }
  }
  return tag
}
function renderDirective(elem) {
  return `<${elem.data}>`
}
function renderText(elem, opts) {
  var _a2
  let data = elem.data || ''
  if (
    ((_a2 = opts.encodeEntities) !== null && _a2 !== void 0 ? _a2 : opts.decodeEntities) !==
      false &&
    !(!opts.xmlMode && elem.parent && unencodedElements.has(elem.parent.name))
  ) {
    data = opts.xmlMode || opts.encodeEntities !== 'utf8' ? encodeXML(data) : escapeText(data)
  }
  return data
}
function renderCdata(elem) {
  return `<![CDATA[${elem.children[0].data}]]>`
}
function renderComment(elem) {
  return `<!--${elem.data}-->`
}
class Node {
  constructor() {
    this.parent = null
    this.prev = null
    this.next = null
    this.startIndex = null
    this.endIndex = null
  }
  // Read-write aliases for properties
  /**
   * Same as {@link parent}.
   * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
   */
  get parentNode() {
    return this.parent
  }
  set parentNode(parent) {
    this.parent = parent
  }
  /**
   * Same as {@link prev}.
   * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
   */
  get previousSibling() {
    return this.prev
  }
  set previousSibling(prev) {
    this.prev = prev
  }
  /**
   * Same as {@link next}.
   * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
   */
  get nextSibling() {
    return this.next
  }
  set nextSibling(next) {
    this.next = next
  }
  /**
   * Clone this node, and optionally its children.
   *
   * @param recursive Clone child nodes as well.
   * @returns A clone of the node.
   */
  cloneNode(recursive = false) {
    return cloneNode(this, recursive)
  }
}
class DataNode extends Node {
  /**
   * @param data The content of the data node
   */
  constructor(data) {
    super()
    this.data = data
  }
  /**
   * Same as {@link data}.
   * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
   */
  get nodeValue() {
    return this.data
  }
  set nodeValue(data) {
    this.data = data
  }
}
class Text extends DataNode {
  constructor() {
    super(...arguments)
    this.type = ElementType.Text
  }
  get nodeType() {
    return 3
  }
}
class Comment extends DataNode {
  constructor() {
    super(...arguments)
    this.type = ElementType.Comment
  }
  get nodeType() {
    return 8
  }
}
class ProcessingInstruction extends DataNode {
  constructor(name, data) {
    super(data)
    this.name = name
    this.type = ElementType.Directive
  }
  get nodeType() {
    return 1
  }
}
class NodeWithChildren extends Node {
  /**
   * @param children Children of the node. Only certain node types can have children.
   */
  constructor(children) {
    super()
    this.children = children
  }
  // Aliases
  /** First child of the node. */
  get firstChild() {
    var _a2
    return (_a2 = this.children[0]) !== null && _a2 !== void 0 ? _a2 : null
  }
  /** Last child of the node. */
  get lastChild() {
    return this.children.length > 0 ? this.children[this.children.length - 1] : null
  }
  /**
   * Same as {@link children}.
   * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
   */
  get childNodes() {
    return this.children
  }
  set childNodes(children) {
    this.children = children
  }
}
class CDATA extends NodeWithChildren {
  constructor() {
    super(...arguments)
    this.type = ElementType.CDATA
  }
  get nodeType() {
    return 4
  }
}
class Document extends NodeWithChildren {
  constructor() {
    super(...arguments)
    this.type = ElementType.Root
  }
  get nodeType() {
    return 9
  }
}
class Element extends NodeWithChildren {
  /**
   * @param name Name of the tag, eg. `div`, `span`.
   * @param attribs Object mapping attribute names to attribute values.
   * @param children Children of the node.
   */
  constructor(
    name,
    attribs,
    children = [],
    type = name === 'script'
      ? ElementType.Script
      : name === 'style'
      ? ElementType.Style
      : ElementType.Tag,
  ) {
    super(children)
    this.name = name
    this.attribs = attribs
    this.type = type
  }
  get nodeType() {
    return 1
  }
  // DOM Level 1 aliases
  /**
   * Same as {@link name}.
   * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
   */
  get tagName() {
    return this.name
  }
  set tagName(name) {
    this.name = name
  }
  get attributes() {
    return Object.keys(this.attribs).map(name => {
      var _a2, _b
      return {
        name,
        value: this.attribs[name],
        namespace:
          (_a2 = this['x-attribsNamespace']) === null || _a2 === void 0 ? void 0 : _a2[name],
        prefix: (_b = this['x-attribsPrefix']) === null || _b === void 0 ? void 0 : _b[name],
      }
    })
  }
}
function isTag(node) {
  return isTag$1(node)
}
function isCDATA(node) {
  return node.type === ElementType.CDATA
}
function isText(node) {
  return node.type === ElementType.Text
}
function isComment(node) {
  return node.type === ElementType.Comment
}
function isDirective(node) {
  return node.type === ElementType.Directive
}
function isDocument(node) {
  return node.type === ElementType.Root
}
function hasChildren(node) {
  return Object.prototype.hasOwnProperty.call(node, 'children')
}
function cloneNode(node, recursive = false) {
  let result
  if (isText(node)) {
    result = new Text(node.data)
  } else if (isComment(node)) {
    result = new Comment(node.data)
  } else if (isTag(node)) {
    const children = recursive ? cloneChildren(node.children) : []
    const clone = new Element(node.name, { ...node.attribs }, children)
    children.forEach(child => (child.parent = clone))
    if (node.namespace != null) {
      clone.namespace = node.namespace
    }
    if (node['x-attribsNamespace']) {
      clone['x-attribsNamespace'] = { ...node['x-attribsNamespace'] }
    }
    if (node['x-attribsPrefix']) {
      clone['x-attribsPrefix'] = { ...node['x-attribsPrefix'] }
    }
    result = clone
  } else if (isCDATA(node)) {
    const children = recursive ? cloneChildren(node.children) : []
    const clone = new CDATA(children)
    children.forEach(child => (child.parent = clone))
    result = clone
  } else if (isDocument(node)) {
    const children = recursive ? cloneChildren(node.children) : []
    const clone = new Document(children)
    children.forEach(child => (child.parent = clone))
    if (node['x-mode']) {
      clone['x-mode'] = node['x-mode']
    }
    result = clone
  } else if (isDirective(node)) {
    const instruction = new ProcessingInstruction(node.name, node.data)
    if (node['x-name'] != null) {
      instruction['x-name'] = node['x-name']
      instruction['x-publicId'] = node['x-publicId']
      instruction['x-systemId'] = node['x-systemId']
    }
    result = instruction
  } else {
    throw new Error(`Not implemented yet: ${node.type}`)
  }
  result.startIndex = node.startIndex
  result.endIndex = node.endIndex
  if (node.sourceCodeLocation != null) {
    result.sourceCodeLocation = node.sourceCodeLocation
  }
  return result
}
function cloneChildren(childs) {
  const children = childs.map(child => cloneNode(child, true))
  for (let i = 1; i < children.length; i++) {
    children[i].prev = children[i - 1]
    children[i - 1].next = children[i]
  }
  return children
}
const defaultOpts = {
  withStartIndices: false,
  withEndIndices: false,
  xmlMode: false,
}
class DomHandler {
  /**
   * @param callback Called once parsing has completed.
   * @param options Settings for the handler.
   * @param elementCB Callback whenever a tag is closed.
   */
  constructor(callback, options, elementCB) {
    this.dom = []
    this.root = new Document(this.dom)
    this.done = false
    this.tagStack = [this.root]
    this.lastNode = null
    this.parser = null
    if (typeof options === 'function') {
      elementCB = options
      options = defaultOpts
    }
    if (typeof callback === 'object') {
      options = callback
      callback = void 0
    }
    this.callback = callback !== null && callback !== void 0 ? callback : null
    this.options = options !== null && options !== void 0 ? options : defaultOpts
    this.elementCB = elementCB !== null && elementCB !== void 0 ? elementCB : null
  }
  onparserinit(parser) {
    this.parser = parser
  }
  // Resets the handler back to starting state
  onreset() {
    this.dom = []
    this.root = new Document(this.dom)
    this.done = false
    this.tagStack = [this.root]
    this.lastNode = null
    this.parser = null
  }
  // Signals the handler that parsing is done
  onend() {
    if (this.done) return
    this.done = true
    this.parser = null
    this.handleCallback(null)
  }
  onerror(error) {
    this.handleCallback(error)
  }
  onclosetag() {
    this.lastNode = null
    const elem = this.tagStack.pop()
    if (this.options.withEndIndices) {
      elem.endIndex = this.parser.endIndex
    }
    if (this.elementCB) this.elementCB(elem)
  }
  onopentag(name, attribs) {
    const type = this.options.xmlMode ? ElementType.Tag : void 0
    const element = new Element(name, attribs, void 0, type)
    this.addNode(element)
    this.tagStack.push(element)
  }
  ontext(data) {
    const { lastNode } = this
    if (lastNode && lastNode.type === ElementType.Text) {
      lastNode.data += data
      if (this.options.withEndIndices) {
        lastNode.endIndex = this.parser.endIndex
      }
    } else {
      const node = new Text(data)
      this.addNode(node)
      this.lastNode = node
    }
  }
  oncomment(data) {
    if (this.lastNode && this.lastNode.type === ElementType.Comment) {
      this.lastNode.data += data
      return
    }
    const node = new Comment(data)
    this.addNode(node)
    this.lastNode = node
  }
  oncommentend() {
    this.lastNode = null
  }
  oncdatastart() {
    const text = new Text('')
    const node = new CDATA([text])
    this.addNode(node)
    text.parent = node
    this.lastNode = text
  }
  oncdataend() {
    this.lastNode = null
  }
  onprocessinginstruction(name, data) {
    const node = new ProcessingInstruction(name, data)
    this.addNode(node)
  }
  handleCallback(error) {
    if (typeof this.callback === 'function') {
      this.callback(error, this.dom)
    } else if (error) {
      throw error
    }
  }
  addNode(node) {
    const parent = this.tagStack[this.tagStack.length - 1]
    const previousSibling = parent.children[parent.children.length - 1]
    if (this.options.withStartIndices) {
      node.startIndex = this.parser.startIndex
    }
    if (this.options.withEndIndices) {
      node.endIndex = this.parser.endIndex
    }
    parent.children.push(node)
    if (previousSibling) {
      node.prev = previousSibling
      previousSibling.next = node
    }
    node.parent = parent
    this.lastNode = null
  }
}
function getAttributeValue(elem, name) {
  var _a2
  return (_a2 = elem.attribs) === null || _a2 === void 0 ? void 0 : _a2[name]
}
function hasAttrib(elem, name) {
  return (
    elem.attribs != null &&
    Object.prototype.hasOwnProperty.call(elem.attribs, name) &&
    elem.attribs[name] != null
  )
}
function findAll(test, nodes) {
  const result = []
  const nodeStack = [Array.isArray(nodes) ? nodes : [nodes]]
  const indexStack = [0]
  for (;;) {
    if (indexStack[0] >= nodeStack[0].length) {
      if (nodeStack.length === 1) {
        return result
      }
      nodeStack.shift()
      indexStack.shift()
      continue
    }
    const elem = nodeStack[0][indexStack[0]++]
    if (isTag(elem) && test(elem)) result.push(elem)
    if (hasChildren(elem) && elem.children.length > 0) {
      indexStack.unshift(0)
      nodeStack.unshift(elem.children)
    }
  }
}
const htmlDecodeTree = /* @__PURE__ */ new Uint16Array(
  // prettier-ignore
  /* @__PURE__ */ 'ᵁ<Õıʊҝջאٵ۞ޢߖࠏ੊ઑඡ๭༉༦჊ረዡᐕᒝᓃᓟᔥ\0\0\0\0\0\0ᕫᛍᦍᰒᷝ὾⁠↰⊍⏀⏻⑂⠤⤒ⴈ⹈⿎〖㊺㘹㞬㣾㨨㩱㫠㬮ࠀEMabcfglmnoprstu\\bfms¦³¹ÈÏlig耻Æ䃆P耻&䀦cute耻Á䃁reve;䄂Āiyx}rc耻Â䃂;䐐r;쀀𝔄rave耻À䃀pha;䎑acr;䄀d;橓Āgp¡on;䄄f;쀀𝔸plyFunction;恡ing耻Å䃅Ācs¾Ãr;쀀𝒜ign;扔ilde耻Ã䃃ml耻Ä䃄ЀaceforsuåûþėĜĢħĪĀcrêòkslash;或Ŷöø;櫧ed;挆y;䐑ƀcrtąċĔause;戵noullis;愬a;䎒r;쀀𝔅pf;쀀𝔹eve;䋘còēmpeq;扎܀HOacdefhilorsuōőŖƀƞƢƵƷƺǜȕɳɸɾcy;䐧PY耻©䂩ƀcpyŝŢźute;䄆Ā;iŧŨ拒talDifferentialD;慅leys;愭ȀaeioƉƎƔƘron;䄌dil耻Ç䃇rc;䄈nint;戰ot;䄊ĀdnƧƭilla;䂸terDot;䂷òſi;䎧rcleȀDMPTǇǋǑǖot;抙inus;抖lus;投imes;抗oĀcsǢǸkwiseContourIntegral;戲eCurlyĀDQȃȏoubleQuote;思uote;怙ȀlnpuȞȨɇɕonĀ;eȥȦ户;橴ƀgitȯȶȺruent;扡nt;戯ourIntegral;戮ĀfrɌɎ;愂oduct;成nterClockwiseContourIntegral;戳oss;樯cr;쀀𝒞pĀ;Cʄʅ拓ap;才րDJSZacefiosʠʬʰʴʸˋ˗ˡ˦̳ҍĀ;oŹʥtrahd;椑cy;䐂cy;䐅cy;䐏ƀgrsʿ˄ˇger;怡r;憡hv;櫤Āayː˕ron;䄎;䐔lĀ;t˝˞戇a;䎔r;쀀𝔇Āaf˫̧Ācm˰̢riticalȀADGT̖̜̀̆cute;䂴oŴ̋̍;䋙bleAcute;䋝rave;䁠ilde;䋜ond;拄ferentialD;慆Ѱ̽\0\0\0͔͂\0Ѕf;쀀𝔻ƀ;DE͈͉͍䂨ot;惜qual;扐blèCDLRUVͣͲ΂ϏϢϸontourIntegraìȹoɴ͹\0\0ͻ»͉nArrow;懓Āeo·ΤftƀARTΐΖΡrrow;懐ightArrow;懔eåˊngĀLRΫτeftĀARγιrrow;柸ightArrow;柺ightArrow;柹ightĀATϘϞrrow;懒ee;抨pɁϩ\0\0ϯrrow;懑ownArrow;懕erticalBar;戥ǹABLRTaВЪаўѿͼrrowƀ;BUНОТ憓ar;椓pArrow;懵reve;䌑eft˒к\0ц\0ѐightVector;楐eeVector;楞ectorĀ;Bљњ憽ar;楖ightǔѧ\0ѱeeVector;楟ectorĀ;BѺѻ懁ar;楗eeĀ;A҆҇护rrow;憧ĀctҒҗr;쀀𝒟rok;䄐ࠀNTacdfglmopqstuxҽӀӄӋӞӢӧӮӵԡԯԶՒ՝ՠեG;䅊H耻Ð䃐cute耻É䃉ƀaiyӒӗӜron;䄚rc耻Ê䃊;䐭ot;䄖r;쀀𝔈rave耻È䃈ement;戈ĀapӺӾcr;䄒tyɓԆ\0\0ԒmallSquare;旻erySmallSquare;斫ĀgpԦԪon;䄘f;쀀𝔼silon;䎕uĀaiԼՉlĀ;TՂՃ橵ilde;扂librium;懌Āci՗՚r;愰m;橳a;䎗ml耻Ë䃋Āipժկsts;戃onentialE;慇ʀcfiosօֈ֍ֲ׌y;䐤r;쀀𝔉lledɓ֗\0\0֣mallSquare;旼erySmallSquare;斪Ͱֺ\0ֿ\0\0ׄf;쀀𝔽All;戀riertrf;愱cò׋؀JTabcdfgorstר׬ׯ׺؀ؒؖ؛؝أ٬ٲcy;䐃耻>䀾mmaĀ;d׷׸䎓;䏜reve;䄞ƀeiy؇،ؐdil;䄢rc;䄜;䐓ot;䄠r;쀀𝔊;拙pf;쀀𝔾eater̀EFGLSTصلَٖٛ٦qualĀ;Lؾؿ扥ess;招ullEqual;执reater;檢ess;扷lantEqual;橾ilde;扳cr;쀀𝒢;扫ЀAacfiosuڅڋږڛڞڪھۊRDcy;䐪Āctڐڔek;䋇;䁞irc;䄤r;愌lbertSpace;愋ǰگ\0ڲf;愍izontalLine;攀Āctۃۅòکrok;䄦mpńېۘownHumðįqual;扏܀EJOacdfgmnostuۺ۾܃܇܎ܚܞܡܨ݄ݸދޏޕcy;䐕lig;䄲cy;䐁cute耻Í䃍Āiyܓܘrc耻Î䃎;䐘ot;䄰r;愑rave耻Ì䃌ƀ;apܠܯܿĀcgܴܷr;䄪inaryI;慈lieóϝǴ݉\0ݢĀ;eݍݎ戬Āgrݓݘral;戫section;拂isibleĀCTݬݲomma;恣imes;恢ƀgptݿރވon;䄮f;쀀𝕀a;䎙cr;愐ilde;䄨ǫޚ\0ޞcy;䐆l耻Ï䃏ʀcfosuެ޷޼߂ߐĀiyޱ޵rc;䄴;䐙r;쀀𝔍pf;쀀𝕁ǣ߇\0ߌr;쀀𝒥rcy;䐈kcy;䐄΀HJacfosߤߨ߽߬߱ࠂࠈcy;䐥cy;䐌ppa;䎚Āey߶߻dil;䄶;䐚r;쀀𝔎pf;쀀𝕂cr;쀀𝒦րJTaceflmostࠥࠩࠬࡐࡣ঳সে্਷ੇcy;䐉耻<䀼ʀcmnpr࠷࠼ࡁࡄࡍute;䄹bda;䎛g;柪lacetrf;愒r;憞ƀaeyࡗ࡜ࡡron;䄽dil;䄻;䐛Āfsࡨ॰tԀACDFRTUVarࡾࢩࢱࣦ࣠ࣼयज़ΐ४Ānrࢃ࢏gleBracket;柨rowƀ;BR࢙࢚࢞憐ar;懤ightArrow;懆eiling;挈oǵࢷ\0ࣃbleBracket;柦nǔࣈ\0࣒eeVector;楡ectorĀ;Bࣛࣜ懃ar;楙loor;挊ightĀAV࣯ࣵrrow;憔ector;楎Āerँगeƀ;AVउऊऐ抣rrow;憤ector;楚iangleƀ;BEतथऩ抲ar;槏qual;抴pƀDTVषूौownVector;楑eeVector;楠ectorĀ;Bॖॗ憿ar;楘ectorĀ;B॥०憼ar;楒ightáΜs̀EFGLSTॾঋকঝঢভqualGreater;拚ullEqual;扦reater;扶ess;檡lantEqual;橽ilde;扲r;쀀𝔏Ā;eঽা拘ftarrow;懚idot;䄿ƀnpw৔ਖਛgȀLRlr৞৷ਂਐeftĀAR০৬rrow;柵ightArrow;柷ightArrow;柶eftĀarγਊightáοightáϊf;쀀𝕃erĀLRਢਬeftArrow;憙ightArrow;憘ƀchtਾੀੂòࡌ;憰rok;䅁;扪Ѐacefiosuਗ਼੝੠੷੼અઋ઎p;椅y;䐜Ādl੥੯iumSpace;恟lintrf;愳r;쀀𝔐nusPlus;戓pf;쀀𝕄cò੶;䎜ҀJacefostuણધભીଔଙඑ඗ඞcy;䐊cute;䅃ƀaey઴હાron;䅇dil;䅅;䐝ƀgswે૰଎ativeƀMTV૓૟૨ediumSpace;怋hiĀcn૦૘ë૙eryThiî૙tedĀGL૸ଆreaterGreateòٳessLesóੈLine;䀊r;쀀𝔑ȀBnptଢନଷ଺reak;恠BreakingSpace;䂠f;愕ڀ;CDEGHLNPRSTV୕ୖ୪୼஡௫ఄ౞಄ದ೘ൡඅ櫬Āou୛୤ngruent;扢pCap;扭oubleVerticalBar;戦ƀlqxஃஊ஛ement;戉ualĀ;Tஒஓ扠ilde;쀀≂̸ists;戄reater΀;EFGLSTஶஷ஽௉௓௘௥扯qual;扱ullEqual;쀀≧̸reater;쀀≫̸ess;批lantEqual;쀀⩾̸ilde;扵umpń௲௽ownHump;쀀≎̸qual;쀀≏̸eĀfsఊధtTriangleƀ;BEచఛడ拪ar;쀀⧏̸qual;括s̀;EGLSTవశ఼ౄోౘ扮qual;扰reater;扸ess;쀀≪̸lantEqual;쀀⩽̸ilde;扴estedĀGL౨౹reaterGreater;쀀⪢̸essLess;쀀⪡̸recedesƀ;ESಒಓಛ技qual;쀀⪯̸lantEqual;拠ĀeiಫಹverseElement;戌ghtTriangleƀ;BEೋೌ೒拫ar;쀀⧐̸qual;拭ĀquೝഌuareSuĀbp೨೹setĀ;E೰ೳ쀀⊏̸qual;拢ersetĀ;Eഃആ쀀⊐̸qual;拣ƀbcpഓതൎsetĀ;Eഛഞ쀀⊂⃒qual;抈ceedsȀ;ESTലള഻െ抁qual;쀀⪰̸lantEqual;拡ilde;쀀≿̸ersetĀ;E൘൛쀀⊃⃒qual;抉ildeȀ;EFT൮൯൵ൿ扁qual;扄ullEqual;扇ilde;扉erticalBar;戤cr;쀀𝒩ilde耻Ñ䃑;䎝܀Eacdfgmoprstuvලෂ෉෕ෛ෠෧෼ขภยา฿ไlig;䅒cute耻Ó䃓Āiy෎ීrc耻Ô䃔;䐞blac;䅐r;쀀𝔒rave耻Ò䃒ƀaei෮ෲ෶cr;䅌ga;䎩cron;䎟pf;쀀𝕆enCurlyĀDQฎบoubleQuote;怜uote;怘;橔Āclวฬr;쀀𝒪ash耻Ø䃘iŬื฼de耻Õ䃕es;樷ml耻Ö䃖erĀBP๋๠Āar๐๓r;怾acĀek๚๜;揞et;掴arenthesis;揜Ҁacfhilors๿ງຊຏຒດຝະ໼rtialD;戂y;䐟r;쀀𝔓i;䎦;䎠usMinus;䂱Āipຢອncareplanåڝf;愙Ȁ;eio຺ູ໠໤檻cedesȀ;EST່້໏໚扺qual;檯lantEqual;扼ilde;找me;怳Ādp໩໮uct;戏ortionĀ;aȥ໹l;戝Āci༁༆r;쀀𝒫;䎨ȀUfos༑༖༛༟OT耻"䀢r;쀀𝔔pf;愚cr;쀀𝒬؀BEacefhiorsu༾གྷཇའཱིྦྷྪྭ႖ႩႴႾarr;椐G耻®䂮ƀcnrཎནབute;䅔g;柫rĀ;tཛྷཝ憠l;椖ƀaeyཧཬཱron;䅘dil;䅖;䐠Ā;vླྀཹ愜erseĀEUྂྙĀlq྇ྎement;戋uilibrium;懋pEquilibrium;楯r»ཹo;䎡ghtЀACDFTUVa࿁࿫࿳ဢဨၛႇϘĀnr࿆࿒gleBracket;柩rowƀ;BL࿜࿝࿡憒ar;懥eftArrow;懄eiling;按oǵ࿹\0စbleBracket;柧nǔည\0နeeVector;楝ectorĀ;Bဝသ懂ar;楕loor;挋Āerိ၃eƀ;AVဵံြ抢rrow;憦ector;楛iangleƀ;BEၐၑၕ抳ar;槐qual;抵pƀDTVၣၮၸownVector;楏eeVector;楜ectorĀ;Bႂႃ憾ar;楔ectorĀ;B႑႒懀ar;楓Āpuႛ႞f;愝ndImplies;楰ightarrow;懛ĀchႹႼr;愛;憱leDelayed;槴ڀHOacfhimoqstuფჱჷჽᄙᄞᅑᅖᅡᅧᆵᆻᆿĀCcჩხHcy;䐩y;䐨FTcy;䐬cute;䅚ʀ;aeiyᄈᄉᄎᄓᄗ檼ron;䅠dil;䅞rc;䅜;䐡r;쀀𝔖ortȀDLRUᄪᄴᄾᅉownArrow»ОeftArrow»࢚ightArrow»࿝pArrow;憑gma;䎣allCircle;战pf;쀀𝕊ɲᅭ\0\0ᅰt;戚areȀ;ISUᅻᅼᆉᆯ斡ntersection;抓uĀbpᆏᆞsetĀ;Eᆗᆘ抏qual;抑ersetĀ;Eᆨᆩ抐qual;抒nion;抔cr;쀀𝒮ar;拆ȀbcmpᇈᇛሉላĀ;sᇍᇎ拐etĀ;Eᇍᇕqual;抆ĀchᇠህeedsȀ;ESTᇭᇮᇴᇿ扻qual;檰lantEqual;扽ilde;承Tháྌ;我ƀ;esሒሓሣ拑rsetĀ;Eሜም抃qual;抇et»ሓրHRSacfhiorsሾቄ቉ቕ቞ቱቶኟዂወዑORN耻Þ䃞ADE;愢ĀHc቎ቒcy;䐋y;䐦Ābuቚቜ;䀉;䎤ƀaeyብቪቯron;䅤dil;䅢;䐢r;쀀𝔗Āeiቻ኉ǲኀ\0ኇefore;戴a;䎘Ācn኎ኘkSpace;쀀  Space;怉ldeȀ;EFTካኬኲኼ戼qual;扃ullEqual;扅ilde;扈pf;쀀𝕋ipleDot;惛Āctዖዛr;쀀𝒯rok;䅦ૡዷጎጚጦ\0ጬጱ\0\0\0\0\0ጸጽ፷ᎅ\0᏿ᐄᐊᐐĀcrዻጁute耻Ú䃚rĀ;oጇገ憟cir;楉rǣጓ\0጖y;䐎ve;䅬Āiyጞጣrc耻Û䃛;䐣blac;䅰r;쀀𝔘rave耻Ù䃙acr;䅪Ādiፁ፩erĀBPፈ፝Āarፍፐr;䁟acĀekፗፙ;揟et;掵arenthesis;揝onĀ;P፰፱拃lus;抎Āgp፻፿on;䅲f;쀀𝕌ЀADETadps᎕ᎮᎸᏄϨᏒᏗᏳrrowƀ;BDᅐᎠᎤar;椒ownArrow;懅ownArrow;憕quilibrium;楮eeĀ;AᏋᏌ报rrow;憥ownáϳerĀLRᏞᏨeftArrow;憖ightArrow;憗iĀ;lᏹᏺ䏒on;䎥ing;䅮cr;쀀𝒰ilde;䅨ml耻Ü䃜ҀDbcdefosvᐧᐬᐰᐳᐾᒅᒊᒐᒖash;披ar;櫫y;䐒ashĀ;lᐻᐼ抩;櫦Āerᑃᑅ;拁ƀbtyᑌᑐᑺar;怖Ā;iᑏᑕcalȀBLSTᑡᑥᑪᑴar;戣ine;䁼eparator;杘ilde;所ThinSpace;怊r;쀀𝔙pf;쀀𝕍cr;쀀𝒱dash;抪ʀcefosᒧᒬᒱᒶᒼirc;䅴dge;拀r;쀀𝔚pf;쀀𝕎cr;쀀𝒲Ȁfiosᓋᓐᓒᓘr;쀀𝔛;䎞pf;쀀𝕏cr;쀀𝒳ҀAIUacfosuᓱᓵᓹᓽᔄᔏᔔᔚᔠcy;䐯cy;䐇cy;䐮cute耻Ý䃝Āiyᔉᔍrc;䅶;䐫r;쀀𝔜pf;쀀𝕐cr;쀀𝒴ml;䅸ЀHacdefosᔵᔹᔿᕋᕏᕝᕠᕤcy;䐖cute;䅹Āayᕄᕉron;䅽;䐗ot;䅻ǲᕔ\0ᕛoWidtè૙a;䎖r;愨pf;愤cr;쀀𝒵௡ᖃᖊᖐ\0ᖰᖶᖿ\0\0\0\0ᗆᗛᗫᙟ᙭\0ᚕ᚛ᚲᚹ\0ᚾcute耻á䃡reve;䄃̀;Ediuyᖜᖝᖡᖣᖨᖭ戾;쀀∾̳;房rc耻â䃢te肻´̆;䐰lig耻æ䃦Ā;r²ᖺ;쀀𝔞rave耻à䃠ĀepᗊᗖĀfpᗏᗔsym;愵èᗓha;䎱ĀapᗟcĀclᗤᗧr;䄁g;樿ɤᗰ\0\0ᘊʀ;adsvᗺᗻᗿᘁᘇ戧nd;橕;橜lope;橘;橚΀;elmrszᘘᘙᘛᘞᘿᙏᙙ戠;榤e»ᘙsdĀ;aᘥᘦ戡ѡᘰᘲᘴᘶᘸᘺᘼᘾ;榨;榩;榪;榫;榬;榭;榮;榯tĀ;vᙅᙆ戟bĀ;dᙌᙍ抾;榝Āptᙔᙗh;戢»¹arr;捼Āgpᙣᙧon;䄅f;쀀𝕒΀;Eaeiop዁ᙻᙽᚂᚄᚇᚊ;橰cir;橯;扊d;手s;䀧roxĀ;e዁ᚒñᚃing耻å䃥ƀctyᚡᚦᚨr;쀀𝒶;䀪mpĀ;e዁ᚯñʈilde耻ã䃣ml耻ä䃤Āciᛂᛈoninôɲnt;樑ࠀNabcdefiklnoprsu᛭ᛱᜰ᜼ᝃᝈ᝸᝽០៦ᠹᡐᜍ᤽᥈ᥰot;櫭Ācrᛶ᜞kȀcepsᜀᜅᜍᜓong;扌psilon;䏶rime;怵imĀ;e᜚᜛戽q;拍Ŷᜢᜦee;抽edĀ;gᜬᜭ挅e»ᜭrkĀ;t፜᜷brk;掶Āoyᜁᝁ;䐱quo;怞ʀcmprtᝓ᝛ᝡᝤᝨausĀ;eĊĉptyv;榰séᜌnoõēƀahwᝯ᝱ᝳ;䎲;愶een;扬r;쀀𝔟g΀costuvwឍឝឳេ៕៛៞ƀaiuបពរðݠrc;旯p»፱ƀdptឤឨឭot;樀lus;樁imes;樂ɱឹ\0\0ើcup;樆ar;昅riangleĀdu៍្own;施p;斳plus;樄eåᑄåᒭarow;植ƀako៭ᠦᠵĀcn៲ᠣkƀlst៺֫᠂ozenge;槫riangleȀ;dlr᠒᠓᠘᠝斴own;斾eft;旂ight;斸k;搣Ʊᠫ\0ᠳƲᠯ\0ᠱ;斒;斑4;斓ck;斈ĀeoᠾᡍĀ;qᡃᡆ쀀=⃥uiv;쀀≡⃥t;挐Ȁptwxᡙᡞᡧᡬf;쀀𝕓Ā;tᏋᡣom»Ꮜtie;拈؀DHUVbdhmptuvᢅᢖᢪᢻᣗᣛᣬ᣿ᤅᤊᤐᤡȀLRlrᢎᢐᢒᢔ;敗;敔;敖;敓ʀ;DUduᢡᢢᢤᢦᢨ敐;敦;敩;敤;敧ȀLRlrᢳᢵᢷᢹ;敝;敚;敜;教΀;HLRhlrᣊᣋᣍᣏᣑᣓᣕ救;敬;散;敠;敫;敢;敟ox;槉ȀLRlrᣤᣦᣨᣪ;敕;敒;攐;攌ʀ;DUduڽ᣷᣹᣻᣽;敥;敨;攬;攴inus;抟lus;択imes;抠ȀLRlrᤙᤛᤝ᤟;敛;敘;攘;攔΀;HLRhlrᤰᤱᤳᤵᤷ᤻᤹攂;敪;敡;敞;攼;攤;攜Āevģ᥂bar耻¦䂦Ȁceioᥑᥖᥚᥠr;쀀𝒷mi;恏mĀ;e᜚᜜lƀ;bhᥨᥩᥫ䁜;槅sub;柈Ŭᥴ᥾lĀ;e᥹᥺怢t»᥺pƀ;Eeįᦅᦇ;檮Ā;qۜۛೡᦧ\0᧨ᨑᨕᨲ\0ᨷᩐ\0\0᪴\0\0᫁\0\0ᬡᬮ᭍᭒\0᯽\0ᰌƀcpr᦭ᦲ᧝ute;䄇̀;abcdsᦿᧀᧄ᧊᧕᧙戩nd;橄rcup;橉Āau᧏᧒p;橋p;橇ot;橀;쀀∩︀Āeo᧢᧥t;恁îړȀaeiu᧰᧻ᨁᨅǰ᧵\0᧸s;橍on;䄍dil耻ç䃧rc;䄉psĀ;sᨌᨍ橌m;橐ot;䄋ƀdmnᨛᨠᨦil肻¸ƭptyv;榲t脀¢;eᨭᨮ䂢räƲr;쀀𝔠ƀceiᨽᩀᩍy;䑇ckĀ;mᩇᩈ朓ark»ᩈ;䏇r΀;Ecefms᩟᩠ᩢᩫ᪤᪪᪮旋;槃ƀ;elᩩᩪᩭ䋆q;扗eɡᩴ\0\0᪈rrowĀlr᩼᪁eft;憺ight;憻ʀRSacd᪒᪔᪖᪚᪟»ཇ;擈st;抛irc;抚ash;抝nint;樐id;櫯cir;槂ubsĀ;u᪻᪼晣it»᪼ˬ᫇᫔᫺\0ᬊonĀ;eᫍᫎ䀺Ā;qÇÆɭ᫙\0\0᫢aĀ;t᫞᫟䀬;䁀ƀ;fl᫨᫩᫫戁îᅠeĀmx᫱᫶ent»᫩eóɍǧ᫾\0ᬇĀ;dኻᬂot;橭nôɆƀfryᬐᬔᬗ;쀀𝕔oäɔ脀©;sŕᬝr;愗Āaoᬥᬩrr;憵ss;朗Ācuᬲᬷr;쀀𝒸Ābpᬼ᭄Ā;eᭁᭂ櫏;櫑Ā;eᭉᭊ櫐;櫒dot;拯΀delprvw᭠᭬᭷ᮂᮬᯔ᯹arrĀlr᭨᭪;椸;椵ɰ᭲\0\0᭵r;拞c;拟arrĀ;p᭿ᮀ憶;椽̀;bcdosᮏᮐᮖᮡᮥᮨ截rcap;橈Āauᮛᮞp;橆p;橊ot;抍r;橅;쀀∪︀Ȁalrv᮵ᮿᯞᯣrrĀ;mᮼᮽ憷;椼yƀevwᯇᯔᯘqɰᯎ\0\0ᯒreã᭳uã᭵ee;拎edge;拏en耻¤䂤earrowĀlrᯮ᯳eft»ᮀight»ᮽeäᯝĀciᰁᰇoninôǷnt;戱lcty;挭ঀAHabcdefhijlorstuwz᰸᰻᰿ᱝᱩᱵᲊᲞᲬᲷ᳻᳿ᴍᵻᶑᶫᶻ᷆᷍rò΁ar;楥Ȁglrs᱈ᱍ᱒᱔ger;怠eth;愸òᄳhĀ;vᱚᱛ怐»ऊūᱡᱧarow;椏aã̕Āayᱮᱳron;䄏;䐴ƀ;ao̲ᱼᲄĀgrʿᲁr;懊tseq;橷ƀglmᲑᲔᲘ耻°䂰ta;䎴ptyv;榱ĀirᲣᲨsht;楿;쀀𝔡arĀlrᲳᲵ»ࣜ»သʀaegsv᳂͸᳖᳜᳠mƀ;oș᳊᳔ndĀ;ș᳑uit;晦amma;䏝in;拲ƀ;io᳧᳨᳸䃷de脀÷;o᳧ᳰntimes;拇nø᳷cy;䑒cɯᴆ\0\0ᴊrn;挞op;挍ʀlptuwᴘᴝᴢᵉᵕlar;䀤f;쀀𝕕ʀ;emps̋ᴭᴷᴽᵂqĀ;d͒ᴳot;扑inus;戸lus;戔quare;抡blebarwedgåúnƀadhᄮᵝᵧownarrowóᲃarpoonĀlrᵲᵶefôᲴighôᲶŢᵿᶅkaro÷གɯᶊ\0\0ᶎrn;挟op;挌ƀcotᶘᶣᶦĀryᶝᶡ;쀀𝒹;䑕l;槶rok;䄑Ādrᶰᶴot;拱iĀ;fᶺ᠖斿Āah᷀᷃ròЩaòྦangle;榦Āci᷒ᷕy;䑟grarr;柿ऀDacdefglmnopqrstuxḁḉḙḸոḼṉṡṾấắẽỡἪἷὄ὎὚ĀDoḆᴴoôᲉĀcsḎḔute耻é䃩ter;橮ȀaioyḢḧḱḶron;䄛rĀ;cḭḮ扖耻ê䃪lon;払;䑍ot;䄗ĀDrṁṅot;扒;쀀𝔢ƀ;rsṐṑṗ檚ave耻è䃨Ā;dṜṝ檖ot;檘Ȁ;ilsṪṫṲṴ檙nters;揧;愓Ā;dṹṺ檕ot;檗ƀapsẅẉẗcr;䄓tyƀ;svẒẓẕ戅et»ẓpĀ1;ẝẤĳạả;怄;怅怃ĀgsẪẬ;䅋p;怂ĀgpẴẸon;䄙f;쀀𝕖ƀalsỄỎỒrĀ;sỊị拕l;槣us;橱iƀ;lvỚớở䎵on»ớ;䏵ȀcsuvỪỳἋἣĀioữḱrc»Ḯɩỹ\0\0ỻíՈantĀglἂἆtr»ṝess»Ṻƀaeiἒ἖Ἒls;䀽st;扟vĀ;DȵἠD;橸parsl;槥ĀDaἯἳot;打rr;楱ƀcdiἾὁỸr;愯oô͒ĀahὉὋ;䎷耻ð䃰Āmrὓὗl耻ë䃫o;悬ƀcipὡὤὧl;䀡sôծĀeoὬὴctatioîՙnentialåչৡᾒ\0ᾞ\0ᾡᾧ\0\0ῆῌ\0ΐ\0ῦῪ \0 ⁚llingdotseñṄy;䑄male;晀ƀilrᾭᾳ῁lig;耀ﬃɩᾹ\0\0᾽g;耀ﬀig;耀ﬄ;쀀𝔣lig;耀ﬁlig;쀀fjƀaltῙ῜ῡt;晭ig;耀ﬂns;斱of;䆒ǰ΅\0ῳf;쀀𝕗ĀakֿῷĀ;vῼ´拔;櫙artint;樍Āao‌⁕Ācs‑⁒α‚‰‸⁅⁈\0⁐β•‥‧‪‬\0‮耻½䂽;慓耻¼䂼;慕;慙;慛Ƴ‴\0‶;慔;慖ʴ‾⁁\0\0⁃耻¾䂾;慗;慜5;慘ƶ⁌\0⁎;慚;慝8;慞l;恄wn;挢cr;쀀𝒻ࢀEabcdefgijlnorstv₂₉₟₥₰₴⃰⃵⃺⃿℃ℒℸ̗ℾ⅒↞Ā;lٍ₇;檌ƀcmpₐₕ₝ute;䇵maĀ;dₜ᳚䎳;檆reve;䄟Āiy₪₮rc;䄝;䐳ot;䄡Ȁ;lqsؾق₽⃉ƀ;qsؾٌ⃄lanô٥Ȁ;cdl٥⃒⃥⃕c;檩otĀ;o⃜⃝檀Ā;l⃢⃣檂;檄Ā;e⃪⃭쀀⋛︀s;檔r;쀀𝔤Ā;gٳ؛mel;愷cy;䑓Ȁ;Eajٚℌℎℐ;檒;檥;檤ȀEaesℛℝ℩ℴ;扩pĀ;p℣ℤ檊rox»ℤĀ;q℮ℯ檈Ā;q℮ℛim;拧pf;쀀𝕘Āci⅃ⅆr;愊mƀ;el٫ⅎ⅐;檎;檐茀>;cdlqr׮ⅠⅪⅮⅳⅹĀciⅥⅧ;檧r;橺ot;拗Par;榕uest;橼ʀadelsↄⅪ←ٖ↛ǰ↉\0↎proø₞r;楸qĀlqؿ↖lesó₈ií٫Āen↣↭rtneqq;쀀≩︀Å↪ԀAabcefkosy⇄⇇⇱⇵⇺∘∝∯≨≽ròΠȀilmr⇐⇔⇗⇛rsðᒄf»․ilôکĀdr⇠⇤cy;䑊ƀ;cwࣴ⇫⇯ir;楈;憭ar;意irc;䄥ƀalr∁∎∓rtsĀ;u∉∊晥it»∊lip;怦con;抹r;쀀𝔥sĀew∣∩arow;椥arow;椦ʀamopr∺∾≃≞≣rr;懿tht;戻kĀlr≉≓eftarrow;憩ightarrow;憪f;쀀𝕙bar;怕ƀclt≯≴≸r;쀀𝒽asè⇴rok;䄧Ābp⊂⊇ull;恃hen»ᱛૡ⊣\0⊪\0⊸⋅⋎\0⋕⋳\0\0⋸⌢⍧⍢⍿\0⎆⎪⎴cute耻í䃭ƀ;iyݱ⊰⊵rc耻î䃮;䐸Ācx⊼⊿y;䐵cl耻¡䂡ĀfrΟ⋉;쀀𝔦rave耻ì䃬Ȁ;inoܾ⋝⋩⋮Āin⋢⋦nt;樌t;戭fin;槜ta;愩lig;䄳ƀaop⋾⌚⌝ƀcgt⌅⌈⌗r;䄫ƀelpܟ⌏⌓inåގarôܠh;䄱f;抷ed;䆵ʀ;cfotӴ⌬⌱⌽⍁are;愅inĀ;t⌸⌹戞ie;槝doô⌙ʀ;celpݗ⍌⍐⍛⍡al;抺Āgr⍕⍙eróᕣã⍍arhk;樗rod;樼Ȁcgpt⍯⍲⍶⍻y;䑑on;䄯f;쀀𝕚a;䎹uest耻¿䂿Āci⎊⎏r;쀀𝒾nʀ;EdsvӴ⎛⎝⎡ӳ;拹ot;拵Ā;v⎦⎧拴;拳Ā;iݷ⎮lde;䄩ǫ⎸\0⎼cy;䑖l耻ï䃯̀cfmosu⏌⏗⏜⏡⏧⏵Āiy⏑⏕rc;䄵;䐹r;쀀𝔧ath;䈷pf;쀀𝕛ǣ⏬\0⏱r;쀀𝒿rcy;䑘kcy;䑔Ѐacfghjos␋␖␢␧␭␱␵␻ppaĀ;v␓␔䎺;䏰Āey␛␠dil;䄷;䐺r;쀀𝔨reen;䄸cy;䑅cy;䑜pf;쀀𝕜cr;쀀𝓀஀ABEHabcdefghjlmnoprstuv⑰⒁⒆⒍⒑┎┽╚▀♎♞♥♹♽⚚⚲⛘❝❨➋⟀⠁⠒ƀart⑷⑺⑼rò৆òΕail;椛arr;椎Ā;gঔ⒋;檋ar;楢ॣ⒥\0⒪\0⒱\0\0\0\0\0⒵Ⓔ\0ⓆⓈⓍ\0⓹ute;䄺mptyv;榴raîࡌbda;䎻gƀ;dlࢎⓁⓃ;榑åࢎ;檅uo耻«䂫rЀ;bfhlpst࢙ⓞⓦⓩ⓫⓮⓱⓵Ā;f࢝ⓣs;椟s;椝ë≒p;憫l;椹im;楳l;憢ƀ;ae⓿─┄檫il;椙Ā;s┉┊檭;쀀⪭︀ƀabr┕┙┝rr;椌rk;杲Āak┢┬cĀek┨┪;䁻;䁛Āes┱┳;榋lĀdu┹┻;榏;榍Ȁaeuy╆╋╖╘ron;䄾Ādi═╔il;䄼ìࢰâ┩;䐻Ȁcqrs╣╦╭╽a;椶uoĀ;rนᝆĀdu╲╷har;楧shar;楋h;憲ʀ;fgqs▋▌উ◳◿扤tʀahlrt▘▤▷◂◨rrowĀ;t࢙□aé⓶arpoonĀdu▯▴own»њp»०eftarrows;懇ightƀahs◍◖◞rrowĀ;sࣴࢧarpoonó྘quigarro÷⇰hreetimes;拋ƀ;qs▋ও◺lanôবʀ;cdgsব☊☍☝☨c;檨otĀ;o☔☕橿Ā;r☚☛檁;檃Ā;e☢☥쀀⋚︀s;檓ʀadegs☳☹☽♉♋pproøⓆot;拖qĀgq♃♅ôউgtò⒌ôছiíলƀilr♕࣡♚sht;楼;쀀𝔩Ā;Eজ♣;檑š♩♶rĀdu▲♮Ā;l॥♳;楪lk;斄cy;䑙ʀ;achtੈ⚈⚋⚑⚖rò◁orneòᴈard;楫ri;旺Āio⚟⚤dot;䅀ustĀ;a⚬⚭掰che»⚭ȀEaes⚻⚽⛉⛔;扨pĀ;p⛃⛄檉rox»⛄Ā;q⛎⛏檇Ā;q⛎⚻im;拦Ѐabnoptwz⛩⛴⛷✚✯❁❇❐Ānr⛮⛱g;柬r;懽rëࣁgƀlmr⛿✍✔eftĀar০✇ightá৲apsto;柼ightá৽parrowĀlr✥✩efô⓭ight;憬ƀafl✶✹✽r;榅;쀀𝕝us;樭imes;樴š❋❏st;戗áፎƀ;ef❗❘᠀旊nge»❘arĀ;l❤❥䀨t;榓ʀachmt❳❶❼➅➇ròࢨorneòᶌarĀ;d྘➃;業;怎ri;抿̀achiqt➘➝ੀ➢➮➻quo;怹r;쀀𝓁mƀ;egল➪➬;檍;檏Ābu┪➳oĀ;rฟ➹;怚rok;䅂萀<;cdhilqrࠫ⟒☹⟜⟠⟥⟪⟰Āci⟗⟙;檦r;橹reå◲mes;拉arr;楶uest;橻ĀPi⟵⟹ar;榖ƀ;ef⠀भ᠛旃rĀdu⠇⠍shar;楊har;楦Āen⠗⠡rtneqq;쀀≨︀Å⠞܀Dacdefhilnopsu⡀⡅⢂⢎⢓⢠⢥⢨⣚⣢⣤ઃ⣳⤂Dot;戺Ȁclpr⡎⡒⡣⡽r耻¯䂯Āet⡗⡙;時Ā;e⡞⡟朠se»⡟Ā;sျ⡨toȀ;dluျ⡳⡷⡻owîҌefôएðᏑker;斮Āoy⢇⢌mma;権;䐼ash;怔asuredangle»ᘦr;쀀𝔪o;愧ƀcdn⢯⢴⣉ro耻µ䂵Ȁ;acdᑤ⢽⣀⣄sôᚧir;櫰ot肻·Ƶusƀ;bd⣒ᤃ⣓戒Ā;uᴼ⣘;横ţ⣞⣡p;櫛ò−ðઁĀdp⣩⣮els;抧f;쀀𝕞Āct⣸⣽r;쀀𝓂pos»ᖝƀ;lm⤉⤊⤍䎼timap;抸ఀGLRVabcdefghijlmoprstuvw⥂⥓⥾⦉⦘⧚⧩⨕⨚⩘⩝⪃⪕⪤⪨⬄⬇⭄⭿⮮ⰴⱧⱼ⳩Āgt⥇⥋;쀀⋙̸Ā;v⥐௏쀀≫⃒ƀelt⥚⥲⥶ftĀar⥡⥧rrow;懍ightarrow;懎;쀀⋘̸Ā;v⥻ే쀀≪⃒ightarrow;懏ĀDd⦎⦓ash;抯ash;抮ʀbcnpt⦣⦧⦬⦱⧌la»˞ute;䅄g;쀀∠⃒ʀ;Eiop඄⦼⧀⧅⧈;쀀⩰̸d;쀀≋̸s;䅉roø඄urĀ;a⧓⧔普lĀ;s⧓ସǳ⧟\0⧣p肻 ଷmpĀ;e௹ఀʀaeouy⧴⧾⨃⨐⨓ǰ⧹\0⧻;橃on;䅈dil;䅆ngĀ;dൾ⨊ot;쀀⩭̸p;橂;䐽ash;怓΀;Aadqsxஒ⨩⨭⨻⩁⩅⩐rr;懗rĀhr⨳⨶k;椤Ā;oᏲᏰot;쀀≐̸uiöୣĀei⩊⩎ar;椨í஘istĀ;s஠டr;쀀𝔫ȀEest௅⩦⩹⩼ƀ;qs஼⩭௡ƀ;qs஼௅⩴lanô௢ií௪Ā;rஶ⪁»ஷƀAap⪊⪍⪑rò⥱rr;憮ar;櫲ƀ;svྍ⪜ྌĀ;d⪡⪢拼;拺cy;䑚΀AEadest⪷⪺⪾⫂⫅⫶⫹rò⥦;쀀≦̸rr;憚r;急Ȁ;fqs఻⫎⫣⫯tĀar⫔⫙rro÷⫁ightarro÷⪐ƀ;qs఻⪺⫪lanôౕĀ;sౕ⫴»శiíౝĀ;rవ⫾iĀ;eచథiäඐĀpt⬌⬑f;쀀𝕟膀¬;in⬙⬚⬶䂬nȀ;Edvஉ⬤⬨⬮;쀀⋹̸ot;쀀⋵̸ǡஉ⬳⬵;拷;拶iĀ;vಸ⬼ǡಸ⭁⭃;拾;拽ƀaor⭋⭣⭩rȀ;ast୻⭕⭚⭟lleì୻l;쀀⫽⃥;쀀∂̸lint;樔ƀ;ceಒ⭰⭳uåಥĀ;cಘ⭸Ā;eಒ⭽ñಘȀAait⮈⮋⮝⮧rò⦈rrƀ;cw⮔⮕⮙憛;쀀⤳̸;쀀↝̸ghtarrow»⮕riĀ;eೋೖ΀chimpqu⮽⯍⯙⬄୸⯤⯯Ȁ;cerല⯆ഷ⯉uå൅;쀀𝓃ortɭ⬅\0\0⯖ará⭖mĀ;e൮⯟Ā;q൴൳suĀbp⯫⯭å೸åഋƀbcp⯶ⰑⰙȀ;Ees⯿ⰀഢⰄ抄;쀀⫅̸etĀ;eഛⰋqĀ;qണⰀcĀ;eലⰗñസȀ;EesⰢⰣൟⰧ抅;쀀⫆̸etĀ;e൘ⰮqĀ;qൠⰣȀgilrⰽⰿⱅⱇìௗlde耻ñ䃱çృiangleĀlrⱒⱜeftĀ;eచⱚñదightĀ;eೋⱥñ೗Ā;mⱬⱭ䎽ƀ;esⱴⱵⱹ䀣ro;愖p;怇ҀDHadgilrsⲏⲔⲙⲞⲣⲰⲶⳓⳣash;抭arr;椄p;쀀≍⃒ash;抬ĀetⲨⲬ;쀀≥⃒;쀀>⃒nfin;槞ƀAetⲽⳁⳅrr;椂;쀀≤⃒Ā;rⳊⳍ쀀<⃒ie;쀀⊴⃒ĀAtⳘⳜrr;椃rie;쀀⊵⃒im;쀀∼⃒ƀAan⳰⳴ⴂrr;懖rĀhr⳺⳽k;椣Ā;oᏧᏥear;椧ቓ᪕\0\0\0\0\0\0\0\0\0\0\0\0\0ⴭ\0ⴸⵈⵠⵥ⵲ⶄᬇ\0\0ⶍⶫ\0ⷈⷎ\0ⷜ⸙⸫⸾⹃Ācsⴱ᪗ute耻ó䃳ĀiyⴼⵅrĀ;c᪞ⵂ耻ô䃴;䐾ʀabios᪠ⵒⵗǈⵚlac;䅑v;樸old;榼lig;䅓Ācr⵩⵭ir;榿;쀀𝔬ͯ⵹\0\0⵼\0ⶂn;䋛ave耻ò䃲;槁Ābmⶈ෴ar;榵Ȁacitⶕ⶘ⶥⶨrò᪀Āir⶝ⶠr;榾oss;榻nå๒;槀ƀaeiⶱⶵⶹcr;䅍ga;䏉ƀcdnⷀⷅǍron;䎿;榶pf;쀀𝕠ƀaelⷔ⷗ǒr;榷rp;榹΀;adiosvⷪⷫⷮ⸈⸍⸐⸖戨rò᪆Ȁ;efmⷷⷸ⸂⸅橝rĀ;oⷾⷿ愴f»ⷿ耻ª䂪耻º䂺gof;抶r;橖lope;橗;橛ƀclo⸟⸡⸧ò⸁ash耻ø䃸l;折iŬⸯ⸴de耻õ䃵esĀ;aǛ⸺s;樶ml耻ö䃶bar;挽ૡ⹞\0⹽\0⺀⺝\0⺢⺹\0\0⻋ຜ\0⼓\0\0⼫⾼\0⿈rȀ;astЃ⹧⹲຅脀¶;l⹭⹮䂶leìЃɩ⹸\0\0⹻m;櫳;櫽y;䐿rʀcimpt⺋⺏⺓ᡥ⺗nt;䀥od;䀮il;怰enk;怱r;쀀𝔭ƀimo⺨⺰⺴Ā;v⺭⺮䏆;䏕maô੶ne;明ƀ;tv⺿⻀⻈䏀chfork»´;䏖Āau⻏⻟nĀck⻕⻝kĀ;h⇴⻛;愎ö⇴sҀ;abcdemst⻳⻴ᤈ⻹⻽⼄⼆⼊⼎䀫cir;樣ir;樢Āouᵀ⼂;樥;橲n肻±ຝim;樦wo;樧ƀipu⼙⼠⼥ntint;樕f;쀀𝕡nd耻£䂣Ԁ;Eaceinosu່⼿⽁⽄⽇⾁⾉⾒⽾⾶;檳p;檷uå໙Ā;c໎⽌̀;acens່⽙⽟⽦⽨⽾pproø⽃urlyeñ໙ñ໎ƀaes⽯⽶⽺pprox;檹qq;檵im;拨iíໟmeĀ;s⾈ຮ怲ƀEas⽸⾐⽺ð⽵ƀdfp໬⾙⾯ƀals⾠⾥⾪lar;挮ine;挒urf;挓Ā;t໻⾴ï໻rel;抰Āci⿀⿅r;쀀𝓅;䏈ncsp;怈̀fiopsu⿚⋢⿟⿥⿫⿱r;쀀𝔮pf;쀀𝕢rime;恗cr;쀀𝓆ƀaeo⿸〉〓tĀei⿾々rnionóڰnt;樖stĀ;e【】䀿ñἙô༔઀ABHabcdefhilmnoprstux぀けさすムㄎㄫㅇㅢㅲㆎ㈆㈕㈤㈩㉘㉮㉲㊐㊰㊷ƀartぇおがròႳòϝail;検aròᱥar;楤΀cdenqrtとふへみわゔヌĀeuねぱ;쀀∽̱te;䅕iãᅮmptyv;榳gȀ;del࿑らるろ;榒;榥å࿑uo耻»䂻rր;abcfhlpstw࿜ガクシスゼゾダッデナp;極Ā;f࿠ゴs;椠;椳s;椞ë≝ð✮l;楅im;楴l;憣;憝Āaiパフil;椚oĀ;nホボ戶aló༞ƀabrョリヮrò៥rk;杳ĀakンヽcĀekヹ・;䁽;䁝Āes㄂㄄;榌lĀduㄊㄌ;榎;榐Ȁaeuyㄗㄜㄧㄩron;䅙Ādiㄡㄥil;䅗ì࿲âヺ;䑀Ȁclqsㄴㄷㄽㅄa;椷dhar;楩uoĀ;rȎȍh;憳ƀacgㅎㅟངlȀ;ipsླྀㅘㅛႜnåႻarôྩt;断ƀilrㅩဣㅮsht;楽;쀀𝔯ĀaoㅷㆆrĀduㅽㅿ»ѻĀ;l႑ㆄ;楬Ā;vㆋㆌ䏁;䏱ƀgns㆕ㇹㇼht̀ahlrstㆤㆰ㇂㇘㇤㇮rrowĀ;t࿜ㆭaéトarpoonĀduㆻㆿowîㅾp»႒eftĀah㇊㇐rrowó࿪arpoonóՑightarrows;應quigarro÷ニhreetimes;拌g;䋚ingdotseñἲƀahm㈍㈐㈓rò࿪aòՑ;怏oustĀ;a㈞㈟掱che»㈟mid;櫮Ȁabpt㈲㈽㉀㉒Ānr㈷㈺g;柭r;懾rëဃƀafl㉇㉊㉎r;榆;쀀𝕣us;樮imes;樵Āap㉝㉧rĀ;g㉣㉤䀩t;榔olint;樒arò㇣Ȁachq㉻㊀Ⴜ㊅quo;怺r;쀀𝓇Ābu・㊊oĀ;rȔȓƀhir㊗㊛㊠reåㇸmes;拊iȀ;efl㊪ၙᠡ㊫方tri;槎luhar;楨;愞ൡ㋕㋛㋟㌬㌸㍱\0㍺㎤\0\0㏬㏰\0㐨㑈㑚㒭㒱㓊㓱\0㘖\0\0㘳cute;䅛quï➺Ԁ;Eaceinpsyᇭ㋳㋵㋿㌂㌋㌏㌟㌦㌩;檴ǰ㋺\0㋼;檸on;䅡uåᇾĀ;dᇳ㌇il;䅟rc;䅝ƀEas㌖㌘㌛;檶p;檺im;择olint;樓iíሄ;䑁otƀ;be㌴ᵇ㌵担;橦΀Aacmstx㍆㍊㍗㍛㍞㍣㍭rr;懘rĀhr㍐㍒ë∨Ā;oਸ਼਴t耻§䂧i;䀻war;椩mĀin㍩ðnuóñt;朶rĀ;o㍶⁕쀀𝔰Ȁacoy㎂㎆㎑㎠rp;景Āhy㎋㎏cy;䑉;䑈rtɭ㎙\0\0㎜iäᑤaraì⹯耻­䂭Āgm㎨㎴maƀ;fv㎱㎲㎲䏃;䏂Ѐ;deglnprካ㏅㏉㏎㏖㏞㏡㏦ot;橪Ā;q኱ኰĀ;E㏓㏔檞;檠Ā;E㏛㏜檝;檟e;扆lus;樤arr;楲aròᄽȀaeit㏸㐈㐏㐗Āls㏽㐄lsetmé㍪hp;樳parsl;槤Ādlᑣ㐔e;挣Ā;e㐜㐝檪Ā;s㐢㐣檬;쀀⪬︀ƀflp㐮㐳㑂tcy;䑌Ā;b㐸㐹䀯Ā;a㐾㐿槄r;挿f;쀀𝕤aĀdr㑍ЂesĀ;u㑔㑕晠it»㑕ƀcsu㑠㑹㒟Āau㑥㑯pĀ;sᆈ㑫;쀀⊓︀pĀ;sᆴ㑵;쀀⊔︀uĀbp㑿㒏ƀ;esᆗᆜ㒆etĀ;eᆗ㒍ñᆝƀ;esᆨᆭ㒖etĀ;eᆨ㒝ñᆮƀ;afᅻ㒦ְrť㒫ֱ»ᅼaròᅈȀcemt㒹㒾㓂㓅r;쀀𝓈tmîñiì㐕aræᆾĀar㓎㓕rĀ;f㓔ឿ昆Āan㓚㓭ightĀep㓣㓪psiloîỠhé⺯s»⡒ʀbcmnp㓻㕞ሉ㖋㖎Ҁ;Edemnprs㔎㔏㔑㔕㔞㔣㔬㔱㔶抂;櫅ot;檽Ā;dᇚ㔚ot;櫃ult;櫁ĀEe㔨㔪;櫋;把lus;檿arr;楹ƀeiu㔽㕒㕕tƀ;en㔎㕅㕋qĀ;qᇚ㔏eqĀ;q㔫㔨m;櫇Ābp㕚㕜;櫕;櫓c̀;acensᇭ㕬㕲㕹㕻㌦pproø㋺urlyeñᇾñᇳƀaes㖂㖈㌛pproø㌚qñ㌗g;晪ڀ123;Edehlmnps㖩㖬㖯ሜ㖲㖴㗀㗉㗕㗚㗟㗨㗭耻¹䂹耻²䂲耻³䂳;櫆Āos㖹㖼t;檾ub;櫘Ā;dሢ㗅ot;櫄sĀou㗏㗒l;柉b;櫗arr;楻ult;櫂ĀEe㗤㗦;櫌;抋lus;櫀ƀeiu㗴㘉㘌tƀ;enሜ㗼㘂qĀ;qሢ㖲eqĀ;q㗧㗤m;櫈Ābp㘑㘓;櫔;櫖ƀAan㘜㘠㘭rr;懙rĀhr㘦㘨ë∮Ā;oਫ਩war;椪lig耻ß䃟௡㙑㙝㙠ዎ㙳㙹\0㙾㛂\0\0\0\0\0㛛㜃\0㜉㝬\0\0\0㞇ɲ㙖\0\0㙛get;挖;䏄rë๟ƀaey㙦㙫㙰ron;䅥dil;䅣;䑂lrec;挕r;쀀𝔱Ȁeiko㚆㚝㚵㚼ǲ㚋\0㚑eĀ4fኄኁaƀ;sv㚘㚙㚛䎸ym;䏑Ācn㚢㚲kĀas㚨㚮pproø዁im»ኬsðኞĀas㚺㚮ð዁rn耻þ䃾Ǭ̟㛆⋧es膀×;bd㛏㛐㛘䃗Ā;aᤏ㛕r;樱;樰ƀeps㛡㛣㜀á⩍Ȁ;bcf҆㛬㛰㛴ot;挶ir;櫱Ā;o㛹㛼쀀𝕥rk;櫚á㍢rime;怴ƀaip㜏㜒㝤dåቈ΀adempst㜡㝍㝀㝑㝗㝜㝟ngleʀ;dlqr㜰㜱㜶㝀㝂斵own»ᶻeftĀ;e⠀㜾ñम;扜ightĀ;e㊪㝋ñၚot;旬inus;樺lus;樹b;槍ime;樻ezium;揢ƀcht㝲㝽㞁Āry㝷㝻;쀀𝓉;䑆cy;䑛rok;䅧Āio㞋㞎xô᝷headĀlr㞗㞠eftarro÷ࡏightarrow»ཝऀAHabcdfghlmoprstuw㟐㟓㟗㟤㟰㟼㠎㠜㠣㠴㡑㡝㡫㢩㣌㣒㣪㣶ròϭar;楣Ācr㟜㟢ute耻ú䃺òᅐrǣ㟪\0㟭y;䑞ve;䅭Āiy㟵㟺rc耻û䃻;䑃ƀabh㠃㠆㠋ròᎭlac;䅱aòᏃĀir㠓㠘sht;楾;쀀𝔲rave耻ù䃹š㠧㠱rĀlr㠬㠮»ॗ»ႃlk;斀Āct㠹㡍ɯ㠿\0\0㡊rnĀ;e㡅㡆挜r»㡆op;挏ri;旸Āal㡖㡚cr;䅫肻¨͉Āgp㡢㡦on;䅳f;쀀𝕦̀adhlsuᅋ㡸㡽፲㢑㢠ownáᎳarpoonĀlr㢈㢌efô㠭ighô㠯iƀ;hl㢙㢚㢜䏅»ᏺon»㢚parrows;懈ƀcit㢰㣄㣈ɯ㢶\0\0㣁rnĀ;e㢼㢽挝r»㢽op;挎ng;䅯ri;旹cr;쀀𝓊ƀdir㣙㣝㣢ot;拰lde;䅩iĀ;f㜰㣨»᠓Āam㣯㣲rò㢨l耻ü䃼angle;榧ހABDacdeflnoprsz㤜㤟㤩㤭㦵㦸㦽㧟㧤㧨㧳㧹㧽㨁㨠ròϷarĀ;v㤦㤧櫨;櫩asèϡĀnr㤲㤷grt;榜΀eknprst㓣㥆㥋㥒㥝㥤㦖appá␕othinçẖƀhir㓫⻈㥙opô⾵Ā;hᎷ㥢ïㆍĀiu㥩㥭gmá㎳Ābp㥲㦄setneqĀ;q㥽㦀쀀⊊︀;쀀⫋︀setneqĀ;q㦏㦒쀀⊋︀;쀀⫌︀Āhr㦛㦟etá㚜iangleĀlr㦪㦯eft»थight»ၑy;䐲ash»ံƀelr㧄㧒㧗ƀ;beⷪ㧋㧏ar;抻q;扚lip;拮Ābt㧜ᑨaòᑩr;쀀𝔳tré㦮suĀbp㧯㧱»ജ»൙pf;쀀𝕧roð໻tré㦴Ācu㨆㨋r;쀀𝓋Ābp㨐㨘nĀEe㦀㨖»㥾nĀEe㦒㨞»㦐igzag;榚΀cefoprs㨶㨻㩖㩛㩔㩡㩪irc;䅵Ādi㩀㩑Ābg㩅㩉ar;機eĀ;qᗺ㩏;扙erp;愘r;쀀𝔴pf;쀀𝕨Ā;eᑹ㩦atèᑹcr;쀀𝓌ૣណ㪇\0㪋\0㪐㪛\0\0㪝㪨㪫㪯\0\0㫃㫎\0㫘ៜ៟tré៑r;쀀𝔵ĀAa㪔㪗ròσrò৶;䎾ĀAa㪡㪤ròθrò৫að✓is;拻ƀdptឤ㪵㪾Āfl㪺ឩ;쀀𝕩imåឲĀAa㫇㫊ròώròਁĀcq㫒ីr;쀀𝓍Āpt៖㫜ré។Ѐacefiosu㫰㫽㬈㬌㬑㬕㬛㬡cĀuy㫶㫻te耻ý䃽;䑏Āiy㬂㬆rc;䅷;䑋n耻¥䂥r;쀀𝔶cy;䑗pf;쀀𝕪cr;쀀𝓎Ācm㬦㬩y;䑎l耻ÿ䃿Ԁacdefhiosw㭂㭈㭔㭘㭤㭩㭭㭴㭺㮀cute;䅺Āay㭍㭒ron;䅾;䐷ot;䅼Āet㭝㭡træᕟa;䎶r;쀀𝔷cy;䐶grarr;懝pf;쀀𝕫cr;쀀𝓏Ājn㮅㮇;怍j;怌'.split("").map((c) => c.charCodeAt(0)),
)
const xmlDecodeTree = /* @__PURE__ */ new Uint16Array(
  // prettier-ignore
  /* @__PURE__ */ "Ȁaglq	\x1Bɭ\0\0p;䀦os;䀧t;䀾t;䀼uot;䀢".split("").map((c) => c.charCodeAt(0)),
)
var _a
const decodeMap = /* @__PURE__ */ new Map([
  [0, 65533],
  // C1 Unicode control character reference replacements
  [128, 8364],
  [130, 8218],
  [131, 402],
  [132, 8222],
  [133, 8230],
  [134, 8224],
  [135, 8225],
  [136, 710],
  [137, 8240],
  [138, 352],
  [139, 8249],
  [140, 338],
  [142, 381],
  [145, 8216],
  [146, 8217],
  [147, 8220],
  [148, 8221],
  [149, 8226],
  [150, 8211],
  [151, 8212],
  [152, 732],
  [153, 8482],
  [154, 353],
  [155, 8250],
  [156, 339],
  [158, 382],
  [159, 376],
])
const fromCodePoint =
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, n/no-unsupported-features/es-builtins
  (_a = String.fromCodePoint) !== null && _a !== void 0
    ? _a
    : function (codePoint) {
        let output = ''
        if (codePoint > 65535) {
          codePoint -= 65536
          output += String.fromCharCode(((codePoint >>> 10) & 1023) | 55296)
          codePoint = 56320 | (codePoint & 1023)
        }
        output += String.fromCharCode(codePoint)
        return output
      }
function replaceCodePoint(codePoint) {
  var _a2
  if ((codePoint >= 55296 && codePoint <= 57343) || codePoint > 1114111) {
    return 65533
  }
  return (_a2 = decodeMap.get(codePoint)) !== null && _a2 !== void 0 ? _a2 : codePoint
}
var CharCodes$1
;(function (CharCodes2) {
  CharCodes2[(CharCodes2['NUM'] = 35)] = 'NUM'
  CharCodes2[(CharCodes2['SEMI'] = 59)] = 'SEMI'
  CharCodes2[(CharCodes2['EQUALS'] = 61)] = 'EQUALS'
  CharCodes2[(CharCodes2['ZERO'] = 48)] = 'ZERO'
  CharCodes2[(CharCodes2['NINE'] = 57)] = 'NINE'
  CharCodes2[(CharCodes2['LOWER_A'] = 97)] = 'LOWER_A'
  CharCodes2[(CharCodes2['LOWER_F'] = 102)] = 'LOWER_F'
  CharCodes2[(CharCodes2['LOWER_X'] = 120)] = 'LOWER_X'
  CharCodes2[(CharCodes2['LOWER_Z'] = 122)] = 'LOWER_Z'
  CharCodes2[(CharCodes2['UPPER_A'] = 65)] = 'UPPER_A'
  CharCodes2[(CharCodes2['UPPER_F'] = 70)] = 'UPPER_F'
  CharCodes2[(CharCodes2['UPPER_Z'] = 90)] = 'UPPER_Z'
})(CharCodes$1 || (CharCodes$1 = {}))
const TO_LOWER_BIT = 32
var BinTrieFlags
;(function (BinTrieFlags2) {
  BinTrieFlags2[(BinTrieFlags2['VALUE_LENGTH'] = 49152)] = 'VALUE_LENGTH'
  BinTrieFlags2[(BinTrieFlags2['BRANCH_LENGTH'] = 16256)] = 'BRANCH_LENGTH'
  BinTrieFlags2[(BinTrieFlags2['JUMP_TABLE'] = 127)] = 'JUMP_TABLE'
})(BinTrieFlags || (BinTrieFlags = {}))
function isNumber(code) {
  return code >= CharCodes$1.ZERO && code <= CharCodes$1.NINE
}
function isHexadecimalCharacter(code) {
  return (
    (code >= CharCodes$1.UPPER_A && code <= CharCodes$1.UPPER_F) ||
    (code >= CharCodes$1.LOWER_A && code <= CharCodes$1.LOWER_F)
  )
}
function isAsciiAlphaNumeric(code) {
  return (
    (code >= CharCodes$1.UPPER_A && code <= CharCodes$1.UPPER_Z) ||
    (code >= CharCodes$1.LOWER_A && code <= CharCodes$1.LOWER_Z) ||
    isNumber(code)
  )
}
function isEntityInAttributeInvalidEnd(code) {
  return code === CharCodes$1.EQUALS || isAsciiAlphaNumeric(code)
}
var EntityDecoderState
;(function (EntityDecoderState2) {
  EntityDecoderState2[(EntityDecoderState2['EntityStart'] = 0)] = 'EntityStart'
  EntityDecoderState2[(EntityDecoderState2['NumericStart'] = 1)] = 'NumericStart'
  EntityDecoderState2[(EntityDecoderState2['NumericDecimal'] = 2)] = 'NumericDecimal'
  EntityDecoderState2[(EntityDecoderState2['NumericHex'] = 3)] = 'NumericHex'
  EntityDecoderState2[(EntityDecoderState2['NamedEntity'] = 4)] = 'NamedEntity'
})(EntityDecoderState || (EntityDecoderState = {}))
var DecodingMode
;(function (DecodingMode2) {
  DecodingMode2[(DecodingMode2['Legacy'] = 0)] = 'Legacy'
  DecodingMode2[(DecodingMode2['Strict'] = 1)] = 'Strict'
  DecodingMode2[(DecodingMode2['Attribute'] = 2)] = 'Attribute'
})(DecodingMode || (DecodingMode = {}))
class EntityDecoder {
  constructor(decodeTree, emitCodePoint, errors) {
    this.decodeTree = decodeTree
    this.emitCodePoint = emitCodePoint
    this.errors = errors
    this.state = EntityDecoderState.EntityStart
    this.consumed = 1
    this.result = 0
    this.treeIndex = 0
    this.excess = 1
    this.decodeMode = DecodingMode.Strict
  }
  /** Resets the instance to make it reusable. */
  startEntity(decodeMode) {
    this.decodeMode = decodeMode
    this.state = EntityDecoderState.EntityStart
    this.result = 0
    this.treeIndex = 0
    this.excess = 1
    this.consumed = 1
  }
  /**
   * Write an entity to the decoder. This can be called multiple times with partial entities.
   * If the entity is incomplete, the decoder will return -1.
   *
   * Mirrors the implementation of `getDecoder`, but with the ability to stop decoding if the
   * entity is incomplete, and resume when the next string is written.
   *
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The offset at which the entity begins. Should be 0 if this is not the first call.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  write(input, offset) {
    switch (this.state) {
      case EntityDecoderState.EntityStart: {
        if (input.charCodeAt(offset) === CharCodes$1.NUM) {
          this.state = EntityDecoderState.NumericStart
          this.consumed += 1
          return this.stateNumericStart(input, offset + 1)
        }
        this.state = EntityDecoderState.NamedEntity
        return this.stateNamedEntity(input, offset)
      }
      case EntityDecoderState.NumericStart: {
        return this.stateNumericStart(input, offset)
      }
      case EntityDecoderState.NumericDecimal: {
        return this.stateNumericDecimal(input, offset)
      }
      case EntityDecoderState.NumericHex: {
        return this.stateNumericHex(input, offset)
      }
      case EntityDecoderState.NamedEntity: {
        return this.stateNamedEntity(input, offset)
      }
    }
  }
  /**
   * Switches between the numeric decimal and hexadecimal states.
   *
   * Equivalent to the `Numeric character reference state` in the HTML spec.
   *
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNumericStart(input, offset) {
    if (offset >= input.length) {
      return -1
    }
    if ((input.charCodeAt(offset) | TO_LOWER_BIT) === CharCodes$1.LOWER_X) {
      this.state = EntityDecoderState.NumericHex
      this.consumed += 1
      return this.stateNumericHex(input, offset + 1)
    }
    this.state = EntityDecoderState.NumericDecimal
    return this.stateNumericDecimal(input, offset)
  }
  addToNumericResult(input, start, end, base) {
    if (start !== end) {
      const digitCount = end - start
      this.result =
        this.result * Math.pow(base, digitCount) +
        Number.parseInt(input.substr(start, digitCount), base)
      this.consumed += digitCount
    }
  }
  /**
   * Parses a hexadecimal numeric entity.
   *
   * Equivalent to the `Hexademical character reference state` in the HTML spec.
   *
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNumericHex(input, offset) {
    const startIndex = offset
    while (offset < input.length) {
      const char = input.charCodeAt(offset)
      if (isNumber(char) || isHexadecimalCharacter(char)) {
        offset += 1
      } else {
        this.addToNumericResult(input, startIndex, offset, 16)
        return this.emitNumericEntity(char, 3)
      }
    }
    this.addToNumericResult(input, startIndex, offset, 16)
    return -1
  }
  /**
   * Parses a decimal numeric entity.
   *
   * Equivalent to the `Decimal character reference state` in the HTML spec.
   *
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNumericDecimal(input, offset) {
    const startIndex = offset
    while (offset < input.length) {
      const char = input.charCodeAt(offset)
      if (isNumber(char)) {
        offset += 1
      } else {
        this.addToNumericResult(input, startIndex, offset, 10)
        return this.emitNumericEntity(char, 2)
      }
    }
    this.addToNumericResult(input, startIndex, offset, 10)
    return -1
  }
  /**
   * Validate and emit a numeric entity.
   *
   * Implements the logic from the `Hexademical character reference start
   * state` and `Numeric character reference end state` in the HTML spec.
   *
   * @param lastCp The last code point of the entity. Used to see if the
   *               entity was terminated with a semicolon.
   * @param expectedLength The minimum number of characters that should be
   *                       consumed. Used to validate that at least one digit
   *                       was consumed.
   * @returns The number of characters that were consumed.
   */
  emitNumericEntity(lastCp, expectedLength) {
    var _a2
    if (this.consumed <= expectedLength) {
      ;(_a2 = this.errors) === null || _a2 === void 0
        ? void 0
        : _a2.absenceOfDigitsInNumericCharacterReference(this.consumed)
      return 0
    }
    if (lastCp === CharCodes$1.SEMI) {
      this.consumed += 1
    } else if (this.decodeMode === DecodingMode.Strict) {
      return 0
    }
    this.emitCodePoint(replaceCodePoint(this.result), this.consumed)
    if (this.errors) {
      if (lastCp !== CharCodes$1.SEMI) {
        this.errors.missingSemicolonAfterCharacterReference()
      }
      this.errors.validateNumericCharacterReference(this.result)
    }
    return this.consumed
  }
  /**
   * Parses a named entity.
   *
   * Equivalent to the `Named character reference state` in the HTML spec.
   *
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNamedEntity(input, offset) {
    const { decodeTree } = this
    let current = decodeTree[this.treeIndex]
    let valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14
    for (; offset < input.length; offset++, this.excess++) {
      const char = input.charCodeAt(offset)
      this.treeIndex = determineBranch(
        decodeTree,
        current,
        this.treeIndex + Math.max(1, valueLength),
        char,
      )
      if (this.treeIndex < 0) {
        return this.result === 0 || // If we are parsing an attribute
          (this.decodeMode === DecodingMode.Attribute && // We shouldn't have consumed any characters after the entity,
            (valueLength === 0 || // And there should be no invalid characters.
              isEntityInAttributeInvalidEnd(char)))
          ? 0
          : this.emitNotTerminatedNamedEntity()
      }
      current = decodeTree[this.treeIndex]
      valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14
      if (valueLength !== 0) {
        if (char === CharCodes$1.SEMI) {
          return this.emitNamedEntityData(this.treeIndex, valueLength, this.consumed + this.excess)
        }
        if (this.decodeMode !== DecodingMode.Strict) {
          this.result = this.treeIndex
          this.consumed += this.excess
          this.excess = 0
        }
      }
    }
    return -1
  }
  /**
   * Emit a named entity that was not terminated with a semicolon.
   *
   * @returns The number of characters consumed.
   */
  emitNotTerminatedNamedEntity() {
    var _a2
    const { result, decodeTree } = this
    const valueLength = (decodeTree[result] & BinTrieFlags.VALUE_LENGTH) >> 14
    this.emitNamedEntityData(result, valueLength, this.consumed)
    ;(_a2 = this.errors) === null || _a2 === void 0
      ? void 0
      : _a2.missingSemicolonAfterCharacterReference()
    return this.consumed
  }
  /**
   * Emit a named entity.
   *
   * @param result The index of the entity in the decode tree.
   * @param valueLength The number of bytes in the entity.
   * @param consumed The number of characters consumed.
   *
   * @returns The number of characters consumed.
   */
  emitNamedEntityData(result, valueLength, consumed) {
    const { decodeTree } = this
    this.emitCodePoint(
      valueLength === 1 ? decodeTree[result] & ~BinTrieFlags.VALUE_LENGTH : decodeTree[result + 1],
      consumed,
    )
    if (valueLength === 3) {
      this.emitCodePoint(decodeTree[result + 2], consumed)
    }
    return consumed
  }
  /**
   * Signal to the parser that the end of the input was reached.
   *
   * Remaining data will be emitted and relevant errors will be produced.
   *
   * @returns The number of characters consumed.
   */
  end() {
    var _a2
    switch (this.state) {
      case EntityDecoderState.NamedEntity: {
        return this.result !== 0 &&
          (this.decodeMode !== DecodingMode.Attribute || this.result === this.treeIndex)
          ? this.emitNotTerminatedNamedEntity()
          : 0
      }
      case EntityDecoderState.NumericDecimal: {
        return this.emitNumericEntity(0, 2)
      }
      case EntityDecoderState.NumericHex: {
        return this.emitNumericEntity(0, 3)
      }
      case EntityDecoderState.NumericStart: {
        ;(_a2 = this.errors) === null || _a2 === void 0
          ? void 0
          : _a2.absenceOfDigitsInNumericCharacterReference(this.consumed)
        return 0
      }
      case EntityDecoderState.EntityStart: {
        return 0
      }
    }
  }
}
function determineBranch(decodeTree, current, nodeIndex, char) {
  const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7
  const jumpOffset = current & BinTrieFlags.JUMP_TABLE
  if (branchCount === 0) {
    return jumpOffset !== 0 && char === jumpOffset ? nodeIndex : -1
  }
  if (jumpOffset) {
    const value = char - jumpOffset
    return value < 0 || value >= branchCount ? -1 : decodeTree[nodeIndex + value] - 1
  }
  let lo = nodeIndex
  let hi = lo + branchCount - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const midValue = decodeTree[mid]
    if (midValue < char) {
      lo = mid + 1
    } else if (midValue > char) {
      hi = mid - 1
    } else {
      return decodeTree[mid + branchCount]
    }
  }
  return -1
}
var CharCodes
;(function (CharCodes2) {
  CharCodes2[(CharCodes2['Tab'] = 9)] = 'Tab'
  CharCodes2[(CharCodes2['NewLine'] = 10)] = 'NewLine'
  CharCodes2[(CharCodes2['FormFeed'] = 12)] = 'FormFeed'
  CharCodes2[(CharCodes2['CarriageReturn'] = 13)] = 'CarriageReturn'
  CharCodes2[(CharCodes2['Space'] = 32)] = 'Space'
  CharCodes2[(CharCodes2['ExclamationMark'] = 33)] = 'ExclamationMark'
  CharCodes2[(CharCodes2['Number'] = 35)] = 'Number'
  CharCodes2[(CharCodes2['Amp'] = 38)] = 'Amp'
  CharCodes2[(CharCodes2['SingleQuote'] = 39)] = 'SingleQuote'
  CharCodes2[(CharCodes2['DoubleQuote'] = 34)] = 'DoubleQuote'
  CharCodes2[(CharCodes2['Dash'] = 45)] = 'Dash'
  CharCodes2[(CharCodes2['Slash'] = 47)] = 'Slash'
  CharCodes2[(CharCodes2['Zero'] = 48)] = 'Zero'
  CharCodes2[(CharCodes2['Nine'] = 57)] = 'Nine'
  CharCodes2[(CharCodes2['Semi'] = 59)] = 'Semi'
  CharCodes2[(CharCodes2['Lt'] = 60)] = 'Lt'
  CharCodes2[(CharCodes2['Eq'] = 61)] = 'Eq'
  CharCodes2[(CharCodes2['Gt'] = 62)] = 'Gt'
  CharCodes2[(CharCodes2['Questionmark'] = 63)] = 'Questionmark'
  CharCodes2[(CharCodes2['UpperA'] = 65)] = 'UpperA'
  CharCodes2[(CharCodes2['LowerA'] = 97)] = 'LowerA'
  CharCodes2[(CharCodes2['UpperF'] = 70)] = 'UpperF'
  CharCodes2[(CharCodes2['LowerF'] = 102)] = 'LowerF'
  CharCodes2[(CharCodes2['UpperZ'] = 90)] = 'UpperZ'
  CharCodes2[(CharCodes2['LowerZ'] = 122)] = 'LowerZ'
  CharCodes2[(CharCodes2['LowerX'] = 120)] = 'LowerX'
  CharCodes2[(CharCodes2['OpeningSquareBracket'] = 91)] = 'OpeningSquareBracket'
})(CharCodes || (CharCodes = {}))
var State
;(function (State2) {
  State2[(State2['Text'] = 1)] = 'Text'
  State2[(State2['BeforeTagName'] = 2)] = 'BeforeTagName'
  State2[(State2['InTagName'] = 3)] = 'InTagName'
  State2[(State2['InSelfClosingTag'] = 4)] = 'InSelfClosingTag'
  State2[(State2['BeforeClosingTagName'] = 5)] = 'BeforeClosingTagName'
  State2[(State2['InClosingTagName'] = 6)] = 'InClosingTagName'
  State2[(State2['AfterClosingTagName'] = 7)] = 'AfterClosingTagName'
  State2[(State2['BeforeAttributeName'] = 8)] = 'BeforeAttributeName'
  State2[(State2['InAttributeName'] = 9)] = 'InAttributeName'
  State2[(State2['AfterAttributeName'] = 10)] = 'AfterAttributeName'
  State2[(State2['BeforeAttributeValue'] = 11)] = 'BeforeAttributeValue'
  State2[(State2['InAttributeValueDq'] = 12)] = 'InAttributeValueDq'
  State2[(State2['InAttributeValueSq'] = 13)] = 'InAttributeValueSq'
  State2[(State2['InAttributeValueNq'] = 14)] = 'InAttributeValueNq'
  State2[(State2['BeforeDeclaration'] = 15)] = 'BeforeDeclaration'
  State2[(State2['InDeclaration'] = 16)] = 'InDeclaration'
  State2[(State2['InProcessingInstruction'] = 17)] = 'InProcessingInstruction'
  State2[(State2['BeforeComment'] = 18)] = 'BeforeComment'
  State2[(State2['CDATASequence'] = 19)] = 'CDATASequence'
  State2[(State2['InSpecialComment'] = 20)] = 'InSpecialComment'
  State2[(State2['InCommentLike'] = 21)] = 'InCommentLike'
  State2[(State2['BeforeSpecialS'] = 22)] = 'BeforeSpecialS'
  State2[(State2['BeforeSpecialT'] = 23)] = 'BeforeSpecialT'
  State2[(State2['SpecialStartSequence'] = 24)] = 'SpecialStartSequence'
  State2[(State2['InSpecialTag'] = 25)] = 'InSpecialTag'
  State2[(State2['InEntity'] = 26)] = 'InEntity'
})(State || (State = {}))
function isWhitespace(c) {
  return (
    c === CharCodes.Space ||
    c === CharCodes.NewLine ||
    c === CharCodes.Tab ||
    c === CharCodes.FormFeed ||
    c === CharCodes.CarriageReturn
  )
}
function isEndOfTagSection(c) {
  return c === CharCodes.Slash || c === CharCodes.Gt || isWhitespace(c)
}
function isASCIIAlpha(c) {
  return (
    (c >= CharCodes.LowerA && c <= CharCodes.LowerZ) ||
    (c >= CharCodes.UpperA && c <= CharCodes.UpperZ)
  )
}
var QuoteType
;(function (QuoteType2) {
  QuoteType2[(QuoteType2['NoValue'] = 0)] = 'NoValue'
  QuoteType2[(QuoteType2['Unquoted'] = 1)] = 'Unquoted'
  QuoteType2[(QuoteType2['Single'] = 2)] = 'Single'
  QuoteType2[(QuoteType2['Double'] = 3)] = 'Double'
})(QuoteType || (QuoteType = {}))
const Sequences = {
  Cdata: new Uint8Array([67, 68, 65, 84, 65, 91]),
  // CDATA[
  CdataEnd: new Uint8Array([93, 93, 62]),
  // ]]>
  CommentEnd: new Uint8Array([45, 45, 62]),
  // `-->`
  ScriptEnd: new Uint8Array([60, 47, 115, 99, 114, 105, 112, 116]),
  // `<\/script`
  StyleEnd: new Uint8Array([60, 47, 115, 116, 121, 108, 101]),
  // `</style`
  TitleEnd: new Uint8Array([60, 47, 116, 105, 116, 108, 101]),
  // `</title`
  TextareaEnd: new Uint8Array([60, 47, 116, 101, 120, 116, 97, 114, 101, 97]),
  // `</textarea`
  XmpEnd: new Uint8Array([60, 47, 120, 109, 112]),
  // `</xmp`
}
class Tokenizer {
  constructor({ xmlMode = false, decodeEntities = true }, cbs) {
    this.cbs = cbs
    this.state = State.Text
    this.buffer = ''
    this.sectionStart = 0
    this.index = 0
    this.entityStart = 0
    this.baseState = State.Text
    this.isSpecial = false
    this.running = true
    this.offset = 0
    this.currentSequence = void 0
    this.sequenceIndex = 0
    this.xmlMode = xmlMode
    this.decodeEntities = decodeEntities
    this.entityDecoder = new EntityDecoder(
      xmlMode ? xmlDecodeTree : htmlDecodeTree,
      (cp, consumed) => this.emitCodePoint(cp, consumed),
    )
  }
  reset() {
    this.state = State.Text
    this.buffer = ''
    this.sectionStart = 0
    this.index = 0
    this.baseState = State.Text
    this.currentSequence = void 0
    this.running = true
    this.offset = 0
  }
  write(chunk) {
    this.offset += this.buffer.length
    this.buffer = chunk
    this.parse()
  }
  end() {
    if (this.running) this.finish()
  }
  pause() {
    this.running = false
  }
  resume() {
    this.running = true
    if (this.index < this.buffer.length + this.offset) {
      this.parse()
    }
  }
  stateText(c) {
    if (c === CharCodes.Lt || (!this.decodeEntities && this.fastForwardTo(CharCodes.Lt))) {
      if (this.index > this.sectionStart) {
        this.cbs.ontext(this.sectionStart, this.index)
      }
      this.state = State.BeforeTagName
      this.sectionStart = this.index
    } else if (this.decodeEntities && c === CharCodes.Amp) {
      this.startEntity()
    }
  }
  stateSpecialStartSequence(c) {
    const isEnd = this.sequenceIndex === this.currentSequence.length
    const isMatch = isEnd
      ? // If we are at the end of the sequence, make sure the tag name has ended
        isEndOfTagSection(c)
      : // Otherwise, do a case-insensitive comparison
        (c | 32) === this.currentSequence[this.sequenceIndex]
    if (!isMatch) {
      this.isSpecial = false
    } else if (!isEnd) {
      this.sequenceIndex++
      return
    }
    this.sequenceIndex = 0
    this.state = State.InTagName
    this.stateInTagName(c)
  }
  /** Look for an end tag. For <title> tags, also decode entities. */
  stateInSpecialTag(c) {
    if (this.sequenceIndex === this.currentSequence.length) {
      if (c === CharCodes.Gt || isWhitespace(c)) {
        const endOfText = this.index - this.currentSequence.length
        if (this.sectionStart < endOfText) {
          const actualIndex = this.index
          this.index = endOfText
          this.cbs.ontext(this.sectionStart, endOfText)
          this.index = actualIndex
        }
        this.isSpecial = false
        this.sectionStart = endOfText + 2
        this.stateInClosingTagName(c)
        return
      }
      this.sequenceIndex = 0
    }
    if ((c | 32) === this.currentSequence[this.sequenceIndex]) {
      this.sequenceIndex += 1
    } else if (this.sequenceIndex === 0) {
      if (this.currentSequence === Sequences.TitleEnd) {
        if (this.decodeEntities && c === CharCodes.Amp) {
          this.startEntity()
        }
      } else if (this.fastForwardTo(CharCodes.Lt)) {
        this.sequenceIndex = 1
      }
    } else {
      this.sequenceIndex = Number(c === CharCodes.Lt)
    }
  }
  stateCDATASequence(c) {
    if (c === Sequences.Cdata[this.sequenceIndex]) {
      if (++this.sequenceIndex === Sequences.Cdata.length) {
        this.state = State.InCommentLike
        this.currentSequence = Sequences.CdataEnd
        this.sequenceIndex = 0
        this.sectionStart = this.index + 1
      }
    } else {
      this.sequenceIndex = 0
      this.state = State.InDeclaration
      this.stateInDeclaration(c)
    }
  }
  /**
   * When we wait for one specific character, we can speed things up
   * by skipping through the buffer until we find it.
   *
   * @returns Whether the character was found.
   */
  fastForwardTo(c) {
    while (++this.index < this.buffer.length + this.offset) {
      if (this.buffer.charCodeAt(this.index - this.offset) === c) {
        return true
      }
    }
    this.index = this.buffer.length + this.offset - 1
    return false
  }
  /**
   * Comments and CDATA end with `-->` and `]]>`.
   *
   * Their common qualities are:
   * - Their end sequences have a distinct character they start with.
   * - That character is then repeated, so we have to check multiple repeats.
   * - All characters but the start character of the sequence can be skipped.
   */
  stateInCommentLike(c) {
    if (c === this.currentSequence[this.sequenceIndex]) {
      if (++this.sequenceIndex === this.currentSequence.length) {
        if (this.currentSequence === Sequences.CdataEnd) {
          this.cbs.oncdata(this.sectionStart, this.index, 2)
        } else {
          this.cbs.oncomment(this.sectionStart, this.index, 2)
        }
        this.sequenceIndex = 0
        this.sectionStart = this.index + 1
        this.state = State.Text
      }
    } else if (this.sequenceIndex === 0) {
      if (this.fastForwardTo(this.currentSequence[0])) {
        this.sequenceIndex = 1
      }
    } else if (c !== this.currentSequence[this.sequenceIndex - 1]) {
      this.sequenceIndex = 0
    }
  }
  /**
   * HTML only allows ASCII alpha characters (a-z and A-Z) at the beginning of a tag name.
   *
   * XML allows a lot more characters here (@see https://www.w3.org/TR/REC-xml/#NT-NameStartChar).
   * We allow anything that wouldn't end the tag.
   */
  isTagStartChar(c) {
    return this.xmlMode ? !isEndOfTagSection(c) : isASCIIAlpha(c)
  }
  startSpecial(sequence, offset) {
    this.isSpecial = true
    this.currentSequence = sequence
    this.sequenceIndex = offset
    this.state = State.SpecialStartSequence
  }
  stateBeforeTagName(c) {
    if (c === CharCodes.ExclamationMark) {
      this.state = State.BeforeDeclaration
      this.sectionStart = this.index + 1
    } else if (c === CharCodes.Questionmark) {
      this.state = State.InProcessingInstruction
      this.sectionStart = this.index + 1
    } else if (this.isTagStartChar(c)) {
      const lower = c | 32
      this.sectionStart = this.index
      if (this.xmlMode) {
        this.state = State.InTagName
      } else if (lower === Sequences.ScriptEnd[2]) {
        this.state = State.BeforeSpecialS
      } else if (lower === Sequences.TitleEnd[2] || lower === Sequences.XmpEnd[2]) {
        this.state = State.BeforeSpecialT
      } else {
        this.state = State.InTagName
      }
    } else if (c === CharCodes.Slash) {
      this.state = State.BeforeClosingTagName
    } else {
      this.state = State.Text
      this.stateText(c)
    }
  }
  stateInTagName(c) {
    if (isEndOfTagSection(c)) {
      this.cbs.onopentagname(this.sectionStart, this.index)
      this.sectionStart = -1
      this.state = State.BeforeAttributeName
      this.stateBeforeAttributeName(c)
    }
  }
  stateBeforeClosingTagName(c) {
    if (isWhitespace(c));
    else if (c === CharCodes.Gt) {
      this.state = State.Text
    } else {
      this.state = this.isTagStartChar(c) ? State.InClosingTagName : State.InSpecialComment
      this.sectionStart = this.index
    }
  }
  stateInClosingTagName(c) {
    if (c === CharCodes.Gt || isWhitespace(c)) {
      this.cbs.onclosetag(this.sectionStart, this.index)
      this.sectionStart = -1
      this.state = State.AfterClosingTagName
      this.stateAfterClosingTagName(c)
    }
  }
  stateAfterClosingTagName(c) {
    if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
      this.state = State.Text
      this.sectionStart = this.index + 1
    }
  }
  stateBeforeAttributeName(c) {
    if (c === CharCodes.Gt) {
      this.cbs.onopentagend(this.index)
      if (this.isSpecial) {
        this.state = State.InSpecialTag
        this.sequenceIndex = 0
      } else {
        this.state = State.Text
      }
      this.sectionStart = this.index + 1
    } else if (c === CharCodes.Slash) {
      this.state = State.InSelfClosingTag
    } else if (!isWhitespace(c)) {
      this.state = State.InAttributeName
      this.sectionStart = this.index
    }
  }
  stateInSelfClosingTag(c) {
    if (c === CharCodes.Gt) {
      this.cbs.onselfclosingtag(this.index)
      this.state = State.Text
      this.sectionStart = this.index + 1
      this.isSpecial = false
    } else if (!isWhitespace(c)) {
      this.state = State.BeforeAttributeName
      this.stateBeforeAttributeName(c)
    }
  }
  stateInAttributeName(c) {
    if (c === CharCodes.Eq || isEndOfTagSection(c)) {
      this.cbs.onattribname(this.sectionStart, this.index)
      this.sectionStart = this.index
      this.state = State.AfterAttributeName
      this.stateAfterAttributeName(c)
    }
  }
  stateAfterAttributeName(c) {
    if (c === CharCodes.Eq) {
      this.state = State.BeforeAttributeValue
    } else if (c === CharCodes.Slash || c === CharCodes.Gt) {
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart)
      this.sectionStart = -1
      this.state = State.BeforeAttributeName
      this.stateBeforeAttributeName(c)
    } else if (!isWhitespace(c)) {
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart)
      this.state = State.InAttributeName
      this.sectionStart = this.index
    }
  }
  stateBeforeAttributeValue(c) {
    if (c === CharCodes.DoubleQuote) {
      this.state = State.InAttributeValueDq
      this.sectionStart = this.index + 1
    } else if (c === CharCodes.SingleQuote) {
      this.state = State.InAttributeValueSq
      this.sectionStart = this.index + 1
    } else if (!isWhitespace(c)) {
      this.sectionStart = this.index
      this.state = State.InAttributeValueNq
      this.stateInAttributeValueNoQuotes(c)
    }
  }
  handleInAttributeValue(c, quote) {
    if (c === quote || (!this.decodeEntities && this.fastForwardTo(quote))) {
      this.cbs.onattribdata(this.sectionStart, this.index)
      this.sectionStart = -1
      this.cbs.onattribend(
        quote === CharCodes.DoubleQuote ? QuoteType.Double : QuoteType.Single,
        this.index + 1,
      )
      this.state = State.BeforeAttributeName
    } else if (this.decodeEntities && c === CharCodes.Amp) {
      this.startEntity()
    }
  }
  stateInAttributeValueDoubleQuotes(c) {
    this.handleInAttributeValue(c, CharCodes.DoubleQuote)
  }
  stateInAttributeValueSingleQuotes(c) {
    this.handleInAttributeValue(c, CharCodes.SingleQuote)
  }
  stateInAttributeValueNoQuotes(c) {
    if (isWhitespace(c) || c === CharCodes.Gt) {
      this.cbs.onattribdata(this.sectionStart, this.index)
      this.sectionStart = -1
      this.cbs.onattribend(QuoteType.Unquoted, this.index)
      this.state = State.BeforeAttributeName
      this.stateBeforeAttributeName(c)
    } else if (this.decodeEntities && c === CharCodes.Amp) {
      this.startEntity()
    }
  }
  stateBeforeDeclaration(c) {
    if (c === CharCodes.OpeningSquareBracket) {
      this.state = State.CDATASequence
      this.sequenceIndex = 0
    } else {
      this.state = c === CharCodes.Dash ? State.BeforeComment : State.InDeclaration
    }
  }
  stateInDeclaration(c) {
    if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
      this.cbs.ondeclaration(this.sectionStart, this.index)
      this.state = State.Text
      this.sectionStart = this.index + 1
    }
  }
  stateInProcessingInstruction(c) {
    if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
      this.cbs.onprocessinginstruction(this.sectionStart, this.index)
      this.state = State.Text
      this.sectionStart = this.index + 1
    }
  }
  stateBeforeComment(c) {
    if (c === CharCodes.Dash) {
      this.state = State.InCommentLike
      this.currentSequence = Sequences.CommentEnd
      this.sequenceIndex = 2
      this.sectionStart = this.index + 1
    } else {
      this.state = State.InDeclaration
    }
  }
  stateInSpecialComment(c) {
    if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
      this.cbs.oncomment(this.sectionStart, this.index, 0)
      this.state = State.Text
      this.sectionStart = this.index + 1
    }
  }
  stateBeforeSpecialS(c) {
    const lower = c | 32
    if (lower === Sequences.ScriptEnd[3]) {
      this.startSpecial(Sequences.ScriptEnd, 4)
    } else if (lower === Sequences.StyleEnd[3]) {
      this.startSpecial(Sequences.StyleEnd, 4)
    } else {
      this.state = State.InTagName
      this.stateInTagName(c)
    }
  }
  stateBeforeSpecialT(c) {
    const lower = c | 32
    switch (lower) {
      case Sequences.TitleEnd[3]: {
        this.startSpecial(Sequences.TitleEnd, 4)
        break
      }
      case Sequences.TextareaEnd[3]: {
        this.startSpecial(Sequences.TextareaEnd, 4)
        break
      }
      case Sequences.XmpEnd[3]: {
        this.startSpecial(Sequences.XmpEnd, 4)
        break
      }
      default: {
        this.state = State.InTagName
        this.stateInTagName(c)
      }
    }
  }
  startEntity() {
    this.baseState = this.state
    this.state = State.InEntity
    this.entityStart = this.index
    this.entityDecoder.startEntity(
      this.xmlMode
        ? DecodingMode.Strict
        : this.baseState === State.Text || this.baseState === State.InSpecialTag
        ? DecodingMode.Legacy
        : DecodingMode.Attribute,
    )
  }
  stateInEntity() {
    const length = this.entityDecoder.write(this.buffer, this.index - this.offset)
    if (length >= 0) {
      this.state = this.baseState
      if (length === 0) {
        this.index = this.entityStart
      }
    } else {
      this.index = this.offset + this.buffer.length - 1
    }
  }
  /**
   * Remove data that has already been consumed from the buffer.
   */
  cleanup() {
    if (this.running && this.sectionStart !== this.index) {
      if (
        this.state === State.Text ||
        (this.state === State.InSpecialTag && this.sequenceIndex === 0)
      ) {
        this.cbs.ontext(this.sectionStart, this.index)
        this.sectionStart = this.index
      } else if (
        this.state === State.InAttributeValueDq ||
        this.state === State.InAttributeValueSq ||
        this.state === State.InAttributeValueNq
      ) {
        this.cbs.onattribdata(this.sectionStart, this.index)
        this.sectionStart = this.index
      }
    }
  }
  shouldContinue() {
    return this.index < this.buffer.length + this.offset && this.running
  }
  /**
   * Iterates through the buffer, calling the function corresponding to the current state.
   *
   * States that are more likely to be hit are higher up, as a performance improvement.
   */
  parse() {
    while (this.shouldContinue()) {
      const c = this.buffer.charCodeAt(this.index - this.offset)
      switch (this.state) {
        case State.Text: {
          this.stateText(c)
          break
        }
        case State.SpecialStartSequence: {
          this.stateSpecialStartSequence(c)
          break
        }
        case State.InSpecialTag: {
          this.stateInSpecialTag(c)
          break
        }
        case State.CDATASequence: {
          this.stateCDATASequence(c)
          break
        }
        case State.InAttributeValueDq: {
          this.stateInAttributeValueDoubleQuotes(c)
          break
        }
        case State.InAttributeName: {
          this.stateInAttributeName(c)
          break
        }
        case State.InCommentLike: {
          this.stateInCommentLike(c)
          break
        }
        case State.InSpecialComment: {
          this.stateInSpecialComment(c)
          break
        }
        case State.BeforeAttributeName: {
          this.stateBeforeAttributeName(c)
          break
        }
        case State.InTagName: {
          this.stateInTagName(c)
          break
        }
        case State.InClosingTagName: {
          this.stateInClosingTagName(c)
          break
        }
        case State.BeforeTagName: {
          this.stateBeforeTagName(c)
          break
        }
        case State.AfterAttributeName: {
          this.stateAfterAttributeName(c)
          break
        }
        case State.InAttributeValueSq: {
          this.stateInAttributeValueSingleQuotes(c)
          break
        }
        case State.BeforeAttributeValue: {
          this.stateBeforeAttributeValue(c)
          break
        }
        case State.BeforeClosingTagName: {
          this.stateBeforeClosingTagName(c)
          break
        }
        case State.AfterClosingTagName: {
          this.stateAfterClosingTagName(c)
          break
        }
        case State.BeforeSpecialS: {
          this.stateBeforeSpecialS(c)
          break
        }
        case State.BeforeSpecialT: {
          this.stateBeforeSpecialT(c)
          break
        }
        case State.InAttributeValueNq: {
          this.stateInAttributeValueNoQuotes(c)
          break
        }
        case State.InSelfClosingTag: {
          this.stateInSelfClosingTag(c)
          break
        }
        case State.InDeclaration: {
          this.stateInDeclaration(c)
          break
        }
        case State.BeforeDeclaration: {
          this.stateBeforeDeclaration(c)
          break
        }
        case State.BeforeComment: {
          this.stateBeforeComment(c)
          break
        }
        case State.InProcessingInstruction: {
          this.stateInProcessingInstruction(c)
          break
        }
        case State.InEntity: {
          this.stateInEntity()
          break
        }
      }
      this.index++
    }
    this.cleanup()
  }
  finish() {
    if (this.state === State.InEntity) {
      this.entityDecoder.end()
      this.state = this.baseState
    }
    this.handleTrailingData()
    this.cbs.onend()
  }
  /** Handle any trailing data. */
  handleTrailingData() {
    const endIndex = this.buffer.length + this.offset
    if (this.sectionStart >= endIndex) {
      return
    }
    if (this.state === State.InCommentLike) {
      if (this.currentSequence === Sequences.CdataEnd) {
        this.cbs.oncdata(this.sectionStart, endIndex, 0)
      } else {
        this.cbs.oncomment(this.sectionStart, endIndex, 0)
      }
    } else if (
      this.state === State.InTagName ||
      this.state === State.BeforeAttributeName ||
      this.state === State.BeforeAttributeValue ||
      this.state === State.AfterAttributeName ||
      this.state === State.InAttributeName ||
      this.state === State.InAttributeValueSq ||
      this.state === State.InAttributeValueDq ||
      this.state === State.InAttributeValueNq ||
      this.state === State.InClosingTagName
    );
    else {
      this.cbs.ontext(this.sectionStart, endIndex)
    }
  }
  emitCodePoint(cp, consumed) {
    if (this.baseState !== State.Text && this.baseState !== State.InSpecialTag) {
      if (this.sectionStart < this.entityStart) {
        this.cbs.onattribdata(this.sectionStart, this.entityStart)
      }
      this.sectionStart = this.entityStart + consumed
      this.index = this.sectionStart - 1
      this.cbs.onattribentity(cp)
    } else {
      if (this.sectionStart < this.entityStart) {
        this.cbs.ontext(this.sectionStart, this.entityStart)
      }
      this.sectionStart = this.entityStart + consumed
      this.index = this.sectionStart - 1
      this.cbs.ontextentity(cp, this.sectionStart)
    }
  }
}
const formTags = /* @__PURE__ */ new Set([
  'input',
  'option',
  'optgroup',
  'select',
  'button',
  'datalist',
  'textarea',
])
const pTag = /* @__PURE__ */ new Set(['p'])
const tableSectionTags = /* @__PURE__ */ new Set(['thead', 'tbody'])
const ddtTags = /* @__PURE__ */ new Set(['dd', 'dt'])
const rtpTags = /* @__PURE__ */ new Set(['rt', 'rp'])
const openImpliesClose = /* @__PURE__ */ new Map([
  ['tr', /* @__PURE__ */ new Set(['tr', 'th', 'td'])],
  ['th', /* @__PURE__ */ new Set(['th'])],
  ['td', /* @__PURE__ */ new Set(['thead', 'th', 'td'])],
  ['body', /* @__PURE__ */ new Set(['head', 'link', 'script'])],
  ['li', /* @__PURE__ */ new Set(['li'])],
  ['p', pTag],
  ['h1', pTag],
  ['h2', pTag],
  ['h3', pTag],
  ['h4', pTag],
  ['h5', pTag],
  ['h6', pTag],
  ['select', formTags],
  ['input', formTags],
  ['output', formTags],
  ['button', formTags],
  ['datalist', formTags],
  ['textarea', formTags],
  ['option', /* @__PURE__ */ new Set(['option'])],
  ['optgroup', /* @__PURE__ */ new Set(['optgroup', 'option'])],
  ['dd', ddtTags],
  ['dt', ddtTags],
  ['address', pTag],
  ['article', pTag],
  ['aside', pTag],
  ['blockquote', pTag],
  ['details', pTag],
  ['div', pTag],
  ['dl', pTag],
  ['fieldset', pTag],
  ['figcaption', pTag],
  ['figure', pTag],
  ['footer', pTag],
  ['form', pTag],
  ['header', pTag],
  ['hr', pTag],
  ['main', pTag],
  ['nav', pTag],
  ['ol', pTag],
  ['pre', pTag],
  ['section', pTag],
  ['table', pTag],
  ['ul', pTag],
  ['rt', rtpTags],
  ['rp', rtpTags],
  ['tbody', tableSectionTags],
  ['tfoot', tableSectionTags],
])
const voidElements = /* @__PURE__ */ new Set([
  'area',
  'base',
  'basefont',
  'br',
  'col',
  'command',
  'embed',
  'frame',
  'hr',
  'img',
  'input',
  'isindex',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])
const foreignContextElements = /* @__PURE__ */ new Set(['math', 'svg'])
const htmlIntegrationElements = /* @__PURE__ */ new Set([
  'mi',
  'mo',
  'mn',
  'ms',
  'mtext',
  'annotation-xml',
  'foreignobject',
  'desc',
  'title',
])
const reNameEnd = /\s|\//
class Parser {
  constructor(cbs, options = {}) {
    var _a2, _b, _c, _d, _e, _f
    this.options = options
    this.startIndex = 0
    this.endIndex = 0
    this.openTagStart = 0
    this.tagname = ''
    this.attribname = ''
    this.attribvalue = ''
    this.attribs = null
    this.stack = []
    this.buffers = []
    this.bufferOffset = 0
    this.writeIndex = 0
    this.ended = false
    this.cbs = cbs !== null && cbs !== void 0 ? cbs : {}
    this.htmlMode = !this.options.xmlMode
    this.lowerCaseTagNames =
      (_a2 = options.lowerCaseTags) !== null && _a2 !== void 0 ? _a2 : this.htmlMode
    this.lowerCaseAttributeNames =
      (_b = options.lowerCaseAttributeNames) !== null && _b !== void 0 ? _b : this.htmlMode
    this.recognizeSelfClosing =
      (_c = options.recognizeSelfClosing) !== null && _c !== void 0 ? _c : !this.htmlMode
    this.tokenizer = new ((_d = options.Tokenizer) !== null && _d !== void 0 ? _d : Tokenizer)(
      this.options,
      this,
    )
    this.foreignContext = [!this.htmlMode]
    ;(_f = (_e = this.cbs).onparserinit) === null || _f === void 0 ? void 0 : _f.call(_e, this)
  }
  // Tokenizer event handlers
  /** @internal */
  ontext(start, endIndex) {
    var _a2, _b
    const data = this.getSlice(start, endIndex)
    this.endIndex = endIndex - 1
    ;(_b = (_a2 = this.cbs).ontext) === null || _b === void 0 ? void 0 : _b.call(_a2, data)
    this.startIndex = endIndex
  }
  /** @internal */
  ontextentity(cp, endIndex) {
    var _a2, _b
    this.endIndex = endIndex - 1
    ;(_b = (_a2 = this.cbs).ontext) === null || _b === void 0
      ? void 0
      : _b.call(_a2, fromCodePoint(cp))
    this.startIndex = endIndex
  }
  /**
   * Checks if the current tag is a void element. Override this if you want
   * to specify your own additional void elements.
   */
  isVoidElement(name) {
    return this.htmlMode && voidElements.has(name)
  }
  /** @internal */
  onopentagname(start, endIndex) {
    this.endIndex = endIndex
    let name = this.getSlice(start, endIndex)
    if (this.lowerCaseTagNames) {
      name = name.toLowerCase()
    }
    this.emitOpenTag(name)
  }
  emitOpenTag(name) {
    var _a2, _b, _c, _d
    this.openTagStart = this.startIndex
    this.tagname = name
    const impliesClose = this.htmlMode && openImpliesClose.get(name)
    if (impliesClose) {
      while (this.stack.length > 0 && impliesClose.has(this.stack[0])) {
        const element = this.stack.shift()
        ;(_b = (_a2 = this.cbs).onclosetag) === null || _b === void 0
          ? void 0
          : _b.call(_a2, element, true)
      }
    }
    if (!this.isVoidElement(name)) {
      this.stack.unshift(name)
      if (this.htmlMode) {
        if (foreignContextElements.has(name)) {
          this.foreignContext.unshift(true)
        } else if (htmlIntegrationElements.has(name)) {
          this.foreignContext.unshift(false)
        }
      }
    }
    ;(_d = (_c = this.cbs).onopentagname) === null || _d === void 0 ? void 0 : _d.call(_c, name)
    if (this.cbs.onopentag) this.attribs = {}
  }
  endOpenTag(isImplied) {
    var _a2, _b
    this.startIndex = this.openTagStart
    if (this.attribs) {
      ;(_b = (_a2 = this.cbs).onopentag) === null || _b === void 0
        ? void 0
        : _b.call(_a2, this.tagname, this.attribs, isImplied)
      this.attribs = null
    }
    if (this.cbs.onclosetag && this.isVoidElement(this.tagname)) {
      this.cbs.onclosetag(this.tagname, true)
    }
    this.tagname = ''
  }
  /** @internal */
  onopentagend(endIndex) {
    this.endIndex = endIndex
    this.endOpenTag(false)
    this.startIndex = endIndex + 1
  }
  /** @internal */
  onclosetag(start, endIndex) {
    var _a2, _b, _c, _d, _e, _f, _g, _h
    this.endIndex = endIndex
    let name = this.getSlice(start, endIndex)
    if (this.lowerCaseTagNames) {
      name = name.toLowerCase()
    }
    if (this.htmlMode && (foreignContextElements.has(name) || htmlIntegrationElements.has(name))) {
      this.foreignContext.shift()
    }
    if (!this.isVoidElement(name)) {
      const pos = this.stack.indexOf(name)
      if (pos !== -1) {
        for (let index = 0; index <= pos; index++) {
          const element = this.stack.shift()
          ;(_b = (_a2 = this.cbs).onclosetag) === null || _b === void 0
            ? void 0
            : _b.call(_a2, element, index !== pos)
        }
      } else if (this.htmlMode && name === 'p') {
        this.emitOpenTag('p')
        this.closeCurrentTag(true)
      }
    } else if (this.htmlMode && name === 'br') {
      ;(_d = (_c = this.cbs).onopentagname) === null || _d === void 0 ? void 0 : _d.call(_c, 'br')
      ;(_f = (_e = this.cbs).onopentag) === null || _f === void 0
        ? void 0
        : _f.call(_e, 'br', {}, true)
      ;(_h = (_g = this.cbs).onclosetag) === null || _h === void 0
        ? void 0
        : _h.call(_g, 'br', false)
    }
    this.startIndex = endIndex + 1
  }
  /** @internal */
  onselfclosingtag(endIndex) {
    this.endIndex = endIndex
    if (this.recognizeSelfClosing || this.foreignContext[0]) {
      this.closeCurrentTag(false)
      this.startIndex = endIndex + 1
    } else {
      this.onopentagend(endIndex)
    }
  }
  closeCurrentTag(isOpenImplied) {
    var _a2, _b
    const name = this.tagname
    this.endOpenTag(isOpenImplied)
    if (this.stack[0] === name) {
      ;(_b = (_a2 = this.cbs).onclosetag) === null || _b === void 0
        ? void 0
        : _b.call(_a2, name, !isOpenImplied)
      this.stack.shift()
    }
  }
  /** @internal */
  onattribname(start, endIndex) {
    this.startIndex = start
    const name = this.getSlice(start, endIndex)
    this.attribname = this.lowerCaseAttributeNames ? name.toLowerCase() : name
  }
  /** @internal */
  onattribdata(start, endIndex) {
    this.attribvalue += this.getSlice(start, endIndex)
  }
  /** @internal */
  onattribentity(cp) {
    this.attribvalue += fromCodePoint(cp)
  }
  /** @internal */
  onattribend(quote, endIndex) {
    var _a2, _b
    this.endIndex = endIndex
    ;(_b = (_a2 = this.cbs).onattribute) === null || _b === void 0
      ? void 0
      : _b.call(
          _a2,
          this.attribname,
          this.attribvalue,
          quote === QuoteType.Double
            ? '"'
            : quote === QuoteType.Single
            ? "'"
            : quote === QuoteType.NoValue
            ? void 0
            : null,
        )
    if (this.attribs && !Object.prototype.hasOwnProperty.call(this.attribs, this.attribname)) {
      this.attribs[this.attribname] = this.attribvalue
    }
    this.attribvalue = ''
  }
  getInstructionName(value) {
    const index = value.search(reNameEnd)
    let name = index < 0 ? value : value.substr(0, index)
    if (this.lowerCaseTagNames) {
      name = name.toLowerCase()
    }
    return name
  }
  /** @internal */
  ondeclaration(start, endIndex) {
    this.endIndex = endIndex
    const value = this.getSlice(start, endIndex)
    if (this.cbs.onprocessinginstruction) {
      const name = this.getInstructionName(value)
      this.cbs.onprocessinginstruction(`!${name}`, `!${value}`)
    }
    this.startIndex = endIndex + 1
  }
  /** @internal */
  onprocessinginstruction(start, endIndex) {
    this.endIndex = endIndex
    const value = this.getSlice(start, endIndex)
    if (this.cbs.onprocessinginstruction) {
      const name = this.getInstructionName(value)
      this.cbs.onprocessinginstruction(`?${name}`, `?${value}`)
    }
    this.startIndex = endIndex + 1
  }
  /** @internal */
  oncomment(start, endIndex, offset) {
    var _a2, _b, _c, _d
    this.endIndex = endIndex
    ;(_b = (_a2 = this.cbs).oncomment) === null || _b === void 0
      ? void 0
      : _b.call(_a2, this.getSlice(start, endIndex - offset))
    ;(_d = (_c = this.cbs).oncommentend) === null || _d === void 0 ? void 0 : _d.call(_c)
    this.startIndex = endIndex + 1
  }
  /** @internal */
  oncdata(start, endIndex, offset) {
    var _a2, _b, _c, _d, _e, _f, _g, _h, _j, _k
    this.endIndex = endIndex
    const value = this.getSlice(start, endIndex - offset)
    if (!this.htmlMode || this.options.recognizeCDATA) {
      ;(_b = (_a2 = this.cbs).oncdatastart) === null || _b === void 0 ? void 0 : _b.call(_a2)
      ;(_d = (_c = this.cbs).ontext) === null || _d === void 0 ? void 0 : _d.call(_c, value)
      ;(_f = (_e = this.cbs).oncdataend) === null || _f === void 0 ? void 0 : _f.call(_e)
    } else {
      ;(_h = (_g = this.cbs).oncomment) === null || _h === void 0
        ? void 0
        : _h.call(_g, `[CDATA[${value}]]`)
      ;(_k = (_j = this.cbs).oncommentend) === null || _k === void 0 ? void 0 : _k.call(_j)
    }
    this.startIndex = endIndex + 1
  }
  /** @internal */
  onend() {
    var _a2, _b
    if (this.cbs.onclosetag) {
      this.endIndex = this.startIndex
      for (let index = 0; index < this.stack.length; index++) {
        this.cbs.onclosetag(this.stack[index], true)
      }
    }
    ;(_b = (_a2 = this.cbs).onend) === null || _b === void 0 ? void 0 : _b.call(_a2)
  }
  /**
   * Resets the parser to a blank state, ready to parse a new HTML document
   */
  reset() {
    var _a2, _b, _c, _d
    ;(_b = (_a2 = this.cbs).onreset) === null || _b === void 0 ? void 0 : _b.call(_a2)
    this.tokenizer.reset()
    this.tagname = ''
    this.attribname = ''
    this.attribs = null
    this.stack.length = 0
    this.startIndex = 0
    this.endIndex = 0
    ;(_d = (_c = this.cbs).onparserinit) === null || _d === void 0 ? void 0 : _d.call(_c, this)
    this.buffers.length = 0
    this.foreignContext.length = 0
    this.foreignContext.unshift(!this.htmlMode)
    this.bufferOffset = 0
    this.writeIndex = 0
    this.ended = false
  }
  /**
   * Resets the parser, then parses a complete document and
   * pushes it to the handler.
   *
   * @param data Document to parse.
   */
  parseComplete(data) {
    this.reset()
    this.end(data)
  }
  getSlice(start, end) {
    while (start - this.bufferOffset >= this.buffers[0].length) {
      this.shiftBuffer()
    }
    let slice = this.buffers[0].slice(start - this.bufferOffset, end - this.bufferOffset)
    while (end - this.bufferOffset > this.buffers[0].length) {
      this.shiftBuffer()
      slice += this.buffers[0].slice(0, end - this.bufferOffset)
    }
    return slice
  }
  shiftBuffer() {
    this.bufferOffset += this.buffers[0].length
    this.writeIndex--
    this.buffers.shift()
  }
  /**
   * Parses a chunk of data and calls the corresponding callbacks.
   *
   * @param chunk Chunk to parse.
   */
  write(chunk) {
    var _a2, _b
    if (this.ended) {
      ;(_b = (_a2 = this.cbs).onerror) === null || _b === void 0
        ? void 0
        : _b.call(_a2, new Error('.write() after done!'))
      return
    }
    this.buffers.push(chunk)
    if (this.tokenizer.running) {
      this.tokenizer.write(chunk)
      this.writeIndex++
    }
  }
  /**
   * Parses the end of the buffer and clears the stack, calls onend.
   *
   * @param chunk Optional final chunk to parse.
   */
  end(chunk) {
    var _a2, _b
    if (this.ended) {
      ;(_b = (_a2 = this.cbs).onerror) === null || _b === void 0
        ? void 0
        : _b.call(_a2, new Error('.end() after done!'))
      return
    }
    if (chunk) this.write(chunk)
    this.ended = true
    this.tokenizer.end()
  }
  /**
   * Pauses parsing. The parser won't emit events until `resume` is called.
   */
  pause() {
    this.tokenizer.pause()
  }
  /**
   * Resumes parsing after `pause` was called.
   */
  resume() {
    this.tokenizer.resume()
    while (this.tokenizer.running && this.writeIndex < this.buffers.length) {
      this.tokenizer.write(this.buffers[this.writeIndex++])
    }
    if (this.ended) this.tokenizer.end()
  }
  /**
   * Alias of `write`, for backwards compatibility.
   *
   * @param chunk Chunk to parse.
   * @deprecated
   */
  parseChunk(chunk) {
    this.write(chunk)
  }
  /**
   * Alias of `end`, for backwards compatibility.
   *
   * @param chunk Optional final chunk to parse.
   * @deprecated
   */
  done(chunk) {
    this.end(chunk)
  }
}
function parseDocument(data, options) {
  const handler = new DomHandler(void 0, options)
  new Parser(handler, options).end(data)
  return handler.root
}
function parseHtmlWorker({ path, source, executables }) {
  const doc = parseDocument(source)
  const api = {
    select(selector, callback) {
      findAll(
        elem => !!(elem.tagName && elem.tagName.toLowerCase() === selector.toLowerCase()),
        doc.children,
      ).forEach(callback)
      return api
    },
    /** Bind relative `href`-attribute of all `<link />` elements */
    bindLinkHref() {
      return api.select('link', link => {
        if (hasAttrib(link, 'href')) {
          const href = getAttributeValue(link, 'href')
          if (!href || isUrl$1(href)) return
          const url = executables.get(resolvePath(path, href))
          if (url) link.attribs.href = url
        }
      })
    },
    /** Bind relative `src`-attribute of all `<script />` elements */
    bindScriptSrc() {
      return api.select('script', script => {
        if (hasAttrib(script, 'src')) {
          const src = getAttributeValue(script, 'src')
          if (!src || isUrl$1(src)) return
          const url = executables.get(resolvePath(path, src))
          if (url) script.attribs.src = url
        }
      })
    },
    /** Transform content of all `<script type="module" />` elements */
    transformModuleScriptContent(transformJs) {
      return api.select('script', script => {
        if (getAttributeValue(script, 'type') === 'module' && script.children.length) {
          const scriptContent = script.children.map(child => child.data).join('')
          const transformedContent = transformJs({ path, source: scriptContent, executables })
          if (transformedContent !== void 0) {
            script.children[0].data = transformedContent
          }
        }
      })
    },
    toString() {
      return render(doc, { decodeEntities: true })
    },
  }
  return api
}
const domParser = typeof DOMParser !== 'undefined' ? new DOMParser() : void 0
const xmlSerializer = typeof XMLSerializer !== 'undefined' ? new XMLSerializer() : void 0
function parseHtml({ path, source, executables }) {
  if (!domParser || !xmlSerializer) {
    throw `\`parseHtml\` can only be used in environments where DOMParser and XMLSerializer are available. Please use \`parseHtmlWorker\` for a worker-friendly alternative.`
  }
  const doc = domParser.parseFromString(source, 'text/html')
  const api = {
    select(selector, callback) {
      Array.from(doc.querySelectorAll(selector)).forEach(callback)
      return api
    },
    /** Bind relative `href`-attribute of all `<link />` elements */
    bindLinkHref() {
      return api.select('link[href]', link => {
        const href = link.getAttribute('href')
        if (isUrl$1(href)) return
        const url = executables.get(resolvePath(path, href))
        if (url) link.setAttribute('href', url)
      })
    },
    /** Bind relative `src`-attribute of all `<script />` elements */
    bindScriptSrc() {
      return api.select('script[src]', script => {
        const src = script.getAttribute('src')
        if (isUrl$1(src)) return
        const url = executables.get(resolvePath(path, script.getAttribute('src')))
        if (url) script.setAttribute('src', url)
      })
    },
    /** Transform content of all `<script type="module" />` elements */
    transformModuleScriptContent(transformJs) {
      return api.select('script[type="module"]', script => {
        if (script.type !== 'module' || !script.textContent) return
        script.textContent = transformJs({ path, source: script.textContent, executables })
      })
    },
    toString() {
      return xmlSerializer.serializeToString(doc)
    },
  }
  return api
}
function resolveExports(exports, conditions) {
  if (typeof exports === 'string') {
    return exports
  }
  if (Array.isArray(exports)) {
    for (const exp of exports) {
      const resolved = resolveExports(exp, conditions)
      if (resolved) return resolved
    }
    return null
  }
  if (typeof exports === 'object') {
    if (conditions.browser && exports.browser) {
      return resolveExports(exports.browser, conditions)
    }
    if (conditions.import && exports.import) {
      return resolveExports(exports.import, conditions)
    }
    if (conditions.require && exports.require) {
      return resolveExports(exports.require, conditions)
    }
    if (exports.default) {
      return resolveExports(exports.default, conditions)
    }
  }
  return null
}
function resolveMainEntry(pkg, conditions = { browser: true, require: true, import: true }) {
  if (pkg.exports) {
    if (typeof pkg.exports === 'string' || Array.isArray(pkg.exports)) {
      const resolved = resolveExports(pkg.exports, conditions)
      if (resolved) return resolved
    } else if (pkg.exports['.']) {
      const resolved = resolveExports(pkg.exports['.'], conditions)
      if (resolved) return resolved
    }
  }
  if (conditions.browser && pkg.browser) {
    if (typeof pkg.browser === 'string') {
      return pkg.browser
    }
    if (typeof pkg.browser === 'object') {
      const mainFile = pkg.module || pkg.main || './index.js'
      return pkg.browser[mainFile] || mainFile
    }
  }
  if (conditions.import && pkg.module) {
    return pkg.module
  }
  if (conditions.require && pkg.main) {
    return pkg.main
  }
  return './index.js'
}
function resolvePackageEntries(pkg, conditions = { browser: true, require: true, import: true }) {
  const resolved = {
    '.': resolveMainEntry(pkg, conditions),
  }
  if (pkg.exports && typeof pkg.exports === 'object' && !Array.isArray(pkg.exports)) {
    for (const [key, value] of Object.entries(pkg.exports)) {
      if (key !== '.' && value !== void 0) {
        const resolvedPath = resolveExports(value, conditions)
        if (resolvedPath) {
          resolved[key] = resolvedPath
        }
      }
    }
  }
  if (conditions.browser && typeof pkg.browser === 'object') {
    for (const [key, value] of Object.entries(pkg.browser)) {
      if (key !== '.' && key !== pkg.main && key !== pkg.module) {
        resolved[key] = value
      }
    }
  }
  return resolved
}
function resolveItems({ cdn, babel, items, type }) {
  if (!items) return Promise.resolve([])
  const availableItems = type === 'plugins' ? babel.availablePlugins : babel.availablePresets
  return Promise.all(
    items.map(async function resolveItem(item) {
      let name
      let options = void 0
      if (typeof item === 'string') {
        name = item
      } else if (Array.isArray(item) && typeof item[0] === 'string') {
        ;[name, options] = item
      } else {
        return item
      }
      if (name in availableItems) {
        return options !== void 0 ? [availableItems[name], options] : availableItems[name]
      } else {
        const module = await import(
          /* @vite-ignore */
          `${cdn}/${name}`
        ).then(module2 => module2.default)
        return options !== void 0 ? [module, options] : module
      }
    }),
  )
}
async function babelTransform(config) {
  const cdn = config.cdn || 'https://esm.sh'
  const babel = await (config.babel ||
    import(
      /* @vite-ignore */
      `${cdn}/@babel/standalone`
    ))
  const [presets, plugins] = await Promise.all([
    resolveItems({ cdn, babel, items: config.presets, type: 'presets' }),
    resolveItems({ cdn, babel, items: config.plugins, type: 'plugins' }),
  ])
  return (source, path) => {
    const result = babel.transform(source, {
      presets,
      plugins,
    }).code
    if (!result)
      throw `Babel transform failed for file ${path} with source: 

 ${source}`
    return result
  }
}
export {
  babelTransform,
  bindMonaco,
  createExecutables,
  createFileSystem,
  createMonacoTypeDownloader,
  downloadTypesFromUrl,
  downloadTypesfromPackage,
  getExtension,
  getName,
  getParentPath,
  isUrl$1 as isUrl,
  normalizePath$1 as normalizePath,
  parseHtml,
  parseHtmlWorker,
  resolvePackageEntries,
  resolvePath,
  transformModulePaths,
}
