import { EventEmitter } from "node:events";

/** In-process event bus: REST routes publish, /ws/live subscribers consume. */
export const bus = new EventEmitter();
bus.setMaxListeners(100);
