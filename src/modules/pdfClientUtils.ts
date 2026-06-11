export interface ZoteroFileConstructor {
  createFromFileName(fileName: string): Promise<Blob>;
}

export function buildServiceUrl(apiUrl: string, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return `${apiUrl.replace(/\/+$/, "")}/${pathOrUrl.replace(/^\/+/, "")}`;
}

export async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => undefined);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getRequiredGlobal<T>(name: string): T {
  const value = getGlobalValue<T>(name);

  if (!value) {
    throw new Error(`${name} is not available in Zotero runtime`);
  }

  return value;
}

export function getGlobalValue<T>(name: string): T | undefined {
  const globalValue = (globalThis as Record<string, unknown>)[name];

  if (globalValue) {
    return globalValue as T;
  }

  const globalRecord = globalThis as Record<string, unknown>;
  const addonValue = globalRecord.addon as
    | { data?: { ztoolkit?: { getGlobal?: (name: string) => unknown } } }
    | undefined;
  const ztoolkitValue = globalRecord.ztoolkit as
    | { getGlobal?: (name: string) => unknown }
    | undefined;
  const toolkit = addonValue?.data?.ztoolkit ?? ztoolkitValue;
  const windowValue =
    typeof toolkit?.getGlobal === "function" ? toolkit.getGlobal(name) : null;

  return windowValue ? (windowValue as T) : undefined;
}
