true&&(function polyfill() {
    const relList = document.createElement('link').relList;
    if (relList && relList.supports && relList.supports('modulepreload')) {
        return;
    }
    for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
        processPreload(link);
    }
    new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type !== 'childList') {
                continue;
            }
            for (const node of mutation.addedNodes) {
                if (node.tagName === 'LINK' && node.rel === 'modulepreload')
                    processPreload(node);
            }
        }
    }).observe(document, { childList: true, subtree: true });
    function getFetchOpts(link) {
        const fetchOpts = {};
        if (link.integrity)
            fetchOpts.integrity = link.integrity;
        if (link.referrerPolicy)
            fetchOpts.referrerPolicy = link.referrerPolicy;
        if (link.crossOrigin === 'use-credentials')
            fetchOpts.credentials = 'include';
        else if (link.crossOrigin === 'anonymous')
            fetchOpts.credentials = 'omit';
        else
            fetchOpts.credentials = 'same-origin';
        return fetchOpts;
    }
    function processPreload(link) {
        if (link.ep)
            // ep marker = processed
            return;
        link.ep = true;
        // prepopulate the load record
        const fetchOpts = getFetchOpts(link);
        fetch(link.href, fetchOpts);
    }
}());

const indexCss = ".repl {\n  display: grid;\n  grid-template-rows: auto 1fr 1fr;\n  gap: 5px;\n  height: 100%;\n}\n\niframe {\n  border: 1px solid black;\n  width: 100%;\n  height: 100%;\n}\n";

const indexHtml = "<script src=\"./main.ts\" type=\"module\"></script>\n<link href=\"./index.css\" rel=\"stylesheet\"></link>\n<div id=\"root\"></div>\n";

const mainTs = "import {\n  createFileSystem,\n  isUrl,\n  parseHtml,\n  resolvePath,\n  Transform,\n  transformModulePaths,\n} from '@bigmistqke/repl'\nimport { createSignal } from 'solid-js'\nimport html from 'solid-js/html'\nimport { render } from 'solid-js/web'\nimport ts from 'typescript'\n\nfunction createRepl() {\n  const transformJs: Transform = ({ path, source, executables }) => {\n    return transformModulePaths(source, modulePath => {\n      if (modulePath.startsWith('.')) {\n        // Swap relative module-path out with their respective module-url\n        const url = executables.get(resolvePath(path, modulePath))\n        if (!url) throw 'url is undefined'\n        return url\n      } else if (isUrl(modulePath)) {\n        // Return url directly\n        return modulePath\n      } else {\n        // Wrap external modules with esm.sh\n        return `https://esm.sh/${modulePath}`\n      }\n    })!\n  }\n\n  return createFileSystem({\n    css: { type: 'css' },\n    js: {\n      type: 'javascript',\n      transform: transformJs,\n    },\n    ts: {\n      type: 'javascript',\n      transform({ path, source, fs }) {\n        return transformJs({ path, source: ts.transpile(source), fs })\n      },\n    },\n    html: {\n      type: 'html',\n      transform(config) {\n        return (\n          parseHtml(config)\n            // Transform content of all `<script type=\"module\" />` elements\n            .transformModuleScriptContent(transformJs)\n            // Bind relative `src`-attribute of all `<script />` elements\n            .bindScriptSrc()\n            // Bind relative `href`-attribute of all `<link />` elements\n            .bindLinkHref()\n            .toString()\n        )\n      },\n    },\n  })\n}\n\nrender(() => {\n  const [selectedPath, setSelectedPath] = createSignal<string>('index.html')\n\n  const repl = createRepl()\n\n  repl.writeFile(\n    'index.html',\n    `<head>\n  <script src=\"./main.ts\"><\/script>\n<link rel=\"stylesheet\" href=\"./index.css\"></link>\n</head>\n<body>\nhallo world 👋\n</body>`,\n  )\n\n  repl.writeFile('index.css', `body { font-size: 32pt; }`)\n\n  repl.writeFile(\n    'main.ts',\n    `function randomValue(){\n  return 200 + Math.random() * 50\n}\n    \nfunction randomColor(){\n  document.body.style.background = \\`rgb(\\${randomValue()}, \\${randomValue()}, \\${randomValue()})\\`\n}    \n\nrequestAnimationFrame(randomColor)\nsetInterval(randomColor, 2000)`,\n  )\n\n  const Button = (props: { path: string }) =>\n    html`<button onclick=\"${() => setSelectedPath(props.path)}\">${props.path}</button>`\n\n  return html`<div class=\"repl\">\n    <div style=\"display: flex; align-content: start; gap: 5px;\">\n      <${Button} path=\"index.html\" />\n      <${Button} path=\"index.css\" />\n      <${Button} path=\"main.ts\" />\n    </div>\n    <textarea\n      oninput=${e => repl.writeFile(selectedPath(), e.target.value)}\n      value=${() => repl.readFile(selectedPath())}\n    ></textarea>\n    <iframe src=${() => repl.executables.get('index.html')}></iframe>\n  </div> `\n}, document.getElementById('root')!)\n";

const demoTest = {
  "index.css": indexCss,
  "index.html": indexHtml,
  "main.ts": mainTs
};

console.log(demoTest);
