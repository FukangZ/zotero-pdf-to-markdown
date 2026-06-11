import {
  buildServiceUrl,
  delay,
  getRequiredGlobal,
  readJson,
  type ZoteroFileConstructor,
} from "./pdfClientUtils";
import type {
  ConversionProgress,
  PdfParserClient,
  PdfParseRequest,
  PdfParseResult,
  ZhiyiParserConfig,
} from "./pdfParsers/types";

const TASK_STATUS_VALUES = new Set([
  "waiting",
  "processing",
  "completed",
  "failed",
]);

export type ZhiyiTaskStatus = "waiting" | "processing" | "completed" | "failed";

export type ZhiyiPdfClientOptions = ZhiyiParserConfig;

export interface ZhiyiTaskCreation {
  taskID: string;
}

export interface ZhiyiTaskStatusResult {
  status: ZhiyiTaskStatus;
  downloadUrl?: string;
  message?: string;
}

const ZHIYI_PARSING_PROGRESS_PATTERN = /^解析中\s+(\d{1,3})%$/;

export function parseTaskCreationResponse(body: unknown): ZhiyiTaskCreation {
  const response = body as {
    success?: boolean;
    task_id?: unknown;
    error_code?: unknown;
    message?: unknown;
  };

  if (response.success !== true || typeof response.task_id !== "string") {
    throw new Error(`Zhiyi task creation failed${formatZhiyiError(response)}`);
  }

  return { taskID: response.task_id };
}

export function parseTaskStatusResponse(body: unknown): ZhiyiTaskStatusResult {
  const response = body as {
    success?: boolean;
    status?: unknown;
    result?: { download_url?: unknown };
    error_code?: unknown;
    message?: unknown;
  };

  if (response.success !== true) {
    throw new Error(`Zhiyi task status failed${formatZhiyiError(response)}`);
  }

  const status = response.status === "pending" ? "processing" : response.status;

  if (typeof status !== "string" || !TASK_STATUS_VALUES.has(status)) {
    throw new Error(
      `Zhiyi returned invalid task status: ${
        response.status ?? "undefined"
      }. Response: ${summarizeZhiyiResponse(body)}`,
    );
  }

  return {
    status: status as ZhiyiTaskStatus,
    downloadUrl:
      typeof response.result?.download_url === "string"
        ? response.result.download_url
        : undefined,
    message:
      typeof response.message === "string" ? response.message : undefined,
  };
}

export function assertMarkdownDownload(contentType: string | null): void {
  if (!contentType?.toLowerCase().includes("text/markdown")) {
    throw new Error(
      `Expected markdown download, got ${contentType || "empty"}`,
    );
  }
}

export function parseZhiyiProgressPercent(
  message: string | undefined,
): number | undefined {
  const match =
    typeof message === "string"
      ? ZHIYI_PARSING_PROGRESS_PATTERN.exec(message)
      : null;

  return match ? Math.min(Number(match[1]), 99) : undefined;
}

export class ZhiyiPdfClient implements PdfParserClient {
  constructor(private readonly options: ZhiyiPdfClientOptions) {}

  async convert(request: PdfParseRequest): Promise<PdfParseResult> {
    if (!this.options.apiKey.trim()) {
      throw new Error("Zhiyi API key is required");
    }

    const task = await this.createTask(request.pdfPath);
    request.onProgress?.(createProgress(request.context, "waiting"));
    const status = await this.waitForCompletion(
      task.taskID,
      request.context,
      request.onProgress,
    );
    const downloadUrl =
      status.downloadUrl ??
      `/api/pdf-to-markdown-proxy/download/${task.taskID}`;

    return {
      provider: "zhiyi",
      markdown: await this.downloadMarkdown(downloadUrl),
    };
  }

  private async createTask(pdfPath: string): Promise<ZhiyiTaskCreation> {
    const FormDataConstructor = getRequiredGlobal<typeof FormData>("FormData");
    const FileConstructor = getRequiredGlobal<ZoteroFileConstructor>("File");
    const formData = new FormDataConstructor();
    const file = await FileConstructor.createFromFileName(pdfPath);

    formData.append("file", file, PathUtils.filename(pdfPath));
    formData.append("table_mode", this.options.tableMode);
    formData.append("formula_format", this.options.formulaFormat);
    formData.append("enable_translation", "false");
    formData.append("images_as_url", "true");
    formData.append("skip_rotation_detection", "false");
    formData.append(
      "enable_cross_page_merge",
      String(this.options.enableCrossPageMerge),
    );

    const response = await fetch(
      buildServiceUrl(this.options.apiUrl, "/api/pdf-to-markdown-proxy/parse"),
      {
        method: "POST",
        headers: this.authHeaders(),
        body: formData,
      },
    );

    const body = await readJson(response);

    if (!response.ok) {
      throw new Error(
        `Zhiyi task creation HTTP ${response.status}${formatZhiyiError(
          body as Record<string, unknown>,
        )}`,
      );
    }

    return parseTaskCreationResponse(body);
  }

  private async waitForCompletion(
    taskID: string,
    context: PdfParseRequest["context"],
    onProgress: PdfParseRequest["onProgress"],
  ): Promise<ZhiyiTaskStatusResult> {
    const startTime = Date.now();

    while (Date.now() - startTime <= this.options.timeoutMs) {
      const status = await this.fetchTaskStatus(taskID);
      onProgress?.(createZhiyiProgress(context, status.status, status.message));

      if (status.status === "completed") {
        return status;
      }

      if (status.status === "failed") {
        throw new Error(
          `Zhiyi task failed for ${taskID}${
            status.message ? `: ${status.message}` : ""
          }`,
        );
      }

      await delay(this.options.pollIntervalMs);
    }

    throw new Error(`Zhiyi task timed out for ${taskID}`);
  }

  private async fetchTaskStatus(
    taskID: string,
  ): Promise<ZhiyiTaskStatusResult> {
    const response = await fetch(
      buildServiceUrl(
        this.options.apiUrl,
        `/api/pdf-to-markdown-proxy/status/${taskID}`,
      ),
      { headers: this.authHeaders() },
    );
    const body = await readJson(response);

    if (!response.ok) {
      throw new Error(
        `Zhiyi task status HTTP ${response.status}${formatZhiyiError(
          body as Record<string, unknown>,
        )}`,
      );
    }

    return parseTaskStatusResponse(body);
  }

  private async downloadMarkdown(downloadUrl: string): Promise<string> {
    const response = await fetch(
      buildServiceUrl(this.options.apiUrl, downloadUrl),
      {
        headers: this.authHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(`Zhiyi download HTTP ${response.status}`);
    }

    assertMarkdownDownload(response.headers.get("content-type"));
    return response.text();
  }

  private authHeaders(): Record<string, string> {
    return { "X-API-Key": this.options.apiKey };
  }
}

function createZhiyiProgress(
  context: PdfParseRequest["context"],
  status: ZhiyiTaskStatus,
  message?: string,
): ConversionProgress {
  if (status === "completed") {
    return createProgress(context, "completed", 100);
  }

  if (status === "failed") {
    return createProgress(context, "failed");
  }

  const percent = parseZhiyiProgressPercent(message);

  return createProgress(
    context,
    status === "waiting" || message === "预处理中" ? "waiting" : "parsing",
    message === "后处理中" ? 99 : percent,
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
    provider: "zhiyi",
    stage,
    percent,
  };
}

function formatZhiyiError(response: {
  error_code?: unknown;
  message?: unknown;
}): string {
  const details = [response.error_code, response.message]
    .filter((value): value is string => typeof value === "string" && !!value)
    .join(": ");

  return details ? `: ${details}` : "";
}

function summarizeZhiyiResponse(body: unknown): string {
  try {
    return JSON.stringify(body).slice(0, 500);
  } catch {
    return String(body);
  }
}
