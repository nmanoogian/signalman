import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  blurRadius,
  formatRevealTime,
  MAX_BLUR_FRACTION,
  REVEAL_DURATION_MS,
  revealProgress,
} from "./reveal";

describe("revealProgress", () => {
  it("runs from 0 to 1 over the reveal", () => {
    assert.equal(revealProgress(0), 0);
    assert.equal(revealProgress(REVEAL_DURATION_MS / 2), 0.5);
    assert.equal(revealProgress(REVEAL_DURATION_MS), 1);
  });

  it("clamps outside the reveal", () => {
    assert.equal(revealProgress(-500), 0);
    assert.equal(revealProgress(REVEAL_DURATION_MS * 3), 1);
  });
});

describe("blurRadius", () => {
  it("starts at the maximum and ends sharp", () => {
    assert.equal(blurRadius(0, 500), MAX_BLUR_FRACTION * 500);
    assert.equal(blurRadius(1, 500), 0);
  });

  it("only ever sharpens", () => {
    let previous = Infinity;
    for (let step = 0; step <= 100; step++) {
      const radius = blurRadius(step / 100, 500);
      assert.ok(radius <= previous);
      previous = radius;
    }
  });

  it("has dropped well below half by the halfway point", () => {
    assert.ok(blurRadius(0.5, 500) < (MAX_BLUR_FRACTION * 500) / 4);
  });
});

describe("formatRevealTime", () => {
  it("shows tenths of a second", () => {
    assert.equal(formatRevealTime(12_345), "12.3s");
    assert.equal(formatRevealTime(0), "0.0s");
  });
});
