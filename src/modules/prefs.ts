import type { PluginPrefs } from "./types";
import {
  getParserDefinitionByProvider,
  IMAGE_PREFERENCE_DEFINITIONS,
  OUTPUT_PREFERENCE_DEFINITIONS,
  PDF_PARSER_PROVIDER_PREFERENCE,
  type PreferenceDefinition,
  type RuntimePreferenceDefault,
} from "./prefsSchema";
import type { PdfParserConfigMap, PdfParserProvider } from "./pdfParsers/types";

function getRawPref(key: string): unknown {
  return Zotero.Prefs.get(`${addon.data.config.prefsPrefix}.${key}`, true);
}

function readPreference<T extends RuntimePreferenceDefault>(
  key: string,
  fallback: T,
): T {
  const value = getRawPref(key);

  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof fallback === "boolean") {
    return normalizeBooleanPref(value, fallback) as T;
  }

  if (typeof fallback === "number") {
    return normalizeNumberPref(value, fallback) as T;
  }

  return String(value) as T;
}

export function readPluginPrefs(): PluginPrefs {
  return {
    pdfParser: {
      provider: readPdfParserProvider(),
      configs: readParserConfigs(),
    },
    images: readPreferenceGroup(IMAGE_PREFERENCE_DEFINITIONS),
    output: readPreferenceGroup(OUTPUT_PREFERENCE_DEFINITIONS),
  };
}

function readPdfParserProvider(): PdfParserProvider {
  const provider = readPreference(
    PDF_PARSER_PROVIDER_PREFERENCE.prefKey,
    PDF_PARSER_PROVIDER_PREFERENCE.defaultValue,
  );

  return getParserDefinitionByProvider(provider)?.id ?? "zhiyi";
}

function readParserConfigs(): PdfParserConfigMap {
  return {
    zhiyi: readParserConfig("zhiyi"),
    mineru: readParserConfig("mineru"),
    glmocr: readParserConfig("glmocr"),
  };
}

function readParserConfig<Provider extends PdfParserProvider>(
  provider: Provider,
): PdfParserConfigMap[Provider] {
  const definition = getParserDefinitionByProvider(provider)!;
  const config = { ...definition.defaults } as Record<string, unknown>;

  for (const field of definition.fields) {
    const key = String(field.key);
    const fallback = config[key];

    if (!isRuntimePreferenceDefault(fallback)) {
      throw new Error(`Unsupported parser preference default: ${key}`);
    }

    config[key] = readPreference(field.prefKey, fallback);
  }

  return config as unknown as PdfParserConfigMap[Provider];
}

function readPreferenceGroup<
  Definitions extends readonly PreferenceDefinition[],
>(
  definitions: Definitions,
): {
  [Definition in Definitions[number] as Definition["key"]]: Definition["defaultValue"];
} {
  const values: Record<string, RuntimePreferenceDefault> = {};

  for (const definition of definitions) {
    values[definition.key] = readPreference(
      definition.prefKey,
      definition.defaultValue,
    );
  }

  return values as {
    [Definition in Definitions[number] as Definition["key"]]: Definition["defaultValue"];
  };
}

function normalizeBooleanPref(value: unknown, fallback: boolean): boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return typeof value === "boolean" ? value : fallback;
}

function normalizeNumberPref(value: unknown, fallback: number): number {
  if (typeof value === "number") {
    return value;
  }

  const parsed = typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isRuntimePreferenceDefault(
  value: unknown,
): value is RuntimePreferenceDefault {
  return (
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  );
}
