import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COUNTRIES } from "../data/countries";
import { commandPhrases, matchCommand, type VoiceCommand } from "./voiceCommand";
import { matchSpeech } from "./voiceMatch";

const ALL: readonly VoiceCommand[] = ["skip", "giveUp", "next", "repeat", "yes", "no"];

function phrasesWithCommand(): [VoiceCommand, string][] {
  return ALL.flatMap((command) =>
    commandPhrases(command).map((phrase): [VoiceCommand, string] => [command, phrase]),
  );
}

describe("matchCommand", () => {
  it("routes every phrase it advertises to its own command", () => {
    const strays = phrasesWithCommand().filter(
      ([command, phrase]) => matchCommand(phrase) !== command,
    );
    assert.deepEqual(strays, []);
  });

  it("reads commands through the filler and casing a speaker adds", () => {
    assert.equal(matchCommand("um, skip"), "skip");
    assert.equal(matchCommand("I give up"), "giveUp");
    assert.equal(matchCommand("Next!"), "next");
    assert.equal(matchCommand("yeah"), "yes");
    assert.equal(matchCommand("Nope."), "no");
  });

  it("returns nothing for speech that is not a command", () => {
    for (const said of ["germany", "banana split", "", "the"]) {
      assert.equal(matchCommand(said), null, said);
    }
  });
});

describe("commands and countries stay out of each other's way", () => {
  // The load-bearing invariant: commands are matched first, so any country name a command
  // phrase captured would be unanswerable by voice.
  it("never reads a country name or alias as a command", () => {
    const captured: string[] = [];
    for (const country of COUNTRIES) {
      for (const term of [country.name, ...(country.aliases ?? [])]) {
        if (matchCommand(term) !== null) captured.push(term);
      }
    }
    assert.deepEqual(captured, []);
  });

  // The reverse direction is softer, since commands win the tie. A command phrase that the
  // country matcher merely wants to *confirm* is harmless; one it would outright accept means
  // the phrase is a plausible mishearing of a real answer and should be dropped instead.
  it("has no command phrase that the country matcher would accept", () => {
    const accepted = phrasesWithCommand()
      .filter(([, phrase]) => matchSpeech(phrase).kind === "accept")
      .map(([command, phrase]) => `${phrase} (${command})`);
    assert.deepEqual(accepted, []);
  });
});

describe("commandPhrases", () => {
  it("lists the spoken forms of a command, for help text", () => {
    assert.ok(commandPhrases("skip").includes("skip"));
    assert.ok(commandPhrases("giveUp").includes("give up"));
  });

  it("never returns an empty list for a known command", () => {
    for (const command of ALL) {
      assert.ok(commandPhrases(command).length > 0, command);
    }
  });
});
