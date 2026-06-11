import { unzipSync } from "fflate";
import { extractImageReferences, isRemoteUrl } from "./markdownImages";
import {
  buildServiceUrl,
  delay,
  getRequiredGlobal,
  readJson,
  type ZoteroFileConstructor,
} from "./pdfClientUtils";
import type { LocalImageAsset } from "./types";
import type {
  ConversionProgress,
  PdfParserClient,
  PdfParseRequest,
  PdfParseResult,
  MineruParserConfig,
} from "./pdfParsers/types";

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

export type MineruPdfClientOptions = MineruParserConfig;

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
  extractProgress?: MineruExtractProgress;
}

export interface MineruExtractProgress {
  extractedPages: number;
  totalPages: number;
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

interface MineruZipMarkdownEntry {
  path: string;
  bytes: Uint8Array;
}

function extractMarkdownFromMineruZip(
  zipBytes: Uint8Array,
  context: PdfParseRequest["context"],
): Promise<PdfParseResult> {
  const files = unzipSync(zipBytes);
  const markdownEntry = findMineruMarkdownEntry(files);

  if (!markdownEntry) {
    throw new Error("MinerU result ZIP does not contain full.md");
  }

  return createMineruConversionResult(files, markdownEntry, context);
}

export class MineruPdfClient implements PdfParserClient {
  constructor(private readonly options: MineruPdfClientOptions) {}

  async convert(request: PdfParseRequest): Promise<PdfParseResult> {
    if (!this.options.apiToken.trim()) {
      throw new Error("MinerU API token is required");
    }

    const upload = await this.createUploadUrls(
      request.pdfPath,
      request.context,
    );

    if (upload.fileUrls.length !== 1) {
      throw new Error(
        `MinerU expected 1 upload URL, got ${upload.fileUrls.length}`,
      );
    }

    await this.uploadFile(upload.fileUrls[0], request.pdfPath);
    request.onProgress?.(createProgress(request.context, "waiting"));

    const result = await this.waitForCompletion(
      upload.batchID,
      request.context,
      request.onProgress,
    );

    if (!result.fullZipUrl) {
      throw new Error(`MinerU task completed without full_zip_url`);
    }

    const zipBytes = await this.downloadResultZip(result.fullZipUrl);
    return extractMarkdownFromMineruZip(zipBytes, request.context);
  }

  private async createUploadUrls(
    pdfPath: string,
    context: PdfParseRequest["context"],
  ): Promise<MineruBatchUploadCreation> {
    const response = await fetch(
      buildServiceUrl(this.options.apiUrl, "/api/v4/file-urls/batch"),
      {
        method: "POST",
        headers: this.jsonAuthHeaders(),
        body: JSON.stringify(this.createUploadPayload(pdfPath, context)),
      },
    );
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
    context: PdfParseRequest["context"],
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
    context: PdfParseRequest["context"],
    onProgress: PdfParseRequest["onProgress"],
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

      onProgress?.(createMineruProgress(context, result));

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
      buildServiceUrl(
        this.options.apiUrl,
        `/api/v4/extract-results/batch/${batchID}`,
      ),
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
}

function parseMineruExtractResult(body: unknown): MineruExtractResult {
  const result = body as {
    file_name?: unknown;
    data_id?: unknown;
    state?: unknown;
    full_zip_url?: unknown;
    err_msg?: unknown;
    extract_progress?: unknown;
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
    extractProgress: parseMineruExtractProgress(result.extract_progress),
  };
}

export function calculateMineruProgressPercent(
  progress: MineruExtractProgress | undefined,
): number | undefined {
  if (!progress || progress.totalPages <= 0) {
    return undefined;
  }

  return Math.min(
    Math.round((progress.extractedPages / progress.totalPages) * 100),
    99,
  );
}

function parseMineruExtractProgress(
  body: unknown,
): MineruExtractProgress | undefined {
  const progress = body as {
    extracted_pages?: unknown;
    total_pages?: unknown;
  };

  return typeof progress?.extracted_pages === "number" &&
    typeof progress.total_pages === "number"
    ? {
        extractedPages: progress.extracted_pages,
        totalPages: progress.total_pages,
      }
    : undefined;
}

function createMineruProgress(
  context: PdfParseRequest["context"],
  result: MineruExtractResult,
): ConversionProgress {
  if (result.state === "done") {
    return createProgress(context, "completed", 100);
  }

  if (result.state === "failed") {
    return createProgress(context, "failed");
  }

  if (result.state === "waiting-file" || result.state === "pending") {
    return createProgress(context, "waiting");
  }

  return createProgress(
    context,
    "parsing",
    result.state === "converting"
      ? 99
      : calculateMineruProgressPercent(result.extractProgress),
  );
}

function createProgress(
  context: PdfParseRequest["context"],
  stage: ConversionProgress["stage"],
  percent?: number,
): ConversionProgress {
  return {
    itemID: context.itemID,
    itemKey: context.itemKey,
    title: context.itemTitle,
    provider: "mineru",
    stage,
    percent,
  };
}

async function createMineruConversionResult(
  files: Record<string, Uint8Array>,
  markdownEntry: MineruZipMarkdownEntry,
  context: PdfParseRequest["context"],
): Promise<PdfParseResult> {
  const markdown = new TextDecoder("utf-8").decode(markdownEntry.bytes);
  const assets = await extractReferencedLocalAssets(
    files,
    markdownEntry.path,
    markdown,
    context,
  );

  return {
    provider: "mineru",
    markdown,
    assets,
    cleanupDirectories: assets.length
      ? [getMineruAssetTempDirectory(context)]
      : undefined,
  };
}

async function extractReferencedLocalAssets(
  files: Record<string, Uint8Array>,
  markdownPath: string,
  markdown: string,
  context: PdfParseRequest["context"],
): Promise<LocalImageAsset[]> {
  const references = extractImageReferences(markdown);
  const assets: LocalImageAsset[] = [];
  const seen = new Set<string>();

  for (const reference of references) {
    if (isRemoteUrl(reference.url) || seen.has(reference.url)) {
      continue;
    }

    const zipPath = resolveZipRelativePath(markdownPath, reference.url);
    const bytes = zipPath ? files[zipPath] : undefined;

    if (!zipPath || !bytes) {
      continue;
    }

    const relativePath = normalizeRelativeAssetPath(reference.url);
    const tempDir = getMineruAssetTempDirectory(context);
    const filePath = PathUtils.join(tempDir, ...relativePath.split("/"));

    await IOUtils.makeDirectory(getParentDirectory(filePath), {
      createAncestors: true,
      ignoreExisting: true,
    });
    await IOUtils.write(filePath, bytes);

    seen.add(reference.url);
    assets.push({ filePath, relativePath });
  }

  return assets;
}

function findMineruMarkdownEntry(
  files: Record<string, Uint8Array>,
): MineruZipMarkdownEntry | undefined {
  const path = files["full.md"]
    ? "full.md"
    : Object.keys(files).find(isFullMarkdownPath);
  return path ? { path, bytes: files[path] } : undefined;
}

function isFullMarkdownPath(path: string): boolean {
  return /(^|\/)full\.md$/i.test(path);
}

function getMineruAssetTempDirectory(
  context: PdfParseRequest["context"],
): string {
  return PathUtils.join(
    PathUtils.tempDir,
    `zotero-pdf-to-markdown-mineru-${context.itemKey}-${context.pdfAttachmentKey}`,
  );
}

function resolveZipRelativePath(
  markdownPath: string,
  relativePath: string,
): string | undefined {
  const normalizedRelativePath = normalizeRelativeAssetPath(relativePath);
  const markdownDirectory = getZipDirectory(markdownPath);
  const candidatePath = markdownDirectory
    ? `${markdownDirectory}/${normalizedRelativePath}`
    : normalizedRelativePath;

  return candidatePath.includes("..") ? undefined : candidatePath;
}

function normalizeRelativeAssetPath(relativePath: string): string {
  return relativePath
    .split(/[?#]/, 1)[0]
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "");
}

function getZipDirectory(path: string): string {
  const normalizedPath = path.replace(/\\/g, "/");
  const separatorIndex = normalizedPath.lastIndexOf("/");
  return separatorIndex >= 0 ? normalizedPath.slice(0, separatorIndex) : "";
}

function getParentDirectory(path: string): string {
  const separatorIndex = Math.max(
    path.lastIndexOf("\\"),
    path.lastIndexOf("/"),
  );
  return separatorIndex >= 0 ? path.slice(0, separatorIndex) : path;
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
