import { speechVariants } from "./voiceMatch";

export type VoiceCommand = "spin" | "skip" | "giveUp" | "next" | "repeat" | "yes" | "no";

// Matched as whole phrases rather than fuzzily, so a command can never steal a country name.
// "Next" would otherwise sit close enough to "Niger" to cause trouble.
const PHRASES: readonly (readonly [VoiceCommand, readonly string[]])[] = [
  // "spin" and "spin it" are also heard as "Spain", which is why `allowed` is not optional:
  // the wheel is the only place these mean anything, and answering is the only place Spain is.
  ["spin", ["spin", "spin it", "spin the wheel", "hit me", "deal me in"]],
  ["skip", ["skip", "skip it", "skip this", "pass", "another one"]],
  ["giveUp", ["give up", "giving up", "i give up", "reveal", "show me", "tell me"]],
  // "I don't know", "no idea" and "no clue" are deliberately absent. They are what a player
  // says while still thinking, or to a friend in the room — not a request to be told.
  // "go on" is deliberately absent: it is a plausible mistranscription of "Ghana", and
  // commands are matched first, so it would swallow a real answer.
  ["next", ["next", "next one", "continue", "carry on", "keep going", "move on"]],
  ["repeat", ["repeat", "again", "say again", "come again", "what was that"]],
  // "sure" is likewise absent: it sounds like "Syria".
  ["yes", ["yes", "yeah", "yep", "yup", "correct", "right", "that's it", "that's right"]],
  ["no", ["no", "nope", "nah", "wrong", "that's wrong", "not that"]],
];

const COMMANDS: ReadonlyMap<string, VoiceCommand> = new Map(
  PHRASES.flatMap(([command, phrases]) =>
    phrases.flatMap((phrase) =>
      speechVariants(phrase).map((variant): [string, VoiceCommand] => [variant, command]),
    ),
  ),
);

// Check this before matching a country: in a stage where a command is live, it is never an
// answer. `allowed` is required rather than defaulted because some phrases double as country
// names, and the stage is the only thing keeping them apart.
export function matchCommand(
  transcript: string,
  allowed: readonly VoiceCommand[],
): VoiceCommand | null {
  for (const variant of speechVariants(transcript)) {
    const command = COMMANDS.get(variant);
    if (command !== undefined && allowed.includes(command)) return command;
  }
  return null;
}

// Every phrase the matcher knows, for building help text without restating the list.
export function commandPhrases(command: VoiceCommand): readonly string[] {
  return PHRASES.find(([name]) => name === command)?.[1] ?? [];
}
