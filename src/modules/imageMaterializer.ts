import { createItemImageFilename } from "./imageFilename";
import {
  type DownloadedImageFile,
  downloadImageFiles,
  inferImageExtension,
} from "./imageFileDownloader";
import {
  extractImageReferences,
  getUniqueImageUrls,
  rewriteImageReferences,
} from "./markdownImages";
import type { LocalImageAsset } from "./types";

const LOCAL_IMAGE_ASSETS_DIR = "assets";

export interface MaterializedMarkdownImages {
  markdown: string;
  assets?: LocalImageAsset[];
  cleanupDirectories?: string[];
}

export async function materializeMarkdownImages(params: {
  markdown: string;
  localAssets: LocalImageAsset[];
  cleanupDirectories: string[];
  itemKey: string;
  remoteUrls?: string[];
}): Promise<MaterializedMarkdownImages> {
  const refs = extractImageReferences(params.markdown);
  const remoteUrls = params.remoteUrls ?? getUniqueImageUrls(refs);

  if (remoteUrls.length === 0 && params.localAssets.length === 0) {
    return {
      markdown: params.markdown,
      cleanupDirectories: params.cleanupDirectories.length
        ? params.cleanupDirectories
        : undefined,
    };
  }

  const tempDir = PathUtils.join(
    PathUtils.tempDir,
    `zotero-pdf-to-markdown-local-images-${params.itemKey}`,
  );

  try {
    const downloadedImages = remoteUrls.length
      ? await downloadImageFiles({
          urls: remoteUrls,
          directory: tempDir,
          itemKey: params.itemKey,
        })
      : [];
    const copiedAssets = await materializeLocalAssets({
      localAssets: params.localAssets,
      directory: tempDir,
      itemKey: params.itemKey,
      existingImageCount: downloadedImages.length,
    });
    const assets = [
      ...downloadedImages.map(toLocalImageAsset),
      ...copiedAssets,
    ];
    const replacements = createLocalImageReplacements([
      ...downloadedImages.map(toDownloadedImageReplacement),
      ...params.localAssets.map((asset, index) => ({
        sourceReference: asset.relativePath,
        relativePath: copiedAssets[index].relativePath,
      })),
    ]);

    return {
      markdown: rewriteImageReferences(params.markdown, refs, replacements),
      assets,
      cleanupDirectories: [...params.cleanupDirectories, tempDir],
    };
  } catch (error) {
    await IOUtils.remove(tempDir, { ignoreAbsent: true, recursive: true });
    throw error;
  }
}

async function materializeLocalAssets(params: {
  localAssets: LocalImageAsset[];
  directory: string;
  itemKey: string;
  existingImageCount: number;
}): Promise<LocalImageAsset[]> {
  const assets: LocalImageAsset[] = [];

  for (const [index, asset] of params.localAssets.entries()) {
    const filename = createItemImageFilename(
      params.itemKey,
      params.existingImageCount + index + 1,
      inferImageExtension(null, asset.relativePath),
    );
    const filePath = PathUtils.join(params.directory, filename);

    await IOUtils.copy(asset.filePath, filePath);
    assets.push({
      filePath,
      relativePath: getLocalImageRelativePath(filename),
    });
  }

  return assets;
}

function toLocalImageAsset(image: DownloadedImageFile): LocalImageAsset {
  return {
    filePath: image.filePath,
    relativePath: getLocalImageRelativePath(image.filename),
  };
}

function toDownloadedImageReplacement(image: DownloadedImageFile): {
  sourceReference: string;
  relativePath: string;
} {
  return {
    sourceReference: image.sourceUrl,
    relativePath: getLocalImageRelativePath(image.filename),
  };
}

function createLocalImageReplacements(
  images: Array<{ sourceReference: string; relativePath: string }>,
): Map<string, string> {
  return new Map(
    images.map((image) => [image.sourceReference, image.relativePath]),
  );
}

function getLocalImageRelativePath(filename: string): string {
  return `${LOCAL_IMAGE_ASSETS_DIR}/${filename}`;
}
