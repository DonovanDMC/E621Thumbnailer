/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import type IDebug from "debug";

let debug: typeof IDebug | undefined;
await import("debug").then((module) => {
    debug = module.default;
}, () => {});

export default function Debug(namespace: string, formatter: unknown, ...args: Array<any>): void {
    if (debug) {
        debug(`e621-thumbnailer:${namespace}`)(formatter, ...args);
    }
}

const debuggers = new Map<string, ReturnType<typeof IDebug>>();

export type Debugger = (formatter: unknown, ...args: Array<any>) => void;
export function getDebugger(namespace: string): Debugger {
    if (!debug) {
        return () => {};
    }
    let dbg = debuggers.get(namespace);
    if (!dbg) {
        dbg = debug(`e621-thumbnailer:${namespace}`);
        debuggers.set(namespace, dbg);
    }
    return dbg;
}

export function removeDebugger(namespace: string): void {
    debuggers.delete(namespace);
}
