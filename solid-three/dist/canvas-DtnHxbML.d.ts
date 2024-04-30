import { JSX, ParentProps, Setter, Component, ComponentProps } from 'solid-js';
import * as three from 'three';
import { Object3D, PerspectiveCamera, OrthographicCamera, Camera, WebGLRenderer, Raycaster, Scene } from 'three';

/**
 * A component for placing its children outside the regular `solid-three` scene graph managed by Solid's reactive system.
 * This is useful for bypassing the normal rendering flow and manually managing children, similar to Solid's Portal but specific to `solid-three`.
 *
 * @function Portal
 * @param {PortalProps} props - The component props containing `children` to be rendered and an optional Object3D `element` to be rendered into.
 * @returns {JSX.Fragment} An empty JSX element.
 */
declare const Portal: (props: PortalProps) => JSX.Element;
type PortalProps = ParentProps<{
    element?: ThreeElement<Object3D> | AugmentedElement<Object3D>;
}>;
/**
 * Wraps a `ThreeElement` and allows it to be used as a JSX-component within a `solid-three` scene.
 *
 * @function Primitive
 * @template T - Extends ThreeElement which includes types from Three.js (like Mesh, Light, etc.).
 * @param {PrimitiveProps<T>} props - The properties for the Three.js object including the object instance's methods,
 *                                    optional children, and a ref that provides access to the object instance.
 * @returns {JSX.Element} The Three.js object wrapped as a JSX element, allowing it to be used within Solid's component system.
 */
declare function Primitive<T extends ThreeElement>(props: PrimitiveProps<T>): JSX.Element;
type PrimitiveProps<T> = Omit<ThreeProps<T>, "object" | "children" | "ref" | "args"> & {
    object: T;
    children?: JSX.Element;
    ref?: T | ((value: T) => void);
};

declare global {
    namespace SolidThree {
        interface Components {
            Primitive: typeof Primitive;
            Portal: typeof Portal;
        }
        interface ThreeElements {
        }
    }
}
/**********************************************************************************/
/**********************************************************************************/
type ThreeContext = {
    camera: AugmentedElement<PerspectiveCamera | OrthographicCamera>;
    canvas: HTMLCanvasElement;
    gl: AugmentedElement<three.WebGLRenderer>;
    pointer: three.Vector2;
    setPointer: Setter<three.Vector2>;
    raycaster: AugmentedElement<three.Raycaster>;
    render: (delta: number) => void;
    requestRender: () => void;
    scene: AugmentedElement<three.Object3D>;
    xr: {
        connect: () => void;
        disconnect: () => void;
    };
};
type Size = {
    left: number;
    top: number;
    height: number;
    width: number;
};
type Constructor<T = any> = new (...args: any[]) => T;
type ExtractConstructors<T> = T extends Constructor ? T : never;
type CameraType = PerspectiveCamera | OrthographicCamera;
type KeyOfOptionals<T> = keyof {
    [K in keyof T as T extends Record<K, T[K]> ? never : K]: T[K];
};
/**********************************************************************************/
/**********************************************************************************/
type ThreeEvent<TEvent extends WheelEvent | MouseEvent = WheelEvent | MouseEvent> = {
    nativeEvent: TEvent;
    stopped: boolean;
    stopPropagation: () => void;
};
type EventHandlers = {
    onClick: (event: ThreeEvent<MouseEvent>) => void;
    onDoubleClick: (event: ThreeEvent<MouseEvent>) => void;
    onContextMenu: (event: ThreeEvent<MouseEvent>) => void;
    onMouseDown: (event: ThreeEvent<MouseEvent>) => void;
    onMouseEnter: (event: ThreeEvent<MouseEvent>) => void;
    onMouseLeave: (event: ThreeEvent<MouseEvent>) => void;
    onMouseMove: (event: ThreeEvent<MouseEvent>) => void;
    onMouseUp: (event: ThreeEvent<MouseEvent>) => void;
    onPointerUp: (event: ThreeEvent<MouseEvent>) => void;
    onPointerDown: (event: ThreeEvent<MouseEvent>) => void;
    onPointerMove: (event: ThreeEvent<MouseEvent>) => void;
    onPointerEnter: (event: ThreeEvent<MouseEvent>) => void;
    onPointerLeave: (event: ThreeEvent<MouseEvent>) => void;
    onPointerMissed: (event: ThreeEvent<MouseEvent>) => void;
    onWheel: (event: ThreeEvent<WheelEvent>) => void;
};
type EventType = keyof EventHandlers;
/**********************************************************************************/
/**********************************************************************************/
type ThreeConstructor = ExtractConstructors<(typeof three)[keyof typeof three]>;
type ThreeElement<TConstructor = ThreeConstructor> = InstanceFromConstructor<TConstructor>;
type AugmentedElement<TConstructor = ThreeConstructor> = ThreeElement<TConstructor> & {
    [$S3C]: Augmentation;
};
type Augmentation = {
    props: ThreeProps<ThreeElement>;
    children: Set<AugmentedElement>;
};
type ThreeComponentProxy<Source> = {
    [K in keyof Source]: ThreeComponent<Source[K]>;
};
type ThreeComponent<Source> = Component<ThreeProps<Source>>;
type ThreeProps<Source> = Partial<ParentProps<Omit<InstanceProps<Source>, "children" | "attach"> & EventHandlers & {
    args: Args<Source>;
    onUpdate: (self: AugmentedElement<InstanceFromConstructor<Source>>) => void;
    attach: string | ((parent: AugmentedElement<three.Object3D>, self: AugmentedElement<InstanceFromConstructor<Source>>) => () => void);
}>>;
type InstanceProps<Source> = WithMapProps<InstanceFromConstructor<Source>>;
type Args<T> = T extends new (...args: any[]) => any ? AllConstructorParameters<T> : any[];
type InstanceFromConstructor<TConstructor> = TConstructor extends new (...args: any[]) => infer TObject ? TObject : TConstructor;
type WithMapProps<T> = {
    [TKey in keyof T]: T[TKey] extends MathRepresentation | three.Euler ? MathType<T[TKey]> : T[TKey];
};
type MathType<T extends MathRepresentation | three.Euler> = T extends three.Color ? ConstructorParameters<typeof three.Color> | three.ColorRepresentation : T extends VectorRepresentation | three.Layers | three.Euler ? T | Parameters<T["set"]> | number : T | Parameters<T["set"]>;
interface MathRepresentation {
    set(...args: number[]): any;
}
interface VectorRepresentation extends MathRepresentation {
    setScalar(s: number): any;
}
type ExcludeUnknown<T> = T extends Array<infer I> ? ({} extends I & {} ? never : T) : T;
type AllConstructorParameters<T> = ExcludeUnknown<T extends {
    new (...o: infer U): void;
    new (...o: infer U2): void;
    new (...o: infer U3): void;
    new (...o: infer U4): void;
    new (...o: infer U5): void;
    new (...o: infer U6): void;
    new (...o: infer U7): void;
} ? U | U2 | U3 | U4 | U5 | U6 | U7 : T extends {
    new (...o: infer U): void;
    new (...o: infer U2): void;
    new (...o: infer U3): void;
    new (...o: infer U4): void;
    new (...o: infer U5): void;
    new (...o: infer U6): void;
} ? U | U2 | U3 | U4 | U5 | U6 : T extends {
    new (...o: infer U): void;
    new (...o: infer U2): void;
    new (...o: infer U3): void;
    new (...o: infer U4): void;
    new (...o: infer U5): void;
} ? U | U2 | U3 | U4 | U5 : T extends {
    new (...o: infer U): void;
    new (...o: infer U2): void;
    new (...o: infer U3): void;
    new (...o: infer U4): void;
} ? U | U2 | U3 | U4 : T extends {
    new (...o: infer U): void;
    new (...o: infer U2): void;
    new (...o: infer U3): void;
} ? U | U2 | U3 : T extends {
    new (...o: infer U): void;
    new (...o: infer U2): void;
} ? U | U2 : T extends {
    new (...o: infer U): void;
} ? U : never>;

declare const $S3C: unique symbol;

/**
 * Props for the Canvas component, which initializes the Three.js rendering context and acts as the root for your 3D scene.
 */
interface CanvasProps extends ComponentProps<"div"> {
    /**
     * Configuration for the camera used in the scene.
     */
    camera?: Partial<ThreeProps<PerspectiveCamera> | ThreeProps<OrthographicCamera>> | Camera;
    /**
     * Element to render while the main content is loading asynchronously.
     */
    fallback?: JSX.Element;
    /**
     * Options for the WebGLRenderer or a function returning a customized renderer.
     */
    gl?: Partial<ThreeProps<WebGLRenderer>> | ((canvas: HTMLCanvasElement) => WebGLRenderer) | WebGLRenderer;
    /**
     * Toggles between Orthographic and Perspective camera.
     */
    orthographic?: boolean;
    /**
     * Configuration for the Raycaster used for mouse and pointer events.
     */
    raycaster?: Partial<ThreeProps<Raycaster>> | Raycaster;
    /**
     * Configuration for the Scene instance.
     */
    scene?: Partial<ThreeProps<Scene>> | Scene;
    /**
     * Custom CSS styles for the canvas container.
     */
    style?: JSX.CSSProperties;
    /**
     * Enables and configures shadows in the scene.
     */
    shadows?: boolean | "basic" | "percentage" | "soft" | "variance" | WebGLRenderer["shadowMap"];
    /**
     * Toggles linear interpolation for texture filtering.
     */
    linear?: boolean;
    /**
     * Toggles flat interpolation for texture filtering.
     */
    flat?: boolean;
    /**
     * Controls the rendering loop's operation mode.
     */
    frameloop?: "never" | "demand" | "always";
}
/**
 * Serves as the root component for all 3D scenes created with `solid-three`. It initializes
 * the Three.js rendering context, including a WebGL renderer, a scene, and a camera.
 * All `<T/>`-components must be children of this Canvas. Hooks such as `useThree` and
 * `useFrame` should only be used within this component to ensure proper context.
 *
 * @function Canvas
 * @param {CanvasProps} props - Configuration options include camera settings, style, and children elements.
 * @returns {JSX.Element} A div element containing the WebGL canvas configured to occupy the full available space.
 */
declare function Canvas(_props: CanvasProps): JSX.Element;

export { $S3C as $, type AugmentedElement as A, Canvas as C, type EventHandlers as E, type InstanceFromConstructor as I, type KeyOfOptionals as K, type Size as S, type ThreeContext as T, type ThreeComponentProxy as a, type Constructor as b, type CameraType as c, type ThreeEvent as d, type EventType as e, type ThreeElement as f, type Augmentation as g, type ThreeComponent as h, type ThreeProps as i, type CanvasProps as j };
