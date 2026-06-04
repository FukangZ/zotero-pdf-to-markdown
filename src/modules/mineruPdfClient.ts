import { unzipSync } from "fflate";
import type { ConversionContext } from "./types";

const TASK_STATE_VALUES = new Set([
  "waiting-file",
  "pending",
  "running",
  "converting",
  "done",
  "failed",
]);

export type MineruTaskState =
  | "waiting-file"
  | "pending"
  | "running"
  | "converting"
  | "done"
  | "failed";

export interface MineruPdfClientOptions {
  apiUrl: string;
  apiToken: string;
  modelVersion: "pipeline" | "vlm" | "MinerU-HTML";
  language: string;
  enableTable: boolean;
  isOcr: boolean;
  enableFormula: boolean;
  pageRanges: string;
  pollIntervalMs: number;
  timeoutMs: number;
}

export interface MineruBatchUploadCreation {
  batchID: string;
  fileUrls: string[];
}

export interface MineruExtractResult {
  fileName?: string;
  dataID?: string;
  state: MineruTaskState;
  fullZipUrl?: string;
  errorMessage?: string;
}

function parseMineruBatchUploadResponse(
  body: unknown,
): MineruBatchUploadCreation {
  const response = (body ?? {}) as {
    code?: unknown;
    data?: { batch_id?: unknown; file_urls?: unknown };
    msg?: unknown;
    trace_id?: unknown;
  };

  if (
    response.code !== 0 ||
    typeof response.data?.batch_id !== "string" ||
    !Array.isArray(response.data?.file_urls) ||
    !response.data.file_urls.every((url) => typeof url === "string")
  ) {
    throw new Error(
      `MinerU upload URL creation failed${formatMineruError(response)}`,
    );
  }

  return {
    batchID: response.data.batch_id,
    fileUrls: response.data.file_urls,
  };
}

function parseMineruBatchStatusResponse(body: unknown): MineruExtractResult[] {
  const response = (body ?? {}) as {
    code?: unknown;
    data?: { extract_result?: unknown };
    msg?: unknown;
    trace_id?: unknown;
  };

  if (response.code !== 0) {
    throw new Error(`MinerU batch status failed${formatMineruError(response)}`);
  }

  if (!Array.isArray(response.data?.extract_result)) {
    throw new Error(
      `MinerU batch status missing extract_result. Response: ${summarizeMineruResponse(
        body,
      )}`,
    );
  }

  return response.data.extract_result.map(parseMineruExtractResult);
}

function extractMarkdownFromMineruZip(zipBytes: Uint8Array): string {
  const files = unzipSync(zipBytes);
  const markdownEntry = findMineruMarkdownEntry(files);

  if (!markdownEntry) {
    throw new Error("MinerU result ZIP does not contain full.md");
  }

  return new TextDecoder("utf-8").decode(markdownEntry);
}

export class MineruPdfClient {
  constructor(private readonly options: MineruPdfClientOptions) {}

  async convert(pdfPath: string, context: ConversionContext): Promise<string> {
    if (!this.options.apiToken.trim()) {
      throw new Error("MinerU API token is required");
    }

    const upload = await this.createUploadUrls(pdfPath, context);

    if (upload.fileUrls.length !== 1) {
      throw new Error(
        `MinerU expected 1 upload URL, got ${upload.fileUrls.length}`,
      );
    }

    await this.uploadFile(upload.fileUrls[0], pdfPath);

    const result = await this.waitForCompletion(upload.batchID, context);

    if (!result.fullZipUrl) {
      throw new Error(`MinerU task completed without full_zip_url`);
    }

    const zipBytes = await this.downloadResultZip(result.fullZipUrl);
    return extractMarkdownFromMineruZip(zipBytes);
  }

  private async createUploadUrls(
    pdfPath: string,
    context: ConversionContext,
  ): Promise<MineruBatchUploadCreation> {
    const response = await fetch(this.buildUrl("/api/v4/file-urls/batch"), {
      method: "POST",
      headers: this.jsonAuthHeaders(),
      body: JSON.stringify(this.createUploadPayload(pdfPath, context)),
    });
    const body = await readJson(response);

    if (!response.ok) {
      throw new Error(
        `MinerU upload URL creation HTTP ${response.status}${formatMineruError(
          (body ?? {}) as Record<string, unknown>,
        )}`,
      );
    }

    return parseMineruBatchUploadResponse(body);
  }

  private createUploadPayload(
    pdfPath: string,
    context: ConversionContext,
  ): Record<string, unknown> {
    const file: Record<string, unknown> = {
      name: PathUtils.filename(pdfPath),
      data_id: `${context.itemKey}-${context.pdfAttachmentKey}`,
      is_ocr: this.options.isOcr,
    };
    const pageRanges = this.options.pageRanges.trim();

    if (pageRanges) {
      file.page_ranges = pageRanges;
    }

    return {
      files: [file],
      model_version: this.options.modelVersion,
      language: this.options.language,
      enable_table: this.options.enableTable,
      enable_formula: this.options.enableFormula,
    };
  }

  private async uploadFile(fileUrl: string, pdfPath: string): Promise<void> {
    const FileConstructor = getRequiredGlobal<ZoteroFileConstructor>("File");
    const file = await FileConstructor.createFromFileName(pdfPath);
    const response = await fetch(fileUrl, {
      method: "PUT",
      body: await file.arrayBuffer(),
    });

    if (!response.ok) {
      throw new Error(`MinerU file upload HTTP ${response.status}`);
    }
  }

  private async waitForCompletion(
    batchID: string,
    context: ConversionContext,
  ): Promise<MineruExtractResult> {
    const startTime = Date.now();

    while (Date.now() - startTime <= this.options.timeoutMs) {
      const results = await this.fetchBatchStatus(batchID);
      const result =
        results.find(
          (item) =>
            item.dataID === `${context.itemKey}-${context.pdfAttachmentKey}`,
        ) ?? results[0];

      if (!result) {
        throw new Error(`MinerU batch ${batchID} returned no extract result`);
      }

      if (result.state === "done") {
        return result;
      }

      if (result.state === "failed") {
        throw new Error(
          `MinerU task failed for ${batchID}${
            result.errorMessage ? `: ${result.errorMessage}` : ""
          }`,
        );
      }

      await delay(this.options.pollIntervalMs);
    }

    throw new Error(`MinerU task timed out for ${batchID}`);
  }

  private async fetchBatchStatus(
    batchID: string,
  ): Promise<MineruExtractResult[]> {
    const response = await fetch(
      this.buildUrl(`/api/v4/extract-results/batch/${batchID}`),
      { headers: this.authHeaders() },
    );
    const body = await readJson(response);

    if (!response.ok) {
      throw new Error(
        `MinerU batch status HTTP ${response.status}${formatMineruError(
          (body ?? {}) as Record<string, unknown>,
        )}`,
      );
    }

    return parseMineruBatchStatusResponse(body);
  }

  private async downloadResultZip(fullZipUrl: string): Promise<Uint8Array> {
    const response = await fetch(fullZipUrl);

    if (!response.ok) {
      throw new Error(`MinerU result ZIP download HTTP ${response.status}`);
    }

    return new Uint8Array(await response.arrayBuffer());
  }

  private jsonAuthHeaders(): Record<string, string> {
    return {
      ...this.authHeaders(),
      "Content-Type": "application/json",
    };
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.options.apiToken}` };
  }

  private buildUrl(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) {
      return pathOrUrl;
    }

    return `${this.options.apiUrl.replace(/\/+$/, "")}/${pathOrUrl.replace(
      /^\/+/,
      "",
    )}`;
  }
}

function parseMineruExtractResult(body: unknown): MineruExtractResult {
  const result = body as {
    file_name?: unknown;
    data_id?: unknown;
    state?: unknown;
    full_zip_url?: unknown;
    err_msg?: unknown;
  };
  const state = result.state;

  if (typeof state !== "string" || !TASK_STATE_VALUES.has(state)) {
    throw new Error(
      `MinerU returned invalid task state: ${
        state ?? "undefined"
      }. Response: ${summarizeMineruResponse(body)}`,
    );
  }

  return {
    fileName:
      typeof result.file_name === "string" ? result.file_name : undefined,
    dataID: typeof result.data_id === "string" ? result.data_id : undefined,
    state: state as MineruTaskState,
    fullZipUrl:
      typeof result.full_zip_url === "string" ? result.full_zip_url : undefined,
    errorMessage:
      typeof result.err_msg === "string" ? result.err_msg : undefined,
  };
}

function findMineruMarkdownEntry(
  files: Record<string, Uint8Array>,
): Uint8Array | undefined {
  const fullMarkdownPath = Object.keys(files).find(isFullMarkdownPath);
  return (
    files["full.md"] ?? (fullMarkdownPath ? files[fullMarkdownPath] : undefined)
  );
}

function isFullMarkdownPath(path: string): boolean {
  return /(^|\/)full\.md$/i.test(path);
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => undefined);
}

function formatMineruError(response: {
  code?: unknown;
  msg?: unknown;
  trace_id?: unknown;
}): string {
  const details = [response.code, response.msg, response.trace_id]
    .filter(
      (value): value is string | number =>
        (typeof value === "string" && !!value) || typeof value === "number",
    )
    .join(": ");

  return details ? `: ${details}` : "";
}

function summarizeMineruResponse(body: unknown): string {
  try {
    return JSON.stringify(body).slice(0, 500);
  } catch {
    return String(body);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ZoteroFileConstructor {
  createFromFileName(fileName: string): Promise<Blob>;
}

function getRequiredGlobal<T>(name: string): T {
  const value = getGlobalValue<T>(name);

  if (!value) {
    throw new Error(`${name} is not available in Zotero runtime`);
  }

  return value;
}

function getGlobalValue<T>(name: string): T | undefined {
  const globalValue = (globalThis as Record<string, unknown>)[name];

  if (globalValue) {
    return globalValue as T;
  }

  const toolkit =
    (globalThis as any).addon?.data?.ztoolkit ?? (globalThis as any).ztoolkit;
  const windowValue =
    typeof toolkit?.getGlobal === "function" ? toolkit.getGlobal(name) : null;

  return windowValue || undefined;
}
