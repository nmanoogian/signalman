// String algorithms behind voice matching, kept separate from the matcher itself so they can
// be exercised on their own.

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

// Clusters whose first letter is silent in English, so "gnome" and "nome" sound alike.
const SILENT_HEADS = new Set(["AE", "GN", "KN", "PN", "WR"]);

// After these, an H is swallowed by the preceding consonant (the CH/SH/PH/TH/GH digraphs).
const H_SILENCERS = new Set(["C", "S", "P", "T", "G"]);

function isVowel(letter: string): boolean {
  return VOWELS.has(letter);
}

// Metaphone (Lawrence Philips, 1990). Collapses a word to the consonant sounds that survive a
// speech engine's guess at spelling, so "Jermany" and "Germany" reduce to the same key.
export function metaphone(value: string): string {
  const word = value.toUpperCase().replaceAll(/[^A-Z]/g, "");
  if (word === "") return "";
  const at = (index: number): string => word[index] ?? "";

  let out = "";
  let start = 0;
  const head = word.slice(0, 2);
  if (SILENT_HEADS.has(head)) {
    start = 1;
  } else if (at(0) === "X") {
    out = "S";
    start = 1;
  } else if (head === "WH") {
    out = "W";
    start = 2;
  }

  for (let i = start; i < word.length; i++) {
    const letter = at(i);
    const prev = at(i - 1);
    const next = at(i + 1);
    const after = at(i + 2);

    // Doubled letters are one sound, except CC which can straddle two (as in "accident").
    if (letter === prev && letter !== "C") continue;
    if (isVowel(letter)) {
      if (i === start) out += letter;
      continue;
    }

    switch (letter) {
      case "B":
        if (!(prev === "M" && i === word.length - 1)) out += "B";
        break;
      case "C":
        if (next === "I" && after === "A") out += "X";
        else if (next === "H") out += prev === "S" ? "K" : "X";
        else if (next === "I" || next === "E" || next === "Y") {
          if (prev !== "S") out += "S";
        } else out += "K";
        break;
      case "D":
        if (next === "G" && (after === "E" || after === "Y" || after === "I")) {
          out += "J";
          i += 1; // the G belongs to the same sound
        } else out += "T";
        break;
      case "G":
        if (next === "H") {
          if (isVowel(after)) out += "K";
        } else if (next === "N") {
          if (!(i + 1 === word.length - 1 || word.slice(i + 1) === "NED")) out += "K";
        } else if (next === "I" || next === "E" || next === "Y") out += "J";
        else out += "K";
        break;
      case "H":
        if (isVowel(next) && !H_SILENCERS.has(prev)) out += "H";
        break;
      case "K":
        if (prev !== "C") out += "K";
        break;
      case "P":
        out += next === "H" ? "F" : "P";
        break;
      case "Q":
        out += "K";
        break;
      case "S":
        if (next === "H" || (next === "I" && (after === "O" || after === "A"))) out += "X";
        else out += "S";
        break;
      case "T":
        if (next === "I" && (after === "O" || after === "A")) out += "X";
        else if (next === "H") out += "0";
        else if (!(next === "C" && after === "H")) out += "T";
        break;
      case "V":
        out += "F";
        break;
      case "W":
      case "Y":
        if (isVowel(next)) out += letter;
        break;
      case "X":
        out += "KS";
        break;
      case "Z":
        out += "S";
        break;
      default:
        out += letter; // F J L M N R stand for themselves
        break;
    }
  }
  return out;
}

// Damerau-Levenshtein (optimal string alignment): counts a swapped pair of letters as one
// mistake rather than two, which is the shape most mishearings take.
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let twoBack: number[] = [];
  let oneBack: number[] = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i++) {
    const current: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        (current[j - 1] ?? 0) + 1,
        (oneBack[j] ?? 0) + 1,
        (oneBack[j - 1] ?? 0) + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, (twoBack[j - 2] ?? 0) + 1);
      }
      current[j] = value;
    }
    twoBack = oneBack;
    oneBack = current;
  }
  return oneBack[b.length] ?? 0;
}

// 1 for identical strings, 0 for nothing in common.
export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - editDistance(a, b) / longest;
}
