// Builds src/data/countryFacts.ts with each flag's international calling code and population.
// Run with `pnpm run facts:generate` after `flags:generate`.
//
// Calling codes come from the `libphonenumber-js` metadata. Populations come from the World
// Bank's latest total-population figures, with Wikidata filling the territories the World Bank
// does not cover.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const LIBPHONENUMBER_VERSION = "1.13.15";
const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const FLAG_DIR = path.join(REPO_ROOT, "public", "flags");
const DATA_OUT_FILE = path.join(REPO_ROOT, "src", "data", "countryFacts.ts");
const WORLD_BANK_URL =
  "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&mrnev=1&per_page=400";
const WIKIDATA_URL = "https://query.wikidata.org/sparql";

// Territories missing from `libphonenumber-js` because they share another region's numbering.
const CALLING_CODE_OVERRIDES = {
  aq: "672",
  gs: "500",
  ic: "34",
  pn: "64",
  tf: "262",
};

// Only research or military staff live here, so any head count is not a resident population.
const NO_PERMANENT_POPULATION = new Set(["aq", "gs", "io", "tf"]);

// Entries without an ISO 3166-1 code on Wikidata, looked up by item instead.
const WIKIDATA_ITEMS = {
  ic: "Q5813",
};

function readCallingCodes(codes) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "signalman-phone-"));
  execFileSync("npm", ["pack", `libphonenumber-js@${LIBPHONENUMBER_VERSION}`], {
    cwd: workDir,
    stdio: "inherit",
  });
  execFileSync("tar", ["-xzf", `libphonenumber-js-${LIBPHONENUMBER_VERSION}.tgz`], {
    cwd: workDir,
  });
  const metadata = JSON.parse(
    fs.readFileSync(path.join(workDir, "package", "metadata.min.json"), "utf8"),
  );
  fs.rmSync(workDir, { recursive: true, force: true });

  const callingCodes = new Map();
  for (const code of codes) {
    const callingCode = CALLING_CODE_OVERRIDES[code] ?? metadata.countries[code.toUpperCase()]?.[0];
    if (callingCode) callingCodes.set(code, callingCode);
  }
  return callingCodes;
}

async function readWorldBankPopulations() {
  const response = await fetch(WORLD_BANK_URL);
  if (!response.ok) throw new Error(`World Bank request failed: ${response.status}`);
  const [, rows] = await response.json();
  return new Map(
    rows
      .filter((row) => row.value !== null)
      .map((row) => [row.country.id.toLowerCase(), row.value]),
  );
}

async function readWikidataPopulations(codes) {
  const isoCodes = codes.filter((code) => !WIKIDATA_ITEMS[code]);
  const items = codes.filter((code) => WIKIDATA_ITEMS[code]);
  const query = `
    SELECT ?iso ?population ?date WHERE {
      {
        VALUES ?iso { ${isoCodes.map((code) => `"${code.toUpperCase()}"`).join(" ")} }
        ?item wdt:P297 ?iso .
      } UNION {
        VALUES (?iso ?item) { ${items.map((code) => `("${code.toUpperCase()}" wd:${WIKIDATA_ITEMS[code]})`).join(" ")} }
      }
      ?item p:P1082 ?statement .
      ?statement ps:P1082 ?population .
      FILTER NOT EXISTS { ?statement wikibase:rank wikibase:DeprecatedRank }
      OPTIONAL { ?statement pq:P585 ?date }
    }`;
  const response = await fetch(`${WIKIDATA_URL}?query=${encodeURIComponent(query)}`, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "signalman-country-facts/0.1 (scripts/generate-country-facts.mjs)",
    },
  });
  if (!response.ok) throw new Error(`Wikidata request failed: ${response.status}`);
  const { results } = await response.json();

  const latest = new Map();
  for (const binding of results.bindings) {
    const code = binding.iso.value.toLowerCase();
    const date = binding.date?.value ?? "";
    const current = latest.get(code);
    if (!current || date > current.date) {
      latest.set(code, { date, population: Math.round(Number(binding.population.value)) });
    }
  }
  return new Map([...latest].map(([code, { population }]) => [code, population]));
}

const codes = fs
  .readdirSync(FLAG_DIR)
  .filter((file) => file.endsWith(".svg"))
  .map((file) => file.slice(0, -4))
  .toSorted();

const callingCodes = readCallingCodes(codes);
const worldBank = await readWorldBankPopulations();
const wikidataCodes = codes.filter(
  (code) => !worldBank.has(code) && !NO_PERMANENT_POPULATION.has(code),
);
const wikidata =
  wikidataCodes.length > 0 ? await readWikidataPopulations(wikidataCodes) : new Map();

function populationFor(code) {
  if (NO_PERMANENT_POPULATION.has(code)) return 0;
  return worldBank.get(code) ?? wikidata.get(code);
}

const entries = codes
  .map((code) => {
    const fields = [];
    const callingCode = callingCodes.get(code);
    if (callingCode) fields.push(`callingCode: ${JSON.stringify(callingCode)}`);
    const people = populationFor(code);
    if (people !== undefined) fields.push(`population: ${people}`);
    const body = fields.length > 0 ? `{ ${fields.join(", ")} }` : "{}";
    return `  [${JSON.stringify(code)}, ${body}],`;
  })
  .join("\n");

fs.writeFileSync(
  DATA_OUT_FILE,
  `// Generated by scripts/generate-country-facts.mjs. Do not edit by hand.

import type { CountryCode } from "./countries";

export interface CountryFacts {
  // Without the leading "+".
  callingCode?: string;
  // Zero means nobody lives there permanently.
  population?: number;
}

export const COUNTRY_FACTS: ReadonlyMap<CountryCode, CountryFacts> = new Map([
${entries}
]);
`,
);

const missing = (has) => codes.filter((code) => !has(code));
console.log(`Wrote ${codes.length} entries to src/data/countryFacts.ts`);
console.log(`No calling code: ${missing((code) => callingCodes.has(code)).join(" ") || "none"}`);
console.log(
  `No population: ${missing((code) => populationFor(code) !== undefined).join(" ") || "none"}`,
);
