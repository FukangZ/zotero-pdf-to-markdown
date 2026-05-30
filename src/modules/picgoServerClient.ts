export interface PicGoServerClientOptions {
  uploadUrl: string;
  secret?: string;
}

export function parsePicGoResponse(body: unknown, sourceUrl: string): string {
  return parsePicGoBatchResponse(body, [sourceUrl])[0];
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

  async uploadOne(sourceUrl: string): Promise<string> {
    return (await this.uploadMany([sourceUrl]))[0];
  }

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

    const response = await fetch(this.options.uploadUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ list: sourcePaths }),
    });

    const body = await response.json().catch(() => undefined);

    if (!response.ok) {
      throw new Error(`PicGo HTTP ${response.status} for ${sourcePaths[0]}`);
    }

    return parsePicGoBatchResponse(body, sourcePaths);
  }
}
