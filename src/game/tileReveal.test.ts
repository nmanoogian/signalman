import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextTileAt, REVEAL_DURATION_MS, TILE_COUNT, tileOrder, tilesShown } from "./tileReveal";

describe("tilesShown", () => {
  it("starts with every tile down", () => {
    assert.equal(tilesShown(0), 0);
    assert.equal(tilesShown(-100), 0);
  });

  it("lifts the last tile exactly as the reveal ends", () => {
    assert.equal(tilesShown(REVEAL_DURATION_MS - 1), TILE_COUNT - 1);
    assert.equal(tilesShown(REVEAL_DURATION_MS), TILE_COUNT);
    assert.equal(tilesShown(REVEAL_DURATION_MS * 2), TILE_COUNT);
  });

  it("lifts tiles at an even pace", () => {
    assert.equal(tilesShown(REVEAL_DURATION_MS / 2), TILE_COUNT / 2);
  });
});

describe("nextTileAt", () => {
  it("agrees with tilesShown", () => {
    for (let shown = 0; shown < TILE_COUNT; shown++) {
      const at = nextTileAt(shown);
      assert.ok(at !== null);
      assert.equal(tilesShown(at), shown + 1);
      assert.equal(tilesShown(at - 1), shown);
    }
  });

  it("is null once every tile is showing", () => {
    assert.equal(nextTileAt(TILE_COUNT), null);
  });
});

describe("tileOrder", () => {
  it("lifts every tile exactly once", () => {
    const order = tileOrder();
    assert.equal(order.length, TILE_COUNT);
    assert.deepEqual(
      order.toSorted((a, b) => a - b),
      Array.from({ length: TILE_COUNT }, (_, index) => index),
    );
  });

  it("shuffles", () => {
    assert.notDeepEqual(
      tileOrder(() => 0),
      Array.from({ length: TILE_COUNT }, (_, index) => index),
    );
  });
});
