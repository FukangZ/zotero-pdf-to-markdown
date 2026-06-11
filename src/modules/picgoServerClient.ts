export interface PicGoServerClientOptions {
  uploadUrl: string;
  secret?: string;
}

export function parsePicGoBatchResponse(
  body: unknown,
  sourcePaths: string[],
): string[] {
  const response = body as { success?: boolean; result?: unknown };
  const sourceLabel = sourcePaths.join(", ");

  if (response.success !== true) {
    throw new Error(`PicGo upload failed for ${sourceLabel}`);
  }

  if (
    !Array.isArray(response.result) ||
    response.result.length !== sourcePaths.length
  ) {
    throw new Error(
      `PicGo expected ${sourcePaths.length} URL(s) for ${sourceLabel}`,
    );
  }

  const uploadedUrls = response.result;
  for (const uploadedUrl of uploadedUrls) {
    if (typeof uploadedUrl !== "string" || !uploadedUrl.startsWith("http")) {
      throw new Error(`PicGo returned invalid URL for ${sourceLabel}`);
    }
  }

  return uploadedUrls;
}

export class PicGoServerClient {
  constructor(private readonly options: PicGoServerClientOptions) {}

  async uploadMany(sourcePaths: string[]): Promise<string[]> {
    if (sourcePaths.length === 0) {
      return [];
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.options.secret) {
      headers.Authorization = this.options.secret;
    }

    let response: Response;
    try {
      response = await fetch(this.options.uploadUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ list: sourcePaths }),
      });
    } catch (error) {
      throw new Error(
        formatPicGoConnectionError(this.options.uploadUrl, error),
      );
    }

    const body = await response.json().catch(() => undefined);

    if (!response.ok) {
      throw new Error(`PicGo HTTP ${response.status} for ${sourcePaths[0]}`);
    }

    return parsePicGoBatchResponse(body, sourcePaths);
  }
}

function formatPicGoConnectionError(uploadUrl: string, error: unknown): string {
  const originalMessage =
    error instanceof Error ? error.message : String(error || "unknown error");

  return [
    `无法连接 PicGo Server（${uploadUrl}）`,
    "请确认 PicGo 已启动并开启 Server，或在插件偏好中关闭 PicGo 图片上传/检查上传地址",
    `原始错误：${originalMessage}`,
  ].join("。");
}
