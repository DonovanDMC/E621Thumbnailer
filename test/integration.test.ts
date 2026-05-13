import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { after, before, describe, it } from "node:test";

import thumbnail from "../lib/index.js";
import { resolveFFmpegPaths } from "../lib/utils.js";

const TEST_DIR = `${tmpdir()}/e621-thumbnailer-integration-${process.pid}`;
const TEST_VIDEO = `${TEST_DIR}/test.webm`;

// Verify a binary is actually executable before trusting the resolved path
function canRun(bin: string): Promise<boolean> {
    return new Promise((resolve): void => {
        const proc = spawn(bin, ["-version"], { stdio: "ignore" });
        proc.on("close", (code): void => { resolve(code === 0); });
        proc.on("error", (): void => { resolve(false); });
    });
}

function createTestVideo(ffmpegPath: string): Promise<void> {
    return new Promise((resolve, reject): void => {
        // 3-second 320×240 test pattern in VP8/WebM — no audio
        const proc = spawn(ffmpegPath, [
            "-f", "lavfi", "-i", "color=c=royalblue:size=320x240:duration=3",
            "-c:v", "libvpx", "-b:v", "200k", "-an",
            "-y", TEST_VIDEO,
        ]);
        let stderr = "";
        proc.stderr.on("data", (d: Buffer): void => { stderr += d.toString(); });
        proc.on("close", (code): void => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
            }
        });
        proc.on("error", reject);
    });
}

// Magic-byte helpers
const isPng = (b: Buffer): boolean => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
const isJpeg = (b: Buffer): boolean => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
const isWebp = (b: Buffer): boolean => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP";
const isGif = (b: Buffer): boolean => b.subarray(0, 4).toString("ascii") === "GIF8";

void describe("Integration", () => {
    let ready = false;

    before(async (): Promise<void> => {
        try {
            const { ffmpegPath } = await resolveFFmpegPaths({});
            if (!await canRun(ffmpegPath)) {
                return;
            }
            await mkdir(TEST_DIR, { recursive: true });
            await createTestVideo(ffmpegPath);
            ready = true;
        } catch {
            // ffmpeg unavailable or VP8 encoder missing — all tests will skip
        }
    });

    after(async (): Promise<void> => {
        await rm(TEST_DIR, { recursive: true, force: true });
    });

    void it("generates a PNG thumbnail (default)", { timeout: 30_000 }, async (t) => {
        if (!ready) {
            t.skip("ffmpeg / test video not available");
            return;
        }
        const thumb = await thumbnail(TEST_VIDEO);
        assert.equal(thumb.type, "image");
        assert.equal(thumb.format, "png");
        const buf = await thumb.toBuffer();
        await thumb.delete();
        assert.ok(buf.length > 0);
        assert.ok(isPng(buf), "output is not a valid PNG");
    });

    void it("generates a JPEG thumbnail", { timeout: 30_000 }, async (t) => {
        if (!ready) {
            t.skip("ffmpeg / test video not available");
            return;
        }
        const thumb = await thumbnail(TEST_VIDEO, { format: "jpg" });
        assert.equal(thumb.format, "jpg");
        const buf = await thumb.toBuffer();
        await thumb.delete();
        assert.ok(isJpeg(buf), "output is not a valid JPEG");
    });

    void it("generates a WebP thumbnail", { timeout: 30_000 }, async (t) => {
        if (!ready) {
            t.skip("ffmpeg / test video not available");
            return;
        }
        const thumb = await thumbnail(TEST_VIDEO, { format: "webp" });
        assert.equal(thumb.format, "webp");
        const buf = await thumb.toBuffer();
        await thumb.delete();
        assert.ok(isWebp(buf), "output is not a valid WebP");
    });

    void it("generates an animated GIF", { timeout: 60_000 }, async (t) => {
        if (!ready) {
            t.skip("ffmpeg / test video not available");
            return;
        }
        const thumb = await thumbnail(TEST_VIDEO, { type: "animated", format: "gif", length: 1 });
        assert.equal(thumb.type, "animated");
        assert.equal(thumb.format, "gif");
        const buf = await thumb.toBuffer();
        await thumb.delete();
        assert.ok(buf.length > 0);
        assert.ok(isGif(buf), "output is not a valid GIF");
    });

    void it("generates an animated WebP", { timeout: 60_000 }, async (t) => {
        if (!ready) {
            t.skip("ffmpeg / test video not available");
            return;
        }
        const thumb = await thumbnail(TEST_VIDEO, { type: "animated", format: "webp", length: 1 });
        assert.equal(thumb.type, "animated");
        assert.equal(thumb.format, "webp");
        const buf = await thumb.toBuffer();
        await thumb.delete();
        assert.ok(isWebp(buf), "output is not a valid WebP");
    });

    void it("width option produces a smaller PNG than the original", { timeout: 30_000 }, async (t) => {
        if (!ready) {
            t.skip("ffmpeg / test video not available");
            return;
        }
        const [full, scaled] = await Promise.all([
            thumbnail(TEST_VIDEO, { format: "png" }),
            thumbnail(TEST_VIDEO, { format: "png", width: 80 }),
        ]);
        const [fullBuf, scaledBuf] = await Promise.all([full.toBuffer(), scaled.toBuffer()]);
        await Promise.all([full.delete(), scaled.delete()]);
        assert.ok(scaledBuf.length < fullBuf.length,
            `scaled (${scaledBuf.length}B) should be smaller than full (${fullBuf.length}B)`);
    });
});
