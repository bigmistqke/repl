import * as solid_js from 'solid-js';
import { Accessor, JSX } from 'solid-js';
import { j as CanvasProps, A as AugmentedElement, T as ThreeContext } from '../canvas-DtnHxbML.js';
import * as three from 'three';
import { PerspectiveCamera, OrthographicCamera, WebGLRenderer, Vector2, Raycaster } from 'three';

/**
 * Creates and manages a `solid-three` scene. It initializes necessary objects like
 * camera, renderer, raycaster, and scene, manages the scene graph, setups up an event system
 * and rendering loop based on the provided properties.
 *
 * @param {HTMLCanvasElement} canvas - The HTML canvas element on which Three.js will render.
 * @param {CanvasProps} props - Configuration properties.
 * @returns - a `ThreeContext` with additional properties including eventRegistry and addFrameListener.
 */
declare function createThree(canvas: HTMLCanvasElement, props: CanvasProps): {
    camera: AugmentedElement<PerspectiveCamera | OrthographicCamera>;
    canvas: HTMLCanvasElement;
    gl: AugmentedElement<WebGLRenderer>;
    pointer: Vector2;
    setPointer: solid_js.Setter<Vector2>;
    raycaster: AugmentedElement<Raycaster>;
    render: (delta: number) => void;
    requestRender: () => void;
    scene: AugmentedElement<three.Object3D<three.Object3DEventMap>>;
    xr: {
        connect: () => void;
        disconnect: () => void;
    };
    eventRegistry: {
        readonly onMouseMove: AugmentedElement<three.Object3D<three.Object3DEventMap>>[];
        readonly onMouseUp: AugmentedElement<three.Object3D<three.Object3DEventMap>>[];
        readonly onMouseDown: AugmentedElement<three.Object3D<three.Object3DEventMap>>[];
        readonly onPointerMove: AugmentedElement<three.Object3D<three.Object3DEventMap>>[];
        readonly onPointerUp: AugmentedElement<three.Object3D<three.Object3DEventMap>>[];
        readonly onPointerDown: AugmentedElement<three.Object3D<three.Object3DEventMap>>[];
        readonly onWheel: AugmentedElement<three.Object3D<three.Object3DEventMap>>[];
        readonly onClick: AugmentedElement<three.Object3D<three.Object3DEventMap>>[];
        readonly onDoubleClick: AugmentedElement<three.Object3D<three.Object3DEventMap>>[];
    };
    addFrameListener: (callback: (context: ThreeContext, delta: number, frame?: XRFrame) => void) => () => any[];
};

/**
 * Initializes a testing enviromnent for `solid-three`.
 *
 * @param {Accessor<JSX.Element>} children - An accessor for the `AugmentedElement` to render.
 * @param {Omit<CanvasProps, "children">} [props] - Optional properties to configure canvas.
 * @returns {TestApi} ThreeContext augmented with methods to unmount the scene and to wait for the next animation frame.
 *
 * @example
 * const testScene = test(() => <Mesh />, { camera: position: [0,0,5] });
 * await testScene.waitTillNextFrame();
 * testScene.unmount();
 */
declare function test(children: Accessor<JSX.Element>, props?: Omit<CanvasProps, "children">): TestApi;
type TestApi = ReturnType<typeof createThree> & {
    unmount: () => void;
    waitTillNextFrame: () => Promise<void>;
};
/**
 * Canvas element tailored for testing.
 *
 * @param {CanvasProps} props
 * @returns {JSX.Element} The canvas JSX element.
 *
 * @example
 * render(<TestCanvas camera={{ position: [0,0,5] }} />);
 */
declare function TestCanvas(props: CanvasProps): HTMLDivElement;

export { TestCanvas, test };
