import { createAsync } from "@solidjs/router";
import { createSignal, createMemo, createEffect, mergeProps, mapArray, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import typescript from "typescript";
function createExtension({
  type,
  transform
}) {
  return ({ path, source: initial, fs }) => createFile({
    type,
    initial,
    transform: transform ? (source) => transform({ path, source, fs }) : void 0
  });
}
function createFile({
  type,
  initial,
  transform
}) {
  const [get, set] = createSignal(initial);
  const [listen, emit] = createSignal(null, { equals: false });
  const transformed = createAsync(async () => transform ? transform(get()) : get());
  function createUrl() {
    const _transformed = transformed();
    if (!_transformed)
      return;
    const blob = new Blob([_transformed], { type: `text/${type}` });
    return URL.createObjectURL(blob);
  }
  const cachedUrl = createMemo((previous) => {
    if (previous)
      URL.revokeObjectURL(previous);
    listen();
    return createUrl();
  });
  return {
    type,
    get,
    set,
    transformed,
    cachedUrl,
    createUrl,
    invalidateUrl: emit
  };
}
function createFileSystem(extensions2) {
  const [dirEnts, setDirEnts] = createStore({});
  function normalizePath2(path) {
    return path.replace(/^\/+/, "");
  }
  function getExtension2(path) {
    var _a;
    return (_a = path.split("/").slice(-1)[0]) == null ? void 0 : _a.split(".")[1];
  }
  function getParentDirectory(path) {
    return path.split("/").slice(0, -1).join("/");
  }
  function assertPathExists(path) {
    const parts = path.split("/");
    const pathExists = parts.map((_, index) => parts.slice(0, index + 1).join("/")).filter(Boolean).every((path2) => path2 in dirEnts);
    if (!pathExists) {
      throw `Path is invalid ${path}`;
    }
    return true;
  }
  function getDirEnt(path) {
    path = normalizePath2(path);
    const dirEnt = dirEnts[path];
    if ((dirEnt == null ? void 0 : dirEnt.type) === "dir") {
      throw `Path is not a file: ${dirEnt}`;
    }
    return dirEnt;
  }
  function url(path) {
    var _a;
    return (_a = getDirEnt(path)) == null ? void 0 : _a.cachedUrl();
  }
  url.invalidate = (path) => {
    var _a;
    return (_a = getDirEnt(path)) == null ? void 0 : _a.invalidateUrl();
  };
  url.create = (path) => {
    var _a;
    return (_a = getDirEnt(path)) == null ? void 0 : _a.createUrl();
  };
  url.watch = (path, callback) => {
    createEffect(() => {
      var _a;
      return callback((_a = getDirEnt(path)) == null ? void 0 : _a.cachedUrl());
    });
  };
  function readdir(path, options) {
    path = normalizePath2(path);
    assertPathExists(path);
    if (options == null ? void 0 : options.withFileTypes) {
      return Object.entries(dirEnts).filter(([_path]) => getParentDirectory(_path) === path && path !== _path).map(([path2, file]) => ({
        type: file.type,
        path: path2
      }));
    }
    return Object.keys(dirEnts).filter((_path) => getParentDirectory(_path) === path);
  }
  const fs = {
    url,
    paths: () => Object.keys(dirEnts),
    transformed: (path) => {
      var _a;
      return (_a = getDirEnt(path)) == null ? void 0 : _a.transformed();
    },
    getType(path) {
      path = normalizePath2(path);
      assertPathExists(path);
      return dirEnts[path].type;
    },
    readdir,
    mkdir(path, options) {
      path = normalizePath2(path);
      if (options == null ? void 0 : options.recursive) {
        const parts = path.split("/");
        parts.forEach((_, index) => {
          setDirEnts(parts.slice(0, index + 1).join("/"), { type: "dir" });
        });
        return;
      }
      assertPathExists(getParentDirectory(path));
      setDirEnts(path, { type: "dir" });
    },
    readFile(path) {
      path = normalizePath2(path);
      const dirEnt = dirEnts[path];
      if ((dirEnt == null ? void 0 : dirEnt.type) === "dir") {
        throw `Path is not a file ${path}`;
      }
      return dirEnt == null ? void 0 : dirEnt.get();
    },
    rename(previous, next) {
      previous = normalizePath2(previous);
      next = normalizePath2(next);
      assertPathExists(previous);
      setDirEnts(
        produce((files) => {
          Object.keys(dirEnts).forEach((path) => {
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
      path = normalizePath2(path);
      if (!options || !options.force) {
        assertPathExists(path);
      }
      if (!options || !options.recursive) {
        const _dirEnts = Object.keys(dirEnts).filter((value) => {
          if (value === path)
            return false;
          return value.includes(path);
        });
        if (_dirEnts.length > 0) {
          throw `Directory is not empty ${_dirEnts}`;
        }
      }
      setDirEnts(
        produce((files) => {
          Object.keys(files).filter((value) => value.includes(path)).forEach((path2) => delete files[path2]);
        })
      );
    },
    writeFile(path, source) {
      var _a;
      path = normalizePath2(path);
      assertPathExists(getParentDirectory(path));
      const dirEnt = dirEnts[path];
      if ((dirEnt == null ? void 0 : dirEnt.type) === "dir") {
        throw `A directory already exist with the same name: ${path}`;
      }
      const extension = getExtension2(path);
      if (dirEnt) {
        dirEnt.set(source);
      } else {
        let dirEnt2 = extension && ((_a = extensions2[extension]) == null ? void 0 : _a.call(extensions2, { path, source, fs }));
        dirEnt2 || (dirEnt2 = createFile({
          type: "unknown",
          initial: source
        }));
        setDirEnts(path, dirEnt2);
      }
    }
  };
  return fs;
}
function last(array) {
  return array[array.length - 1];
}
function resolvePath(currentPath, relativePath) {
  const pathIsUrl = isUrl$1(currentPath);
  const base = pathIsUrl ? currentPath : new URL(currentPath, "http://example.com/");
  const absoluteUrl = new URL(relativePath, base);
  return pathIsUrl ? absoluteUrl.href : absoluteUrl.pathname;
}
function isUrl$1(path) {
  return path.startsWith("blob:") || path.startsWith("http:") || path.startsWith("https:");
}
function getExtension(path) {
  const filename = last(path.split("/"));
  return (filename == null ? void 0 : filename.includes(".")) ? last(filename.split(".")) : void 0;
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
var Monaco;
((Monaco2) => {
  ((ModuleKind2) => {
    ModuleKind2[ModuleKind2["None"] = 0] = "None";
    ModuleKind2[ModuleKind2["CommonJS"] = 1] = "CommonJS";
    ModuleKind2[ModuleKind2["AMD"] = 2] = "AMD";
    ModuleKind2[ModuleKind2["UMD"] = 3] = "UMD";
    ModuleKind2[ModuleKind2["System"] = 4] = "System";
    ModuleKind2[ModuleKind2["ES2015"] = 5] = "ES2015";
    ModuleKind2[ModuleKind2["ESNext"] = 99] = "ESNext";
  })(Monaco2.ModuleKind || (Monaco2.ModuleKind = {}));
  ((JsxEmit2) => {
    JsxEmit2[JsxEmit2["None"] = 0] = "None";
    JsxEmit2[JsxEmit2["Preserve"] = 1] = "Preserve";
    JsxEmit2[JsxEmit2["React"] = 2] = "React";
    JsxEmit2[JsxEmit2["ReactNative"] = 3] = "ReactNative";
    JsxEmit2[JsxEmit2["ReactJSX"] = 4] = "ReactJSX";
    JsxEmit2[JsxEmit2["ReactJSXDev"] = 5] = "ReactJSXDev";
  })(Monaco2.JsxEmit || (Monaco2.JsxEmit = {}));
  ((NewLineKind2) => {
    NewLineKind2[NewLineKind2["CarriageReturnLineFeed"] = 0] = "CarriageReturnLineFeed";
    NewLineKind2[NewLineKind2["LineFeed"] = 1] = "LineFeed";
  })(Monaco2.NewLineKind || (Monaco2.NewLineKind = {}));
  ((ScriptTarget2) => {
    ScriptTarget2[ScriptTarget2["ES3"] = 0] = "ES3";
    ScriptTarget2[ScriptTarget2["ES5"] = 1] = "ES5";
    ScriptTarget2[ScriptTarget2["ES2015"] = 2] = "ES2015";
    ScriptTarget2[ScriptTarget2["ES2016"] = 3] = "ES2016";
    ScriptTarget2[ScriptTarget2["ES2017"] = 4] = "ES2017";
    ScriptTarget2[ScriptTarget2["ES2018"] = 5] = "ES2018";
    ScriptTarget2[ScriptTarget2["ES2019"] = 6] = "ES2019";
    ScriptTarget2[ScriptTarget2["ES2020"] = 7] = "ES2020";
    ScriptTarget2[ScriptTarget2["ESNext"] = 99] = "ESNext";
    ScriptTarget2[ScriptTarget2["JSON"] = 100] = "JSON";
    ScriptTarget2[ScriptTarget2["Latest"] = 99] = "Latest";
  })(Monaco2.ScriptTarget || (Monaco2.ScriptTarget = {}));
  ((ModuleResolutionKind2) => {
    ModuleResolutionKind2[ModuleResolutionKind2["Classic"] = 1] = "Classic";
    ModuleResolutionKind2[ModuleResolutionKind2["NodeJs"] = 2] = "NodeJs";
  })(Monaco2.ModuleResolutionKind || (Monaco2.ModuleResolutionKind = {}));
})(Monaco || (Monaco = {}));
function createMonacoTypeDownloader(tsconfig) {
  const [types, setTypes] = createStore({});
  const [aliases, setAliases] = createSignal({});
  function addAlias(alias, path) {
    setAliases((paths) => {
      paths[alias] = [`file:///${path}`];
      return { ...paths };
    });
  }
  return {
    get tsconfig() {
      return {
        ...tsconfig,
        paths: {
          ...mapObject(tsconfig.paths || {}, (value) => value.map((path) => `file:///${path}`)),
          ...aliases()
        }
      };
    },
    types,
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
    }
  };
}
function bindMonaco(config) {
  const languages = mergeProps(
    {
      tsx: "typescript",
      ts: "typescript"
    },
    () => config.languages
  );
  function getType(path) {
    let type = config.fs.getType(path);
    const extension = getExtension(path);
    if (extension && extension in languages) {
      type = languages[extension];
    }
    return type;
  }
  createEffect(() => {
    config.editor.onDidChangeModelContent(
      (event) => config.fs.writeFile(config.path, config.editor.getModel().getValue())
    );
  });
  createEffect(
    mapArray(config.fs.paths, (path) => {
      createEffect(() => {
        const type = getType(path);
        if (type === "dir")
          return;
        const uri = config.monaco.Uri.parse(`file:///${path}`);
        const model = config.monaco.editor.getModel(uri) || config.monaco.editor.createModel("", type, uri);
        createEffect(() => {
          const value = config.fs.readFile(path) || "";
          if (value !== model.getValue()) {
            model.setValue(config.fs.readFile(path) || "");
          }
        });
        onCleanup(() => model.dispose());
      });
    })
  );
  createEffect(() => {
    const uri = config.monaco.Uri.parse(`file:///${config.path}`);
    let type = getType(config.path);
    const model = config.monaco.editor.getModel(uri) || config.monaco.editor.createModel("", type, uri);
    config.editor.setModel(model);
  });
  createEffect(() => {
    if (config.tsconfig) {
      config.monaco.languages.typescript.typescriptDefaults.setCompilerOptions(config.tsconfig);
      config.monaco.languages.typescript.javascriptDefaults.setCompilerOptions(config.tsconfig);
    }
  });
  createEffect(
    mapArray(
      () => Object.keys(config.types ?? {}),
      (name) => {
        createEffect(() => {
          var _a;
          const declaration = (_a = config.types) == null ? void 0 : _a[name];
          if (!declaration)
            return;
          const path = `file:///${name}`;
          config.monaco.languages.typescript.typescriptDefaults.addExtraLib(declaration, path);
          config.monaco.languages.typescript.javascriptDefaults.addExtraLib(declaration, path);
        });
      }
    )
  );
}
const domParser = new DOMParser();
const xmlSerializer = new XMLSerializer();
function parseHtml({ path, source, fs }) {
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
        const url = fs.url(resolvePath(path, href));
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
        const url = fs.url(resolvePath(path, script.getAttribute("src")));
        if (url)
          script.setAttribute("src", url);
      });
    },
    /** Transform content of all `<script type="module" />` elements */
    transformModuleScriptContent(transformJs) {
      return api.select('script[type="module"]', (script) => {
        if (script.type !== "module" || !script.textContent)
          return;
        script.textContent = transformJs({ path, source: script.textContent, fs });
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
  Monaco,
  babelTransform,
  bindMonaco,
  createExtension,
  createFile,
  createFileSystem,
  createMonacoTypeDownloader,
  downloadTypesFromUrl,
  downloadTypesfromPackage,
  getExtension,
  isUrl$1 as isUrl,
  parseHtml,
  resolvePackageEntries,
  resolvePath,
  transformModulePaths
};
