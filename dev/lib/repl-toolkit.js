import { createAsync } from "@solidjs/router";
import { createSignal, createMemo } from "solid-js";
import { createStore, produce } from "solid-js/store";
import typescript from "typescript";
function createExtension({
  type,
  transform
}) {
  return (path, initial, fs) => createFile({
    type,
    initial,
    transform: transform ? (source) => transform(path, source, fs) : void 0
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
  const cachedUrl = createMemo(() => (listen(), createUrl()));
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
function createFileSystem(extensions) {
  const [dirEnts, setDirEnts] = createStore({});
  function normalizePath(path) {
    return path.replace(/^\/+/, "");
  }
  function getExtension(path) {
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
    path = normalizePath(path);
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
  function readdir(path, options) {
    path = normalizePath(path);
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
    transformed: (path) => {
      var _a;
      return (_a = getDirEnt(path)) == null ? void 0 : _a.transformed();
    },
    getType(path) {
      path = normalizePath(path);
      assertPathExists(path);
      return dirEnts[path].type;
    },
    readdir,
    mkdir(path, options) {
      path = normalizePath(path);
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
      path = normalizePath(path);
      const dirEnt = dirEnts[path];
      if ((dirEnt == null ? void 0 : dirEnt.type) === "dir") {
        throw `Path is not a file ${path}`;
      }
      return dirEnt == null ? void 0 : dirEnt.get();
    },
    rename(previous, next) {
      previous = normalizePath(previous);
      next = normalizePath(next);
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
      path = normalizePath(path);
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
      path = normalizePath(path);
      assertPathExists(getParentDirectory(path));
      const dirEnt = dirEnts[path];
      if ((dirEnt == null ? void 0 : dirEnt.type) === "dir") {
        throw `A directory already exist with the same name: ${path}`;
      }
      const extension = getExtension(path);
      if (dirEnt) {
        dirEnt.set(source);
      } else {
        let dirEnt2 = extension && ((_a = extensions[extension]) == null ? void 0 : _a.call(extensions, path, source, fs));
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
function relativeToAbsolutePath(currentPath, relativePath) {
  const base = new URL(currentPath, "http://example.com/");
  const absoluteUrl = new URL(relativePath, base);
  return absoluteUrl.pathname;
}
function isUrl(path) {
  return path.startsWith("blob:") || path.startsWith("http:") || path.startsWith("https:");
}
function isRelativePath(path) {
  return path.startsWith(".");
}
async function downloadTypesFromUrl({
  url,
  declarationFiles = {},
  cdn = "https://www.esm.sh"
}) {
  async function resolvePath2(path) {
    const virtualPath = getVirtualPath(path);
    if (virtualPath in declarationFiles)
      return;
    const code = await fetch(path).then((response) => {
      if (response.status !== 200) {
        throw new Error(`Error while loading ${url}`);
      }
      return response.text();
    });
    const promises = new Array();
    const transformedCode = transformModulePaths(code, (modulePath) => {
      if (isRelativePath(modulePath)) {
        promises.push(resolvePath2(relativeToAbsolutePath(path, modulePath)));
        if (modulePath.endsWith(".js")) {
          return modulePath.replace(".js", ".d.ts");
        }
      } else if (isUrl(modulePath)) {
        const virtualPath2 = getVirtualPath(modulePath);
        promises.push(downloadTypesFromUrl({ url: modulePath, declarationFiles, cdn }));
        return virtualPath2;
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
  await resolvePath2(url);
  return declarationFiles;
}
async function downloadTypesfromPackage({
  name,
  declarationFiles = {},
  cdn = "https://www.esm.sh"
}) {
  const typeUrl = await fetch(`${cdn}/${name}`).then((result) => result.headers.get("X-TypeScript-Types")).catch((error) => {
    console.info(error);
    return void 0;
  });
  if (!typeUrl) {
    throw `no type url was found for package ${name}`;
  }
  return downloadTypesFromUrl({ url: typeUrl, declarationFiles, cdn });
}
function getVirtualPath(url, cdn = "https://www.esm.sh") {
  return url.replace(`${cdn}/`, "").split("/").slice(1).join("/");
}
const domParser = new DOMParser();
const xmlSerializer = new XMLSerializer();
function parseHtml(source) {
  const doc = domParser.parseFromString(source, "text/html");
  const api = {
    select(selector, callback) {
      Array.from(doc.querySelectorAll(selector)).forEach(callback);
      return api;
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
function resolvePath(currentPath, relativePath) {
  return new URL(relativePath, new URL(currentPath, "http://example.com/")).pathname;
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
  createExtension,
  createFile,
  createFileSystem,
  downloadTypesFromUrl,
  parseHtml,
  resolvePackageEntries,
  resolvePath,
  transformModulePaths
};
