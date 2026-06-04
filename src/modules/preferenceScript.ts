import { config } from "../../package.json";

const preferenceKeys = [
  "pdfParserProvider",
  "zhiyiApiUrl",
  "zhiyiApiKey",
  "zhiyiTableMode",
  "zhiyiFormulaFormat",
  "zhiyiEnableCrossPageMerge",
  "mineruApiUrl",
  "mineruApiToken",
  "mineruModelVersion",
  "mineruLanguage",
  "mineruEnableTable",
  "mineruIsOcr",
  "mineruEnableFormula",
  "mineruPageRanges",
  "enablePicgoUpload",
  "picgoUploadUrl",
  "picgoSecret",
  "picgoUploadIntervalMs",
  "skipUrlPrefixes",
  "markdownFilenameTemplate",
] as const;

export async function registerPrefsScripts(_window: Window) {
  addon.data.prefs = {
    window: _window,
    columns: [],
    rows: [],
  };

  bindPrefEvents(_window);
}

export function registerPreferencePane(): void {
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: rootURI + "content/preferences.xhtml",
    label: addon.data.config.addonName,
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
  });
}

function bindPrefEvents(_window: Window): void {
  const document = _window.document;

  for (const preferenceKey of preferenceKeys) {
    const element = document.querySelector(
      `#zotero-prefpane-${config.addonRef}-${preferenceKey}`,
    );

    element?.addEventListener("change", () => {
      ztoolkit.log(`Preference changed: ${preferenceKey}`);
    });
  }

  bindVisibilityEvents(document);
  _window.setTimeout(() => updatePreferenceVisibility(document), 0);
}

function bindVisibilityEvents(document: Document): void {
  const parserProviderSelect = getElement<HTMLSelectElement>(
    document,
    "pdfParserProvider",
  );
  const enablePicgoUploadCheckbox = getElement<HTMLInputElement>(
    document,
    "enablePicgoUpload",
  );

  parserProviderSelect?.addEventListener("change", () => {
    updatePreferenceVisibility(document);
  });
  enablePicgoUploadCheckbox?.addEventListener("change", () => {
    updatePreferenceVisibility(document);
  });
}

function updatePreferenceVisibility(document: Document): void {
  const parserProvider =
    getElement<HTMLSelectElement>(document, "pdfParserProvider")?.value ??
    "zhiyi";
  const enablePicgoUpload =
    getElement<HTMLInputElement>(document, "enablePicgoUpload")?.checked ??
    true;

  for (const section of document.querySelectorAll<HTMLElement>(
    "[data-parser-section]",
  )) {
    section.hidden = section.dataset.parserSection !== parserProvider;
  }

  for (const section of document.querySelectorAll<HTMLElement>(
    "[data-picgo-section]",
  )) {
    section.hidden = !enablePicgoUpload;
  }
}

function getElement<T extends Element>(
  document: Document,
  preferenceKey: (typeof preferenceKeys)[number],
): T | null {
  return document.querySelector(
    `#zotero-prefpane-${config.addonRef}-${preferenceKey}`,
  );
}
