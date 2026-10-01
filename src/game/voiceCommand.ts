import { speechVariants } from "./voiceMatch";

export type VoiceCommand = "skip" | "giveUp" | "next" | "repeat" | "yes" | "no";

// Matched as whole phrases rather than fuzzily, so a command can never steal a country name.
// "Next" would otherwise sit close enough to "Niger" to cause trouble.
const PHRASES: readonly (readonly [VoiceCommand, readonly string[]])[] = [
  ["skip", ["skip", "skip it", "skip this", "pass", "another one"]],
  [
    "giveUp",
    [
      "give up",
      "giving up",
      "i give up",
      "reveal",
      "show me",
      "tell me",
      "i don't know",
      "no idea",
      "no clue",
    ],
  ],
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

// Check this before matching a country: an utterance that is a command is never an answer.
export function matchCommand(transcript: string): VoiceCommand | null {
  for (const variant of speechVariants(transcript)) {
    const command = COMMANDS.get(variant);
    if (command !== undefined) return command;
  }
  return null;
}

// Every phrase the matcher knows, for building help text without restating the list.
export function commandPhrases(command: VoiceCommand): readonly string[] {
  return PHRASES.find(([name]) => name === command)?.[1] ?? [];
}
