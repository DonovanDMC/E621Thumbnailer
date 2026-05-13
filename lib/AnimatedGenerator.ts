import { exec } from "node:child_process";
import { rename, stat } from "node:fs/promises";

import { getDebugger, type Debugger } from "./Debug.js";
import TempFile from "./TempFile.js";
import Thumbnail from "./Thumbnail.js";
import { hasGifsicle, probeDuration, randomOffset, runFFmpeg } from "./utils.js";

import type { AnimatedFormat, ResolvedAnimatedOptions } from "./types.js";

let gifsicleWarningShown = false;
export default class AnimatedGenerator {
    private readonly log: Debugger;
    readonly options: ResolvedAnimatedOptions;
    constructor(options: ResolvedAnimatedOptions) {
        this.options = options;
        this.log = getDebugger("animated");
    }

    args(format: AnimatedFormat, offset: number, inputFile: string, outputFile: string): Array<string> {
        if (format === "gif") {
            const scaleFilter = `fps=${this.options.fps},scale=${this.options.width}:-2:flags=lanczos`;
            const paletteGen = `palettegen=max_colors=${this.options.colors}:stats_mode=diff`;
            const paletteUse = "paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle";
            const filter = `${scaleFilter},split[s0][s1];[s0]${paletteGen}[p];[s1][p]${paletteUse}`;

            return [
                "-ss", String(offset),
                "-t", String(this.options.length),
                "-i", inputFile,
                "-vf", filter,
                "-loop", "0",
                "-y", outputFile,
            ];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        } else if (format === "webp") {
            return [
                "-ss", String(offset),
                "-t", String(this.options.length),
                "-i", inputFile,
                "-vf", `fps=${this.options.fps},scale=${this.options.width}:-2:flags=lanczos`,
                "-vcodec", "libwebp",
                "-lossless", "0",
                "-compression_level", "6",
                "-q:v", String(this.options.quality),
                "-loop", "0",
                "-preset", "picture",
                "-an",
                "-y", outputFile,
            ];
        } else {
            return [];
        }
    }

    async generate(format: AnimatedFormat, inputFile: string, offset?: number): Promise<Thumbnail<"animated">> {
        offset ??= await this.randomOffset(inputFile);
        const now = Date.now();
        const outputFile = TempFile.new(`thumb-${now}.${format}`);
        const args = this.args(format, offset, inputFile, outputFile.path);

        this.log("generating %s: offset=%ds length=%ds fps=%d width=%dpx colors=%d", format, offset, this.options.length, this.options.fps, this.options.width, this.options.colors);
        await runFFmpeg(this.options.ffmpegPath, args, this.log);

        if (format === "gif") {
            const temporary = TempFile.new(`thumb-${now}.unoptimized.${format}`);
            await rename(outputFile.path, temporary.path);
            const optimized = await this.optimizeGif(temporary.path, outputFile.path);
            if (optimized) {
                await temporary.release();
                return new Thumbnail("animated", format, optimized);
            } else {
                await rename(temporary.path, outputFile.path);
                await temporary.release();
            }
        }

        this.log("done");
        return new Thumbnail("animated", format, outputFile);
    }

    async optimizeGif(inputFile: string, outputFile: string): Promise<TempFile | null> {
        if (this.options.gifOptimizationLevel === 0) {
            this.log("GIF optimization disabled");
            return null;
        }
        const canOptimize = await hasGifsicle();
        if (!canOptimize) {
            if (!gifsicleWarningShown) {
                gifsicleWarningShown = true;
                process.emitWarning("gifsicle not found in PATH — GIF optimization will be skipped");
                this.log("gifsicle not found in PATH — GIF optimization will be skipped");
            } else {
                this.log("skipping gifsicle optimization");
            }
            return null;
        }

        this.log("optimizing with gifsicle -O%d", this.options.gifOptimizationLevel);
        const cmd = `gifsicle -O${this.options.gifOptimizationLevel} "${inputFile}" -o "${outputFile}"`;
        this.log("executing command: %s", cmd);
        await new Promise<void>((resolve, reject) => {
            exec(cmd)
                .on("close", () => { resolve(); })
                .on("error", reject);
        });

        const [before, after] = await Promise.all([stat(inputFile), stat(outputFile)]);
        this.log("optimized: %dMB -> %dMB", (before.size / 1e6).toFixed(2), (after.size / 1e6).toFixed(2));

        return new TempFile(outputFile);
    }

    async randomOffset(file: string): Promise<number> {
        this.log("probing duration of %s", file);
        const duration = await probeDuration(this.options.ffprobePath, file, this.log);
        this.log("duration=%ds", duration.toFixed(2));
        return randomOffset(duration);
    }
}
