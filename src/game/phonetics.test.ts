import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { editDistance, metaphone, similarity } from "./phonetics";

describe("metaphone", () => {
  it("folds spellings that sound alike onto one key", () => {
    const pairs: readonly [string, string][] = [
      ["germany", "jermany"],
      ["hungary", "hungry"],
      ["iraq", "irock"],
      ["togo", "togo"],
      ["chile", "chilly"],
      ["greece", "grease"],
      ["qatar", "katar"],
      ["colombia", "columbia"],
      ["philippines", "phillipines"],
      ["newzealand", "newzeeland"],
      ["oman", "ohman"],
    ];
    for (const [a, b] of pairs) {
      assert.equal(metaphone(a), metaphone(b), `${a} / ${b}`);
    }
  });

  it("keeps words that sound different apart", () => {
    const pairs: readonly [string, string][] = [
      ["germany", "france"],
      ["chad", "chile"],
      ["niger", "nicer"],
      ["japan", "spain"],
      ["kenya", "kenia"],
    ];
    for (const [a, b] of pairs) {
      assert.notEqual(metaphone(a), metaphone(b), `${a} / ${b}`);
    }
  });

  it("ignores case, spacing and punctuation", () => {
    assert.equal(metaphone("Guinea-Bissau"), metaphone("guinea bissau"));
    assert.equal(metaphone("CÔTE"), metaphone("cte"));
  });

  it("drops the silent head of a cluster", () => {
    assert.equal(metaphone("gnome"), metaphone("nome"));
    assert.equal(metaphone("knight"), metaphone("night"));
  });

  it("returns an empty key for input with no letters", () => {
    assert.equal(metaphone(""), "");
    assert.equal(metaphone("123 !?"), "");
  });
});

describe("editDistance", () => {
  it("is zero for identical strings", () => {
    assert.equal(editDistance("chad", "chad"), 0);
  });

  it("counts a single insertion, deletion or substitution as one", () => {
    assert.equal(editDistance("chad", "chads"), 1);
    assert.equal(editDistance("chad", "cha"), 1);
    assert.equal(editDistance("chad", "chat"), 1);
  });

  it("counts a transposition as one mistake, not two", () => {
    assert.equal(editDistance("ab", "ba"), 1);
    assert.equal(editDistance("kiribati", "kirbiati"), 1);
  });

  it("falls back to length when one side is empty", () => {
    assert.equal(editDistance("", "peru"), 4);
    assert.equal(editDistance("peru", ""), 4);
  });
});

describe("similarity", () => {
  it("is 1 for a match and 0 for nothing in common", () => {
    assert.equal(similarity("peru", "peru"), 1);
    assert.equal(similarity("", ""), 1);
    assert.equal(similarity("abc", "xyz"), 0);
  });

  it("scales with the length of the longer string", () => {
    assert.equal(similarity("chad", "chat"), 0.75);
    assert.ok(similarity("switzerland", "switzerlend") > similarity("chad", "chat"));
  });
});
