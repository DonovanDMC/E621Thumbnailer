export type ImageFormat = "png" | "jpg" | "webp";
export type AnimatedFormat = "gif" | "webp";

interface BaseOptions {
    /** Path to the ffmpeg binary. Defaults to `ffmpeg-static` if installed, otherwise `ffmpeg`. */
    ffmpegPath?: string;
    /** Path to the ffprobe binary. Defaults to `ffprobe-static` if installed, otherwise `ffprobe`. */
    ffprobePath?: string;
}

export interface ImageOptions extends BaseOptions {
    /** @default "png" */
    format?: ImageFormat;
    /** JPEG quality (1-31, lower is better). @default 2 */
    jpegQuality?: number;
    type?: "image";
    /** WebP quality (0-100). @default 85 */
    webpQuality?: number;
    /** Scale width in pixels. 0 = original size. @default 0 */
    width?: number;
}

export interface AnimatedOptions extends BaseOptions {
    /** GIF palette color count (2-256). @default 128 */
    colors?: number;
    /** @default "gif" */
    format?: AnimatedFormat;
    /** Frames per second. @default 15 */
    fps?: number;
    /**
     * Gifsicle optimization level (GIF only). 0 disables optimization.
     * Requires `gifsicle` in PATH.
     * @default 0
     */
    gifOptimizationLevel?: 0 | 1 | 2 | 3;
    /** Duration in seconds. @default 2.5 */
    length?: number;
    /** WebP quality (0-100). @default 75 */
    quality?: number;
    type: "animated";
    /** Scale width in pixels. @default 480 */
    width?: number;
}

export type ThumbnailOptions = ImageOptions | AnimatedOptions;

export interface ResolvedImageOptions {
    ffmpegPath: string;
    ffprobePath: string;
    format: ImageFormat;
    jpegQuality: number;
    type: "image";
    webpQuality: number;
    width: number;
}

export interface ResolvedAnimatedOptions {
    colors: number;
    ffmpegPath: string;
    ffprobePath: string;
    format: AnimatedFormat;
    fps: number;
    gifOptimizationLevel: 0 | 1 | 2 | 3;
    length: number;
    quality: number;
    type: "animated";
    width: number;
}

export type ResolvedOptions = ResolvedImageOptions | ResolvedAnimatedOptions;
