import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COUNTRIES } from "../data/countries";
import { metaphone } from "./phonetics";
import { matchSpeech, speechVariants } from "./voiceMatch";

function accepted(transcript: string): string {
  const match = matchSpeech(transcript);
  assert.equal(match.kind, "accept", `${transcript} -> ${match.kind}`);
  return match.kind === "accept" ? match.country.name : "";
}

describe("matchSpeech round trips", () => {
  it("accepts every country's own name", () => {
    const failures = COUNTRIES.filter((country) => {
      const match = matchSpeech(country.name);
      return match.kind !== "accept" || match.country.code !== country.code;
    }).map((country) => country.name);
    assert.deepEqual(failures, []);
  });

  it("accepts every alias", () => {
    const failures: string[] = [];
    for (const country of COUNTRIES) {
      for (const alias of country.aliases ?? []) {
        const match = matchSpeech(alias);
        if (match.kind !== "accept" || match.country.code !== country.code) {
          failures.push(`${alias} (${country.name})`);
        }
      }
    }
    assert.deepEqual(failures, []);
  });
});

describe("matchSpeech wrapping words", () => {
  it("ignores filler either side of the answer", () => {
    for (const said of [
      "um germany",
      "it's germany",
      "uh, I think it's Germany",
      "the answer is Germany",
      "Germany please",
      "so... Germany, right",
    ]) {
      assert.equal(accepted(said), "Germany", said);
    }
  });

  it("keeps filler that is really part of the answer", () => {
    // "I" is filler everywhere except when the engine splits "Iraq" into "I rock".
    assert.equal(accepted("i rock"), "Iraq");
    assert.equal(accepted("oh man"), "Oman");
  });

  it("leaves interior words alone", () => {
    assert.equal(accepted("Isle of Man"), "Isle of Man");
    assert.equal(accepted("Trinidad and Tobago"), "Trinidad and Tobago");
  });

  it("expands the abbreviation a speech engine writes for Saint", () => {
    assert.equal(accepted("st lucia"), "Saint Lucia");
    assert.equal(accepted("St. Kitts and Nevis"), "Saint Kitts and Nevis");
  });
});

describe("matchSpeech mishearings", () => {
  it("accepts transcripts that sound like the answer", () => {
    const table: readonly [string, string][] = [
      ["jermany", "Germany"],
      ["hungry", "Hungary"],
      ["chilly", "Chile"],
      ["grease", "Greece"],
      ["to go", "Togo"],
      ["katar", "Qatar"],
      ["columbia", "Colombia"],
      ["phillipines", "Philippines"],
      ["maldeeves", "Maldives"],
      ["new zeeland", "New Zealand"],
      ["costa rika", "Costa Rica"],
      ["south corea", "South Korea"],
      ["viet nam", "Vietnam"],
    ];
    for (const [said, expected] of table) {
      assert.equal(accepted(said), expected, said);
    }
  });

  it("asks rather than guesses when the transcript is only close", () => {
    for (const said of ["sejelles", "jibooty"]) {
      assert.equal(matchSpeech(said).kind, "confirm", said);
    }
  });

  it("returns nothing for speech that is not a country", () => {
    for (const said of ["banana split", "qwerty", "asdfgh", "the", "um uh", ""]) {
      assert.equal(matchSpeech(said).kind, "none", said);
    }
  });
});

describe("matchSpeech ambiguity", () => {
  it("takes an exact name at its word even when a longer name extends it", () => {
    assert.equal(accepted("Niger"), "Niger");
    assert.equal(accepted("Nigeria"), "Nigeria");
    assert.equal(accepted("Guinea"), "Guinea");
    assert.equal(accepted("Guinea-Bissau"), "Guinea-Bissau");
    assert.equal(accepted("Dominica"), "Dominica");
    assert.equal(accepted("Dominican Republic"), "Dominican Republic");
  });

  it("names the longer country when it hears a truncation", () => {
    const match = matchSpeech("dominican");
    assert.equal(match.kind, "confirm");
    if (match.kind !== "confirm") return;
    assert.equal(match.country.name, "Dominica");
    assert.equal(match.runnerUp?.name, "Dominican Republic");
  });

  it("asks when two countries sound equally plausible", () => {
    const match = matchSpeech("angolla");
    assert.equal(match.kind, "confirm");
    if (match.kind !== "confirm") return;
    assert.deepEqual([match.country.name, match.runnerUp?.name].toSorted(), ["Angola", "Anguilla"]);
  });

  // These pairs are indistinguishable to the phonetic key, so a fuzzy hit on one always has to
  // be confirmed. Spelling either out exactly still wins outright. If the country list changes,
  // this list should be re-checked rather than quietly updated.
  it("has a known set of countries that reduce to the same phonetic key", () => {
    const keys = new Map<string, string[]>();
    for (const country of COUNTRIES) {
      const tight = speechVariants(country.name)[0]?.replaceAll(" ", "") ?? "";
      const key = metaphone(tight);
      keys.set(key, [...(keys.get(key) ?? []), country.name]);
    }
    const collisions = [...keys.values()]
      .filter((names) => names.length > 1)
      .map((names) => names.toSorted().join(" / "))
      .toSorted();
    assert.deepEqual(collisions, [
      "Angola / Anguilla",
      "Bahrain / Brunei",
      "Ghana / Guinea",
      "Niger / Nigeria",
    ]);
  });
});

describe("speechVariants", () => {
  it("offers the trimmed and untrimmed readings, most useful first", () => {
    assert.deepEqual(speechVariants("um germany"), ["germany", "um germany"]);
  });

  it("collapses to one reading when there is no filler to trim", () => {
    assert.deepEqual(speechVariants("germany"), ["germany"]);
  });

  it("is empty for speech with no words", () => {
    assert.deepEqual(speechVariants("  ?! "), []);
  });
});
