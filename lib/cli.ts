#!/usr/bin/env node
import { resolve } from "node:path";
import { exit } from "node:process";

import thumbnail from "./index.js";

import type { AnimatedOptions, ImageOptions } from "./types.js";

const HELP = `
Usage: e621-thumbnailer <input> [options]

  <input>  Post ID, 32-char MD5, URL, or local file path

Output:
  -o, --output <path>       Output file  (default: ./thumbnail.<format>)
                            Use - to write to stdout

Type & format:
  -t, --type <type>         image | animated  (default: image)
  -f, --format <fmt>        image:    png | jpg | webp  (default: png)
                            animated: gif | webp         (default: gif)

Image options:
  -w, --width <px>          Scale width; 0 = original  (default: 0)
  --jpeg-quality <1-31>     JPEG quality, lower = better  (default: 2)
  --webp-quality <0-100>    WebP quality  (default: 85)

Animated options:
  -w, --width <px>          Scale width  (default: 480)
  --length <seconds>        Clip duration  (default: 2.5)
  --fps <n>                 Frames per second  (default: 15)
  --colors <2-256>          GIF palette size  (default: 128)
  --quality <0-100>         WebP quality  (default: 75)
  --gif-optimize <0-3>      Gifsicle level; 0 = off  (default: 0)

Binaries:
  --ffmpeg <path>           Path to ffmpeg binary
  --ffprobe <path>          Path to ffprobe binary

  -h, --help                Show this help

Examples:
  e621-thumbnailer 4505261
  e621-thumbnailer 4505261 -t animated -f gif -o out.gif --gif-optimize 2
  e621-thumbnailer a51d55b12e7a16a37253783e52c4ec21 -t animated -f webp
  e621-thumbnailer ./video.webm -f jpg -o thumb.jpg
  e621-thumbnailer 4505261 -o - | display
`.trim();

function die(msg: string): never {
    console.error(`error: ${msg}\nRun with --help for usage.`);
    exit(1);
}

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
    console.log(HELP);
    exit(args.length === 0 ? 1 : 0);
}

const rawInput = args[0];
if (rawInput.startsWith("-")) {
    die(`expected <input> as first argument, got flag "${rawInput}"`);
}

const input: string | number = /^\d+$/.test(rawInput) ? parseInt(rawInput, 10) : rawInput;

let outputPath: string | undefined;
let type: "image" | "animated" = "image";
let format: string | undefined;
let width: number | undefined;
let length: number | undefined;
let fps: number | undefined;
let colors: number | undefined;
let quality: number | undefined;
let webpQuality: number | undefined;
let jpegQuality: number | undefined;
let gifOptimize: 0 | 1 | 2 | 3 | undefined;
let ffmpegPath: string | undefined;
let ffprobePath: string | undefined;

function nextArg(flag: string, i: number): [string, number] {
    const val = args[i + 1];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (val === undefined || (val.startsWith("-") && val !== "-")) {
        die(`${flag} requires a value`);
    }
    return [val, i + 1];
}

for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    let val: string;
    switch (arg) {
        /* eslint-disable @stylistic/max-statements-per-line, no-case-declarations */
        case "-o": case "--output": [val, i] = nextArg(arg, i); outputPath = val; break;
        case "-t": case "--type": [val, i] = nextArg(arg, i);
            if (val !== "image" && val !== "animated") die(`--type must be "image" or "animated"`);
            type = val; break;
        case "-f": case "--format": [val, i] = nextArg(arg, i); format = val; break;
        case "-w": case "--width": [val, i] = nextArg(arg, i); width = parseInt(val, 10); break;
        case "--length": [val, i] = nextArg(arg, i); length = parseFloat(val); break;
        case "--fps": [val, i] = nextArg(arg, i); fps = parseInt(val, 10); break;
        case "--colors": [val, i] = nextArg(arg, i); colors = parseInt(val, 10); break;
        case "--quality": [val, i] = nextArg(arg, i); quality = parseInt(val, 10); break;
        case "--webp-quality": [val, i] = nextArg(arg, i); webpQuality = parseInt(val, 10); break;
        case "--jpeg-quality": [val, i] = nextArg(arg, i); jpegQuality = parseInt(val, 10); break;
        case "--gif-optimize": [val, i] = nextArg(arg, i);
            const level = parseInt(val, 10);
            if (level < 0 || level > 3) die("--gif-optimize must be 0-3");
            gifOptimize = level as 0 | 1 | 2 | 3; break;
        case "--ffmpeg": [val, i] = nextArg(arg, i); ffmpegPath = val; break;
        case "--ffprobe": [val, i] = nextArg(arg, i); ffprobePath = val; break;
        default: die(`unknown flag "${arg}"`);
        /* eslint-enable @stylistic/max-statements-per-line, no-case-declarations */
    }
}

const resolvedFormat = format ?? (type === "animated" ? "gif" : "png");
const toStdout = outputPath === "-";
const resolvedOutput = toStdout ? "-" : (outputPath ?? resolve(`thumbnail.${resolvedFormat}`));

const options: ImageOptions | AnimatedOptions = type === "animated"
    ? {
        type: "animated",
        format: resolvedFormat as "gif" | "webp",
        ...(width !== undefined && { width }),
        ...(length !== undefined && { length }),
        ...(fps !== undefined && { fps }),
        ...(colors !== undefined && { colors }),
        ...(quality !== undefined && { quality }),
        ...(gifOptimize !== undefined && { gifOptimizationLevel: gifOptimize }),
        ...(ffmpegPath !== undefined && { ffmpegPath }),
        ...(ffprobePath !== undefined && { ffprobePath }),
    } satisfies AnimatedOptions
    : {
        type: "image",
        format: resolvedFormat as "png" | "jpg" | "webp",
        ...(width !== undefined && { width }),
        ...(jpegQuality !== undefined && { jpegQuality }),
        ...(webpQuality !== undefined && { webpQuality }),
        ...(ffmpegPath !== undefined && { ffmpegPath }),
        ...(ffprobePath !== undefined && { ffprobePath }),
    } satisfies ImageOptions;

// When writing data to stdout, keep status messages on stderr so they don't corrupt the stream
const log = toStdout
    ? (msg: string): void => { process.stderr.write(msg + "\n"); }
    : (msg: string): void => { console.log(msg); };

log(`Generating ${type}/${resolvedFormat} thumbnail for "${rawInput}"...`);

try {
    const result = await thumbnail(input, options);
    if (toStdout) {
        const buf = await result.toBuffer();
        await result.delete();
        await new Promise<void>((resolve, reject) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            process.stdout.write(buf, (err) => { err ? reject(err) : resolve(); });
        });
    } else {
        await result.save(resolvedOutput);
        await result.delete();
        log(`Saved: ${resolvedOutput}`);
    }
} catch (err) {
    console.error("Error:", err instanceof Error ? err.message : String(err));
    exit(1);
}
