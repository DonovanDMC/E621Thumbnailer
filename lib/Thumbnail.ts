import TempFile from "./TempFile.js";

import type { AnimatedFormat, ImageFormat } from "./types.js";

export default class Thumbnail<T extends "image" | "animated" = "image" | "animated"> {
    file: TempFile;
    format: T extends "image" ? ImageFormat : T extends "animated" ? AnimatedFormat : ImageFormat | AnimatedFormat;
    type: T;
    constructor(type: T, format: ImageFormat | AnimatedFormat, file: string | TempFile) {
        this.file = file instanceof TempFile ? file : new TempFile(file);
        this.format = format as never;
        this.type = type;
    }

    async delete(): Promise<void> {
        await this.file.release();
    }

    async save(path: string): Promise<void> {
        await this.file.copyTo(path);
    }

    async toBuffer(): Promise<Buffer> {
        return this.file.buffer();
    }
}
