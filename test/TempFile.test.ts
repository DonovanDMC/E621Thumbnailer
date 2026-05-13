import assert from "node:assert/strict";
import { access, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { after, before, beforeEach, describe, it } from "node:test";

import TempFile from "../lib/TempFile.js";

const TEST_DIR = `${tmpdir()}/e621-thumbnailer-test-${process.pid}`;
const p = (name: string): string => `${TEST_DIR}/${name}`;

void describe("TempFile", () => {
    before(async (): Promise<void> => {
        await mkdir(TEST_DIR, { recursive: true });
    });

    after(async (): Promise<void> => {
        await rm(TEST_DIR, { recursive: true, force: true });
    });

    beforeEach((): void => {
        TempFile.tracked.length = 0;
    });

    void it("registers itself in TempFile.tracked on construction", () => {
        const file = new TempFile(p("tracked"));
        assert.ok(TempFile.tracked.includes(file));
        file.untrack();
    });

    void it("write() stores data, read() returns it", async () => {
        const file = new TempFile(p("write-read.txt"));
        await file.write("hello world");
        assert.equal((await file.read()).toString(), "hello world");
        await file.release();
    });

    void it("write() handles binary buffers", async () => {
        const file = new TempFile(p("binary.bin"));
        const data = Buffer.from([0x00, 0x01, 0xFE, 0xFF]);
        await file.write(data);
        assert.deepEqual([...(await file.read())], [0x00, 0x01, 0xFE, 0xFF]);
        await file.release();
    });

    void it("release() deletes the file and marks valid=false", async () => {
        const path = p("release.txt");
        const file = new TempFile(path);
        await file.write("bye");
        await file.release();
        assert.equal(file.valid, false);
        assert.equal(await access(path).then(() => true, () => false), false);
    });

    void it("release() removes the file from tracked", async () => {
        const file = new TempFile(p("untrack-on-release.txt"));
        await file.write("x");
        assert.ok(TempFile.tracked.includes(file));
        await file.release();
        assert.ok(!TempFile.tracked.includes(file));
    });

    void it("write() and read() throw after release()", async () => {
        const file = new TempFile(p("post-release.txt"));
        await file.write("data");
        await file.release();
        await assert.rejects(() => file.write("more"), /no longer valid/i);
        await assert.rejects(() => file.read(), /no longer valid/i);
    });

    void it("track() returns false if already tracked, true otherwise", () => {
        const file = new TempFile(p("track-bool"));
        assert.equal(file.track(), false);
        file.untrack();
        assert.equal(file.track(), true);
        file.untrack();
    });

    void it("untrack() returns false if not tracked, true otherwise", () => {
        const file = new TempFile(p("untrack-bool"));
        assert.equal(file.untrack(), true);
        assert.equal(file.untrack(), false);
    });

    void it("copyFrom() replicates file content", async () => {
        const src = new TempFile(p("copy-src.txt"));
        const dest = new TempFile(p("copy-dest.txt"));
        await src.write("source");
        await dest.copyFrom(src.path);
        assert.equal((await dest.read()).toString(), "source");
        await src.release();
        await dest.release();
    });

    void it("copyTo() writes content to a destination path", async () => {
        const src = new TempFile(p("copyto-src.txt"));
        const destPath = p("copyto-dest.txt");
        await src.write("target");
        await src.copyTo(destPath);
        const dest = new TempFile(destPath);
        assert.equal((await dest.read()).toString(), "target");
        await src.release();
        await dest.release();
    });

    void it("rename() moves the file and updates path", async () => {
        const file = new TempFile(p("before.txt"));
        const newPath = p("after.txt");
        await file.write("renamed");
        await file.rename(newPath);
        assert.equal(file.path, newPath);
        assert.equal(await access(p("before.txt")).then(() => true, () => false), false);
        assert.equal(await access(newPath).then(() => true, () => false), true);
        await file.release();
    });
});
