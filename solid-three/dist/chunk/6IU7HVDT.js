import { createContext, useContext, createResource, splitProps, createRenderEffect, children, untrack, onCleanup, mapArray, createSignal, mergeProps, createMemo } from 'solid-js';
import { Object3D, Layers, Color, Texture, RGBAFormat, UnsignedByteType, Material, BufferGeometry, Fog, Vector2, Camera, OrthographicCamera, PerspectiveCamera, Scene, Raycaster, WebGLRenderer, PCFSoftShadowMap, NoToneMapping, ACESFilmicToneMapping, BasicShadowMap, PCFShadowMap, VSMShadowMap } from 'three';

// src/augment.ts
var $S3C = Symbol("solid-three");
var augment = (instance, augmentation) => {
  instance[$S3C] = { children: /* @__PURE__ */ new Set(), ...augmentation };
  return instance;
};
function useThree(callback) {
  const store = useContext(threeContext);
  if (!store) {
    throw new Error("S3F: Hooks can only be used within the Canvas component!");
  }
  if (callback)
    return () => callback(store);
  return store;
}
var threeContext = createContext(null);
var useFrame = (callback) => {
  const addFrameListener = useContext(frameContext);
  if (!addFrameListener) {
    throw new Error("S3F: Hooks can only be used within the Canvas component!");
  }
  addFrameListener(callback);
};
var frameContext = createContext();
var useLoader = (Constructor, args, setup) => {
  let cache = LOADER_CACHE.get(Constructor);
  if (!cache) {
    cache = {
      loader: new Constructor(),
      resources: {}
    };
    LOADER_CACHE.set(Constructor, cache);
  }
  const { loader, resources } = cache;
  setup?.(loader);
  const load = (arg) => {
    if (resources[arg])
      return resources[arg];
    return resources[arg] = new Promise(
      (resolve2, reject) => loader.load(
        arg,
        (value) => {
          resources[arg] = value;
          resolve2(value);
        },
        void 0,
        reject
      )
    );
  };
  const [resource] = createResource(
    args,
    (args2) => Array.isArray(args2) ? Promise.all(args2.map((arg) => load(arg))) : load(args2)
  );
  return resource;
};
var LOADER_CACHE = /* @__PURE__ */ new Map();

// src/utils/is-augmented-element.ts
var isAugmentedElement = (element) => typeof element === "object" && $S3C in element;

// src/utils/remove-element-from-array.ts
var removeElementFromArray = (array, value) => {
  const index = array.indexOf(value);
  if (index !== -1)
    array.splice(index, 1);
  return array;
};

// src/create-events.ts
var isEventType = (type) => /^on(Pointer|Click|DoubleClick|ContextMenu|Wheel|Mouse)/.test(type);
var createEvents = (context) => {
  const eventRegistry = {
    onMouseMove: [],
    onMouseUp: [],
    onMouseDown: [],
    onPointerMove: [],
    onPointerUp: [],
    onPointerDown: [],
    onWheel: [],
    onClick: [],
    onDoubleClick: []
  };
  const createThreeEvent = (nativeEvent) => {
    const event = {
      ...nativeEvent,
      nativeEvent,
      stopped: false,
      stopPropagation: () => event.stopped = true
    };
    return event;
  };
  const raycast = (nativeEvent, type) => {
    context.setPointer((pointer) => {
      pointer.x = nativeEvent.offsetX / window.innerWidth * 2 - 1;
      pointer.y = -(nativeEvent.offsetY / window.innerHeight) * 2 + 1;
      return pointer;
    });
    context.raycaster.setFromCamera(context.pointer, context.camera);
    const duplicates = /* @__PURE__ */ new Set();
    const intersections = context.raycaster.intersectObjects(eventRegistry[type], true);
    return intersections.sort((a, b) => a.distance - b.distance).filter(({ object }) => {
      if (duplicates.has(object))
        return false;
      duplicates.add(object);
      return true;
    });
  };
  const bubbleDown = (element, type, event) => {
    let node = element.parent;
    while (node) {
      if (event.stopped)
        break;
      if (isAugmentedElement(node)) {
        node[$S3C].props[type]?.(event);
      }
      node = node.parent;
    }
  };
  const createMoveHandler = (type) => (nativeEvent) => {
    const moveEvent = createThreeEvent(nativeEvent);
    const enterEvent = createThreeEvent(nativeEvent);
    let staleIntersects = new Set(priorIntersects[type]);
    for (const intersection of raycast(nativeEvent, `on${type}Move`)) {
      const props = intersection.object[$S3C].props;
      if (!enterEvent.stopped && !priorIntersects[type].has(intersection.object)) {
        props[`on${type}Enter`]?.(enterEvent);
        bubbleDown(intersection.object, `on${type}Enter`, enterEvent);
      }
      if (!moveEvent.stopped) {
        props[`on${type}Move`]?.(moveEvent);
        bubbleDown(intersection.object, `on${type}Move`, moveEvent);
      }
      staleIntersects.delete(intersection.object);
      priorIntersects[type].add(intersection.object);
      if (moveEvent.stopped && enterEvent.stopped)
        break;
    }
    if (priorMoveEvents[type]) {
      const leaveEvent = createThreeEvent(priorMoveEvents[type]);
      for (const object of staleIntersects.values()) {
        priorIntersects[type].delete(object);
        if (!leaveEvent.stopped) {
          const props = object[$S3C].props;
          props[`on${type}Leave`]?.(leaveEvent);
          bubbleDown(object, `on${type}Leave`, leaveEvent);
        }
      }
    }
    priorMoveEvents[type] = nativeEvent;
  };
  const priorIntersects = {
    Mouse: /* @__PURE__ */ new Set(),
    Pointer: /* @__PURE__ */ new Set()
  };
  const priorMoveEvents = {
    Mouse: void 0,
    Pointer: void 0
  };
  const createEventHandler = (type) => (nativeEvent) => {
    const event = createThreeEvent(nativeEvent);
    for (const { object } of raycast(nativeEvent, type)) {
      object[$S3C].props[type]?.(event);
      bubbleDown(object, type, event);
      if (event.stopped)
        break;
    }
  };
  context.canvas.addEventListener("mousemove", createMoveHandler("Mouse"));
  context.canvas.addEventListener("pointermove", createMoveHandler("Pointer"));
  context.canvas.addEventListener("mousedown", createEventHandler("onMouseDown"));
  context.canvas.addEventListener("pointerdown", createEventHandler("onPointerDown"));
  context.canvas.addEventListener("mouseup", createEventHandler("onMouseUp"));
  context.canvas.addEventListener("pointerup", createEventHandler("onPointerUp"));
  context.canvas.addEventListener("wheel", createEventHandler("onWheel"));
  context.canvas.addEventListener("click", createEventHandler("onClick"));
  context.canvas.addEventListener("dblclick", createEventHandler("onDoubleClick"));
  const addEventListener = (object, type) => {
    const isDerivedEvent = type.includes("Enter") || type.includes("Leave");
    const isPointerEvent = type.includes("Pointer");
    const derivedType = isDerivedEvent ? `on${isPointerEvent ? "Pointer" : "Mouse"}Move` : type;
    if (!eventRegistry[derivedType].find((value) => value === object)) {
      eventRegistry[derivedType].push(object);
    }
    onCleanup(() => {
      if (derivedType.includes("Move")) {
        const props = object[$S3C].props;
        if (isPointerEvent) {
          if ("onPointerMove" in props || "onPointerEnter" in props || "onPointerLeave" in props) {
            return;
          }
        } else {
          if ("onMouseMove" in props || "onMouseEnter" in props || "onMouseLeave" in props) {
            return;
          }
        }
      }
      removeElementFromArray(eventRegistry[type], object);
    });
  };
  return { addEventListener, eventRegistry };
};
var addToEventListeners = (object, type) => {
  const addToEventListeners2 = useContext(eventContext);
  if (!addToEventListeners2) {
    throw new Error("S3F: Hooks can only be used within the Canvas component!");
  }
  addToEventListeners2(object, type);
};
var eventContext = createContext();
createContext();
var useCanvasProps = () => {
  const canvasProps = useContext(canvasPropsContext);
  if (!canvasProps) {
    throw new Error("S3F: Hooks can only be used within the Canvas component!");
  }
  return canvasProps;
};
var canvasPropsContext = createContext();

// src/utils/has-colorspace.ts
var hasColorSpace = (object) => "colorSpace" in object || "outputColorSpace" in object;

// src/utils/resolve.ts
function resolve(child, recursive = false) {
  return typeof child !== "function" ? child : recursive ? resolve(child()) : child();
}

// src/props.ts
function manageProps(object, props) {
  const [local, instanceProps] = splitProps(props, ["ref", "args", "object", "attach", "children"]);
  createRenderEffect(() => {
    if (local.ref instanceof Function)
      local.ref(object());
    else
      local.ref = object();
  });
  const childrenAccessor = children(() => props.children);
  createRenderEffect(
    () => manageSceneGraph(object(), childrenAccessor)
  );
  createRenderEffect(() => {
    const keys = Object.keys(instanceProps);
    for (const key of keys) {
      const subKeys = keys.filter((_key) => key !== _key && _key.includes(key));
      createRenderEffect(() => {
        applyProp(object(), key, instanceProps[key]);
        for (const subKey of subKeys) {
          applyProp(object(), subKey, instanceProps[subKey]);
        }
      });
    }
    untrack(() => props.onUpdate)?.(object());
  });
  onCleanup(() => object()?.dispose?.());
}
var NEEDS_UPDATE = [
  "map",
  "envMap",
  "bumpMap",
  "normalMap",
  "transparent",
  "morphTargets",
  "skinning",
  "alphaTest",
  "useVertexColors",
  "flatShading"
];
var applyProp = (source, type, value) => {
  if (!source) {
    return;
  }
  if (value === void 0)
    return;
  if (type.indexOf("-") > -1) {
    const [property, ...rest] = type.split("-");
    applyProp(source[property], rest.join("-"), value);
    return;
  }
  if (NEEDS_UPDATE.includes(type) && (!source[type] && value || source[type] && !value)) {
    source.needsUpdate = true;
  }
  if (hasColorSpace(source)) {
    const sRGBEncoding = 3001;
    const SRGBColorSpace = "srgb";
    const LinearSRGBColorSpace = "srgb-linear";
    if (type === "encoding") {
      type = "colorSpace";
      value = value === sRGBEncoding ? SRGBColorSpace : LinearSRGBColorSpace;
    } else if (type === "outputEncoding") {
      type = "outputColorSpace";
      value = value === sRGBEncoding ? SRGBColorSpace : LinearSRGBColorSpace;
    }
  }
  if (isEventType(type)) {
    if (source instanceof Object3D) {
      addToEventListeners(source, type);
    }
    return;
  }
  const target = source[type];
  const context = useThree();
  const canvasProps = useCanvasProps();
  try {
    if (target?.copy && target?.constructor === value?.constructor) {
      target.copy(value);
    } else if (target instanceof Layers && value instanceof Layers) {
      target.mask = value.mask;
    } else if (target?.set && Array.isArray(value)) {
      if (target.fromArray)
        target.fromArray(value);
      else
        target.set(...value);
    } else if (target?.set && typeof value !== "object") {
      const isColor = target instanceof Color;
      if (!isColor && target.setScalar && typeof value === "number")
        target.setScalar(value);
      else if (value !== void 0)
        target.set(value);
    } else {
      source[type] = value;
      if (source[type] instanceof Texture && // sRGB textures must be RGBA8 since r137 https://github.com/mrdoob/three.js/pull/23129
      source[type].format === RGBAFormat && source[type].type === UnsignedByteType) {
        createRenderEffect(() => {
          canvasProps.linear;
          canvasProps.flat;
          const texture = source[type];
          if (hasColorSpace(texture) && hasColorSpace(context.gl)) {
            texture.colorSpace = context.gl.outputColorSpace;
          } else {
            texture.encoding = context.gl.outputEncoding;
          }
        });
      }
    }
  } finally {
    if (canvasProps.frameloop === "demand") {
      context.requestRender();
    }
  }
};
var manageSceneGraph = (parent, childAccessor) => {
  createRenderEffect(
    mapArray(
      () => {
        const result = resolve(childAccessor, true);
        return Array.isArray(result) ? result : result ? [result] : [];
      },
      (child) => createRenderEffect(() => {
        if (!child) {
          return;
        }
        parent[$S3C].children.add(child);
        onCleanup(() => parent[$S3C].children.delete(child));
        let attachProp = child[$S3C].props.attach;
        if (typeof attachProp === "function") {
          const cleanup = attachProp(parent, child);
          onCleanup(cleanup);
          return;
        }
        if (!attachProp) {
          if (child instanceof Material)
            attachProp = "material";
          else if (child instanceof BufferGeometry)
            attachProp = "geometry";
          else if (child instanceof Fog)
            attachProp = "fog";
        }
        if (attachProp) {
          let target = parent;
          const path = attachProp.split("-");
          while (true) {
            const property = path.shift();
            if (path.length === 0) {
              target[property] = child;
              onCleanup(() => parent[attachProp] = void 0);
              break;
            } else {
              target = parent[property];
            }
          }
          return;
        }
        if (child instanceof Object3D && parent instanceof Object3D && !parent.children.includes(child)) {
          parent.add(child);
          onCleanup(() => parent.remove(child));
          return child;
        }
      })
    )
  );
};
function defaultProps(props, defaults) {
  return mergeProps(defaults, props);
}

// src/utils/with-context.ts
function withContext(children3, context, value) {
  let result;
  context.Provider({
    value,
    children: () => {
      result = children3();
      return "";
    }
  });
  return () => result;
}
function withMultiContexts(children3, values) {
  let result;
  const fn = (index) => {
    const [context, value] = values[index];
    context.Provider({
      value,
      children: () => {
        if (index < values.length - 1) {
          fn(index + 1);
        } else {
          result = children3();
        }
        return "";
      }
    });
  };
  fn(0);
  return () => result;
}

// src/create-three.tsx
function createThree(canvas, props) {
  const canvasProps = defaultProps(props, {
    frameloop: "always"
  });
  const [pointer, setPointer] = createSignal(new Vector2(), {
    equals: false
  });
  const frameListeners = [];
  const addFrameListener = (callback) => {
    frameListeners.push(callback);
    const cleanup = () => removeElementFromArray(frameListeners, callback);
    onCleanup(cleanup);
    return cleanup;
  };
  const {
    camera,
    gl,
    raycaster,
    scene
  } = createCoreElements(canvas, canvasProps);
  const handleXRFrame = (timestamp, frame) => {
    if (canvasProps.frameloop === "never")
      return;
    render(timestamp, frame);
  };
  const handleSessionChange = () => {
    context.gl.xr.enabled = context.gl.xr.isPresenting;
    context.gl.xr.setAnimationLoop(context.gl.xr.isPresenting ? handleXRFrame : null);
  };
  const xr = {
    connect() {
      context.gl.xr.addEventListener("sessionstart", handleSessionChange);
      context.gl.xr.addEventListener("sessionend", handleSessionChange);
    },
    disconnect() {
      context.gl.xr.removeEventListener("sessionstart", handleSessionChange);
      context.gl.xr.removeEventListener("sessionend", handleSessionChange);
    }
  };
  let isRenderPending = false;
  const render = (timestamp, frame) => {
    isRenderPending = false;
    context.gl.render(context.scene, context.camera);
    frameListeners.forEach((listener) => listener(context, timestamp, frame));
  };
  const requestRender = () => {
    if (isRenderPending)
      return;
    isRenderPending = true;
    requestAnimationFrame(render);
  };
  const context = {
    canvas,
    // Add core elements
    get camera() {
      return camera();
    },
    get gl() {
      return gl();
    },
    get raycaster() {
      return raycaster();
    },
    get scene() {
      return scene();
    },
    // Current normalized, centric pointer coordinates
    get pointer() {
      return pointer();
    },
    setPointer,
    render,
    requestRender,
    xr
  };
  withMultiContexts(() => manageCoreElements(canvasProps, context), [[threeContext, context], [canvasPropsContext, canvasProps]]);
  const {
    addEventListener,
    eventRegistry
  } = createEvents(context);
  manageSceneGraph(context.scene, children(withMultiContexts(() => canvasProps.children, [
    // Dependency Injection
    [threeContext, context],
    [frameContext, addFrameListener],
    [eventContext, addEventListener],
    [canvasPropsContext, canvasProps]
  ])));
  const loop = (value) => {
    if (canvasProps.frameloop === "always") {
      requestAnimationFrame(loop);
      context.render(value);
    }
  };
  createRenderEffect(() => {
    if (canvasProps.frameloop === "always") {
      requestAnimationFrame(loop);
    }
  });
  return mergeProps(context, {
    eventRegistry,
    addFrameListener
  });
}
var createCoreElements = (canvas, props) => ({
  camera: createMemo(() => augment(props.camera instanceof Camera ? props.camera : props.orthographic ? new OrthographicCamera() : new PerspectiveCamera(), {
    get props() {
      return props.camera || {};
    }
  })),
  scene: createMemo(() => augment(props.scene instanceof Scene ? props.scene : new Scene(), {
    get props() {
      return props.scene || {};
    }
  })),
  raycaster: createMemo(() => augment(props.raycaster instanceof Raycaster ? props.raycaster : new Raycaster(), {
    get props() {
      return props.raycaster || {};
    }
  })),
  gl: createMemo(() => augment(props.gl instanceof WebGLRenderer ? (
    // props.gl can be a WebGLRenderer provided by the user
    props.gl
  ) : typeof props.gl === "function" ? (
    // or a callback that returns a Renderer
    props.gl(canvas)
  ) : (
    // if props.gl is not defined we default to a WebGLRenderer
    new WebGLRenderer({
      canvas
    })
  ), {
    get props() {
      return props.gl || {};
    }
  }))
});
var manageCoreElements = (props, context) => {
  createRenderEffect(() => {
    if (!props.camera || props.camera instanceof Camera)
      return;
    manageProps(() => context.camera, props.camera);
    context.camera.updateMatrixWorld(true);
  });
  createRenderEffect(() => {
    if (!props.scene || props.scene instanceof Scene)
      return;
    manageProps(() => context.scene, props.scene);
  });
  createRenderEffect(() => {
    createRenderEffect(() => {
      if (context.gl.shadowMap) {
        const oldEnabled = context.gl.shadowMap.enabled;
        const oldType = context.gl.shadowMap.type;
        context.gl.shadowMap.enabled = !!props.shadows;
        if (typeof props.shadows === "boolean") {
          context.gl.shadowMap.type = PCFSoftShadowMap;
        } else if (typeof props.shadows === "string") {
          const types = {
            basic: BasicShadowMap,
            percentage: PCFShadowMap,
            soft: PCFSoftShadowMap,
            variance: VSMShadowMap
          };
          context.gl.shadowMap.type = types[props.shadows] ?? PCFSoftShadowMap;
        } else if (typeof props.shadows === "object") {
          Object.assign(context.gl.shadowMap, props.shadows);
        }
        if (oldEnabled !== context.gl.shadowMap.enabled || oldType !== context.gl.shadowMap.type)
          context.gl.shadowMap.needsUpdate = true;
      }
    });
    const LinearEncoding = 3e3;
    const sRGBEncoding = 3001;
    manageProps(() => context.gl, {
      get outputEncoding() {
        return props.linear ? LinearEncoding : sRGBEncoding;
      },
      get toneMapping() {
        return props.flat ? NoToneMapping : ACESFilmicToneMapping;
      }
    });
    if (context.gl.xr)
      context.xr.connect();
    if (!props.gl || props.gl instanceof WebGLRenderer)
      return;
    manageProps(() => context.gl, props.gl);
  });
  createRenderEffect(() => {
    if (!props.raycaster || props.raycaster instanceof Raycaster)
      return;
    manageProps(() => context.raycaster, props.raycaster);
  });
};

export { $S3C, augment, createThree, isAugmentedElement, manageProps, manageSceneGraph, threeContext, useFrame, useLoader, useThree, withContext };
