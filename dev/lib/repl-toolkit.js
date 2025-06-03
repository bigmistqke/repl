var __accessCheck = (obj, member, msg) => {
  if (!member.has(obj))
    throw TypeError("Cannot " + msg);
};
var __privateGet = (obj, member, getter) => {
  __accessCheck(obj, member, "read from private field");
  return getter ? getter.call(obj) : member.get(obj);
};
var __privateAdd = (obj, member, value) => {
  if (member.has(obj))
    throw TypeError("Cannot add the same private member more than once");
  member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
};
var __privateSet = (obj, member, value, setter) => {
  __accessCheck(obj, member, "write to private field");
  setter ? setter.call(obj, value) : member.set(obj, value);
  return value;
};
var _map, _keyTriggers, _valueTriggers, _triggers;
import { getListener, createSignal, onCleanup, DEV, batch, createResource, untrack, createComputed, mapArray, createMemo, createEffect } from "solid-js";
import { createStore } from "solid-js/store";
import typescript, { ScriptTarget, ScriptKind, transform } from "typescript";
import serialize from "dom-serializer";
import { findAll, hasAttrib, getAttributeValue } from "domutils";
import { parseDocument } from "htmlparser2";
const triggerOptions = DEV ? { equals: false, name: "trigger" } : { equals: false };
const triggerCacheOptions = DEV ? { equals: false, internal: true } : triggerOptions;
class TriggerCache {
  constructor(mapConstructor = Map) {
    __privateAdd(this, _map, void 0);
    __privateSet(this, _map, new mapConstructor());
  }
  dirty(key) {
    var _a;
    (_a = __privateGet(this, _map).get(key)) == null ? void 0 : _a.$$();
  }
  dirtyAll() {
    for (const trigger of __privateGet(this, _map).values())
      trigger.$$();
  }
  track(key) {
    if (!getListener())
      return;
    let trigger = __privateGet(this, _map).get(key);
    if (!trigger) {
      const [$, $$] = createSignal(void 0, triggerCacheOptions);
      __privateGet(this, _map).set(key, trigger = { $, $$, n: 1 });
    } else
      trigger.n++;
    onCleanup(() => {
      if (--trigger.n === 0)
        queueMicrotask(() => trigger.n === 0 && __privateGet(this, _map).delete(key));
    });
    trigger.$();
  }
}
_map = new WeakMap();
const $OBJECT = Symbol("track-object");
class ReactiveMap extends Map {
  constructor(entries) {
    super();
    __privateAdd(this, _keyTriggers, new TriggerCache());
    __privateAdd(this, _valueTriggers, new TriggerCache());
    if (entries)
      for (const entry of entries)
        super.set(...entry);
  }
  [Symbol.iterator]() {
    return this.entries();
  }
  get size() {
    __privateGet(this, _keyTriggers).track($OBJECT);
    return super.size;
  }
  *keys() {
    __privateGet(this, _keyTriggers).track($OBJECT);
    for (const key of super.keys()) {
      yield key;
    }
  }
  *values() {
    __privateGet(this, _valueTriggers).track($OBJECT);
    for (const value of super.values()) {
      yield value;
    }
  }
  *entries() {
    __privateGet(this, _keyTriggers).track($OBJECT);
    __privateGet(this, _valueTriggers).track($OBJECT);
    for (const entry of super.entries()) {
      yield entry;
    }
  }
  forEach(callbackfn, thisArg) {
    __privateGet(this, _keyTriggers).track($OBJECT);
    __privateGet(this, _valueTriggers).track($OBJECT);
    super.forEach(callbackfn, thisArg);
  }
  has(key) {
    __privateGet(this, _keyTriggers).track(key);
    return super.has(key);
  }
  get(key) {
    __privateGet(this, _valueTriggers).track(key);
    return super.get(key);
  }
  set(key, value) {
    const hadNoKey = !super.has(key);
    const hasChanged = super.get(key) !== value;
    const result = super.set(key, value);
    if (hasChanged || hadNoKey) {
      batch(() => {
        if (hadNoKey) {
          __privateGet(this, _keyTriggers).dirty($OBJECT);
          __privateGet(this, _keyTriggers).dirty(key);
        }
        if (hasChanged) {
          __privateGet(this, _valueTriggers).dirty($OBJECT);
          __privateGet(this, _valueTriggers).dirty(key);
        }
      });
    }
    return result;
  }
  delete(key) {
    const isDefined = super.get(key) !== void 0;
    const result = super.delete(key);
    if (result) {
      batch(() => {
        __privateGet(this, _keyTriggers).dirty($OBJECT);
        __privateGet(this, _valueTriggers).dirty($OBJECT);
        __privateGet(this, _keyTriggers).dirty(key);
        if (isDefined) {
          __privateGet(this, _valueTriggers).dirty(key);
        }
      });
    }
    return result;
  }
  clear() {
    if (super.size === 0)
      return;
    batch(() => {
      __privateGet(this, _keyTriggers).dirty($OBJECT);
      __privateGet(this, _valueTriggers).dirty($OBJECT);
      for (const key of super.keys()) {
        __privateGet(this, _keyTriggers).dirty(key);
        __privateGet(this, _valueTriggers).dirty(key);
      }
      super.clear();
    });
  }
}
_keyTriggers = new WeakMap();
_valueTriggers = new WeakMap();
const $KEYS = Symbol("track-keys");
class ReactiveSet extends Set {
  constructor(values) {
    super();
    __privateAdd(this, _triggers, new TriggerCache());
    if (values)
      for (const value of values)
        super.add(value);
  }
  [Symbol.iterator]() {
    return this.values();
  }
  get size() {
    __privateGet(this, _triggers).track($KEYS);
    return super.size;
  }
  has(value) {
    __privateGet(this, _triggers).track(value);
    return super.has(value);
  }
  keys() {
    return this.values();
  }
  *values() {
    __privateGet(this, _triggers).track($KEYS);
    for (const value of super.values()) {
      yield value;
    }
  }
  *entries() {
    __privateGet(this, _triggers).track($KEYS);
    for (const entry of super.entries()) {
      yield entry;
    }
  }
  forEach(callbackfn, thisArg) {
    __privateGet(this, _triggers).track($KEYS);
    super.forEach(callbackfn, thisArg);
  }
  add(value) {
    if (!super.has(value)) {
      super.add(value);
      batch(() => {
        __privateGet(this, _triggers).dirty(value);
        __privateGet(this, _triggers).dirty($KEYS);
      });
    }
    return this;
  }
  delete(value) {
    const result = super.delete(value);
    if (result) {
      batch(() => {
        __privateGet(this, _triggers).dirty(value);
        __privateGet(this, _triggers).dirty($KEYS);
      });
    }
    return result;
  }
  clear() {
    if (!super.size)
      return;
    batch(() => {
      __privateGet(this, _triggers).dirty($KEYS);
      for (const member of super.values()) {
        __privateGet(this, _triggers).dirty(member);
      }
      super.clear();
    });
  }
}
_triggers = new WeakMap();
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
  const pathIsUrl = isUrl(currentPath);
  const base = pathIsUrl ? currentPath : new URL(currentPath, "http://example.com/");
  const absoluteUrl = new URL(relativePath, base);
  return normalizePath$1(pathIsUrl ? absoluteUrl.href : absoluteUrl.pathname);
}
function isUrl(path) {
  return path.startsWith("blob:") || path.startsWith("http:") || path.startsWith("https:");
}
function createFileUrl(source, type) {
  const blob = new Blob([source], {
    type: `text/${type || "plain"}`
  });
  return URL.createObjectURL(blob);
}
function createFileUrlSystem(readFile, extensions2) {
  const actions = new ReactiveMap();
  const paths = new ReactiveSet();
  const api = {
    get(path, { cached = true } = { cached: true }) {
      var _a, _b;
      paths.add(path);
      if (!cached) {
        return (_a = actions.get(path)) == null ? void 0 : _a.create();
      }
      return (_b = actions.get(path)) == null ? void 0 : _b.get();
    },
    invalidate(path) {
      var _a;
      return (_a = actions.get(path)) == null ? void 0 : _a.invalidate();
    }
  };
  createComputed(
    mapArray(
      () => Array.from(paths.keys()),
      (path) => {
        const extension = getExtension(path);
        const [listen, invalidate] = createSignal(null, { equals: false });
        const source = createAsync(async () => {
          try {
            return await readFile(path);
          } catch {
            paths.delete(path);
            return void 0;
          }
        });
        const sourceTransformer = createAsync(() => {
          var _a, _b, _c, _d, _e;
          const _source = source();
          if (_source === void 0 || _source === null)
            return void 0;
          if ((_a = extensions2[extension]) == null ? void 0 : _a.transform) {
            return createMemo(
              (_c = (_b = extensions2[extension]) == null ? void 0 : _b.transform) == null ? void 0 : _c.call(_b, {
                path,
                source: _source,
                fileUrls: api
              })
            );
          }
          return ((_e = (_d = extensions2[extension]) == null ? void 0 : _d.transform) == null ? void 0 : _e.call(_d, {
            path,
            source: _source,
            fileUrls: api
          })) || (() => _source);
        });
        const getTransformedSource = () => {
          var _a;
          return (_a = sourceTransformer()) == null ? void 0 : _a();
        };
        const get = createMemo((previous) => {
          if (previous)
            URL.revokeObjectURL(previous);
          listen();
          return create();
        });
        function create() {
          var _a;
          const transformedSource = getTransformedSource();
          if (!transformedSource)
            return void 0;
          return createFileUrl(transformedSource, (_a = extensions2[extension]) == null ? void 0 : _a.type);
        }
        actions.set(path, {
          get,
          create,
          invalidate
        });
        onCleanup(() => actions.delete(path));
      }
    )
  );
  createEffect(() => console.log("paths", [...paths.keys()]));
  return api;
}
function transformModulePaths(code, callback) {
  const sourceFile = typescript.createSourceFile("", code, ScriptTarget.Latest, true, ScriptKind.TS);
  let shouldPrint = false;
  const result = transform(sourceFile, [
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
        promises.push(downloadTypesfromPackageName({ name: modulePath, declarationFiles, cdn }));
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
async function downloadTypesfromPackageName({
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
        const { types: types2, path } = await downloadTypesfromPackageName({ name });
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
function createTransformModulePaths(ts, input) {
  const sourceFile = ts.createSourceFile("", input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const ranges = [];
  function collect(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const isImport = ts.isImportDeclaration(node);
      const text = node.moduleSpecifier.text;
      const start = node.moduleSpecifier.getStart(sourceFile) + 1;
      const end = node.moduleSpecifier.getEnd() - 1;
      ranges.push({ start, end, path: text, isImport });
    }
    ts.forEachChild(node, collect);
  }
  collect(sourceFile);
  return (transform2) => {
    let modified = false;
    const edits = [];
    for (const { start, end, path, isImport } of ranges) {
      const replacement = transform2(path, isImport);
      if (replacement !== null && replacement !== path) {
        edits.push({ start, end, replacement });
        modified = true;
      }
    }
    if (!modified) {
      return input;
    }
    let result = input;
    for (let i = edits.length - 1; i >= 0; i--) {
      const { start, end, replacement } = edits[i];
      result = result.slice(0, start) + replacement + result.slice(end);
    }
    return result;
  };
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
function transformHtmlWorker({ path, source, fileUrls }) {
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
    transformLinkHref() {
      return api.select("link", (link) => {
        if (hasAttrib(link, "href")) {
          const href = getAttributeValue(link, "href");
          if (!href || isUrl(href))
            return;
          const url = fileUrls.get(resolvePath(path, href));
          if (url)
            link.attribs.href = url;
        }
      });
    },
    /** Bind relative `src`-attribute of all `<script />` elements */
    transformScriptSrc() {
      return api.select("script", (script) => {
        if (hasAttrib(script, "src")) {
          const src = getAttributeValue(script, "src");
          if (!src || isUrl(src))
            return;
          const url = fileUrls.get(resolvePath(path, src));
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
          const transformedContent = transformJs({
            path,
            source: scriptContent,
            fileUrls
          });
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
function transformHtml({ path, source, fileUrls }) {
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
    transformLinkHref() {
      return api.select("link[href]", (link) => {
        const href = link.getAttribute("href");
        if (isUrl(href))
          return;
        const url = fileUrls.get(resolvePath(path, href));
        if (url)
          link.setAttribute("href", url);
      });
    },
    /** Bind relative `src`-attribute of all `<script />` elements */
    transformScriptSrc() {
      return api.select("script[src]", (script) => {
        const src = script.getAttribute("src");
        if (isUrl(src))
          return;
        const url = fileUrls.get(resolvePath(path, script.getAttribute("src")));
        if (url)
          script.setAttribute("src", url);
      });
    },
    /** Transform content of all `<script type="module" />` elements */
    transformModuleScriptContent(transformJs) {
      return api.select('script[type="module"]', (script) => {
        if (script.type !== "module" || !script.textContent)
          return;
        script.textContent = transformJs({
          path,
          source: script.textContent,
          fileUrls
        })();
      });
    },
    toString() {
      return xmlSerializer.serializeToString(doc);
    }
  };
  return api;
}
export {
  babelTransform,
  createFileUrlSystem,
  createMonacoTypeDownloader,
  createTransformModulePaths,
  downloadTypesFromUrl,
  downloadTypesfromPackageName,
  getExtension,
  getName,
  getParentPath,
  isUrl,
  normalizePath$1 as normalizePath,
  resolvePackageEntries,
  resolvePath,
  transformHtml,
  transformHtmlWorker,
  transformModulePaths
};
