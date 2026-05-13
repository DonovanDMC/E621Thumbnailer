import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasGifsicle, randomOffset } from "../lib/utils.js";

void describe("randomOffset", () => {
    void it("returns 0 when duration is 0", () => {
        assert.equal(randomOffset(0), 0);
    });

    void it("always returns a non-negative value below duration", () => {
        for (let i = 0; i < 500; i++) {
            const offset = randomOffset(60);
            assert.ok(offset >= 0 && offset < 60, `offset ${offset} not in [0, 60)`);
        }
    });

    void it("never exceeds duration for any integer duration", () => {
        for (let d = 1; d <= 120; d++) {
            const offset = randomOffset(d);
            assert.ok(offset <= d, `offset ${offset} exceeds duration ${d}`);
        }
    });
});

void describe("hasGifsicle", () => {
    void it("returns a boolean", async () => {
        const result = await hasGifsicle();
        assert.equal(typeof result, "boolean");
    });
});
