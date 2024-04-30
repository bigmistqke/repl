import { T as ThreeContext, a as ThreeComponentProxy } from '../canvas-DtnHxbML.js';
export { $ as $S3C, g as Augmentation, A as AugmentedElement, c as CameraType, C as Canvas, b as Constructor, E as EventHandlers, e as EventType, I as InstanceFromConstructor, K as KeyOfOptionals, S as Size, h as ThreeComponent, f as ThreeElement, d as ThreeEvent, i as ThreeProps } from '../canvas-DtnHxbML.js';
import { Accessor, Resource } from 'solid-js';
import * as three from 'three';
import { Object3D, Material } from 'three';

/**
 * Custom hook to access all necessary Three.js objects needed to manage a 3D scene.
 * This hook must be used within a component that is a descendant of the `<Canvas/>` component.
 *
 * @template T The expected return type after applying the callback to the context.
 * @param {Function} [callback] - Optional callback function that processes and returns a part of the context.
 * @returns {ThreeContext | Accessor<T>} Returns the ThreeContext directly, or an accessor if a callback is provided.
 * @throws {Error} Throws an error if used outside of the Canvas component context.
 */
declare function useThree(): ThreeContext;
declare function useThree<T>(callback: (value: ThreeContext) => T): Accessor<T>;
/**
 * Hook to register a callback that will be executed on each animation frame within the `<Canvas/>` component.
 * This hook must be used within a component that is a descendant of the `<Canvas/>` component.
 *
 * @param callback - The callback function to be executed on each frame.
 * @throws {Error} Throws an error if used outside of the Canvas component context.
 */
declare const useFrame: (callback: (context: ThreeContext, delta: number, frame?: XRFrame) => void) => void;
/**
 * Hook to create and manage a resource using a Three.js loader. It ensures that the loader is
 * reused if it has been instantiated before, and manages the resource lifecycle automatically.
 *
 * @template TResult The type of the resolved data when the loader completes loading.
 * @template TArg The argument type expected by the loader function.
 * @param Constructor - The loader class constructor.
 * @param args - The arguments to be passed to the loader function, wrapped in an accessor to enable reactivity.
 * @returns An accessor containing the loaded resource, re-evaluating when inputs change.
 */
declare const useLoader: <TArg extends string | readonly string[], TLoader extends Loader<any>>(Constructor: new () => TLoader, args: Accessor<TArg>, setup?: ((loader: TLoader) => void) | undefined) => Resource<UseLoaderOverload<string, TLoader extends Loader<infer U> ? U : never, TArg>>;
type Loader<TLoaderResult = any> = {
    load: (value: string, onLoad: (value: TLoaderResult) => void, onProgress: (() => void) | undefined, onReject: ((error: ErrorEvent) => void) | undefined) => void | null;
};
type UseLoaderOverload<TLoaderArg, TLoaderResult, TArg> = TArg extends readonly TLoaderArg[] ? {
    [K in keyof TArg]: TLoaderResult;
} : TLoaderResult;

/**
 * Extends the global CATALOGUE with additional objects.
 *
 * @param {Record<string, Constructor>} objects - The objects to add to the catalogue.
 */
declare const extend: (objects: Partial<typeof three | {}>) => void;
/**
 * A proxy that provides on-demand creation and caching of `solid-three` components.
 * It represents a dynamic layer over the predefined components and any added through extend function.
 */
declare const T: ThreeComponentProxy<typeof three & SolidThree.ThreeElements> & SolidThree.Components;

interface ObjectMap {
    nodes: {
        [name: string]: Object3D;
    };
    materials: {
        [name: string]: Material;
    };
}
declare function buildGraph(object: Object3D): ObjectMap;

export { T, ThreeComponentProxy, ThreeContext, buildGraph, extend, useFrame, useLoader, useThree };
