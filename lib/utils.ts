import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access } from "node:fs/promises";
import { delimiter, extname } from "node:path";

import E621 from "e621";

import { USER_AGENT } from "./Constants.js";
import { getDebugger } from "./Debug.js";
import TempFile from "./TempFile.js";

import type { Debugger } from "./Debug.js";
import type { ResolvedAnimatedOptions, ResolvedImageOptions } from "./types.js";
import type { Post } from "e621";

export async function resolveFFmpegPaths(opts: { ffmpegPath?: string; ffprobePath?: string }): Promise<Record<"ffmpegPath" | "ffprobePath", string>> {
    const log = getDebugger("resolve");
    let ffmpegPath = opts.ffmpegPath ?? "";
    if (!ffmpegPath) {
        try {
            ffmpegPath = ((await import("ffmpeg-static")).default as unknown as string | null) ?? "";
        } catch { /* ignore */ }
        ffmpegPath ||= "ffmpeg";
    }
    log("resolved ffmpeg path: %s", ffmpegPath);

    let ffprobePath = opts.ffprobePath ?? "";
    if (!ffprobePath) {
        try {
            ffprobePath = ((await import("ffprobe-static")).default as unknown as { path: string } | null)?.path ?? "";
        } catch { /* ignore */ }
        ffprobePath ||= "ffprobe";
    }
    log("resolved ffprobe path: %s", ffprobePath);

    return { ffmpegPath, ffprobePath };
}

export async function probeDuration(ffprobePath: string, file: string, log?: Debugger): Promise<number> {
    const args = ["-v", "quiet", "-print_format", "json", "-show_format", file];
    if (log) {
        log("running ffprobe with args: %s", args.join(" "));
    }
    const proc = spawn(ffprobePath, args);
    let stdout = "";
    for await (const chunk of proc.stdout as AsyncIterable<Buffer>) {
        stdout += chunk.toString();
    }
    await new Promise(resolve => proc.on("close", resolve));
    try {
        const data = JSON.parse(stdout) as { format?: { duration?: string } };
        return parseFloat(data.format?.duration ?? "0") || 0;
    } catch {
        return 0;
    }
}

export async function runFFmpeg(ffmpegPath: string, args: Array<string>, log?: Debugger): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        if (log) {
            log("running ffmpeg with args: %s", args.join(" "));
        }
        const proc = spawn(ffmpegPath, args);
        let stderr = "";
        proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
        proc.on("close", (code: number | null) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`ffmpeg exited with code ${code ?? "null"}:\n${stderr.slice(-2000)}`));
            }
        });
        proc.on("error", reject);
    });
}

export async function hasGifsicle(): Promise<boolean> {
    const paths = (process.env.PATH ?? "")
        .replace(/"+/g, "")
        .split(delimiter)
        .flatMap(dir => (process.env.PATHEXT ?? "").split(delimiter).map(ext => `${dir}/gifsicle${ext}`));
    for (const p of paths) {
        if (await access(p).then(() => true, () => false)) {
            return true;
        }
    }
    return false;
}

export function randomOffset(duration: number): number {
    const offset = Math.floor(Math.random() * duration);
    return offset > duration ? 0 : offset;
}

const MD5 = /^[a-f0-9]{32}$/i;
export const e6Client = new E621({ userAgent: USER_AGENT });
export async function resolveInput(input: string | number): Promise<TempFile> {
    const log = getDebugger("resolve");
    const id = randomBytes(4).toString("hex");
    log("id: %s", id);
    if (typeof input !== "string" || !input.includes("://")) {
        if (typeof input === "number" || MD5.test(input)) {
            let post: Post | null = null;
            if (typeof input === "number") {
                log("resolving post by ID: %d", input);
                post = await e6Client.posts.get(input);
            } else {
                log("resolving post by MD5: %s", input);
                post = await e6Client.posts.search({ tags: `md5:${input}` }).then(res => res[0] ?? null);
            }
            if (post === null) {
                throw new Error(`Post with ID "${input}" not found.`);
            } else if (!post.file.url) {
                if (post.flags.deleted) {
                    throw new Error(`Post with ID "${input}" is deleted.`);
                }
                throw new Error(`Post with ID "${input}" has no file URL.`);
            }

            input = post.file.url;
        } else if (await access(input).then(() => true, () => false)) {
            log("resolving local file: %s", input);
            const file = TempFile.new(`thumb-${id}${extname(input)}`);
            await file.copyFrom(input);
            return file;
        } else {
            throw new Error(`Input "${input}" is not a valid URL, md5, or existing file path.`);
        }
    }

    log("downloading %s", input);
    const res = await fetch(input, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) {
        throw new Error(`Failed to fetch "${input}": ${res.status} ${res.statusText}`);
    }
    const file = TempFile.new(`thumb-${id}${extname(input)}`);
    await file.write(Buffer.from(await res.arrayBuffer()));
    log("download complete: %s", file.path);
    return file;
}

export function resolveImageOptions(input: Partial<ResolvedImageOptions>): ResolvedImageOptions {
    return {
        type: "image",
        ffmpegPath: input.ffmpegPath!,
        ffprobePath: input.ffprobePath!,
        format: input.format ?? "png",
        width: input.width ?? 0,
        jpegQuality: input.jpegQuality ?? 2,
        webpQuality: input.webpQuality ?? 85,
    };
}

export function resolveAnimatedOptions(input: Partial<ResolvedAnimatedOptions>): ResolvedAnimatedOptions {
    return {
        type: "animated",
        ffmpegPath: input.ffmpegPath!,
        ffprobePath: input.ffprobePath!,
        format: input.format ?? "gif",
        length: Math.max(0.1, input.length ?? 2.5),
        fps: Math.max(1, input.fps ?? 15),
        width: input.width ?? 480,
        colors: Math.min(256, Math.max(2, input.colors ?? 128)),
        gifOptimizationLevel: input.gifOptimizationLevel ?? 0,
        quality: Math.min(100, Math.max(0, input.quality ?? 75)),
    };
}
