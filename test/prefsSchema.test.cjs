/* global process */

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

require("ts-node/register/transpile-only");

const {
  parserDefinitions,
} = require("../src/modules/pdfParsers/definitions.ts");
const {
  getPreferenceKeys,
  PREFERENCE_DEFAULTS,
} = require("../src/modules/prefsSchema.ts");

describe("prefsSchema", function () {
  it("derives parser preference keys from parser definitions", function () {
    const preferenceKeys = getPreferenceKeys();
    const parserPreferenceKeys = Object.values(parserDefinitions).flatMap(
      (definition) => definition.fields.map((field) => field.prefKey),
    );

    for (const key of parserPreferenceKeys) {
      assert.ok(preferenceKeys.includes(key), `missing preference key: ${key}`);
    }
  });

  it("keeps addon preference defaults in sync with the schema", function () {
    const prefsJsPath = path.join(process.cwd(), "addon", "prefs.js");
    const prefDefaults = parseAddonPrefs(readFileSync(prefsJsPath, "utf8"));

    assert.deepEqual(prefDefaults, PREFERENCE_DEFAULTS);
  });

  it("keeps preference pane controls in sync with the schema", function () {
    const preferencePanePath = path.join(
      process.cwd(),
      "addon",
      "content",
      "preferences.xhtml",
    );
    const markup = readFileSync(preferencePanePath, "utf8");

    for (const key of getPreferenceKeys()) {
      assert.ok(
        markup.includes(`preference="${key}"`),
        `missing preference pane control: ${key}`,
      );
    }
  });
});

function parseAddonPrefs(content) {
  const prefs = {};
  const pattern =
    /pref\(\s*"extensions\.zotero\.zoteropdftomarkdown\.([^"]+)"\s*,\s*("[^"]*"|\d+)\s*,?\s*\)/gms;

  for (const match of content.matchAll(pattern)) {
    const [, key, rawValue] = match;
    prefs[key] = rawValue.startsWith('"')
      ? JSON.parse(rawValue)
      : Number(rawValue);
  }

  return prefs;
}
