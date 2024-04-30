import { createThree, augment, manageProps, useThree, isAugmentedElement, manageSceneGraph, withContext, threeContext } from '../chunk/6IU7HVDT.js';
export { $S3C, useFrame, useLoader, useThree } from '../chunk/6IU7HVDT.js';
import { insert, spread, mergeProps, template } from 'solid-js/web';
import { createResizeObserver } from '@solid-primitives/resize-observer';
import { splitProps, createRenderEffect, mergeProps as mergeProps$1, createMemo } from 'solid-js';
import { OrthographicCamera } from 'three';

var _tmpl$ = /* @__PURE__ */ template(`<canvas>`);
var _tmpl$2 = /* @__PURE__ */ template(`<div>`);
function Canvas(_props) {
  const [props, canvasProps] = splitProps(_props, ["fallback", "camera", "children", "ref"]);
  const canvas = (() => {
    const _el$ = _tmpl$();
    _el$.style.setProperty("width", "100%");
    _el$.style.setProperty("height", "100%");
    return _el$;
  })();
  const container = (() => {
    const _el$2 = _tmpl$2();
    _el$2.style.setProperty("width", "100%");
    _el$2.style.setProperty("height", "100%");
    insert(_el$2, canvas);
    return _el$2;
  })();
  const context = createThree(canvas, props);
  createResizeObserver(() => container, () => {
    context.gl.setSize(window.innerWidth, window.innerHeight);
    context.gl.setPixelRatio(window.devicePixelRatio);
    if (context.camera instanceof OrthographicCamera) {
      context.camera.left = window.innerWidth / -2;
      context.camera.right = window.innerWidth / 2;
      context.camera.top = window.innerHeight / 2;
      context.camera.bottom = window.innerHeight / -2;
    } else {
      context.camera.aspect = window.innerWidth / window.innerHeight;
    }
    context.camera.updateProjectionMatrix();
    context.render(performance.now());
  });
  createRenderEffect(() => {
    if (props.ref instanceof Function)
      props.ref(container);
    else
      props.ref = container;
  });
  return (() => {
    const _el$3 = _tmpl$2();
    spread(_el$3, mergeProps(canvasProps, {
      get style() {
        return {
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          ...canvasProps.style
        };
      }
    }), false, true);
    insert(_el$3, container);
    return _el$3;
  })();
}
var Portal = (props) => {
  const context = useThree();
  const scene = createMemo(() => props.element ? isAugmentedElement(props.element) ? props.element : augment(props.element, {
    props: {}
  }) : context.scene);
  createRenderEffect(() => {
    manageSceneGraph(scene(), withContext(() => props.children, threeContext, mergeProps$1(context, {
      get scene() {
        return scene();
      }
    })));
  });
  return [];
};
function Primitive(props) {
  const memo = createMemo(() => augment(props.object, {
    props
  }));
  manageProps(memo, props);
  return memo;
}

// src/proxy.tsx
var CATALOGUE = {};
var COMPONENTS = {
  Primitive,
  Portal
};
var extend = (objects) => void Object.assign(CATALOGUE, objects);
var T_CACHE = new Map(Object.entries(COMPONENTS));
var T = new Proxy({}, {
  get: (_, name) => {
    if (!T_CACHE.has(name)) {
      const constructor = CATALOGUE[name];
      if (!constructor)
        return void 0;
      T_CACHE.set(name, createThreeComponent(constructor));
    }
    return T_CACHE.get(name);
  }
});
function createThreeComponent(source) {
  const Component = (props) => {
    const merged = mergeProps$1({
      args: []
    }, props);
    const memo = createMemo(() => {
      try {
        return augment(new source(...merged.args), {
          props
        });
      } catch (e) {
        throw new Error("");
      }
    });
    manageProps(memo, props);
    return memo;
  };
  return Component;
}

// src/utils/build-graph.ts
function buildGraph(object) {
  const data = { nodes: {}, materials: {} };
  if (object) {
    object.traverse((obj) => {
      if (obj.name)
        data.nodes[obj.name] = obj;
      if (obj.material && !data.materials[obj.material.name])
        data.materials[obj.material.name] = obj.material;
    });
  }
  return data;
}

export { Canvas, T, buildGraph, extend };
