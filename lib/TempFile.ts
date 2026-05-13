import { copyFile, readFile, rm, writeFile } from "node:fs/promises";

import AsyncExitHook from "async-exit-hook";

import { TEMP_DIR } from "./Constants.js";

export default class TempFile {
    static tracked: Array<TempFile> = [];
    path: string;
    valid = true;
    constructor(path: string) {
        this.path = path;
        TempFile.tracked.push(this);
    }

    static new(name: string): TempFile {
        return new TempFile(`${TEMP_DIR}/${name}`);
    }

    private _checkValid(): void {
        if (!this.valid) {
            throw new Error("TempFile is no longer valid");
        }
    }

    async buffer(): Promise<Buffer> {
        this._checkValid();
        return readFile(this.path);
    }

    async copyFrom(src: string): Promise<void> {
        this._checkValid();
        await copyFile(src, this.path);
    }

    async copyTo(dest: string): Promise<void> {
        this._checkValid();
        await copyFile(this.path, dest);
    }

    async delete(): Promise<boolean> {
        return rm(this.path).then(() => true, () => false);
    }

    async read(): Promise<Buffer> {
        return this.buffer();
    }

    async release(): Promise<void> {
        this.valid = false;
        await this.delete();
        this.untrack();
    }

    async rename(newPath: string): Promise<void> {
        this._checkValid();
        await rm(newPath).catch(() => { /* ignore */ });
        await copyFile(this.path, newPath);
        await this.delete();
        this.path = newPath;
    }

    async touch(): Promise<void> {
        this._checkValid();
        await writeFile(this.path, "");
    }

    track(): boolean {
        if (!TempFile.tracked.includes(this)) {
            TempFile.tracked.push(this);
            return true;
        }
        return false;
    }

    untrack(): boolean {
        const idx = TempFile.tracked.indexOf(this);
        if (idx !== -1) {
            TempFile.tracked.splice(idx, 1);
            return true;
        }
        return false;
    }

    async write(data: Buffer | string): Promise<void> {
        this._checkValid();
        await rm(this.path).catch(() => { /* ignore */ });
        await writeFile(this.path, data);
    }
}

AsyncExitHook((cb) => {
    void Promise.all(TempFile.tracked.map(file => file.delete()))
        .then(cb);
});
