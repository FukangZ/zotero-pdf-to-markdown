import { config } from "../../package.json";
import {
  getParserDefinitionByProvider,
  getPreferenceKeys,
} from "./prefsSchema";

const preferenceKeys = getPreferenceKeys();

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
  bindParserDocLinks(_window);
  _window.setTimeout(() => updatePreferenceVisibility(document), 0);
}

function bindVisibilityEvents(document: Document): void {
  const parserProviderSelect = getElement<HTMLSelectElement>(
    document,
    "pdfParserProvider",
  );

  parserProviderSelect?.addEventListener("change", () => {
    updatePreferenceVisibility(document);
  });
}

function updatePreferenceVisibility(document: Document): void {
  const parserProvider =
    getElement<HTMLSelectElement>(document, "pdfParserProvider")?.value ??
    "zhiyi";

  for (const section of document.querySelectorAll<HTMLElement>(
    "[data-parser-section]",
  )) {
    section.hidden = section.dataset.parserSection !== parserProvider;
  }
}

function bindParserDocLinks(_window: Window): void {
  const document = _window.document;

  for (const link of document.querySelectorAll<HTMLAnchorElement>(
    "[data-parser-doc-link]",
  )) {
    const definition = getParserDefinitionByProvider(
      link.dataset.parserDocLink,
    );

    if (!definition?.docsUrl) {
      link.hidden = true;
      continue;
    }

    link.href = definition.docsUrl;
    link.addEventListener("click", (event: MouseEvent) => {
      event.preventDefault();
      openExternalUrl(definition.docsUrl!, _window);
    });
  }
}

function openExternalUrl(url: string, _window: Window): void {
  const zotero = (globalThis as { Zotero?: ZoteroUrlLauncher }).Zotero;

  if (typeof zotero?.launchURL === "function") {
    zotero.launchURL(url);
    return;
  }

  _window.open(url, "_blank", "noopener");
}

function getElement<T extends Element>(
  document: Document,
  preferenceKey: string,
): T | null {
  return document.querySelector(
    `#zotero-prefpane-${config.addonRef}-${preferenceKey}`,
  );
}

interface ZoteroUrlLauncher {
  launchURL?: (url: string) => void;
}
