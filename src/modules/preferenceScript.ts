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
}
