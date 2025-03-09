import { createResource, untrack, createEffect, mapArray, createSignal, createMemo, onCleanup, mergeProps } from "solid-js";
import { createStore, produce } from "solid-js/store";
import typescript from "typescript";
import serialize from "dom-serializer";
import { findAll, hasAttrib, getAttributeValue } from "domutils";
import { parseDocument } from "htmlparser2";
function getExtension(path) {
  var _a;
  return ((_a = path.split("/").slice(-1)[0]) == null ? void 0 : _a.split(".")[1]) || "";
}
function getName(path) {
  const parts = path.split("/");
  return parts[parts.length - 1] || "";
}
function getParentPath(path) {
  const parts = path.split("/");
  return parts.slice(0, -1).join("/");
}
function normalizePath$1(path) {
  return path.replace(/^\/+/, "");
}
function resolvePath(currentPath, relativePath) {
  const pathIsUrl = isUrl$1(currentPath);
  const base = pathIsUrl ? currentPath : new URL(currentPath, "http://example.com/");
  const absoluteUrl = new URL(relativePath, base);
  return normalizePath$1(pathIsUrl ? absoluteUrl.href : absoluteUrl.pathname);
}
function isUrl$1(path) {
  return path.startsWith("blob:") || path.startsWith("http:") || path.startsWith("https:");
}
function createAsync(fn, options) {
  let resource;
  let prev = () => !resource || resource.state === "unresolved" ? void 0 : resource.latest;
  [resource] = createResource(
    () => fn(untrack(prev)),
    (v) => v,
    options
  );
  const resultAccessor = () => resource();
  Object.defineProperty(resultAccessor, "latest", {
    get() {
      return resource.latest;
    }
  });
  return resultAccessor;
}
function createExecutables(fs, extensions2) {
  const [actions, setActions] = createStore({});
  const executables = {
    get(path) {
      var _a;
      return (_a = actions[path]) == null ? void 0 : _a.get();
    },
    invalidate(path) {
      var _a;
      return (_a = actions[path]) == null ? void 0 : _a.invalidate();
    },
    create(path) {
      var _a;
      return (_a = actions[path]) == null ? void 0 : _a.create();
    }
  };
  createEffect(
    mapArray(
      () => Object.keys(fs()).filter((path) => fs()[path] !== null),
      (path) => {
        const extension = getExtension(path);
        const [listen, invalidateExecutable] = createSignal(null, { equals: false });
        const transformed = createAsync(
          async () => {
            var _a, _b;
            return ((_b = (_a = extensions2[extension]) == null ? void 0 : _a.transform) == null ? void 0 : _b.call(_a, { path, source: fs()[path], executables })) || fs()[path];
          }
        );
        function createExecutable() {
          var _a;
          const _transformed = transformed();
          if (!_transformed)
            return;
          const blob = new Blob([_transformed], {
            type: `text/${((_a = extensions2[extension]) == null ? void 0 : _a.type) || "plain"}`
          });
          return URL.createObjectURL(blob);
        }
        const getExecutable = createMemo((previous) => {
          if (previous)
            URL.revokeObjectURL(previous);
          listen();
          return createExecutable();
        });
        setActions({
          [path]: {
            get: getExecutable,
            create: createExecutable,
            invalidate: invalidateExecutable
          }
        });
        onCleanup(() => setActions({ [path]: void 0 }));
      }
    )
  );
  return executables;
}
function getParentDirectory(path) {
  return path.split("/").slice(0, -1).join("/");
}
function globToRegex(glob) {
  const regex = glob.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*").replace(/\?/g, ".");
  return new RegExp(`^${regex}$`);
}
function createFileSystem(extensions2) {
  const [fs, setFs] = createStore({});
  const executables = createExecutables(() => fs, extensions2);
  const [match, setMatch] = createSignal((glob) => {
    const regex = globToRegex(glob);
    return (paths) => paths.filter((path) => regex.test(path));
  });
  function createGlobEffect(glob, cb) {
    const matchFn = createMemo(() => match()(glob));
    createEffect(
      mapArray(
        () => matchFn()(api.getPaths()),
        (path) => createEffect(() => cb(path))
      )
    );
  }
  function assertPathExists(path) {
    const parts = path.split("/");
    const pathExists = parts.map((_, index) => parts.slice(0, index + 1).join("/")).filter(Boolean).every((path2) => path2 in fs);
    if (!pathExists) {
      throw `Path is invalid ${path}`;
    }
    return true;
  }
  function assertNotDir(path) {
    if (fs[path] === null) {
      throw `Path is not a file: ${path}`;
    }
  }
  function getExecutable(path) {
    path = normalizePath$1(path);
    assertNotDir(path);
    return executables.get(path);
  }
  function invalidateExecutable(path) {
    path = normalizePath$1(path);
    assertNotDir(path);
    return executables.invalidate(path);
  }
  function createExecutable(path) {
    path = normalizePath$1(path);
    assertNotDir(path);
    return executables.create(path);
  }
  function readdir(path, options) {
    path = normalizePath$1(path);
    assertPathExists(path);
    if (options == null ? void 0 : options.withFileTypes) {
      return Object.entries(fs).filter(([_path]) => getParentDirectory(_path) === path && path !== _path).map(([path2, file]) => {
        var _a;
        return {
          type: file === null ? "dir" : ((_a = extensions2[getExtension(path2)]) == null ? void 0 : _a.type) || "plain",
          path: path2
        };
      });
    }
    return Object.keys(fs).filter((_path) => getParentDirectory(_path) === path);
  }
  const api = {
    getExecutable,
    invalidateExecutable,
    createExecutable,
    getPaths: () => Object.keys(fs),
    getType(path) {
      var _a;
      path = normalizePath$1(path);
      assertPathExists(path);
      return fs[path] === null ? "dir" : ((_a = extensions2[getExtension(path)]) == null ? void 0 : _a.type) || "plain";
    },
    readdir,
    mkdir(path, options) {
      path = normalizePath$1(path);
      if (options == null ? void 0 : options.recursive) {
        const parts = path.split("/");
        parts.forEach((_, index) => {
          setFs(parts.slice(0, index + 1).join("/"), null);
        });
        return;
      }
      assertPathExists(getParentDirectory(path));
      setFs(path, null);
    },
    readFile(path) {
      path = normalizePath$1(path);
      const file = fs[path];
      if (file === null) {
        throw `Path is not a file ${path}`;
      }
      return file;
    },
    rename(previous, next) {
      previous = normalizePath$1(previous);
      next = normalizePath$1(next);
      assertPathExists(previous);
      setFs(
        produce((files) => {
          Object.keys(fs).forEach((path) => {
            if (path.startsWith(previous)) {
              const newPath = path.replace(previous, next);
              files[newPath] = files[path];
              delete files[path];
            }
          });
        })
      );
    },
    rm(path, options) {
      path = normalizePath$1(path);
      if (!options || !options.force) {
        assertPathExists(path);
      }
      if (!options || !options.recursive) {
        const _dirEnts = Object.keys(executables).filter((value) => {
          if (value === path)
            return false;
          return value.includes(path);
        });
        if (_dirEnts.length > 0) {
          throw `Directory is not empty ${_dirEnts}`;
        }
      }
      setFs(
        produce((files) => {
          Object.keys(files).filter((value) => value.includes(path)).forEach((path2) => delete files[path2]);
        })
      );
    },
    writeFile(path, source) {
      path = normalizePath$1(path);
      assertPathExists(getParentDirectory(path));
      if (fs[path] === null) {
        throw `A directory already exist with the same name: ${path}`;
      }
      setFs(path, source);
    },
    // Watchers
    watchExecutable(glob, cb) {
      createGlobEffect(glob, (path) => cb(api.getExecutable(path), path));
    },
    watchFile(glob, cb) {
      createGlobEffect(glob, (path) => cb(api.readFile(path), path));
    },
    watchDir(path, cb) {
      cb(api.readdir(path, { withFileTypes: true }), path);
    },
    watchPaths(cb) {
      createEffect(() => cb(api.getPaths()));
    },
    // Set match function
    setMatch
  };
  return api;
}
function transformModulePaths(code, callback) {
  const sourceFile = typescript.createSourceFile(
    "",
    code,
    typescript.ScriptTarget.Latest,
    true,
    typescript.ScriptKind.TS
  );
  let shouldPrint = false;
  const result = typescript.transform(sourceFile, [
    (context) => {
      const visit = (node) => {
        if ((typescript.isImportDeclaration(node) || typescript.isExportDeclaration(node)) && node.moduleSpecifier && typescript.isStringLiteral(node.moduleSpecifier)) {
          const isImport = typescript.isImportDeclaration(node);
          const previous = node.moduleSpecifier.text;
          const result2 = callback(node.moduleSpecifier.text, isImport);
          if (result2 === null) {
            shouldPrint = true;
            return;
          }
          node.moduleSpecifier.text = result2;
          if (previous !== node.moduleSpecifier.text) {
            shouldPrint = true;
            if (isImport) {
              return typescript.factory.updateImportDeclaration(
                node,
                node.modifiers,
                node.importClause,
                typescript.factory.createStringLiteral(result2),
                node.assertClause
                // Preserve the assert clause if it exists
              );
            } else {
              return typescript.factory.updateExportDeclaration(
                node,
                node.modifiers,
                false,
                node.exportClause,
                typescript.factory.createStringLiteral(result2),
                node.assertClause
                // Preserve the assert clause if it exists
              );
            }
          }
        }
        return typescript.visitEachChild(node, visit, context);
      };
      return (node) => typescript.visitNode(node, visit);
    }
  ]);
  if (!result.transformed[0])
    return void 0;
  if (!shouldPrint)
    return code;
  const printer = typescript.createPrinter({
    newLine: typescript.NewLineKind.LineFeed
  });
  return printer.printFile(result.transformed[0]);
}
function defer() {
  let resolve = null;
  return {
    promise: new Promise((_resolve) => resolve = _resolve),
    resolve
  };
}
function isUrl(path) {
  return path.startsWith("blob:") || path.startsWith("http:") || path.startsWith("https:");
}
function isRelativePath(path) {
  return path.startsWith(".");
}
const extensions = [".js.d.ts", ".jsx.d.ts", ".ts.d.ts", ".tsx.d.ts", ".js", ".jsx", ".tsx"];
function normalizePath(path) {
  for (const extension of extensions) {
    if (path.endsWith(extension)) {
      return path.replace(extension, ".d.ts");
    }
  }
  return path;
}
function getVirtualPath(url, cdn = "https://esm.sh") {
  const [first, ...path] = url.replace(`${cdn}/`, "").split("/");
  const library = (first == null ? void 0 : first.startsWith("@")) ? `@${first.slice(1).split("@")[0]}` : first.split("@")[0];
  return `${library}/${path.join("/")}`;
}
const URL_CACHE = /* @__PURE__ */ new Map();
async function downloadTypesFromUrl({
  url,
  declarationFiles = {},
  cdn = "https://esm.sh"
}) {
  async function downloadPath(path) {
    if (URL_CACHE.has(path))
      return await URL_CACHE.get(path);
    const { promise, resolve } = defer();
    URL_CACHE.set(path, promise);
    const virtualPath = getVirtualPath(path);
    if (virtualPath in declarationFiles)
      return;
    const response = await fetch(path);
    if (response.status !== 200) {
      throw new Error(`Error while loading ${url}`);
    }
    const code = await response.text();
    resolve(code);
    const promises = new Array();
    const transformedCode = transformModulePaths(code, (modulePath) => {
      if (isRelativePath(modulePath)) {
        let newPath = resolvePath(path, modulePath);
        promises.push(downloadPath(normalizePath(newPath)));
        return normalizePath(modulePath);
      } else if (isUrl(modulePath)) {
        promises.push(
          downloadTypesFromUrl({
            url: modulePath,
            declarationFiles,
            cdn
          })
        );
        return getVirtualPath(modulePath);
      } else {
        promises.push(downloadTypesfromPackage({ name: modulePath, declarationFiles, cdn }));
      }
      return modulePath;
    });
    if (!transformedCode) {
      throw new Error(`Transform returned undefined for ${virtualPath}`);
    }
    await Promise.all(promises);
    declarationFiles[virtualPath] = transformedCode;
  }
  await downloadPath(url);
  return declarationFiles;
}
const TYPE_URL_CACHE = /* @__PURE__ */ new Map();
async function downloadTypesfromPackage({
  name,
  declarationFiles = {},
  cdn = "https://esm.sh"
}) {
  const typeUrl = await (TYPE_URL_CACHE.get(name) ?? TYPE_URL_CACHE.set(
    name,
    fetch(`${cdn}/${name}`).then((result) => result.headers.get("X-TypeScript-Types")).catch((error) => {
      console.info(error);
      return null;
    })
  ).get(name));
  if (!typeUrl)
    throw `No type url was found for package ${name}`;
  return {
    path: getVirtualPath(typeUrl),
    types: await downloadTypesFromUrl({ url: typeUrl, declarationFiles, cdn })
  };
}
function mapObject(object, callback) {
  return Object.fromEntries(
    Object.entries(object).map((entry) => [entry[0], callback(entry[1], entry[0])])
  );
}
function createMonacoTypeDownloader(tsconfig) {
  const [types, setTypes] = createStore({});
  const [aliases, setAliases] = createSignal({});
  function addAlias(alias, path) {
    setAliases((paths) => {
      paths[alias] = [`file:///${path}`];
      return { ...paths };
    });
  }
  const methods = {
    tsconfig() {
      return {
        ...tsconfig,
        paths: {
          ...mapObject(tsconfig.paths || {}, (value) => value.map((path) => `file:///${path}`)),
          ...aliases()
        }
      };
    },
    types() {
      return types;
    },
    addDeclaration(path, source, alias) {
      setTypes(path, source);
      if (alias) {
        addAlias(alias, path);
      }
    },
    async downloadModule(name) {
      if (!(name in aliases())) {
        const { types: types2, path } = await downloadTypesfromPackage({ name });
        setTypes(types2);
        addAlias(name, path);
      }
    },
    // Watchers
    watchTsconfig(cb) {
      createEffect(() => cb(methods.tsconfig()));
    },
    watchTypes(cb) {
      createEffect(() => cb({ ...types }));
    }
  };
  return methods;
}
function bindMonaco(props) {
  const languages = mergeProps(
    {
      tsx: "typescript",
      ts: "typescript"
    },
    () => props.languages
  );
  function getType(path) {
    let type = props.fs.getType(path);
    const extension = getExtension(path);
    if (extension && extension in languages) {
      type = languages[extension];
    }
    return type;
  }
  createEffect(() => {
    props.editor.onDidChangeModelContent(() => {
      props.fs.writeFile(props.path, props.editor.getModel().getValue());
    });
  });
  createEffect(
    mapArray(props.fs.getPaths, (path) => {
      createEffect(() => {
        const type = getType(path);
        if (type === "dir")
          return;
        const uri = props.monaco.Uri.parse(`file:///${path}`);
        const model = props.monaco.editor.getModel(uri) || props.monaco.editor.createModel("", type, uri);
        createEffect(() => {
          const value = props.fs.readFile(path) || "";
          if (value !== model.getValue()) {
            model.setValue(props.fs.readFile(path) || "");
          }
        });
        onCleanup(() => model.dispose());
      });
    })
  );
  createEffect(() => {
    const uri = props.monaco.Uri.parse(`file:///${props.path}`);
    let type = getType(props.path);
    const model = props.monaco.editor.getModel(uri) || props.monaco.editor.createModel("", type, uri);
    props.editor.setModel(model);
  });
  createEffect(() => {
    if (props.tsconfig) {
      props.monaco.languages.typescript.typescriptDefaults.setCompilerOptions(props.tsconfig);
      props.monaco.languages.typescript.javascriptDefaults.setCompilerOptions(props.tsconfig);
    }
  });
  createEffect(
    mapArray(
      () => Object.keys(props.types ?? {}),
      (name) => {
        createEffect(() => {
          var _a;
          const declaration = (_a = props.types) == null ? void 0 : _a[name];
          if (!declaration)
            return;
          const path = `file:///${name}`;
          props.monaco.languages.typescript.typescriptDefaults.addExtraLib(declaration, path);
          props.monaco.languages.typescript.javascriptDefaults.addExtraLib(declaration, path);
        });
      }
    )
  );
}
function parseHtmlWorker({ path, source, executables }) {
  const doc = parseDocument(source);
  const api = {
    select(selector, callback) {
      findAll(
        (elem) => !!(elem.tagName && elem.tagName.toLowerCase() === selector.toLowerCase()),
        doc.children
      ).forEach(callback);
      return api;
    },
    /** Bind relative `href`-attribute of all `<link />` elements */
    bindLinkHref() {
      return api.select("link", (link) => {
        if (hasAttrib(link, "href")) {
          const href = getAttributeValue(link, "href");
          if (!href || isUrl$1(href))
            return;
          const url = executables.get(resolvePath(path, href));
          if (url)
            link.attribs.href = url;
        }
      });
    },
    /** Bind relative `src`-attribute of all `<script />` elements */
    bindScriptSrc() {
      return api.select("script", (script) => {
        if (hasAttrib(script, "src")) {
          const src = getAttributeValue(script, "src");
          if (!src || isUrl$1(src))
            return;
          const url = executables.get(resolvePath(path, src));
          if (url)
            script.attribs.src = url;
        }
      });
    },
    /** Transform content of all `<script type="module" />` elements */
    transformModuleScriptContent(transformJs) {
      return api.select("script", (script) => {
        if (getAttributeValue(script, "type") === "module" && script.children.length) {
          const scriptContent = script.children.map((child) => child.data).join("");
          const transformedContent = transformJs({ path, source: scriptContent, executables });
          if (transformedContent !== void 0) {
            script.children[0].data = transformedContent;
          }
        }
      });
    },
    toString() {
      return serialize(doc, { decodeEntities: true });
    }
  };
  return api;
}
const domParser = typeof DOMParser !== "undefined" ? new DOMParser() : void 0;
const xmlSerializer = typeof XMLSerializer !== "undefined" ? new XMLSerializer() : void 0;
function parseHtml({ path, source, executables }) {
  if (!domParser || !xmlSerializer) {
    throw `\`parseHtml\` can only be used in environments where DOMParser and XMLSerializer are available. Please use \`parseHtmlWorker\` for a worker-friendly alternative.`;
  }
  const doc = domParser.parseFromString(source, "text/html");
  const api = {
    select(selector, callback) {
      Array.from(doc.querySelectorAll(selector)).forEach(callback);
      return api;
    },
    /** Bind relative `href`-attribute of all `<link />` elements */
    bindLinkHref() {
      return api.select("link[href]", (link) => {
        const href = link.getAttribute("href");
        if (isUrl$1(href))
          return;
        const url = executables.get(resolvePath(path, href));
        if (url)
          link.setAttribute("href", url);
      });
    },
    /** Bind relative `src`-attribute of all `<script />` elements */
    bindScriptSrc() {
      return api.select("script[src]", (script) => {
        const src = script.getAttribute("src");
        if (isUrl$1(src))
          return;
        const url = executables.get(resolvePath(path, script.getAttribute("src")));
        if (url)
          script.setAttribute("src", url);
      });
    },
    /** Transform content of all `<script type="module" />` elements */
    transformModuleScriptContent(transformJs) {
      return api.select('script[type="module"]', (script) => {
        if (script.type !== "module" || !script.textContent)
          return;
        script.textContent = transformJs({ path, source: script.textContent, executables });
      });
    },
    toString() {
      return xmlSerializer.serializeToString(doc);
    }
  };
  return api;
}
function resolveExports(exports, conditions) {
  if (typeof exports === "string") {
    return exports;
  }
  if (Array.isArray(exports)) {
    for (const exp of exports) {
      const resolved = resolveExports(exp, conditions);
      if (resolved)
        return resolved;
    }
    return null;
  }
  if (typeof exports === "object") {
    if (conditions.browser && exports.browser) {
      return resolveExports(exports.browser, conditions);
    }
    if (conditions.import && exports.import) {
      return resolveExports(exports.import, conditions);
    }
    if (conditions.require && exports.require) {
      return resolveExports(exports.require, conditions);
    }
    if (exports.default) {
      return resolveExports(exports.default, conditions);
    }
  }
  return null;
}
function resolveMainEntry(pkg, conditions = { browser: true, require: true, import: true }) {
  if (pkg.exports) {
    if (typeof pkg.exports === "string" || Array.isArray(pkg.exports)) {
      const resolved = resolveExports(pkg.exports, conditions);
      if (resolved)
        return resolved;
    } else if (pkg.exports["."]) {
      const resolved = resolveExports(pkg.exports["."], conditions);
      if (resolved)
        return resolved;
    }
  }
  if (conditions.browser && pkg.browser) {
    if (typeof pkg.browser === "string") {
      return pkg.browser;
    }
    if (typeof pkg.browser === "object") {
      const mainFile = pkg.module || pkg.main || "./index.js";
      return pkg.browser[mainFile] || mainFile;
    }
  }
  if (conditions.import && pkg.module) {
    return pkg.module;
  }
  if (conditions.require && pkg.main) {
    return pkg.main;
  }
  return "./index.js";
}
function resolvePackageEntries(pkg, conditions = { browser: true, require: true, import: true }) {
  const resolved = {
    ".": resolveMainEntry(pkg, conditions)
  };
  if (pkg.exports && typeof pkg.exports === "object" && !Array.isArray(pkg.exports)) {
    for (const [key, value] of Object.entries(pkg.exports)) {
      if (key !== "." && value !== void 0) {
        const resolvedPath = resolveExports(value, conditions);
        if (resolvedPath) {
          resolved[key] = resolvedPath;
        }
      }
    }
  }
  if (conditions.browser && typeof pkg.browser === "object") {
    for (const [key, value] of Object.entries(pkg.browser)) {
      if (key !== "." && key !== pkg.main && key !== pkg.module) {
        resolved[key] = value;
      }
    }
  }
  return resolved;
}
function resolveItems({
  cdn,
  babel,
  items,
  type
}) {
  if (!items)
    return Promise.resolve([]);
  const availableItems = type === "plugins" ? babel.availablePlugins : babel.availablePresets;
  return Promise.all(
    items.map(async function resolveItem(item) {
      let name;
      let options = void 0;
      if (typeof item === "string") {
        name = item;
      } else if (Array.isArray(item) && typeof item[0] === "string") {
        [name, options] = item;
      } else {
        return item;
      }
      if (name in availableItems) {
        return options !== void 0 ? [availableItems[name], options] : availableItems[name];
      } else {
        const module = await import(
          /* @vite-ignore */
          `${cdn}/${name}`
        ).then(
          (module2) => module2.default
        );
        return options !== void 0 ? [module, options] : module;
      }
    })
  );
}
async function babelTransform(config) {
  const cdn = config.cdn || "https://esm.sh";
  const babel = await (config.babel || import(
    /* @vite-ignore */
    `${cdn}/@babel/standalone`
  ));
  const [presets, plugins] = await Promise.all([
    resolveItems({ cdn, babel, items: config.presets, type: "presets" }),
    resolveItems({ cdn, babel, items: config.plugins, type: "plugins" })
  ]);
  return (source, path) => {
    const result = babel.transform(source, {
      presets,
      plugins
    }).code;
    if (!result)
      throw `Babel transform failed for file ${path} with source: 

 ${source}`;
    return result;
  };
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
  transformModulePaths
};
