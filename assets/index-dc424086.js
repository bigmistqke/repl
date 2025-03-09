import { c as createRoot, a as createRenderEffect, u as untrack, m as mergeProps, s as splitProps, b as createSignal, d as createSelector, e as children, f as createMemo, g as createEffect, o as onCleanup, h as mapArray, i as createComponent, j as useContext, k as on, l as createContext, n as createWorkerProxy, p as createResource, S as Show, I as Index, q as getExtension } from './index-5304fc13.js';

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

const booleans = [
  "allowfullscreen",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "disabled",
  "formnovalidate",
  "hidden",
  "indeterminate",
  "inert",
  "ismap",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "novalidate",
  "open",
  "playsinline",
  "readonly",
  "required",
  "reversed",
  "seamless",
  "selected"
];
const Properties = /*#__PURE__*/ new Set([
  "className",
  "value",
  "readOnly",
  "formNoValidate",
  "isMap",
  "noModule",
  "playsInline",
  ...booleans
]);
const ChildProperties = /*#__PURE__*/ new Set([
  "innerHTML",
  "textContent",
  "innerText",
  "children"
]);
const Aliases = /*#__PURE__*/ Object.assign(Object.create(null), {
  className: "class",
  htmlFor: "for"
});
const PropAliases = /*#__PURE__*/ Object.assign(Object.create(null), {
  class: "className",
  formnovalidate: {
    $: "formNoValidate",
    BUTTON: 1,
    INPUT: 1
  },
  ismap: {
    $: "isMap",
    IMG: 1
  },
  nomodule: {
    $: "noModule",
    SCRIPT: 1
  },
  playsinline: {
    $: "playsInline",
    VIDEO: 1
  },
  readonly: {
    $: "readOnly",
    INPUT: 1,
    TEXTAREA: 1
  }
});
function getPropAlias(prop, tagName) {
  const a = PropAliases[prop];
  return typeof a === "object" ? (a[tagName] ? a["$"] : undefined) : a;
}
const DelegatedEvents = /*#__PURE__*/ new Set([
  "beforeinput",
  "click",
  "dblclick",
  "contextmenu",
  "focusin",
  "focusout",
  "input",
  "keydown",
  "keyup",
  "mousedown",
  "mousemove",
  "mouseout",
  "mouseover",
  "mouseup",
  "pointerdown",
  "pointermove",
  "pointerout",
  "pointerover",
  "pointerup",
  "touchend",
  "touchmove",
  "touchstart"
]);
const SVGNamespace = {
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace"
};

function reconcileArrays(parentNode, a, b) {
  let bLength = b.length,
    aEnd = a.length,
    bEnd = bLength,
    aStart = 0,
    bStart = 0,
    after = a[aEnd - 1].nextSibling,
    map = null;
  while (aStart < aEnd || bStart < bEnd) {
    if (a[aStart] === b[bStart]) {
      aStart++;
      bStart++;
      continue;
    }
    while (a[aEnd - 1] === b[bEnd - 1]) {
      aEnd--;
      bEnd--;
    }
    if (aEnd === aStart) {
      const node = bEnd < bLength ? (bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart]) : after;
      while (bStart < bEnd) parentNode.insertBefore(b[bStart++], node);
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        if (!map || !map.has(a[aStart])) a[aStart].remove();
        aStart++;
      }
    } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
      const node = a[--aEnd].nextSibling;
      parentNode.insertBefore(b[bStart++], a[aStart++].nextSibling);
      parentNode.insertBefore(b[--bEnd], node);
      a[aEnd] = b[bEnd];
    } else {
      if (!map) {
        map = new Map();
        let i = bStart;
        while (i < bEnd) map.set(b[i], i++);
      }
      const index = map.get(a[aStart]);
      if (index != null) {
        if (bStart < index && index < bEnd) {
          let i = aStart,
            sequence = 1,
            t;
          while (++i < aEnd && i < bEnd) {
            if ((t = map.get(a[i])) == null || t !== index + sequence) break;
            sequence++;
          }
          if (sequence > index - bStart) {
            const node = a[aStart];
            while (bStart < index) parentNode.insertBefore(b[bStart++], node);
          } else parentNode.replaceChild(b[bStart++], a[aStart++]);
        } else aStart++;
      } else a[aStart++].remove();
    }
  }
}

const $$EVENTS = "_$DX_DELEGATE";
function render(code, element, init, options = {}) {
  let disposer;
  createRoot(dispose => {
    disposer = dispose;
    element === document
      ? code()
      : insert(element, code(), element.firstChild ? null : undefined, init);
  }, options.owner);
  return () => {
    disposer();
    element.textContent = "";
  };
}
function template(html, isImportNode, isSVG) {
  let node;
  const create = () => {
    const t = document.createElement("template");
    t.innerHTML = html;
    return isSVG ? t.content.firstChild.firstChild : t.content.firstChild;
  };
  const fn = isImportNode
    ? () => untrack(() => document.importNode(node || (node = create()), true))
    : () => (node || (node = create())).cloneNode(true);
  fn.cloneNode = fn;
  return fn;
}
function delegateEvents(eventNames, document = window.document) {
  const e = document[$$EVENTS] || (document[$$EVENTS] = new Set());
  for (let i = 0, l = eventNames.length; i < l; i++) {
    const name = eventNames[i];
    if (!e.has(name)) {
      e.add(name);
      document.addEventListener(name, eventHandler);
    }
  }
}
function setAttribute(node, name, value) {
  if (value == null) node.removeAttribute(name);
  else node.setAttribute(name, value);
}
function setAttributeNS(node, namespace, name, value) {
  if (value == null) node.removeAttributeNS(namespace, name);
  else node.setAttributeNS(namespace, name, value);
}
function setBoolAttribute(node, name, value) {
  value ? node.setAttribute(name, "") : node.removeAttribute(name);
}
function className(node, value) {
  if (value == null) node.removeAttribute("class");
  else node.className = value;
}
function addEventListener(node, name, handler, delegate) {
  if (delegate) {
    if (Array.isArray(handler)) {
      node[`$$${name}`] = handler[0];
      node[`$$${name}Data`] = handler[1];
    } else node[`$$${name}`] = handler;
  } else if (Array.isArray(handler)) {
    const handlerFn = handler[0];
    node.addEventListener(name, (handler[0] = e => handlerFn.call(node, handler[1], e)));
  } else node.addEventListener(name, handler, typeof handler !== "function" && handler);
}
function classList(node, value, prev = {}) {
  const classKeys = Object.keys(value || {}),
    prevKeys = Object.keys(prev);
  let i, len;
  for (i = 0, len = prevKeys.length; i < len; i++) {
    const key = prevKeys[i];
    if (!key || key === "undefined" || value[key]) continue;
    toggleClassKey(node, key, false);
    delete prev[key];
  }
  for (i = 0, len = classKeys.length; i < len; i++) {
    const key = classKeys[i],
      classValue = !!value[key];
    if (!key || key === "undefined" || prev[key] === classValue || !classValue) continue;
    toggleClassKey(node, key, true);
    prev[key] = classValue;
  }
  return prev;
}
function style(node, value, prev) {
  if (!value) return prev ? setAttribute(node, "style") : value;
  const nodeStyle = node.style;
  if (typeof value === "string") return (nodeStyle.cssText = value);
  typeof prev === "string" && (nodeStyle.cssText = prev = undefined);
  prev || (prev = {});
  value || (value = {});
  let v, s;
  for (s in prev) {
    value[s] == null && nodeStyle.removeProperty(s);
    delete prev[s];
  }
  for (s in value) {
    v = value[s];
    if (v !== prev[s]) {
      nodeStyle.setProperty(s, v);
      prev[s] = v;
    }
  }
  return prev;
}
function spread(node, props = {}, isSVG, skipChildren) {
  const prevProps = {};
  if (!skipChildren) {
    createRenderEffect(
      () => (prevProps.children = insertExpression(node, props.children, prevProps.children))
    );
  }
  createRenderEffect(() => typeof props.ref === "function" && use(props.ref, node));
  createRenderEffect(() => assign(node, props, isSVG, true, prevProps, true));
  return prevProps;
}
function use(fn, element, arg) {
  return untrack(() => fn(element, arg));
}
function insert(parent, accessor, marker, initial) {
  if (marker !== undefined && !initial) initial = [];
  if (typeof accessor !== "function") return insertExpression(parent, accessor, initial, marker);
  createRenderEffect(current => insertExpression(parent, accessor(), current, marker), initial);
}
function assign(node, props, isSVG, skipChildren, prevProps = {}, skipRef = false) {
  props || (props = {});
  for (const prop in prevProps) {
    if (!(prop in props)) {
      if (prop === "children") continue;
      prevProps[prop] = assignProp(node, prop, null, prevProps[prop], isSVG, skipRef, props);
    }
  }
  for (const prop in props) {
    if (prop === "children") {
      if (!skipChildren) insertExpression(node, props.children);
      continue;
    }
    const value = props[prop];
    prevProps[prop] = assignProp(node, prop, value, prevProps[prop], isSVG, skipRef, props);
  }
}
function toPropertyName(name) {
  return name.toLowerCase().replace(/-([a-z])/g, (_, w) => w.toUpperCase());
}
function toggleClassKey(node, key, value) {
  const classNames = key.trim().split(/\s+/);
  for (let i = 0, nameLen = classNames.length; i < nameLen; i++)
    node.classList.toggle(classNames[i], value);
}
function assignProp(node, prop, value, prev, isSVG, skipRef, props) {
  let isCE, isProp, isChildProp, propAlias, forceProp;
  if (prop === "style") return style(node, value, prev);
  if (prop === "classList") return classList(node, value, prev);
  if (value === prev) return prev;
  if (prop === "ref") {
    if (!skipRef) value(node);
  } else if (prop.slice(0, 3) === "on:") {
    const e = prop.slice(3);
    prev && node.removeEventListener(e, prev, typeof prev !== "function" && prev);
    value && node.addEventListener(e, value, typeof value !== "function" && value);
  } else if (prop.slice(0, 10) === "oncapture:") {
    const e = prop.slice(10);
    prev && node.removeEventListener(e, prev, true);
    value && node.addEventListener(e, value, true);
  } else if (prop.slice(0, 2) === "on") {
    const name = prop.slice(2).toLowerCase();
    const delegate = DelegatedEvents.has(name);
    if (!delegate && prev) {
      const h = Array.isArray(prev) ? prev[0] : prev;
      node.removeEventListener(name, h);
    }
    if (delegate || value) {
      addEventListener(node, name, value, delegate);
      delegate && delegateEvents([name]);
    }
  } else if (prop.slice(0, 5) === "attr:") {
    setAttribute(node, prop.slice(5), value);
  } else if (prop.slice(0, 5) === "bool:") {
    setBoolAttribute(node, prop.slice(5), value);
  } else if (
    (forceProp = prop.slice(0, 5) === "prop:") ||
    (isChildProp = ChildProperties.has(prop)) ||
    (!isSVG &&
      ((propAlias = getPropAlias(prop, node.tagName)) || (isProp = Properties.has(prop)))) ||
    (isCE = node.nodeName.includes("-") || "is" in props)
  ) {
    if (forceProp) {
      prop = prop.slice(5);
      isProp = true;
    }
    if (prop === "class" || prop === "className") className(node, value);
    else if (isCE && !isProp && !isChildProp) node[toPropertyName(prop)] = value;
    else node[propAlias || prop] = value;
  } else {
    const ns = isSVG && prop.indexOf(":") > -1 && SVGNamespace[prop.split(":")[0]];
    if (ns) setAttributeNS(node, ns, prop, value);
    else setAttribute(node, Aliases[prop] || prop, value);
  }
  return value;
}
function eventHandler(e) {
  let node = e.target;
  const key = `$$${e.type}`;
  const oriTarget = e.target;
  const oriCurrentTarget = e.currentTarget;
  const retarget = value =>
    Object.defineProperty(e, "target", {
      configurable: true,
      value
    });
  const handleNode = () => {
    const handler = node[key];
    if (handler && !node.disabled) {
      const data = node[`${key}Data`];
      data !== undefined ? handler.call(node, data, e) : handler.call(node, e);
      if (e.cancelBubble) return;
    }
    node.host &&
      typeof node.host !== "string" &&
      !node.host._$host &&
      node.contains(e.target) &&
      retarget(node.host);
    return true;
  };
  const walkUpTree = () => {
    while (handleNode() && (node = node._$host || node.parentNode || node.host));
  };
  Object.defineProperty(e, "currentTarget", {
    configurable: true,
    get() {
      return node || document;
    }
  });
  if (e.composedPath) {
    const path = e.composedPath();
    retarget(path[0]);
    for (let i = 0; i < path.length - 2; i++) {
      node = path[i];
      if (!handleNode()) break;
      if (node._$host) {
        node = node._$host;
        walkUpTree();
        break;
      }
      if (node.parentNode === oriCurrentTarget) {
        break;
      }
    }
  } else walkUpTree();
  retarget(oriTarget);
}
function insertExpression(parent, value, current, marker, unwrapArray) {
  while (typeof current === "function") current = current();
  if (value === current) return current;
  const t = typeof value,
    multi = marker !== undefined;
  parent = (multi && current[0] && current[0].parentNode) || parent;
  if (t === "string" || t === "number") {
    if (t === "number") {
      value = value.toString();
      if (value === current) return current;
    }
    if (multi) {
      let node = current[0];
      if (node && node.nodeType === 3) {
        node.data !== value && (node.data = value);
      } else node = document.createTextNode(value);
      current = cleanChildren(parent, current, marker, node);
    } else {
      if (current !== "" && typeof current === "string") {
        current = parent.firstChild.data = value;
      } else current = parent.textContent = value;
    }
  } else if (value == null || t === "boolean") {
    current = cleanChildren(parent, current, marker);
  } else if (t === "function") {
    createRenderEffect(() => {
      let v = value();
      while (typeof v === "function") v = v();
      current = insertExpression(parent, v, current, marker);
    });
    return () => current;
  } else if (Array.isArray(value)) {
    const array = [];
    const currentArray = current && Array.isArray(current);
    if (normalizeIncomingArray(array, value, current, unwrapArray)) {
      createRenderEffect(() => (current = insertExpression(parent, array, current, marker, true)));
      return () => current;
    }
    if (array.length === 0) {
      current = cleanChildren(parent, current, marker);
      if (multi) return current;
    } else if (currentArray) {
      if (current.length === 0) {
        appendNodes(parent, array, marker);
      } else reconcileArrays(parent, current, array);
    } else {
      current && cleanChildren(parent);
      appendNodes(parent, array);
    }
    current = array;
  } else if (value.nodeType) {
    if (Array.isArray(current)) {
      if (multi) return (current = cleanChildren(parent, current, marker, value));
      cleanChildren(parent, current, null, value);
    } else if (current == null || current === "" || !parent.firstChild) {
      parent.appendChild(value);
    } else parent.replaceChild(value, parent.firstChild);
    current = value;
  } else;
  return current;
}
function normalizeIncomingArray(normalized, array, current, unwrap) {
  let dynamic = false;
  for (let i = 0, len = array.length; i < len; i++) {
    let item = array[i],
      prev = current && current[normalized.length],
      t;
    if (item == null || item === true || item === false);
    else if ((t = typeof item) === "object" && item.nodeType) {
      normalized.push(item);
    } else if (Array.isArray(item)) {
      dynamic = normalizeIncomingArray(normalized, item, prev) || dynamic;
    } else if (t === "function") {
      if (unwrap) {
        while (typeof item === "function") item = item();
        dynamic =
          normalizeIncomingArray(
            normalized,
            Array.isArray(item) ? item : [item],
            Array.isArray(prev) ? prev : [prev]
          ) || dynamic;
      } else {
        normalized.push(item);
        dynamic = true;
      }
    } else {
      const value = String(item);
      if (prev && prev.nodeType === 3 && prev.data === value) normalized.push(prev);
      else normalized.push(document.createTextNode(value));
    }
  }
  return dynamic;
}
function appendNodes(parent, array, marker = null) {
  for (let i = 0, len = array.length; i < len; i++) parent.insertBefore(array[i], marker);
}
function cleanChildren(parent, current, marker, replacement) {
  if (marker === undefined) return (parent.textContent = "");
  const node = replacement || document.createTextNode("");
  if (current.length) {
    let inserted = false;
    for (let i = current.length - 1; i >= 0; i--) {
      const el = current[i];
      if (node !== el) {
        const isParent = el.parentNode === parent;
        if (!inserted && !i)
          isParent ? parent.replaceChild(node, el) : parent.insertBefore(node, marker);
        else isParent && el.remove();
      } else inserted = true;
    }
  } else parent.insertBefore(node, marker);
  return [node];
}

var _tmpl$$1 = /* @__PURE__ */ template(`<span>`);
var cursor = (event, callback) => {
  return new Promise((resolve) => {
    const start = {
      x: event.clientX,
      y: event.clientY
    };
    let previous = start;
    const startTime = performance.now();
    function onUpdate(event2) {
      const current = {
        x: event2.clientX,
        y: event2.clientY
      };
      const delta = {
        x: current.x - previous.x,
        y: current.y - previous.y
      };
      const total = {
        x: start.x - current.x,
        y: start.y - current.y
      };
      previous = current;
      const result = {
        total,
        delta,
        event: event2,
        timespan: performance.now() - startTime
      };
      callback(result);
      return result;
    }
    const onMouseUp = (event2) => {
      window.removeEventListener("mousemove", onUpdate);
      window.removeEventListener("mouseup", onMouseUp);
      resolve(onUpdate(event2));
    };
    window.addEventListener("mousemove", onUpdate);
    window.addEventListener("mouseup", onMouseUp);
  });
};
function mergeRefs(...values) {
  return (element) => {
    values.forEach((value) => {
      if (typeof value === "function") {
        value(element);
      } else if ("ref" in value && value.ref) {
        if (typeof value.ref === "function") {
          value.ref(element);
        } else {
          value.ref = element;
        }
      }
    });
  };
}
function withContext(children2, context, value) {
  let result;
  context.Provider({
    value,
    children: () => {
      result = children2();
      return "";
    }
  });
  return () => result;
}
var propsMap = /* @__PURE__ */ new WeakMap();
var handleSet = /* @__PURE__ */ new WeakSet();
var NO_OVERFLOW = Symbol("no-overflow");
var isPercentageSize = (value) => value.endsWith("%");
var isFractionSize = (value) => value.endsWith("fr");
var isPixelSize = (value) => value.endsWith("px");
var isPixelProps = (props) => isPixelSize(props.size);
var isFractionProps = (props) => isFractionSize(props.size);
var getProps = (element) => propsMap.get(element);
var isNotHandle = (element) => !handleSet.has(element);
function resolveNode(value) {
  if (typeof value === "function") {
    const result = value();
    return resolveNode(result);
  }
  return value;
}
function getNeigboringPanes(panes, handle) {
  const index = panes.indexOf(handle);
  if (index === -1) {
    return;
  }
  if (index === 0 || index === panes.length - 1) {
    return;
  }
  const left = panes.slice(0, index).findLast(isNotHandle);
  const right = panes.slice(index).find(isNotHandle);
  if (!left || !right) {
    return;
  }
  return [left, right];
}
function Base(props) {
  const context = useSplit();
  const config = mergeProps({
    size: `1fr`
  }, props);
  const [, rest] = splitProps(props, [
    "size",
    // @ts-expect-error TODO: props don't have min-prop when using fraction units
    "min",
    // @ts-expect-error TODO: props don't have max-prop when using fraction units
    "max",
    "style",
    "ref"
  ]);
  let ref;
  const pane = (() => {
    var _el$ = _tmpl$$1();
    var _ref$ = mergeRefs(props, (value) => ref = value);
    typeof _ref$ === "function" && use(_ref$, _el$);
    spread(_el$, mergeProps({
      get style() {
        return {
          overflow: "hidden",
          ...props.style
        };
      }
    }, rest, {
      get ["data-active-pane"]() {
        return context?.isActivePane(ref) || void 0;
      }
    }), false, true);
    insert(_el$, () => props.children);
    return _el$;
  })();
  propsMap.set(pane, config);
  return pane;
}
var splitContext = createContext();
function useSplit() {
  const context = useContext(splitContext);
  return context;
}
function Split(props) {
  const config = mergeProps({
    type: "column"
  }, props);
  const [, rest] = splitProps(props, ["type", "style", "ref"]);
  const [domRect, setDomRect] = createSignal();
  const [activePanels, setActivePanels] = createSignal(void 0);
  const [offsets, setOffsets] = createSignal(/* @__PURE__ */ new WeakMap(), {
    equals: false
  });
  const [splitRef, setSplitRef] = createSignal();
  const containerSize = () => (config.type === "column" ? domRect()?.width : domRect()?.height) || 0;
  function offset(element, delta) {
    setOffsets((map) => {
      map.set(element, (map.get(element) || 0) - delta);
      return map;
    });
  }
  function getNonFractionPixels(value, offset2 = 0) {
    return isPercentageSize(value) ? (parseFloat(value) - offset2) / 100 * containerSize() : parseFloat(value) - offset2;
  }
  function getNonFractionPanePixels(element) {
    const props2 = getProps(element);
    const offset2 = getOffset(element);
    if (!props2)
      return 0;
    if (isFractionProps(props2))
      return 0;
    return getNonFractionPixels(props2.size, offset2);
  }
  function getPixelsPerFraction() {
    const sumOfFractionPanePixelSizes = getSumOfFractionPanePixels();
    const totalFrUnits = getFractionPanes().reduce((total, pane) => total + parseFloat(getProps(pane).size), 0);
    if (totalFrUnits === 0) {
      return 0;
    } else if (totalFrUnits < 1) {
      const remainingSpace = sumOfFractionPanePixelSizes - sumOfFractionPanePixelSizes * totalFrUnits;
      return sumOfFractionPanePixelSizes / (totalFrUnits + remainingSpace / sumOfFractionPanePixelSizes);
    } else {
      return sumOfFractionPanePixelSizes / totalFrUnits;
    }
  }
  function getPixelSizeOfFractionPane(element) {
    const props2 = getProps(element);
    const offset2 = getOffset(element);
    if (!props2 || !isFractionProps(props2))
      return 0;
    return (parseFloat(props2.size) - offset2) * getPixelsPerFraction();
  }
  function getOffset(element) {
    return offsets().get(element) || 0;
  }
  function getSumOfNonFractionPanePixels() {
    return getNonFractionPanes().reduce((total, pane) => total + getNonFractionPanePixels(pane), 0);
  }
  function getSumOfFractionPanePixels() {
    return containerSize() - getSumOfNonFractionPanePixels();
  }
  function offsetFractionAndNonFractionPane(fractionPane, nonFractionPane, deltaPx) {
    const fractionPanes = getFractionPanes();
    const fractionPaneIndex = fractionPanes.indexOf(fractionPane);
    const fractionPanesPixelSizes = fractionPanes.map(getPixelSizeOfFractionPane);
    let nonPaneOffset = isPixelProps(getProps(nonFractionPane)) ? deltaPx : deltaPx / containerSize() * 100;
    offset(nonFractionPane, nonPaneOffset);
    const fractionPanePixels = fractionPanesPixelSizes[fractionPaneIndex] -= deltaPx;
    if (fractionPanePixels < 0) {
      offset(nonFractionPane, -nonPaneOffset);
      fractionPanesPixelSizes[fractionPaneIndex] = 0;
    }
    const total = fractionPanesPixelSizes.reduce((a, b) => a + b, 0);
    const totalFrUnits = fractionPanes.map(getProps).reduce((a, b) => a + parseFloat(b.size), 0);
    const newFractions = fractionPanesPixelSizes.map((size) => size * totalFrUnits / total);
    const newOffsets = newFractions.map((newFraction, index) => {
      const oldFraction = parseFloat(getProps(fractionPanes[index]).size);
      return oldFraction - newFraction;
    });
    setOffsets((map) => {
      newOffsets.forEach((offset2, index) => {
        map.set(fractionPanes[index], offset2);
      });
      return map;
    });
  }
  function getFractionOverflow(element, deltaFr) {
    const props2 = getProps(element);
    const offset2 = getOffset(element);
    if (!isFractionProps(props2)) {
      return 0;
    }
    const overflow = parseFloat(props2.size) - offset2 + deltaFr;
    return overflow < 0 ? overflow : 0;
  }
  function getNonFractionOverflow(element, deltaPx) {
    const props2 = getProps(element);
    const offset2 = getOffset(element);
    if (isFractionProps(props2)) {
      return 0;
    }
    const realSize = getNonFractionPixels(props2.size, offset2);
    const newSize = realSize + deltaPx;
    if (props2.max) {
      const realMaxSize = getNonFractionPixels(props2.max);
      if (newSize < realMaxSize) {
        return newSize - realMaxSize;
      }
    }
    if (props2.min) {
      const realMinSize = getNonFractionPixels(props2.min);
      if (newSize > realMinSize) {
        return newSize - realMinSize;
      }
    }
    return newSize > 0 ? 0 : newSize;
  }
  const context = {
    isActivePane: createSelector(activePanels, (element, panes2) => isNotHandle(element) && !!panes2?.includes(element)),
    get type() {
      return config.type;
    },
    dragHandleStart(handle) {
      return setActivePanels(getNeigboringPanes(panes(), handle));
    },
    dragHandle([left, right], deltaPx) {
      if (deltaPx === 0)
        return NO_OVERFLOW;
      const leftProps = getProps(left);
      const rightProps = getProps(right);
      const isLeftFraction = isFractionProps(leftProps);
      const isRightFraction = isFractionProps(rightProps);
      let deltaFr = deltaPx / getPixelsPerFraction();
      const leftOverflow = !isLeftFraction ? getNonFractionOverflow(left, deltaPx) : getFractionOverflow(left, deltaFr) * getPixelsPerFraction();
      const rightOverflow = !isRightFraction ? getNonFractionOverflow(right, -deltaPx) : getFractionOverflow(right, -deltaFr) * getPixelsPerFraction();
      deltaPx = leftOverflow ? deltaPx - leftOverflow : rightOverflow ? deltaPx + rightOverflow : deltaPx;
      deltaFr = deltaPx / getPixelsPerFraction();
      if (isLeftFraction && isRightFraction) {
        offset(left, deltaFr);
        offset(right, -deltaFr);
      } else if (!isLeftFraction && !isRightFraction) {
        offset(left, isPixelProps(leftProps) ? deltaPx : deltaPx / containerSize() * 100);
        offset(right, isPixelProps(rightProps) ? -deltaPx : -deltaPx / containerSize() * 100);
      } else if (isLeftFraction) {
        offsetFractionAndNonFractionPane(left, right, -deltaPx);
      } else {
        offsetFractionAndNonFractionPane(right, left, deltaPx);
      }
      if (!leftOverflow && !rightOverflow) {
        return NO_OVERFLOW;
      }
      if (Math.abs(leftOverflow) > Math.abs(rightOverflow)) {
        return leftOverflow;
      }
      return -rightOverflow;
    },
    dragHandleEnd() {
      setActivePanels(void 0);
    }
  };
  const offspring = children(withContext(() => props.children, splitContext, context));
  const panes = createMemo(() => offspring.toArray().filter((value) => propsMap.has(value)));
  const getFractionPanes = () => panes().filter((pane) => isFractionProps(getProps(pane)));
  const getNonFractionPanes = () => panes().filter((pane) => !isFractionProps(getProps(pane)));
  const template = () => panes().map((pane) => {
    const props2 = getProps(pane);
    const offset2 = getOffset(pane);
    if (isFractionProps(props2)) {
      return offset2 ? `${parseFloat(props2.size) - offset2}fr` : props2.size;
    }
    const unit = offset2 ? `calc(${parseFloat(props2.size) - offset2}${isPixelProps(props2) ? "px" : "%"})` : props2.size;
    return props2.min ? props2.max ? `min(${props2.min}, max(${props2.max}, ${unit}))` : `min(${props2.min}, ${unit})` : props2.max ? `max(${props2.max}, ${unit})` : unit;
  }).join(" ");
  createEffect(() => {
    const ref = splitRef();
    if (!ref)
      return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDomRect(entry.contentRect);
        props.onResize?.(entry.contentRect, ref);
      }
    });
    observer.observe(ref);
    onCleanup(() => observer.disconnect());
  });
  createSignal(mapArray(panes, (pane) => {
    createEffect(on(() => getProps(pane)?.size, () => {
      setOffsets((map) => {
        map.set(pane, 0);
        return map;
      });
    }));
  }));
  createEffect(() => props.onTemplate?.(template()));
  return createComponent(Base, mergeProps({
    ref(r$) {
      var _ref$2 = mergeRefs(setSplitRef, props);
      typeof _ref$2 === "function" && _ref$2(r$);
    },
    get style() {
      return {
        display: "grid",
        ...props.style,
        [`grid-template-${config.type}s`]: template()
      };
    }
  }, rest, {
    get children() {
      return panes();
    }
  }));
}
function Pane(props) {
  const context = useSplit();
  if (!context)
    throw `Split.Pane should be used within a Split-component`;
  return createComponent(Base, props);
}
function Handle$1(props) {
  const context = useSplit();
  if (!context)
    throw `Split.Handle should be used within a Split-component`;
  const [active, setActive] = createSignal(false);
  const handle = createComponent(Base, mergeProps(props, {
    get ["data-active-handle"]() {
      return active() || void 0;
    },
    onPointerDown: async (e) => {
      let totalOverflow = {
        x: 0,
        y: 0
      };
      setActive(true);
      const neighbors = context.dragHandleStart(resolveNode(handle));
      if (!neighbors)
        return;
      await cursor(e, ({
        delta
      }) => {
        const overflow = context.dragHandle(neighbors, context.type === "column" ? delta.x + totalOverflow.x : delta.y + totalOverflow.y);
        if (overflow === NO_OVERFLOW) {
          totalOverflow = {
            x: 0,
            y: 0
          };
        } else {
          totalOverflow.x += context.type === "column" ? delta.x : overflow;
          totalOverflow.y += context.type !== "column" ? delta.y : overflow;
        }
      });
      context.dragHandleEnd();
      setActive(false);
    }
  }));
  handleSet.add(resolveNode(handle));
  return handle;
}
Split.Handle = Handle$1;
Split.Pane = Pane;

function _defineProperty$1(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function ownKeys$1(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    });
    keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2$1(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};

    if (i % 2) {
      ownKeys$1(Object(source), true).forEach(function (key) {
        _defineProperty$1(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys$1(Object(source)).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }

  return target;
}

function _objectWithoutPropertiesLoose(source, excluded) {
  if (source == null) return {};
  var target = {};
  var sourceKeys = Object.keys(source);
  var key, i;

  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (excluded.indexOf(key) >= 0) continue;
    target[key] = source[key];
  }

  return target;
}

function _objectWithoutProperties(source, excluded) {
  if (source == null) return {};

  var target = _objectWithoutPropertiesLoose(source, excluded);

  var key, i;

  if (Object.getOwnPropertySymbols) {
    var sourceSymbolKeys = Object.getOwnPropertySymbols(source);

    for (i = 0; i < sourceSymbolKeys.length; i++) {
      key = sourceSymbolKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
      target[key] = source[key];
    }
  }

  return target;
}

function _slicedToArray(arr, i) {
  return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest();
}

function _arrayWithHoles(arr) {
  if (Array.isArray(arr)) return arr;
}

function _iterableToArrayLimit(arr, i) {
  if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return;
  var _arr = [];
  var _n = true;
  var _d = false;
  var _e = undefined;

  try {
    for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
      _arr.push(_s.value);

      if (i && _arr.length === i) break;
    }
  } catch (err) {
    _d = true;
    _e = err;
  } finally {
    try {
      if (!_n && _i["return"] != null) _i["return"]();
    } finally {
      if (_d) throw _e;
    }
  }

  return _arr;
}

function _unsupportedIterableToArray(o, minLen) {
  if (!o) return;
  if (typeof o === "string") return _arrayLikeToArray(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor) n = o.constructor.name;
  if (n === "Map" || n === "Set") return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
}

function _arrayLikeToArray(arr, len) {
  if (len == null || len > arr.length) len = arr.length;

  for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];

  return arr2;
}

function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    });
    keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};

    if (i % 2) {
      ownKeys(Object(source), true).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }

  return target;
}

function compose$1() {
  for (var _len = arguments.length, fns = new Array(_len), _key = 0; _key < _len; _key++) {
    fns[_key] = arguments[_key];
  }

  return function (x) {
    return fns.reduceRight(function (y, f) {
      return f(y);
    }, x);
  };
}

function curry$1(fn) {
  return function curried() {
    var _this = this;

    for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    return args.length >= fn.length ? fn.apply(this, args) : function () {
      for (var _len3 = arguments.length, nextArgs = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
        nextArgs[_key3] = arguments[_key3];
      }

      return curried.apply(_this, [].concat(args, nextArgs));
    };
  };
}

function isObject$1(value) {
  return {}.toString.call(value).includes('Object');
}

function isEmpty(obj) {
  return !Object.keys(obj).length;
}

function isFunction(value) {
  return typeof value === 'function';
}

function hasOwnProperty(object, property) {
  return Object.prototype.hasOwnProperty.call(object, property);
}

function validateChanges(initial, changes) {
  if (!isObject$1(changes)) errorHandler$1('changeType');
  if (Object.keys(changes).some(function (field) {
    return !hasOwnProperty(initial, field);
  })) errorHandler$1('changeField');
  return changes;
}

function validateSelector(selector) {
  if (!isFunction(selector)) errorHandler$1('selectorType');
}

function validateHandler(handler) {
  if (!(isFunction(handler) || isObject$1(handler))) errorHandler$1('handlerType');
  if (isObject$1(handler) && Object.values(handler).some(function (_handler) {
    return !isFunction(_handler);
  })) errorHandler$1('handlersType');
}

function validateInitial(initial) {
  if (!initial) errorHandler$1('initialIsRequired');
  if (!isObject$1(initial)) errorHandler$1('initialType');
  if (isEmpty(initial)) errorHandler$1('initialContent');
}

function throwError$1(errorMessages, type) {
  throw new Error(errorMessages[type] || errorMessages["default"]);
}

var errorMessages$1 = {
  initialIsRequired: 'initial state is required',
  initialType: 'initial state should be an object',
  initialContent: 'initial state shouldn\'t be an empty object',
  handlerType: 'handler should be an object or a function',
  handlersType: 'all handlers should be a functions',
  selectorType: 'selector should be a function',
  changeType: 'provided value of changes should be an object',
  changeField: 'it seams you want to change a field in the state which is not specified in the "initial" state',
  "default": 'an unknown error accured in `state-local` package'
};
var errorHandler$1 = curry$1(throwError$1)(errorMessages$1);
var validators$1 = {
  changes: validateChanges,
  selector: validateSelector,
  handler: validateHandler,
  initial: validateInitial
};

function create(initial) {
  var handler = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  validators$1.initial(initial);
  validators$1.handler(handler);
  var state = {
    current: initial
  };
  var didUpdate = curry$1(didStateUpdate)(state, handler);
  var update = curry$1(updateState)(state);
  var validate = curry$1(validators$1.changes)(initial);
  var getChanges = curry$1(extractChanges)(state);

  function getState() {
    var selector = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function (state) {
      return state;
    };
    validators$1.selector(selector);
    return selector(state.current);
  }

  function setState(causedChanges) {
    compose$1(didUpdate, update, validate, getChanges)(causedChanges);
  }

  return [getState, setState];
}

function extractChanges(state, causedChanges) {
  return isFunction(causedChanges) ? causedChanges(state.current) : causedChanges;
}

function updateState(state, changes) {
  state.current = _objectSpread2(_objectSpread2({}, state.current), changes);
  return changes;
}

function didStateUpdate(state, handler, changes) {
  isFunction(handler) ? handler(state.current) : Object.keys(changes).forEach(function (field) {
    var _handler$field;

    return (_handler$field = handler[field]) === null || _handler$field === void 0 ? void 0 : _handler$field.call(handler, state.current[field]);
  });
  return changes;
}

var index = {
  create: create
};

var config$1 = {
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.43.0/min/vs'
  }
};

function curry(fn) {
  return function curried() {
    var _this = this;

    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return args.length >= fn.length ? fn.apply(this, args) : function () {
      for (var _len2 = arguments.length, nextArgs = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        nextArgs[_key2] = arguments[_key2];
      }

      return curried.apply(_this, [].concat(args, nextArgs));
    };
  };
}

function isObject(value) {
  return {}.toString.call(value).includes('Object');
}

/**
 * validates the configuration object and informs about deprecation
 * @param {Object} config - the configuration object 
 * @return {Object} config - the validated configuration object
 */

function validateConfig(config) {
  if (!config) errorHandler('configIsRequired');
  if (!isObject(config)) errorHandler('configType');

  if (config.urls) {
    informAboutDeprecation();
    return {
      paths: {
        vs: config.urls.monacoBase
      }
    };
  }

  return config;
}
/**
 * logs deprecation message
 */


function informAboutDeprecation() {
  console.warn(errorMessages.deprecation);
}

function throwError(errorMessages, type) {
  throw new Error(errorMessages[type] || errorMessages["default"]);
}

var errorMessages = {
  configIsRequired: 'the configuration object is required',
  configType: 'the configuration object should be an object',
  "default": 'an unknown error accured in `@monaco-editor/loader` package',
  deprecation: "Deprecation warning!\n    You are using deprecated way of configuration.\n\n    Instead of using\n      monaco.config({ urls: { monacoBase: '...' } })\n    use\n      monaco.config({ paths: { vs: '...' } })\n\n    For more please check the link https://github.com/suren-atoyan/monaco-loader#config\n  "
};
var errorHandler = curry(throwError)(errorMessages);
var validators = {
  config: validateConfig
};

var compose = function compose() {
  for (var _len = arguments.length, fns = new Array(_len), _key = 0; _key < _len; _key++) {
    fns[_key] = arguments[_key];
  }

  return function (x) {
    return fns.reduceRight(function (y, f) {
      return f(y);
    }, x);
  };
};

function merge(target, source) {
  Object.keys(source).forEach(function (key) {
    if (source[key] instanceof Object) {
      if (target[key]) {
        Object.assign(source[key], merge(target[key], source[key]));
      }
    }
  });
  return _objectSpread2$1(_objectSpread2$1({}, target), source);
}

// The source (has been changed) is https://github.com/facebook/react/issues/5465#issuecomment-157888325
var CANCELATION_MESSAGE = {
  type: 'cancelation',
  msg: 'operation is manually canceled'
};

function makeCancelable(promise) {
  var hasCanceled_ = false;
  var wrappedPromise = new Promise(function (resolve, reject) {
    promise.then(function (val) {
      return hasCanceled_ ? reject(CANCELATION_MESSAGE) : resolve(val);
    });
    promise["catch"](reject);
  });
  return wrappedPromise.cancel = function () {
    return hasCanceled_ = true;
  }, wrappedPromise;
}

/** the local state of the module */

var _state$create = index.create({
  config: config$1,
  isInitialized: false,
  resolve: null,
  reject: null,
  monaco: null
}),
    _state$create2 = _slicedToArray(_state$create, 2),
    getState = _state$create2[0],
    setState = _state$create2[1];
/**
 * set the loader configuration
 * @param {Object} config - the configuration object
 */


function config(globalConfig) {
  var _validators$config = validators.config(globalConfig),
      monaco = _validators$config.monaco,
      config = _objectWithoutProperties(_validators$config, ["monaco"]);

  setState(function (state) {
    return {
      config: merge(state.config, config),
      monaco: monaco
    };
  });
}
/**
 * handles the initialization of the monaco-editor
 * @return {Promise} - returns an instance of monaco (with a cancelable promise)
 */


function init() {
  var state = getState(function (_ref) {
    var monaco = _ref.monaco,
        isInitialized = _ref.isInitialized,
        resolve = _ref.resolve;
    return {
      monaco: monaco,
      isInitialized: isInitialized,
      resolve: resolve
    };
  });

  if (!state.isInitialized) {
    setState({
      isInitialized: true
    });

    if (state.monaco) {
      state.resolve(state.monaco);
      return makeCancelable(wrapperPromise);
    }

    if (window.monaco && window.monaco.editor) {
      storeMonacoInstance(window.monaco);
      state.resolve(window.monaco);
      return makeCancelable(wrapperPromise);
    }

    compose(injectScripts, getMonacoLoaderScript)(configureLoader);
  }

  return makeCancelable(wrapperPromise);
}
/**
 * injects provided scripts into the document.body
 * @param {Object} script - an HTML script element
 * @return {Object} - the injected HTML script element
 */


function injectScripts(script) {
  return document.body.appendChild(script);
}
/**
 * creates an HTML script element with/without provided src
 * @param {string} [src] - the source path of the script
 * @return {Object} - the created HTML script element
 */


function createScript(src) {
  var script = document.createElement('script');
  return src && (script.src = src), script;
}
/**
 * creates an HTML script element with the monaco loader src
 * @return {Object} - the created HTML script element
 */


function getMonacoLoaderScript(configureLoader) {
  var state = getState(function (_ref2) {
    var config = _ref2.config,
        reject = _ref2.reject;
    return {
      config: config,
      reject: reject
    };
  });
  var loaderScript = createScript("".concat(state.config.paths.vs, "/loader.js"));

  loaderScript.onload = function () {
    return configureLoader();
  };

  loaderScript.onerror = state.reject;
  return loaderScript;
}
/**
 * configures the monaco loader
 */


function configureLoader() {
  var state = getState(function (_ref3) {
    var config = _ref3.config,
        resolve = _ref3.resolve,
        reject = _ref3.reject;
    return {
      config: config,
      resolve: resolve,
      reject: reject
    };
  });
  var require = window.require;

  require.config(state.config);

  require(['vs/editor/editor.main'], function (monaco) {
    storeMonacoInstance(monaco);
    state.resolve(monaco);
  }, function (error) {
    state.reject(error);
  });
}
/**
 * store monaco instance in local state
 */


function storeMonacoInstance(monaco) {
  if (!getState().monaco) {
    setState({
      monaco: monaco
    });
  }
}
/**
 * internal helper function
 * extracts stored monaco instance
 * @return {Object|null} - the monaco instance
 */


function __getMonacoInstance() {
  return getState(function (_ref4) {
    var monaco = _ref4.monaco;
    return monaco;
  });
}

var wrapperPromise = new Promise(function (resolve, reject) {
  return setState({
    resolve: resolve,
    reject: reject
  });
});
var loader = {
  config: config,
  init: init,
  __getMonacoInstance: __getMonacoInstance
};

const indexCss = ".repl {\n  display: grid;\n  grid-template-rows: auto 1fr 1fr;\n  gap: 5px;\n  height: 100%;\n}\n\niframe {\n  border: 1px solid black;\n  width: 100%;\n  height: 100%;\n}\n";

const indexHtml = "<script src=\"./main.ts\" type=\"module\"></script>\n<link href=\"./index.css\" rel=\"stylesheet\"></link>\n<div id=\"root\"></div>\n";

const mainTs = "import {\n  createFileSystem,\n  isUrl,\n  parseHtml,\n  resolvePath,\n  Transform,\n  transformModulePaths,\n} from '@bigmistqke/repl'\nimport { createSignal } from 'solid-js'\nimport html from 'solid-js/html'\nimport { render } from 'solid-js/web'\nimport ts from 'typescript'\n\nfunction createRepl() {\n  const transformJs: Transform = ({ path, source, executables }) => {\n    return transformModulePaths(source, modulePath => {\n      if (modulePath.startsWith('.')) {\n        // Swap relative module-path out with their respective module-url\n        const url = executables.get(resolvePath(path, modulePath))\n        if (!url) throw 'url is undefined'\n        return url\n      } else if (isUrl(modulePath)) {\n        // Return url directly\n        return modulePath\n      } else {\n        // Wrap external modules with esm.sh\n        return `https://esm.sh/${modulePath}`\n      }\n    })!\n  }\n\n  return createFileSystem({\n    css: { type: 'css' },\n    js: {\n      type: 'javascript',\n      transform: transformJs,\n    },\n    ts: {\n      type: 'javascript',\n      transform({ path, source, fs }) {\n        return transformJs({ path, source: ts.transpile(source), fs })\n      },\n    },\n    html: {\n      type: 'html',\n      transform(config) {\n        return (\n          parseHtml(config)\n            // Transform content of all `<script type=\"module\" />` elements\n            .transformModuleScriptContent(transformJs)\n            // Bind relative `src`-attribute of all `<script />` elements\n            .bindScriptSrc()\n            // Bind relative `href`-attribute of all `<link />` elements\n            .bindLinkHref()\n            .toString()\n        )\n      },\n    },\n  })\n}\n\nrender(() => {\n  const [selectedPath, setSelectedPath] = createSignal<string>('index.html')\n\n  const repl = createRepl()\n\n  repl.writeFile(\n    'index.html',\n    `<head>\n  <script src=\"./main.ts\"><\/script>\n<link rel=\"stylesheet\" href=\"./index.css\"></link>\n</head>\n<body>\nhallo world 👋\n</body>`,\n  )\n\n  repl.writeFile('index.css', `body { font-size: 32pt; }`)\n\n  repl.writeFile(\n    'main.ts',\n    `function randomValue(){\n  return 200 + Math.random() * 50\n}\n    \nfunction randomColor(){\n  document.body.style.background = \\`rgb(\\${randomValue()}, \\${randomValue()}, \\${randomValue()})\\`\n}    \n\nrequestAnimationFrame(randomColor)\nsetInterval(randomColor, 2000)`,\n  )\n\n  const Button = (props: { path: string }) =>\n    html`<button onclick=\"${() => setSelectedPath(props.path)}\">${props.path}</button>`\n\n  return html`<div class=\"repl\">\n    <div style=\"display: flex; align-content: start; gap: 5px;\">\n      <${Button} path=\"index.html\" />\n      <${Button} path=\"index.css\" />\n      <${Button} path=\"main.ts\" />\n    </div>\n    <textarea\n      oninput=${e => repl.writeFile(selectedPath(), e.target.value)}\n      value=${() => repl.readFile(selectedPath())}\n    ></textarea>\n    <iframe src=${() => repl.getExecutable('index.html')}></iframe>\n  </div> `\n}, document.getElementById('root')!)\n";

const demo = {
  "index.css": indexCss,
  "index.html": indexHtml,
  "main.ts": mainTs
};

const styles = '';

function check(accessor, callback, fallback) {
  const value = typeof accessor === "function" ? accessor() : accessor;
  return value ? callback(value) : fallback ? fallback() : void 0;
}
function when(accessor, callback, fallback) {
  return () => check(accessor, callback, fallback);
}
function every(...accessors) {
  function callback() {
    const values = new Array(accessors.length);
    for (let i = 0; i < accessors.length; i++) {
      const _value = typeof accessors[i] === "function" ? accessors[i]() : accessors[i];
      if (!_value)
        return void 0;
      values[i] = _value;
    }
    return values;
  }
  return callback;
}
function whenEffect(accessor, callback) {
  createEffect(when(accessor, callback));
}
function whenMemo(accessor, callback) {
  return createMemo(when(accessor, callback));
}

function Worker$1() {
  const worker = new Worker("./assets/fs.worker.worker-proxy.js", { type: "module" });
  return createWorkerProxy(worker);
}

var _tmpl$ = /* @__PURE__ */ template(`<iframe>`), _tmpl$2 = /* @__PURE__ */ template(`<div>`), _tmpl$3 = /* @__PURE__ */ template(`<button>`), _tmpl$4 = /* @__PURE__ */ template(`<div><span>`);
function App() {
  const [selectedPath, setSelectedPath] = createSignal("main.ts");
  const isPathSelected = createSelector(selectedPath);
  const [url, setUrl] = createSignal();
  const [tsconfig, setTsconfig] = createSignal({});
  const [types, setTypes] = createSignal();
  const fs = new Worker$1();
  fs.watchTsconfig(setTsconfig);
  fs.watchTypes(setTypes);
  fs.watchExecutable("index.html", setUrl);
  Object.entries(demo).forEach(([key, source]) => {
    fs.writeFile(key, source);
  });
  return createComponent(Split, {
    style: {
      height: "100vh"
    },
    get children() {
      return [createComponent(Split.Pane, {
        size: "150px",
        style: {
          display: "grid",
          "align-content": "start"
        },
        get children() {
          return createComponent(FileTree, {
            fs,
            onPathSelect: setSelectedPath,
            isPathSelected
          });
        }
      }), createComponent(Handle, {}), createComponent(Split.Pane, {
        style: {
          display: "grid"
        },
        get children() {
          return createComponent(Editor, {
            fs,
            get path() {
              return selectedPath();
            },
            get types() {
              return types();
            },
            get tsconfig() {
              return tsconfig();
            }
          });
        }
      }), createComponent(Handle, {}), createComponent(Split.Pane, {
        style: {
          display: "grid"
        },
        get children() {
          var _el$ = _tmpl$();
          _el$.style.setProperty("height", "100%");
          _el$.style.setProperty("width", "100%");
          _el$.style.setProperty("border", "none");
          createRenderEffect(() => setAttribute(_el$, "src", url()));
          return _el$;
        }
      })];
    }
  });
}
function Handle() {
  return createComponent(Split.Handle, {
    size: "10px",
    style: {
      display: "flex",
      padding: "0px 4px",
      cursor: "ew-resize"
    },
    get children() {
      var _el$2 = _tmpl$2();
      _el$2.style.setProperty("background", "black");
      _el$2.style.setProperty("flex", "1");
      return _el$2;
    }
  });
}
function Editor(props) {
  const [paths, setPaths] = createSignal([]);
  const [monaco] = createResource(() => loader.init());
  const [element, setElement] = createSignal();
  const editor = whenMemo(every(monaco, element), ([monaco2, element2]) => {
    return monaco2.editor.create(element2, {
      value: "",
      language: "typescript",
      automaticLayout: true
    });
  });
  createEffect(() => props.fs.watchPaths(setPaths));
  whenEffect(every(monaco, editor), ([monaco2, editor2]) => {
    const languages2 = mergeProps({
      tsx: "typescript",
      ts: "typescript"
    }, () => props.languages);
    async function getType(path) {
      let type = await props.fs.$async.getType(path);
      const extension = getExtension(path);
      if (extension && extension in languages2) {
        type = languages2[extension];
      }
      return type;
    }
    createEffect(() => {
      editor2.onDidChangeModelContent((event) => {
        props.fs.writeFile(props.path, editor2.getModel().getValue());
      });
    });
    createEffect(mapArray(paths, (path) => {
      createEffect(async () => {
        const type = await getType(path);
        if (type === "dir")
          return;
        const uri = monaco2.Uri.parse(`file:///${path}`);
        const model = monaco2.editor.getModel(uri) || monaco2.editor.createModel("", type, uri);
        props.fs.watchFile(path, (value) => {
          if (value !== model.getValue()) {
            model.setValue(value || "");
          }
        });
        onCleanup(() => model.dispose());
      });
    }));
    createEffect(async () => {
      const uri = monaco2.Uri.parse(`file:///${props.path}`);
      let type = await getType(props.path);
      const model = monaco2.editor.getModel(uri) || monaco2.editor.createModel("", type, uri);
      editor2.setModel(model);
    });
    createEffect(() => {
      if (props.tsconfig) {
        monaco2.languages.typescript.typescriptDefaults.setCompilerOptions(props.tsconfig);
        monaco2.languages.typescript.javascriptDefaults.setCompilerOptions(props.tsconfig);
      }
    });
    createEffect(mapArray(() => Object.keys(props.types ?? {}), (name) => {
      createEffect(() => {
        const declaration = props.types?.[name];
        if (!declaration)
          return;
        const path = `file:///${name}`;
        monaco2.languages.typescript.typescriptDefaults.addExtraLib(declaration, path);
        monaco2.languages.typescript.javascriptDefaults.addExtraLib(declaration, path);
      });
    }));
  });
  return (() => {
    var _el$3 = _tmpl$2();
    use(setElement, _el$3);
    _el$3.style.setProperty("overflow", "hidden");
    return _el$3;
  })();
}
function FileTree(treeProps) {
  function Dir(props) {
    const [collapsed, setCollapsed] = createSignal(false);
    const [childDirEnts, setChildDirEnts] = createSignal([]);
    createEffect(() => treeProps.fs.watchDir(props.path, setChildDirEnts));
    return [createComponent(Show, {
      get when() {
        return props.path;
      },
      get children() {
        var _el$4 = _tmpl$4(), _el$5 = _el$4.firstChild;
        _el$4.style.setProperty("display", "grid");
        _el$4.style.setProperty("grid-template-columns", "1fr 30px");
        insert(_el$5, () => props.name);
        insert(_el$4, createComponent(Show, {
          get when() {
            return childDirEnts().length !== 0;
          },
          get children() {
            var _el$6 = _tmpl$3();
            _el$6.$$click = () => setCollapsed((collapsed2) => !collapsed2);
            _el$6.style.setProperty("text-align", "center");
            insert(_el$6, () => collapsed() ? "+" : "-");
            return _el$6;
          }
        }), null);
        createRenderEffect((_$p) => (_$p = props.layer * 10 + "px") != null ? _el$4.style.setProperty("padding-left", _$p) : _el$4.style.removeProperty("padding-left"));
        return _el$4;
      }
    }), createComponent(Show, {
      get when() {
        return !collapsed();
      },
      get children() {
        return createComponent(Index, {
          get each() {
            return childDirEnts();
          },
          children: (dirEnt) => {
            return createComponent(DirEnt, {
              get layer() {
                return props.layer + 1;
              },
              get path() {
                return dirEnt().path;
              },
              get type() {
                return dirEnt().type;
              }
            });
          }
        });
      }
    })];
  }
  function DirEnt(props) {
    const name = () => {
      const parts = props.path.split("/");
      return parts[parts.length - 1] || "";
    };
    return createComponent(Show, {
      get when() {
        return props.type === "dir";
      },
      get fallback() {
        return (() => {
          var _el$7 = _tmpl$3();
          _el$7.$$click = () => treeProps.onPathSelect(props.path);
          insert(_el$7, name);
          createRenderEffect((_p$) => {
            var _v$ = props.layer * 10 + "px", _v$2 = treeProps.isPathSelected(props.path) ? "underline" : "none";
            _v$ !== _p$.e && ((_p$.e = _v$) != null ? _el$7.style.setProperty("padding-left", _v$) : _el$7.style.removeProperty("padding-left"));
            _v$2 !== _p$.t && ((_p$.t = _v$2) != null ? _el$7.style.setProperty("text-decoration", _v$2) : _el$7.style.removeProperty("text-decoration"));
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$7;
        })();
      },
      get children() {
        return createComponent(Dir, {
          get layer() {
            return props.layer;
          },
          get path() {
            return props.path;
          },
          get name() {
            return name();
          }
        });
      }
    });
  }
  return createComponent(DirEnt, {
    path: "",
    layer: 0,
    type: "dir"
  });
}
delegateEvents(["click"]);

render(App, document.getElementById("root"));
