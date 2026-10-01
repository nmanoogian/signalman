import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { View } from "./useSession";
import { nextIntentFor } from "./useVoiceGuessing";

describe("nextIntentFor", () => {
  it("spins the wheel when there is a wheel", () => {
    assert.equal(nextIntentFor("carousel"), "spin");
  });

  // The regression: `advance` treats a finished round as a destination, so routing "next"
  // there left the player stuck on the round-complete screen.
  it("opens the next round rather than re-arriving at the end of this one", () => {
    assert.equal(nextIntentFor("roundComplete"), "nextRound");
  });

  it("moves on from a flag that has been answered or revealed", () => {
    assert.equal(nextIntentFor("revealed"), "advance");
    assert.equal(nextIntentFor("correct"), "advance");
  });

  it("has an intent for every stage", () => {
    const stages: View["kind"][] = [
      "carousel",
      "guessing",
      "correct",
      "revealed",
      "roundComplete",
      "studyComplete",
    ];
    for (const stage of stages) {
      assert.ok(["spin", "nextRound", "advance"].includes(nextIntentFor(stage)), stage);
    }
  });
});
