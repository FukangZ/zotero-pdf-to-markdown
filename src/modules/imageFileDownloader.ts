import { sanitizeFilename } from "./filenameTemplate";

export interface DownloadedImageFile {
  sourceUrl: string;
  filePath: string;
}

const IMAGE_EXTENSION_BY_CONTENT_TYPE = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["image/svg+xml", ".svg"],
]);

export async function downloadImagesForUpload(params: {
  urls: string[];
  directory: string;
  markdownFilename: string;
}): Promise<DownloadedImageFile[]> {
  await IOUtils.makeDirectory(params.directory);

  return Promise.all(
    params.urls.map(async (url, index) => {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Image download HTTP ${response.status} for ${url}`);
      }

      const extension = inferImageExtension(
        response.headers.get("content-type"),
        url,
      );
      const filename = createImageFilename(
        params.markdownFilename,
        index + 1,
        extension,
      );
      const filePath = PathUtils.join(params.directory, filename);
      const bytes = new Uint8Array(await response.arrayBuffer());

      await IOUtils.write(filePath, bytes);

      return {
        sourceUrl: url,
        filePath,
      };
    }),
  );
}

export function inferImageExtension(
  contentType: string | null,
  url: string,
): string {
  const normalizedContentType = contentType
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  const contentTypeExtension = normalizedContentType
    ? IMAGE_EXTENSION_BY_CONTENT_TYPE.get(normalizedContentType)
    : undefined;

  if (contentTypeExtension) {
    return contentTypeExtension;
  }

  const urlExtension = getUrlImageExtension(url);
  return urlExtension ?? ".png";
}

function createImageFilename(
  markdownFilename: string,
  index: number,
  extension: string,
): string {
  const markdownBaseName = markdownFilename.replace(/\.md$/i, "");
  const paddedIndex = String(index).padStart(3, "0");
  return sanitizeFilename(
    `${markdownBaseName}-fig-${paddedIndex}${extension}`,
    `figure-${paddedIndex}${extension}`,
  );
}

function getUrlImageExtension(url: string): string | undefined {
  const pathname = getUrlPathname(url);
  const match = pathname.match(/\.(png|jpe?g|webp|gif|svg)$/i);

  if (!match) {
    return undefined;
  }

  const extension = match[1].toLowerCase();
  return extension === "jpeg" ? ".jpg" : `.${extension}`;
}

function getUrlPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split(/[?#]/)[0];
  }
}
