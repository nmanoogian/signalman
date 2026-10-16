import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { searchCountries } from "./search";

function names(query: string, limit = 6): string[] {
  return searchCountries(query, limit).map((country) => country.name);
}

describe("searchCountries", () => {
  it("finds a country by its full code", () => {
    assert.ok(names("de").includes("Germany"));
    assert.equal(names("JP")[0], "Japan");
  });

  it("ranks a code match above name prefix matches", () => {
    assert.equal(names("is")[0], "Iceland");
    assert.ok(names("is").includes("Isle of Man"));
  });

  it("does not match a partial code", () => {
    assert.ok(!names("d", Infinity).includes("Germany"));
  });
});
