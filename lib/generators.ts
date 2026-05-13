import { mkdir } from "node:fs/promises";

import AnimatedGenerator from "./AnimatedGenerator.js";
import { TEMP_DIR } from "./Constants.js";
import ImageGenerator from "./ImageGenerator.js";
import { resolveAnimatedOptions, resolveFFmpegPaths, resolveImageOptions, resolveInput } from "./utils.js";

import type Thumbnail from "./Thumbnail.js";
import type { AnimatedOptions, ImageOptions } from "./types.js";

export async function generateImage(input: string | number, options?: ImageOptions): Promise<Thumbnail<"image">> {
    await mkdir(TEMP_DIR, { recursive: true });
    const { ffmpegPath, ffprobePath } = await resolveFFmpegPaths(options ?? {});
    const resOptions = resolveImageOptions({ ffmpegPath, ffprobePath, ...options });
    const file = await resolveInput(input);
    try {
        return await new ImageGenerator(resOptions).generate(resOptions.format, file.path);
    } finally {
        await file.release();
    }
}

export async function generateAnimated(input: string | number, options?: AnimatedOptions): Promise<Thumbnail<"animated">> {
    await mkdir(TEMP_DIR, { recursive: true });
    const { ffmpegPath, ffprobePath } = await resolveFFmpegPaths(options ?? {});
    const resOptions = resolveAnimatedOptions({ ffmpegPath, ffprobePath, ...options });
    const file = await resolveInput(input);
    try {
        return await new AnimatedGenerator(resOptions).generate(resOptions.format, file.path);
    } finally {
        await file.release();
    }
}
