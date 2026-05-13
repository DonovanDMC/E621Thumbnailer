import { generateAnimated, generateImage } from "./generators.js";

import type Thumbnail from "./Thumbnail.js";
import type { ThumbnailOptions } from "./types.js";

/**
 * Generate a thumbnail from an e621 video.
 *
 * @param input A direct URL, absolute file path, MD5 hash, or post ID.
 * @param options Generation options.
 */
async function thumbnail(input: string | number, options?: ThumbnailOptions): Promise<Thumbnail> {
    if (options?.type === "animated") {
        return generateAnimated(input, options);
    } else {
        return generateImage(input, options);
    }
}

export type * from "./types.js";
export default thumbnail;
