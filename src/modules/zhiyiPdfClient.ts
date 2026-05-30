import type { ConversionContext } from "./types";

const TASK_STATUS_VALUES = new Set([
  "waiting",
  "processing",
  "completed",
  "failed",
]);

export type ZhiyiTaskStatus =
  | "waiting"
  | "processing"
  | "completed"
  | "failed";

export interface ZhiyiPdfClientOptions {
  apiUrl: string;
  apiKey: string;
  tableMode: "markdown" | "image";
  formulaFormat: "dollar" | "bracket";
  enableCrossPageMerge: boolean;
  pollIntervalMs: number;
  timeoutMs: number;
}

export interface ZhiyiTaskCreation {
  taskID: string;
}

export interface ZhiyiTaskStatusResult {
  status: ZhiyiTaskStatus;
  downloadUrl?: string;
  message?: string;
}

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

export function parseTaskStatusResponse(
  body: unknown,
): ZhiyiTaskStatusResult {
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

  const status =
    response.status === "pending" ? "processing" : response.status;

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
    throw new Error(`Expected markdown download, got ${contentType || "empty"}`);
  }
}

export class ZhiyiPdfClient {
  constructor(private readonly options: ZhiyiPdfClientOptions) {}

  async convert(
    pdfPath: string,
    context: ConversionContext,
  ): Promise<string> {
    void context;

    if (!this.options.apiKey.trim()) {
      throw new Error("Zhiyi API key is required");
    }

    const task = await this.createTask(pdfPath);
    const status = await this.waitForCompletion(task.taskID);
    const downloadUrl =
      status.downloadUrl ?? `/api/pdf-to-markdown-proxy/download/${task.taskID}`;

    return this.downloadMarkdown(downloadUrl);
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

    const response = await fetch(this.buildUrl("/api/pdf-to-markdown-proxy/parse"), {
      method: "POST",
      headers: this.authHeaders(),
      body: formData,
    });

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
  ): Promise<ZhiyiTaskStatusResult> {
    const startTime = Date.now();

    while (Date.now() - startTime <= this.options.timeoutMs) {
      const status = await this.fetchTaskStatus(taskID);

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
      this.buildUrl(`/api/pdf-to-markdown-proxy/status/${taskID}`),
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
    const response = await fetch(this.buildUrl(downloadUrl), {
      headers: this.authHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Zhiyi download HTTP ${response.status}`);
    }

    assertMarkdownDownload(response.headers.get("content-type"));
    return response.text();
  }

  private authHeaders(): Record<string, string> {
    return { "X-API-Key": this.options.apiKey };
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

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => undefined);
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
