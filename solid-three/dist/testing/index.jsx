// src/testing/index.tsx
import { createRenderEffect as createRenderEffect3, createRoot, mergeProps as mergeProps3 } from "solid-js";

// src/create-three.tsx
import {
  children as children2,
  createMemo,
  createRenderEffect as createRenderEffect2,
  createSignal,
  mergeProps as mergeProps2,
  onCleanup as onCleanup3
} from "solid-js";
import {
  ACESFilmicToneMapping,
  BasicShadowMap,
  Camera,
  NoToneMapping,
  OrthographicCamera,
  PCFShadowMap,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Raycaster,
  Scene,
  VSMShadowMap,
  Vector2,
  WebGLRenderer
} from "three";

// src/augment.ts
var $S3C = Symbol("solid-three");
var augment = (instance, augmentation) => {
  instance[$S3C] = { children: /* @__PURE__ */ new Set(), ...augmentation };
  return instance;
};

// src/create-events.ts
import { onCleanup } from "solid-js";

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

// src/hooks.ts
import { createContext, createResource, useContext } from "solid-js";
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
var frameContext = createContext();

// src/internal-context.ts
import { createContext as createContext2, useContext as useContext2 } from "solid-js";
var addToEventListeners = (object, type) => {
  const addToEventListeners2 = useContext2(eventContext);
  if (!addToEventListeners2) {
    throw new Error("S3F: Hooks can only be used within the Canvas component!");
  }
  addToEventListeners2(object, type);
};
var eventContext = createContext2();
var portalContext = createContext2();
var useCanvasProps = () => {
  const canvasProps = useContext2(canvasPropsContext);
  if (!canvasProps) {
    throw new Error("S3F: Hooks can only be used within the Canvas component!");
  }
  return canvasProps;
};
var canvasPropsContext = createContext2();

// src/props.ts
import {
  children,
  createRenderEffect,
  mapArray,
  onCleanup as onCleanup2,
  splitProps,
  untrack
} from "solid-js";
import {
  BufferGeometry,
  Color,
  Fog,
  Layers,
  Material,
  Object3D,
  RGBAFormat,
  Texture,
  UnsignedByteType
} from "three";

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
  onCleanup2(() => object()?.dispose?.());
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
    } else {
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
        onCleanup2(() => parent[$S3C].children.delete(child));
        let attachProp = child[$S3C].props.attach;
        if (typeof attachProp === "function") {
          const cleanup = attachProp(parent, child);
          onCleanup2(cleanup);
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
              onCleanup2(() => parent[attachProp] = void 0);
              break;
            } else {
              target = parent[property];
            }
          }
          return;
        }
        if (child instanceof Object3D && parent instanceof Object3D && !parent.children.includes(child)) {
          parent.add(child);
          onCleanup2(() => parent.remove(child));
          return child;
        }
      })
    )
  );
};

// src/utils/default-props.ts
import { mergeProps } from "solid-js";
function defaultProps(props, defaults) {
  return mergeProps(defaults, props);
}

// src/utils/with-context.ts
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
  const canvasProps = defaultProps(props, { frameloop: "always" });
  const [pointer, setPointer] = createSignal(new Vector2(), { equals: false });
  const frameListeners = [];
  const addFrameListener = (callback) => {
    frameListeners.push(callback);
    const cleanup = () => removeElementFromArray(frameListeners, callback);
    onCleanup3(cleanup);
    return cleanup;
  };
  const { camera, gl, raycaster, scene } = createCoreElements(canvas, canvasProps);
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
  withMultiContexts(
    () => manageCoreElements(canvasProps, context),
    [
      [threeContext, context],
      [canvasPropsContext, canvasProps]
    ]
  );
  const { addEventListener, eventRegistry } = createEvents(context);
  manageSceneGraph(
    context.scene,
    children2(
      withMultiContexts(
        () => canvasProps.children,
        [
          // Dependency Injection
          [threeContext, context],
          [frameContext, addFrameListener],
          [eventContext, addEventListener],
          [canvasPropsContext, canvasProps]
        ]
      )
    )
  );
  const loop = (value) => {
    if (canvasProps.frameloop === "always") {
      requestAnimationFrame(loop);
      context.render(value);
    }
  };
  createRenderEffect2(() => {
    if (canvasProps.frameloop === "always") {
      requestAnimationFrame(loop);
    }
  });
  return mergeProps2(context, { eventRegistry, addFrameListener });
}
var createCoreElements = (canvas, props) => ({
  camera: createMemo(
    () => augment(
      props.camera instanceof Camera ? props.camera : props.orthographic ? new OrthographicCamera() : new PerspectiveCamera(),
      {
        get props() {
          return props.camera || {};
        }
      }
    )
  ),
  scene: createMemo(
    () => augment(props.scene instanceof Scene ? props.scene : new Scene(), {
      get props() {
        return props.scene || {};
      }
    })
  ),
  raycaster: createMemo(
    () => augment(props.raycaster instanceof Raycaster ? props.raycaster : new Raycaster(), {
      get props() {
        return props.raycaster || {};
      }
    })
  ),
  gl: createMemo(
    () => augment(
      props.gl instanceof WebGLRenderer ? (
        // props.gl can be a WebGLRenderer provided by the user
        props.gl
      ) : typeof props.gl === "function" ? (
        // or a callback that returns a Renderer
        props.gl(canvas)
      ) : (
        // if props.gl is not defined we default to a WebGLRenderer
        new WebGLRenderer({ canvas })
      ),
      {
        get props() {
          return props.gl || {};
        }
      }
    )
  )
});
var manageCoreElements = (props, context) => {
  createRenderEffect2(() => {
    if (!props.camera || props.camera instanceof Camera)
      return;
    manageProps(() => context.camera, props.camera);
    context.camera.updateMatrixWorld(true);
  });
  createRenderEffect2(() => {
    if (!props.scene || props.scene instanceof Scene)
      return;
    manageProps(() => context.scene, props.scene);
  });
  createRenderEffect2(() => {
    createRenderEffect2(() => {
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
  createRenderEffect2(() => {
    if (!props.raycaster || props.raycaster instanceof Raycaster)
      return;
    manageProps(() => context.raycaster, props.raycaster);
  });
};

// src/testing/webgl2-rendering-context.ts
var functions = [
  "activeTexture",
  "attachShader",
  "beginQuery",
  "beginTransformFeedback",
  "bindAttribLocation",
  "bindBufferBase",
  "bindBufferRange",
  "bindRenderbuffer",
  "bindSampler",
  "bindTransformFeedback",
  "bindVertexArray",
  "blendColor",
  "blendEquation",
  "blendEquationSeparate",
  "blendFunc",
  "blendFuncSeparate",
  "blitFramebuffer",
  "bufferData",
  "bufferSubData",
  "checkFramebufferStatus",
  "clientWaitSync",
  "compileShader",
  "compressedTexImage2D",
  "compressedTexImage3D",
  "compressedTexSubImage2D",
  "compressedTexSubImage3D",
  "copyBufferSubData",
  "copyTexImage2D",
  "copyTexSubImage2D",
  "copyTexSubImage3D",
  "createBuffer",
  "createFramebuffer",
  "createProgram",
  "createQuery",
  "createRenderbuffer",
  "createSampler",
  "createShader",
  "createTexture",
  "createTransformFeedback",
  "createVertexArray",
  "cullFace",
  "deleteBuffer",
  "deleteFramebuffer",
  "deleteProgram",
  "deleteQuery",
  "deleteRenderbuffer",
  "deleteSampler",
  "deleteShader",
  "deleteSync",
  "deleteTexture",
  "deleteTransformFeedback",
  "deleteVertexArray",
  "depthFunc",
  "depthMask",
  "depthRange",
  "detachShader",
  "disable",
  "drawArraysInstanced",
  "drawElementsInstanced",
  "drawRangeElements",
  "enable",
  "endQuery",
  "endTransformFeedback",
  "fenceSync",
  "finish",
  "flush",
  "framebufferRenderbuffer",
  "framebufferTexture2D",
  "framebufferTextureLayer",
  "frontFace",
  "generateMipmap",
  "getActiveAttrib",
  "getActiveUniform",
  "getActiveUniformBlockName",
  "getActiveUniformBlockParameter",
  "getActiveUniforms",
  "getAttachedShaders",
  "getAttribLocation",
  "getBufferParameter",
  "getBufferSubData",
  "getContextAttributes",
  "getError",
  "getExtension",
  "getFragDataLocation",
  "getFramebufferAttachmentParameter",
  "getIndexedParameter",
  "getInternalformatParameter",
  "getParameter",
  "getProgramInfoLog",
  "getProgramParameter",
  "getQuery",
  "getQueryParameter",
  "getRenderbufferParameter",
  "getSamplerParameter",
  "getShaderInfoLog",
  "getShaderParameter",
  "getShaderPrecisionFormat",
  "getShaderSource",
  "getSupportedExtensions",
  "getSyncParameter",
  "getTexParameter",
  "getTransformFeedbackVarying",
  "getUniform",
  "getUniformBlockIndex",
  "getUniformIndices",
  "getUniformLocation",
  "getVertexAttrib",
  "getVertexAttribOffset",
  "hint",
  "invalidateFramebuffer",
  "invalidateSubFramebuffer",
  "isBuffer",
  "isContextLost",
  "isEnabled",
  "isFramebuffer",
  "isProgram",
  "isQuery",
  "isRenderbuffer",
  "isSampler",
  "isShader",
  "isSync",
  "isTexture",
  "isTransformFeedback",
  "isVertexArray",
  "lineWidth",
  "linkProgram",
  "pauseTransformFeedback",
  "pixelStorei",
  "polygonOffset",
  "readBuffer",
  "readPixels",
  "renderbufferStorage",
  "renderbufferStorageMultisample",
  "resumeTransformFeedback",
  "sampleCoverage",
  "samplerParameterf",
  "samplerParameteri",
  "shaderSource",
  "stencilFunc",
  "stencilFuncSeparate",
  "stencilMask",
  "stencilMaskSeparate",
  "stencilOp",
  "stencilOpSeparate",
  "texImage2D",
  "texImage3D",
  "texParameterf",
  "texParameteri",
  "texStorage2D",
  "texStorage3D",
  "texSubImage2D",
  "texSubImage3D",
  "transformFeedbackVaryings",
  "uniform1ui",
  "uniform2ui",
  "uniform3ui",
  "uniform4ui",
  "uniformBlockBinding",
  "useProgram",
  "validateProgram",
  "vertexAttribDivisor",
  "vertexAttribI4i",
  "vertexAttribI4ui",
  "vertexAttribIPointer",
  "waitSync",
  "bindBuffer",
  "bindFramebuffer",
  "bindTexture",
  "clear",
  "clearBufferfi",
  "clearBufferfv",
  "clearBufferiv",
  "clearBufferuiv",
  "clearColor",
  "clearDepth",
  "clearStencil",
  "colorMask",
  "disableVertexAttribArray",
  "drawArrays",
  "drawBuffers",
  "drawElements",
  "enableVertexAttribArray",
  "scissor",
  "uniform1f",
  "uniform1fv",
  "uniform1i",
  "uniform1iv",
  "uniform1uiv",
  "uniform2f",
  "uniform2fv",
  "uniform2i",
  "uniform2iv",
  "uniform2uiv",
  "uniform3f",
  "uniform3fv",
  "uniform3i",
  "uniform3iv",
  "uniform3uiv",
  "uniform4f",
  "uniform4fv",
  "uniform4i",
  "uniform4iv",
  "uniform4uiv",
  "uniformMatrix2fv",
  "uniformMatrix2x3fv",
  "uniformMatrix2x4fv",
  "uniformMatrix3fv",
  "uniformMatrix3x2fv",
  "uniformMatrix3x4fv",
  "uniformMatrix4fv",
  "uniformMatrix4x2fv",
  "uniformMatrix4x3fv",
  "vertexAttrib1f",
  "vertexAttrib1fv",
  "vertexAttrib2f",
  "vertexAttrib2fv",
  "vertexAttrib3f",
  "vertexAttrib3fv",
  "vertexAttrib4f",
  "vertexAttrib4fv",
  "vertexAttribI4iv",
  "vertexAttribI4uiv",
  "vertexAttribPointer",
  "viewport",
  "makeXRCompatible"
];
var enums = {
  DEPTH_BUFFER_BIT: 256,
  STENCIL_BUFFER_BIT: 1024,
  COLOR_BUFFER_BIT: 16384,
  POINTS: 0,
  LINES: 1,
  LINE_LOOP: 2,
  LINE_STRIP: 3,
  TRIANGLES: 4,
  TRIANGLE_STRIP: 5,
  TRIANGLE_FAN: 6,
  ZERO: 0,
  ONE: 1,
  SRC_COLOR: 768,
  ONE_MINUS_SRC_COLOR: 769,
  SRC_ALPHA: 770,
  ONE_MINUS_SRC_ALPHA: 771,
  DST_ALPHA: 772,
  ONE_MINUS_DST_ALPHA: 773,
  DST_COLOR: 774,
  ONE_MINUS_DST_COLOR: 775,
  SRC_ALPHA_SATURATE: 776,
  FUNC_ADD: 32774,
  BLEND_EQUATION: 32777,
  BLEND_EQUATION_RGB: 32777,
  BLEND_EQUATION_ALPHA: 34877,
  FUNC_SUBTRACT: 32778,
  FUNC_REVERSE_SUBTRACT: 32779,
  BLEND_DST_RGB: 32968,
  BLEND_SRC_RGB: 32969,
  BLEND_DST_ALPHA: 32970,
  BLEND_SRC_ALPHA: 32971,
  CONSTANT_COLOR: 32769,
  ONE_MINUS_CONSTANT_COLOR: 32770,
  CONSTANT_ALPHA: 32771,
  ONE_MINUS_CONSTANT_ALPHA: 32772,
  BLEND_COLOR: 32773,
  ARRAY_BUFFER: 34962,
  ELEMENT_ARRAY_BUFFER: 34963,
  ARRAY_BUFFER_BINDING: 34964,
  ELEMENT_ARRAY_BUFFER_BINDING: 34965,
  STREAM_DRAW: 35040,
  STATIC_DRAW: 35044,
  DYNAMIC_DRAW: 35048,
  BUFFER_SIZE: 34660,
  BUFFER_USAGE: 34661,
  CURRENT_VERTEX_ATTRIB: 34342,
  FRONT: 1028,
  BACK: 1029,
  FRONT_AND_BACK: 1032,
  TEXTURE_2D: 3553,
  CULL_FACE: 2884,
  BLEND: 3042,
  DITHER: 3024,
  STENCIL_TEST: 2960,
  DEPTH_TEST: 2929,
  SCISSOR_TEST: 3089,
  POLYGON_OFFSET_FILL: 32823,
  SAMPLE_ALPHA_TO_COVERAGE: 32926,
  SAMPLE_COVERAGE: 32928,
  NO_ERROR: 0,
  INVALID_ENUM: 1280,
  INVALID_VALUE: 1281,
  INVALID_OPERATION: 1282,
  OUT_OF_MEMORY: 1285,
  CW: 2304,
  CCW: 2305,
  LINE_WIDTH: 2849,
  ALIASED_POINT_SIZE_RANGE: 33901,
  ALIASED_LINE_WIDTH_RANGE: 33902,
  CULL_FACE_MODE: 2885,
  FRONT_FACE: 2886,
  DEPTH_RANGE: 2928,
  DEPTH_WRITEMASK: 2930,
  DEPTH_CLEAR_VALUE: 2931,
  DEPTH_FUNC: 2932,
  STENCIL_CLEAR_VALUE: 2961,
  STENCIL_FUNC: 2962,
  STENCIL_FAIL: 2964,
  STENCIL_PASS_DEPTH_FAIL: 2965,
  STENCIL_PASS_DEPTH_PASS: 2966,
  STENCIL_REF: 2967,
  STENCIL_VALUE_MASK: 2963,
  STENCIL_WRITEMASK: 2968,
  STENCIL_BACK_FUNC: 34816,
  STENCIL_BACK_FAIL: 34817,
  STENCIL_BACK_PASS_DEPTH_FAIL: 34818,
  STENCIL_BACK_PASS_DEPTH_PASS: 34819,
  STENCIL_BACK_REF: 36003,
  STENCIL_BACK_VALUE_MASK: 36004,
  STENCIL_BACK_WRITEMASK: 36005,
  VIEWPORT: 2978,
  SCISSOR_BOX: 3088,
  COLOR_CLEAR_VALUE: 3106,
  COLOR_WRITEMASK: 3107,
  UNPACK_ALIGNMENT: 3317,
  PACK_ALIGNMENT: 3333,
  MAX_TEXTURE_SIZE: 3379,
  MAX_VIEWPORT_DIMS: 3386,
  SUBPIXEL_BITS: 3408,
  RED_BITS: 3410,
  GREEN_BITS: 3411,
  BLUE_BITS: 3412,
  ALPHA_BITS: 3413,
  DEPTH_BITS: 3414,
  STENCIL_BITS: 3415,
  POLYGON_OFFSET_UNITS: 10752,
  POLYGON_OFFSET_FACTOR: 32824,
  TEXTURE_BINDING_2D: 32873,
  SAMPLE_BUFFERS: 32936,
  SAMPLES: 32937,
  SAMPLE_COVERAGE_VALUE: 32938,
  SAMPLE_COVERAGE_INVERT: 32939,
  COMPRESSED_TEXTURE_FORMATS: 34467,
  DONT_CARE: 4352,
  FASTEST: 4353,
  NICEST: 4354,
  GENERATE_MIPMAP_HINT: 33170,
  BYTE: 5120,
  UNSIGNED_BYTE: 5121,
  SHORT: 5122,
  UNSIGNED_SHORT: 5123,
  INT: 5124,
  UNSIGNED_INT: 5125,
  FLOAT: 5126,
  DEPTH_COMPONENT: 6402,
  ALPHA: 6406,
  RGB: 6407,
  RGBA: 6408,
  LUMINANCE: 6409,
  LUMINANCE_ALPHA: 6410,
  UNSIGNED_SHORT_4_4_4_4: 32819,
  UNSIGNED_SHORT_5_5_5_1: 32820,
  UNSIGNED_SHORT_5_6_5: 33635,
  FRAGMENT_SHADER: 35632,
  VERTEX_SHADER: 35633,
  MAX_VERTEX_ATTRIBS: 34921,
  MAX_VERTEX_UNIFORM_VECTORS: 36347,
  MAX_VARYING_VECTORS: 36348,
  MAX_COMBINED_TEXTURE_IMAGE_UNITS: 35661,
  MAX_VERTEX_TEXTURE_IMAGE_UNITS: 35660,
  MAX_TEXTURE_IMAGE_UNITS: 34930,
  MAX_FRAGMENT_UNIFORM_VECTORS: 36349,
  SHADER_TYPE: 35663,
  DELETE_STATUS: 35712,
  LINK_STATUS: 35714,
  VALIDATE_STATUS: 35715,
  ATTACHED_SHADERS: 35717,
  ACTIVE_UNIFORMS: 35718,
  ACTIVE_ATTRIBUTES: 35721,
  SHADING_LANGUAGE_VERSION: 35724,
  CURRENT_PROGRAM: 35725,
  NEVER: 512,
  LESS: 513,
  EQUAL: 514,
  LEQUAL: 515,
  GREATER: 516,
  NOTEQUAL: 517,
  GEQUAL: 518,
  ALWAYS: 519,
  KEEP: 7680,
  REPLACE: 7681,
  INCR: 7682,
  DECR: 7683,
  INVERT: 5386,
  INCR_WRAP: 34055,
  DECR_WRAP: 34056,
  VENDOR: 7936,
  RENDERER: 7937,
  VERSION: 7938,
  NEAREST: 9728,
  LINEAR: 9729,
  NEAREST_MIPMAP_NEAREST: 9984,
  LINEAR_MIPMAP_NEAREST: 9985,
  NEAREST_MIPMAP_LINEAR: 9986,
  LINEAR_MIPMAP_LINEAR: 9987,
  TEXTURE_MAG_FILTER: 10240,
  TEXTURE_MIN_FILTER: 10241,
  TEXTURE_WRAP_S: 10242,
  TEXTURE_WRAP_T: 10243,
  TEXTURE: 5890,
  TEXTURE_CUBE_MAP: 34067,
  TEXTURE_BINDING_CUBE_MAP: 34068,
  TEXTURE_CUBE_MAP_POSITIVE_X: 34069,
  TEXTURE_CUBE_MAP_NEGATIVE_X: 34070,
  TEXTURE_CUBE_MAP_POSITIVE_Y: 34071,
  TEXTURE_CUBE_MAP_NEGATIVE_Y: 34072,
  TEXTURE_CUBE_MAP_POSITIVE_Z: 34073,
  TEXTURE_CUBE_MAP_NEGATIVE_Z: 34074,
  MAX_CUBE_MAP_TEXTURE_SIZE: 34076,
  TEXTURE0: 33984,
  TEXTURE1: 33985,
  TEXTURE2: 33986,
  TEXTURE3: 33987,
  TEXTURE4: 33988,
  TEXTURE5: 33989,
  TEXTURE6: 33990,
  TEXTURE7: 33991,
  TEXTURE8: 33992,
  TEXTURE9: 33993,
  TEXTURE10: 33994,
  TEXTURE11: 33995,
  TEXTURE12: 33996,
  TEXTURE13: 33997,
  TEXTURE14: 33998,
  TEXTURE15: 33999,
  TEXTURE16: 34e3,
  TEXTURE17: 34001,
  TEXTURE18: 34002,
  TEXTURE19: 34003,
  TEXTURE20: 34004,
  TEXTURE21: 34005,
  TEXTURE22: 34006,
  TEXTURE23: 34007,
  TEXTURE24: 34008,
  TEXTURE25: 34009,
  TEXTURE26: 34010,
  TEXTURE27: 34011,
  TEXTURE28: 34012,
  TEXTURE29: 34013,
  TEXTURE30: 34014,
  TEXTURE31: 34015,
  ACTIVE_TEXTURE: 34016,
  REPEAT: 10497,
  CLAMP_TO_EDGE: 33071,
  MIRRORED_REPEAT: 33648,
  FLOAT_VEC2: 35664,
  FLOAT_VEC3: 35665,
  FLOAT_VEC4: 35666,
  INT_VEC2: 35667,
  INT_VEC3: 35668,
  INT_VEC4: 35669,
  BOOL: 35670,
  BOOL_VEC2: 35671,
  BOOL_VEC3: 35672,
  BOOL_VEC4: 35673,
  FLOAT_MAT2: 35674,
  FLOAT_MAT3: 35675,
  FLOAT_MAT4: 35676,
  SAMPLER_2D: 35678,
  SAMPLER_CUBE: 35680,
  VERTEX_ATTRIB_ARRAY_ENABLED: 34338,
  VERTEX_ATTRIB_ARRAY_SIZE: 34339,
  VERTEX_ATTRIB_ARRAY_STRIDE: 34340,
  VERTEX_ATTRIB_ARRAY_TYPE: 34341,
  VERTEX_ATTRIB_ARRAY_NORMALIZED: 34922,
  VERTEX_ATTRIB_ARRAY_POINTER: 34373,
  VERTEX_ATTRIB_ARRAY_BUFFER_BINDING: 34975,
  IMPLEMENTATION_COLOR_READ_TYPE: 35738,
  IMPLEMENTATION_COLOR_READ_FORMAT: 35739,
  COMPILE_STATUS: 35713,
  LOW_FLOAT: 36336,
  MEDIUM_FLOAT: 36337,
  HIGH_FLOAT: 36338,
  LOW_INT: 36339,
  MEDIUM_INT: 36340,
  HIGH_INT: 36341,
  FRAMEBUFFER: 36160,
  RENDERBUFFER: 36161,
  RGBA4: 32854,
  RGB5_A1: 32855,
  RGB565: 36194,
  DEPTH_COMPONENT16: 33189,
  STENCIL_INDEX: 6401,
  STENCIL_INDEX8: 36168,
  DEPTH_STENCIL: 34041,
  RENDERBUFFER_WIDTH: 36162,
  RENDERBUFFER_HEIGHT: 36163,
  RENDERBUFFER_INTERNAL_FORMAT: 36164,
  RENDERBUFFER_RED_SIZE: 36176,
  RENDERBUFFER_GREEN_SIZE: 36177,
  RENDERBUFFER_BLUE_SIZE: 36178,
  RENDERBUFFER_ALPHA_SIZE: 36179,
  RENDERBUFFER_DEPTH_SIZE: 36180,
  RENDERBUFFER_STENCIL_SIZE: 36181,
  FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE: 36048,
  FRAMEBUFFER_ATTACHMENT_OBJECT_NAME: 36049,
  FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL: 36050,
  FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE: 36051,
  COLOR_ATTACHMENT0: 36064,
  DEPTH_ATTACHMENT: 36096,
  STENCIL_ATTACHMENT: 36128,
  DEPTH_STENCIL_ATTACHMENT: 33306,
  NONE: 0,
  FRAMEBUFFER_COMPLETE: 36053,
  FRAMEBUFFER_INCOMPLETE_ATTACHMENT: 36054,
  FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: 36055,
  FRAMEBUFFER_INCOMPLETE_DIMENSIONS: 36057,
  FRAMEBUFFER_UNSUPPORTED: 36061,
  FRAMEBUFFER_BINDING: 36006,
  RENDERBUFFER_BINDING: 36007,
  MAX_RENDERBUFFER_SIZE: 34024,
  INVALID_FRAMEBUFFER_OPERATION: 1286,
  UNPACK_FLIP_Y_WEBGL: 37440,
  UNPACK_PREMULTIPLY_ALPHA_WEBGL: 37441,
  CONTEXT_LOST_WEBGL: 37442,
  UNPACK_COLORSPACE_CONVERSION_WEBGL: 37443,
  BROWSER_DEFAULT_WEBGL: 37444,
  READ_BUFFER: 3074,
  UNPACK_ROW_LENGTH: 3314,
  UNPACK_SKIP_ROWS: 3315,
  UNPACK_SKIP_PIXELS: 3316,
  PACK_ROW_LENGTH: 3330,
  PACK_SKIP_ROWS: 3331,
  PACK_SKIP_PIXELS: 3332,
  COLOR: 6144,
  DEPTH: 6145,
  STENCIL: 6146,
  RED: 6403,
  UNPACK_SKIP_IMAGES: 32877,
  UNPACK_IMAGE_HEIGHT: 32878,
  TEXTURE_WRAP_R: 32882,
  MAX_ELEMENTS_VERTICES: 33e3,
  MAX_ELEMENTS_INDICES: 33001,
  TEXTURE_MIN_LOD: 33082,
  TEXTURE_MAX_LOD: 33083,
  TEXTURE_BASE_LEVEL: 33084,
  TEXTURE_MAX_LEVEL: 33085,
  MIN: 32775,
  MAX: 32776,
  MAX_TEXTURE_LOD_BIAS: 34045,
  TEXTURE_COMPARE_MODE: 34892,
  TEXTURE_COMPARE_FUNC: 34893,
  CURRENT_QUERY: 34917,
  QUERY_RESULT: 34918,
  QUERY_RESULT_AVAILABLE: 34919,
  STREAM_READ: 35041,
  STREAM_COPY: 35042,
  STATIC_READ: 35045,
  STATIC_COPY: 35046,
  DYNAMIC_READ: 35049,
  DYNAMIC_COPY: 35050,
  MAX_DRAW_BUFFERS: 34852,
  MAX_FRAGMENT_UNIFORM_COMPONENTS: 35657,
  MAX_VERTEX_UNIFORM_COMPONENTS: 35658,
  FRAGMENT_SHADER_DERIVATIVE_HINT: 35723,
  PIXEL_PACK_BUFFER: 35051,
  PIXEL_UNPACK_BUFFER: 35052,
  PIXEL_PACK_BUFFER_BINDING: 35053,
  PIXEL_UNPACK_BUFFER_BINDING: 35055,
  SRGB: 35904,
  COMPARE_REF_TO_TEXTURE: 34894,
  VERTEX_ATTRIB_ARRAY_INTEGER: 35069,
  MAX_ARRAY_TEXTURE_LAYERS: 35071,
  MIN_PROGRAM_TEXEL_OFFSET: 35076,
  MAX_PROGRAM_TEXEL_OFFSET: 35077,
  MAX_VARYING_COMPONENTS: 35659,
  TRANSFORM_FEEDBACK_BUFFER_MODE: 35967,
  MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS: 35968,
  TRANSFORM_FEEDBACK_VARYINGS: 35971,
  TRANSFORM_FEEDBACK_BUFFER_START: 35972,
  TRANSFORM_FEEDBACK_BUFFER_SIZE: 35973,
  TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN: 35976,
  RASTERIZER_DISCARD: 35977,
  MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS: 35978,
  MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS: 35979,
  INTERLEAVED_ATTRIBS: 35980,
  SEPARATE_ATTRIBS: 35981,
  TRANSFORM_FEEDBACK_BUFFER: 35982,
  TRANSFORM_FEEDBACK_BUFFER_BINDING: 35983,
  RED_INTEGER: 36244,
  RGB_INTEGER: 36248,
  RGBA_INTEGER: 36249,
  SAMPLER_CUBE_SHADOW: 36293,
  INT_SAMPLER_CUBE: 36300,
  UNSIGNED_INT_SAMPLER_CUBE: 36308,
  FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING: 33296,
  FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE: 33297,
  FRAMEBUFFER_ATTACHMENT_RED_SIZE: 33298,
  FRAMEBUFFER_ATTACHMENT_GREEN_SIZE: 33299,
  FRAMEBUFFER_ATTACHMENT_BLUE_SIZE: 33300,
  FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE: 33301,
  FRAMEBUFFER_ATTACHMENT_DEPTH_SIZE: 33302,
  FRAMEBUFFER_ATTACHMENT_STENCIL_SIZE: 33303,
  FRAMEBUFFER_DEFAULT: 33304,
  UNSIGNED_NORMALIZED: 35863,
  DRAW_FRAMEBUFFER_BINDING: 36006,
  READ_FRAMEBUFFER: 36008,
  DRAW_FRAMEBUFFER: 36009,
  READ_FRAMEBUFFER_BINDING: 36010,
  RENDERBUFFER_SAMPLES: 36011,
  FRAMEBUFFER_ATTACHMENT_TEXTURE_LAYER: 36052,
  MAX_COLOR_ATTACHMENTS: 36063,
  FRAMEBUFFER_INCOMPLETE_MULTISAMPLE: 36182,
  MAX_SAMPLES: 36183,
  HALF_FLOAT: 5131,
  RG: 33319,
  RG_INTEGER: 33320,
  VERTEX_ARRAY_BINDING: 34229,
  SIGNED_NORMALIZED: 36764,
  COPY_READ_BUFFER: 36662,
  COPY_WRITE_BUFFER: 36663,
  COPY_READ_BUFFER_BINDING: 36662,
  COPY_WRITE_BUFFER_BINDING: 36663,
  UNIFORM_BUFFER: 35345,
  UNIFORM_BUFFER_BINDING: 35368,
  UNIFORM_BUFFER_START: 35369,
  UNIFORM_BUFFER_SIZE: 35370,
  MAX_VERTEX_UNIFORM_BLOCKS: 35371,
  MAX_FRAGMENT_UNIFORM_BLOCKS: 35373,
  MAX_COMBINED_UNIFORM_BLOCKS: 35374,
  MAX_UNIFORM_BUFFER_BINDINGS: 35375,
  MAX_UNIFORM_BLOCK_SIZE: 35376,
  MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS: 35377,
  MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS: 35379,
  UNIFORM_BUFFER_OFFSET_ALIGNMENT: 35380,
  ACTIVE_UNIFORM_BLOCKS: 35382,
  UNIFORM_TYPE: 35383,
  UNIFORM_SIZE: 35384,
  UNIFORM_BLOCK_INDEX: 35386,
  UNIFORM_OFFSET: 35387,
  UNIFORM_ARRAY_STRIDE: 35388,
  UNIFORM_MATRIX_STRIDE: 35389,
  UNIFORM_IS_ROW_MAJOR: 35390,
  UNIFORM_BLOCK_BINDING: 35391,
  UNIFORM_BLOCK_DATA_SIZE: 35392,
  UNIFORM_BLOCK_ACTIVE_UNIFORMS: 35394,
  UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES: 35395,
  UNIFORM_BLOCK_REFERENCED_BY_VERTEX_SHADER: 35396,
  UNIFORM_BLOCK_REFERENCED_BY_FRAGMENT_SHADER: 35398,
  INVALID_INDEX: 4294967295,
  MAX_VERTEX_OUTPUT_COMPONENTS: 37154,
  MAX_FRAGMENT_INPUT_COMPONENTS: 37157,
  MAX_SERVER_WAIT_TIMEOUT: 37137,
  OBJECT_TYPE: 37138,
  SYNC_CONDITION: 37139,
  SYNC_STATUS: 37140,
  SYNC_FLAGS: 37141,
  SYNC_FENCE: 37142,
  SYNC_GPU_COMMANDS_COMPLETE: 37143,
  UNSIGNALED: 37144,
  SIGNALED: 37145,
  ALREADY_SIGNALED: 37146,
  TIMEOUT_EXPIRED: 37147,
  CONDITION_SATISFIED: 37148,
  WAIT_FAILED: 37149,
  SYNC_FLUSH_COMMANDS_BIT: 1,
  VERTEX_ATTRIB_ARRAY_DIVISOR: 35070,
  ANY_SAMPLES_PASSED: 35887,
  ANY_SAMPLES_PASSED_CONSERVATIVE: 36202,
  SAMPLER_BINDING: 35097,
  TRANSFORM_FEEDBACK: 36386,
  TRANSFORM_FEEDBACK_PAUSED: 36387,
  TRANSFORM_FEEDBACK_ACTIVE: 36388,
  TRANSFORM_FEEDBACK_BINDING: 36389,
  TEXTURE_IMMUTABLE_FORMAT: 37167,
  MAX_ELEMENT_INDEX: 36203,
  TEXTURE_IMMUTABLE_LEVELS: 33503,
  TIMEOUT_IGNORED: -1,
  MAX_CLIENT_WAIT_TIMEOUT_WEBGL: 37447
};
var extensions = {
  // ratified
  OES_texture_float: {},
  OES_texture_half_float: {},
  WEBGL_lose_context: {
    loseContext: () => {
    }
  },
  OES_standard_derivatives: {},
  OES_vertex_array_object: {
    createVertexArrayOES: () => {
    },
    bindVertexArrayOES: () => {
    },
    deleteVertexArrayOES: () => {
    }
  },
  WEBGL_debug_renderer_info: null,
  WEBGL_debug_shaders: null,
  WEBGL_compressed_texture_s3tc: null,
  WEBGL_depth_texture: {},
  OES_element_index_uint: {},
  EXT_texture_filter_anisotropic: null,
  EXT_frag_depth: {},
  WEBGL_draw_buffers: {},
  ANGLE_instanced_arrays: null,
  OES_texture_float_linear: null,
  OES_texture_half_float_linear: null,
  EXT_blend_minmax: { MIN_EXT: 0, MAX_EXT: 0 },
  EXT_shader_texture_lod: null,
  // community
  WEBGL_compressed_texture_atc: null,
  WEBGL_compressed_texture_pvrtc: null,
  EXT_color_buffer_half_float: null,
  WEBGL_color_buffer_float: null,
  EXT_sRGB: null,
  WEBGL_compressed_texture_etc1: null
};
var WebGL2RenderingContext = class {
  constructor(canvas) {
    this.canvas = canvas;
    this.drawingBufferWidth = canvas.width;
    this.drawingBufferHeight = canvas.height;
    for (const method of functions) {
      this[method] ??= () => {
      };
    }
    Object.assign(this, enums);
  }
  getShaderPrecisionFormat = () => {
    return {
      rangeMin: 127,
      rangeMax: 127,
      precision: 23
    };
  };
  GL_VERSION = 7938;
  SCISSOR_BOX = 3088;
  VIEWPORT = 2978;
  getParameter(paramId) {
    switch (paramId) {
      case this.GL_VERSION:
        return ["WebGL2"];
      case this.SCISSOR_BOX:
      case this.VIEWPORT:
        return [0, 0, 1, 1];
    }
  }
  getExtension(ext) {
    return extensions[ext];
  }
  getProgramInfoLog = () => "";
  getShaderInfoLog = () => "";
};

// src/testing/index.tsx
function test(children3, props) {
  const canvas = createTestCanvas();
  let context = null;
  let unmount = null;
  createRoot((dispose) => {
    unmount = dispose;
    context = createThree(
      canvas,
      mergeProps3(
        {
          get children() {
            return children3();
          },
          camera: {
            position: [0, 0, 5]
          }
        },
        props
      )
    );
  });
  const waitTillNextFrame = () => new Promise((resolve2) => {
    const cleanup = context.addFrameListener(() => (cleanup(), resolve2()));
  });
  return mergeProps3(context, {
    unmount,
    waitTillNextFrame
  });
}
function TestCanvas(props) {
  const canvas = createTestCanvas();
  const container = <div style={{ width: "100%", height: "100%" }}>{canvas}</div>;
  createRoot(() => createThree(canvas, props));
  createRenderEffect3(() => {
    if (props.ref instanceof Function)
      props.ref(container);
    else
      props.ref = container;
  });
  return container;
}
var createTestCanvas = ({ width = 1280, height = 800 } = {}) => {
  let canvas;
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    canvas = document.createElement("canvas");
  } else {
    canvas = {
      style: {},
      addEventListener: () => {
      },
      removeEventListener: () => {
      },
      clientWidth: width,
      clientHeight: height,
      getContext: () => new WebGL2RenderingContext(canvas)
    };
  }
  canvas.width = width;
  canvas.height = height;
  if (globalThis.HTMLCanvasElement) {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(id) {
      if (id.startsWith("webgl"))
        return new WebGL2RenderingContext(this);
      return getContext.apply(this, arguments);
    };
  }
  class WebGLRenderingContext extends WebGL2RenderingContext {
  }
  globalThis.WebGLRenderingContext ??= WebGLRenderingContext;
  globalThis.WebGL2RenderingContext ??= WebGL2RenderingContext;
  return canvas;
};
export {
  TestCanvas,
  test
};
