import type { PluginPrefs } from "./types";

function getPref<T extends boolean | number | string>(key: string): T {
  return Zotero.Prefs.get(
    `${addon.data.config.prefsPrefix}.${key}`,
    true,
  ) as T;
}

export function readPluginPrefs(): PluginPrefs {
  return {
    zhiyiApiUrl: getPref<string>("zhiyiApiUrl"),
    zhiyiApiKey: getPref<string>("zhiyiApiKey"),
    zhiyiTableMode: getPref<string>("zhiyiTableMode") as "markdown" | "image",
    zhiyiFormulaFormat: getPref<string>("zhiyiFormulaFormat") as
      | "dollar"
      | "bracket",
    zhiyiEnableCrossPageMerge: getPref<boolean>("zhiyiEnableCrossPageMerge"),
    enablePicgoUpload: getPref<boolean>("enablePicgoUpload"),
    picgoUploadUrl: getPref<string>("picgoUploadUrl"),
    picgoSecret: getPref<string>("picgoSecret"),
    picgoUploadIntervalMs: getPref<number>("picgoUploadIntervalMs"),
    skipUrlPrefixes: getPref<string>("skipUrlPrefixes"),
    markdownFilenameTemplate: getPref<string>("markdownFilenameTemplate"),
    existingMarkdownStrategy: "skip",
  };
}
