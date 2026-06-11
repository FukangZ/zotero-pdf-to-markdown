import {
  buildServiceUrl,
  getRequiredGlobal,
  readJson,
  type ZoteroFileConstructor,
} from "./pdfClientUtils";
import type {
  ConversionProgress,
  GlmOcrParserConfig,
  PdfParserClient,
  PdfParseRequest,
  PdfParseResult,
} from "./pdfParsers/types";

const GLM_OCR_MODEL = "glm-ocr";
const GLM_OCR_LAYOUT_PARSING_PATH = "/api/paas/v4/layout_parsing";

export type GlmOcrPdfClientOptions = GlmOcrParserConfig;

export class GlmOcrPdfClient implements PdfParserClient {
  constructor(private readonly options: GlmOcrPdfClientOptions) {}

  async convert(request: PdfParseRequest): Promise<PdfParseResult> {
    if (!this.options.apiKey.trim()) {
      throw new Error("GLM-OCR API key is required");
    }

    const file = await this.readInputFile(request.pdfPath);

    request.onProgress?.(createProgress(request.context, "parsing"));

    const response = await fetch(
      buildServiceUrl(this.options.apiUrl, GLM_OCR_LAYOUT_PARSING_PATH),
      {
        method: "POST",
        headers: this.jsonAuthHeaders(),
        body: JSON.stringify(await this.createPayload(request.pdfPath, file)),
      },
    );
    const body = await readJson(response);

    if (!response.ok) {
      throw new Error(
        `GLM-OCR HTTP ${response.status}: ${summarizeGlmOcrResponse(body)}`,
      );
    }

    const markdown = parseGlmOcrMarkdown(body);

    request.onProgress?.(createProgress(request.context, "completed", 100));

    return {
      provider: "glmocr",
      markdown,
    };
  }

  private async readInputFile(pdfPath: string): Promise<Blob> {
    const FileConstructor = getRequiredGlobal<ZoteroFileConstructor>("File");
    const file = await FileConstructor.createFromFileName(pdfPath);
    const maxBytes = this.options.maxFileSizeMb * 1024 * 1024;

    if (maxBytes > 0 && file.size > maxBytes) {
      throw new Error(
        `GLM-OCR input file is ${(file.size / 1024 / 1024).toFixed(
          1,
        )}MB, above configured ${this.options.maxFileSizeMb}MB limit`,
      );
    }

    return file;
  }

  private async createPayload(
    pdfPath: string,
    file: Blob,
  ): Promise<Record<string, unknown>> {
    const payload: Record<string, unknown> = {
      model: GLM_OCR_MODEL,
      file: `data:${inferMimeType(pdfPath, file)};base64,${arrayBufferToBase64(
        await file.arrayBuffer(),
      )}`,
      return_crop_images: this.options.returnCropImages,
      need_layout_visualization: this.options.needLayoutVisualization,
    };

    if (this.options.startPageId > 0) {
      payload.start_page_id = this.options.startPageId;
    }

    if (this.options.endPageId > 0) {
      payload.end_page_id = this.options.endPageId;
    }

    if (
      this.options.startPageId > 0 &&
      this.options.endPageId > 0 &&
      this.options.startPageId > this.options.endPageId
    ) {
      throw new Error("GLM-OCR start_page_id must be <= end_page_id");
    }

    return payload;
  }

  private jsonAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.options.apiKey}`,
      "Content-Type": "application/json",
    };
  }
}

export function parseGlmOcrMarkdown(body: unknown): string {
  const response = body as { md_results?: unknown };
  const markdown =
    typeof response.md_results === "string" ? response.md_results : "";

  if (!markdown.trim()) {
    throw new Error(
      `GLM-OCR response missing non-empty md_results: ${summarizeGlmOcrResponse(
        body,
      )}`,
    );
  }

  return markdown;
}

function inferMimeType(filePath: string, file: Blob): string {
  const fileName = PathUtils.filename(filePath).toLowerCase();

  if (fileName.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (fileName.endsWith(".png")) {
    return "image/png";
  }

  if (file.type) {
    return file.type;
  }

  throw new Error("GLM-OCR only supports PDF, JPG, and PNG files");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const encodeBase64 = getRequiredGlobal<(binary: string) => string>("btoa");
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return encodeBase64(binary);
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
    provider: "glmocr",
    stage,
    percent,
  };
}

function summarizeGlmOcrResponse(body: unknown): string {
  try {
    return JSON.stringify(body).slice(0, 500);
  } catch {
    return String(body);
  }
}
