```ts
/**********************************************************************************/
/*                                                                                */
/*                                 Window Messaging                               */
/*                                                                                */
/**********************************************************************************/

/**
 * Sends a message to another window (e.g., iframe, popup).
 * Requires specifying a target origin.
 */
window.postMessage(
  message: any,
  targetOrigin: string,
  transfer?: Transferable[]
): void;

/**
 * Replies to the sender of a message event (e.g., iframe, popup).
 * Must use the original target's origin.
 */
event.source?.postMessage(
  message: any,
  targetOrigin: string,
  transfer?: Transferable[]
): void;

/**
 * Replies using a transferred MessagePort from a message event.
 */
event.ports[n].postMessage(
  message: any,
  transfer?: Transferable[]
): void;

/**********************************************************************************/
/*                                                                                */
/*                                 Worker Messaging                               */
/*                                                                                */
/**********************************************************************************/

/**
 * Sends a message to a Web Worker from the main thread.
 */
worker.postMessage(
  message: any,
  transfer?: Transferable[]
): void;

/**
 * Sends a message from inside a DedicatedWorker to the main thread.
 */
self.postMessage(
  message: any,
  transfer?: Transferable[]
): void; // inside a worker

/**
 * Replies to the sender of a message event inside a worker
 * (e.g., from a controlled client or another worker).
 */
event.source?.postMessage(
  message: any,
  transfer?: Transferable[]
): void; // inside ServiceWorker or SharedWorker

/**
 * Sends a message to a SharedWorker via its communication port.
 */
sharedWorker.port.postMessage(
  message: any,
  transfer?: Transferable[]
): void;

/**********************************************************************************/
/*                                                                                */
/*                                   MessagePort                                  */
/*                                                                                */
/**********************************************************************************/

/**
 * Sends a message through a MessagePort (used with MessageChannel or transferred ports).
 */
port.postMessage(
  message: any,
  transfer?: Transferable[]
): void;

// ─────────────────────────────
// BroadcastChannel
// ─────────────────────────────

/**
 * Broadcasts a message to all contexts listening on the same named channel.
 */
broadcastChannel.postMessage(
  message: any
): void;

// ─────────────────────────────
// Service Worker
// ─────────────────────────────

/**
 * Sends a message to a running Service Worker from the main thread.
 */
serviceWorker.postMessage(
  message: any,
  transfer?: Transferable[]
): void;

/**
 * Sends a message from a Service Worker to a controlled client (e.g., a page or iframe).
 */
client.postMessage(
  message: any,
  transfer?: Transferable[]
): void;

// ─────────────────────────────
// Worklets (e.g., AudioWorklet)
// ─────────────────────────────

/**
 * Sends a message from an AudioWorkletNode (main thread) to its processor.
 */
audioWorkletNode.port.postMessage(
  message: any,
  transfer?: Transferable[]
): void;

/**
 * Sends a message from inside the processor (AudioWorkletProcessor) back to the main thread.
 */
this.port.postMessage(
  message: any,
  transfer?: Transferable[]
): void; // inside processor
```
