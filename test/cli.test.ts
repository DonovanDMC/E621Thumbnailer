import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { describe, it } from "node:test";

const ROOT = join(import.meta.dirname, "..");
const CLI = join(ROOT, "dist/cli.js");

function run(args: Array<string>): Promise<{ code: number; stderr: string; stdout: string }> {
    return new Promise((resolve): void => {
        const proc = spawn(process.execPath, [CLI, ...args]);
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (d: Buffer): void => { stdout += d.toString(); });
        proc.stderr.on("data", (d: Buffer): void => { stderr += d.toString(); });
        proc.on("close", (code): void => { resolve({ code: code ?? 1, stderr, stdout }); });
    });
}

void describe("CLI — argument handling", () => {
    void it("--help exits 0 and prints usage", async () => {
        const { code, stdout } = await run(["--help"]);
        assert.equal(code, 0);
        assert.ok(stdout.includes("Usage: e621-thumbnailer"), `unexpected stdout:\n${stdout}`);
    });

    void it("-h is an alias for --help", async () => {
        const { code, stdout } = await run(["-h"]);
        assert.equal(code, 0);
        assert.ok(stdout.includes("Usage: e621-thumbnailer"));
    });

    void it("no arguments exits 1 and prints usage", async () => {
        const { code, stdout } = await run([]);
        assert.equal(code, 1);
        assert.ok(stdout.includes("Usage: e621-thumbnailer"));
    });

    void it("flag as first argument exits 1 with descriptive error", async () => {
        const { code, stderr } = await run(["--not-an-input"]);
        assert.equal(code, 1);
        assert.match(stderr, /expected <input>/);
    });

    void it("unknown flag exits 1 with error", async () => {
        const { code, stderr } = await run(["4505261", "--unknown-flag"]);
        assert.equal(code, 1);
        assert.match(stderr, /unknown flag/);
    });

    void it("--type with invalid value exits 1", async () => {
        const { code, stderr } = await run(["4505261", "--type", "video"]);
        assert.equal(code, 1);
        assert.match(stderr, /--type must be/);
    });

    void it("--gif-optimize with value > 3 exits 1", async () => {
        const { code, stderr } = await run(["4505261", "--gif-optimize", "4"]);
        assert.equal(code, 1);
        assert.match(stderr, /--gif-optimize must be/);
    });

    void it("--gif-optimize with negative value exits 1", async () => {
        // -1 starts with "-" so nextArg will reject it as a missing value
        const { code, stderr } = await run(["4505261", "--gif-optimize", "-1"]);
        assert.equal(code, 1);
        assert.match(stderr, /requires a value/);
    });

    void it("flag without value exits 1", async () => {
        const { code, stderr } = await run(["4505261", "--output"]);
        assert.equal(code, 1);
        assert.match(stderr, /requires a value/);
    });

    void it("flag without value at end of args exits 1", async () => {
        const { code, stderr } = await run(["4505261", "--format"]);
        assert.equal(code, 1);
        assert.match(stderr, /requires a value/);
    });

    void it("--help mentions - for stdout", async () => {
        const { stdout } = await run(["--help"]);
        assert.ok(stdout.includes("stdout"), `expected 'stdout' in help:\n${stdout}`);
    });
});
