import { parserDefinitions } from "./pdfParsers/definitions";
import type { PdfParserProvider } from "./pdfParsers/types";

export type RuntimePreferenceDefault = boolean | number | string;
export type StoredPreferenceDefault = number | string;

export interface PreferenceDefinition<
  T extends RuntimePreferenceDefault = RuntimePreferenceDefault,
> {
  key: string;
  prefKey: string;
  defaultValue: T;
}

export const PDF_PARSER_PROVIDER_PREFERENCE = {
  key: "provider",
  prefKey: "pdfParserProvider",
  defaultValue: "zhiyi",
} as const satisfies PreferenceDefinition<PdfParserProvider>;

export const IMAGE_PREFERENCE_DEFINITIONS = [
  {
    key: "enablePicgoUpload",
    prefKey: "enablePicgoUpload",
    defaultValue: true,
  },
  {
    key: "picgoUploadUrl",
    prefKey: "picgoUploadUrl",
    defaultValue: "http://127.0.0.1:36677/upload",
  },
  {
    key: "picgoSecret",
    prefKey: "picgoSecret",
    defaultValue: "",
  },
  {
    key: "skipUrlPrefixes",
    prefKey: "skipUrlPrefixes",
    defaultValue: "",
  },
] as const satisfies readonly PreferenceDefinition[];

export const OUTPUT_PREFERENCE_DEFINITIONS = [
  {
    key: "markdownFilenameTemplate",
    prefKey: "markdownFilenameTemplate",
    defaultValue: "{firstAuthor}-{year}-{title}.md",
  },
] as const satisfies readonly PreferenceDefinition[];

const PARSER_PROVIDERS = Object.keys(parserDefinitions) as PdfParserProvider[];

export const PREFERENCE_DEFAULTS = createPreferenceDefaults();

export function getPreferenceKeys(): string[] {
  return Object.keys(PREFERENCE_DEFAULTS);
}

export function getParserProviders(): PdfParserProvider[] {
  return [...PARSER_PROVIDERS];
}

export function getParserDefinitionByProvider(provider: string | undefined) {
  if (!isPdfParserProvider(provider)) {
    return undefined;
  }

  return parserDefinitions[provider];
}

function createPreferenceDefaults(): Record<string, StoredPreferenceDefault> {
  const defaults: Record<string, StoredPreferenceDefault> = {
    [PDF_PARSER_PROVIDER_PREFERENCE.prefKey]: serializePreferenceDefault(
      PDF_PARSER_PROVIDER_PREFERENCE.defaultValue,
    ),
  };

  for (const provider of PARSER_PROVIDERS) {
    const definition = parserDefinitions[provider];

    for (const field of definition.fields) {
      defaults[field.prefKey] = serializePreferenceDefault(
        getParserDefaultValue(definition.defaults, field.key),
      );
    }
  }

  for (const definition of [
    ...IMAGE_PREFERENCE_DEFINITIONS,
    ...OUTPUT_PREFERENCE_DEFINITIONS,
  ]) {
    defaults[definition.prefKey] = serializePreferenceDefault(
      definition.defaultValue,
    );
  }

  return defaults;
}

function isPdfParserProvider(
  provider: string | undefined,
): provider is PdfParserProvider {
  return (
    typeof provider === "string" &&
    Object.prototype.hasOwnProperty.call(parserDefinitions, provider)
  );
}

function getParserDefaultValue(
  defaults: object,
  key: string | number | symbol,
): RuntimePreferenceDefault {
  const value = (defaults as Record<string, unknown>)[String(key)];

  if (isRuntimePreferenceDefault(value)) {
    return value;
  }

  throw new Error(`Unsupported parser preference default: ${String(key)}`);
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

function serializePreferenceDefault(
  value: RuntimePreferenceDefault,
): StoredPreferenceDefault {
  return typeof value === "boolean" ? String(value) : value;
}
