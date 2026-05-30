export interface PicGoServerClientOptions {
  uploadUrl: string;
  secret?: string;
}

export function parsePicGoResponse(body: unknown, sourceUrl: string): string {
  const response = body as { success?: boolean; result?: unknown };

  if (response.success !== true) {
    throw new Error(`PicGo upload failed for ${sourceUrl}`);
  }

  if (!Array.isArray(response.result) || response.result.length !== 1) {
    throw new Error(`PicGo expected exactly one URL for ${sourceUrl}`);
  }

  const uploadedUrl = response.result[0];
  if (typeof uploadedUrl !== "string" || !uploadedUrl.startsWith("http")) {
    throw new Error(`PicGo returned invalid URL for ${sourceUrl}`);
  }

  return uploadedUrl;
}

export class PicGoServerClient {
  constructor(private readonly options: PicGoServerClientOptions) {}

  async uploadOne(sourceUrl: string): Promise<string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.options.secret) {
      headers.Authorization = this.options.secret;
    }

    const response = await fetch(this.options.uploadUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ list: [sourceUrl] }),
    });

    const body = await response.json().catch(() => undefined);

    if (!response.ok) {
      throw new Error(`PicGo HTTP ${response.status} for ${sourceUrl}`);
    }

    return parsePicGoResponse(body, sourceUrl);
  }
}
