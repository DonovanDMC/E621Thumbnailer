import { getDebugger, type Debugger } from "./Debug.js";
import TempFile from "./TempFile.js";
import Thumbnail from "./Thumbnail.js";
import { probeDuration, randomOffset, runFFmpeg } from "./utils.js";

import type { ImageFormat, ResolvedImageOptions } from "./types.js";

export default class ImageGenerator {
    private readonly log: Debugger;
    readonly options: ResolvedImageOptions;
    constructor(options: ResolvedImageOptions) {
        this.options = options;
        this.log = getDebugger("image");
    }

    args(format: ImageFormat, offset: number, inputFile: string, outputFile: string): Array<string> {
        const args = ["-ss", String(offset), "-i", inputFile, "-vframes", "1"];

        const filters: Array<string> = [];
        if (this.options.width > 0) {
            filters.push(`scale=${this.options.width}:-2:flags=lanczos`);
        }
        if (filters.length > 0) {
            args.push("-vf", filters.join(","));
        }

        if (format === "jpg") {
            args.push("-q:v", String(this.options.jpegQuality));
        } else if (format === "webp") {
            args.push("-vcodec", "libwebp", "-quality", String(this.options.webpQuality));
        }

        args.push("-y", outputFile);
        return args;
    }

    async generate(format: ImageFormat, inputFile: string, offset?: number): Promise<Thumbnail<"image">> {
        offset ??= await this.randomOffset(inputFile);
        const outputFile = TempFile.new(`thumb-${Date.now()}.${format}`);
        const args = this.args(format, offset, inputFile, outputFile.path);

        if (format === "jpg") {
            this.log("generating jpg: offset=%ds width=%dpx quality=%d", offset, this.options.width, this.options.jpegQuality);
        } else if (format === "webp") {
            this.log("generating webp: offset=%ds width=%dpx quality=%d", offset, this.options.width, this.options.webpQuality);
        } else {
            this.log("generating %s: offset=%ds width=%dpx", format, offset, this.options.width);
        }
        await runFFmpeg(this.options.ffmpegPath, args, this.log);

        this.log("done");
        return new Thumbnail("image", format, outputFile);
    }

    async randomOffset(file: string): Promise<number> {
        this.log("probing duration of %s", file);
        const duration = await probeDuration(this.options.ffprobePath, file, this.log);
        this.log("duration=%ds", duration.toFixed(2));
        return randomOffset(duration);
    }
}
