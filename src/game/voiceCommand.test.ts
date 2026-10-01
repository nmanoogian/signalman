import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COUNTRIES } from "../data/countries";
import { commandPhrases, matchCommand, type VoiceCommand } from "./voiceCommand";
import { matchSpeech } from "./voiceMatch";

const ALL: readonly VoiceCommand[] = ["spin", "skip", "giveUp", "next", "repeat", "yes", "no"];
// What the player can say while a flag is on screen waiting for an answer.
const WHILE_ANSWERING: readonly VoiceCommand[] = ["skip", "giveUp", "repeat"];

function phrasesWithCommand(): [VoiceCommand, string][] {
  return ALL.flatMap((command) =>
    commandPhrases(command).map((phrase): [VoiceCommand, string] => [command, phrase]),
  );
}

describe("matchCommand", () => {
  it("routes every phrase it advertises to its own command", () => {
    const strays = phrasesWithCommand().filter(
      ([command, phrase]) => matchCommand(phrase, ALL) !== command,
    );
    assert.deepEqual(strays, []);
  });

  it("reads commands through the filler and casing a speaker adds", () => {
    assert.equal(matchCommand("um, skip", ALL), "skip");
    assert.equal(matchCommand("I give up", ALL), "giveUp");
    assert.equal(matchCommand("Next!", ALL), "next");
    assert.equal(matchCommand("Hit me", ALL), "spin");
    assert.equal(matchCommand("yeah", ALL), "yes");
    assert.equal(matchCommand("Nope.", ALL), "no");
  });

  it("returns nothing for speech that is not a command", () => {
    for (const said of ["germany", "banana split", "", "the"]) {
      assert.equal(matchCommand(said, ALL), null, said);
    }
  });

  it("ignores commands that are not live in the current stage", () => {
    assert.equal(matchCommand("skip", ["yes", "no"]), null);
    assert.equal(matchCommand("yes", []), null);
    assert.equal(matchCommand("skip", ["skip"]), "skip");
  });
});

describe("commands and countries stay out of each other's way", () => {
  // The load-bearing invariant: commands are matched first, so any country name a command
  // phrase captured would be unanswerable by voice.
  it("never reads a country name or alias as a command", () => {
    const captured: string[] = [];
    for (const country of COUNTRIES) {
      for (const term of [country.name, ...(country.aliases ?? [])]) {
        if (matchCommand(term, ALL) !== null) captured.push(term);
      }
    }
    assert.deepEqual(captured, []);
  });

  // The reverse direction is handled by the stage gate rather than by avoidance. A phrase the
  // country matcher would outright *accept* is only safe while its command is not live, so the
  // overlap is pinned here: anything new showing up in this list needs the same check.
  it("has a known, stage-gated overlap with country names", () => {
    const overlap = phrasesWithCommand()
      .map(([command, phrase]) => [command, phrase, matchSpeech(phrase)] as const)
      .filter(([, , match]) => match.kind === "accept")
      .map(([command, phrase, match]) =>
        match.kind === "accept" ? `${phrase} (${command}) -> ${match.country.name}` : "",
      );
    assert.deepEqual(overlap, ["spin (spin) -> Spain", "spin it (spin) -> Spain"]);
  });

  it("lets Spain through while the player is answering", () => {
    assert.equal(matchCommand("spin", WHILE_ANSWERING), null);
    const match = matchSpeech("spin");
    assert.equal(match.kind, "accept");
    assert.equal(match.kind === "accept" ? match.country.name : "", "Spain");
  });

  it("still spins on the wheel, where no answer is being given", () => {
    assert.equal(matchCommand("spin", ["spin", "next"]), "spin");
    assert.equal(matchCommand("hit me", ["spin", "next"]), "spin");
    assert.equal(matchCommand("next", ["spin", "next"]), "next");
  });
});

describe("commandPhrases", () => {
  it("lists the spoken forms of a command, for help text", () => {
    assert.ok(commandPhrases("skip").includes("skip"));
    assert.ok(commandPhrases("giveUp").includes("give up"));
    assert.ok(commandPhrases("spin").includes("hit me"));
  });

  it("never returns an empty list for a known command", () => {
    for (const command of ALL) {
      assert.ok(commandPhrases(command).length > 0, command);
    }
  });
});
