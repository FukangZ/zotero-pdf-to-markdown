import { renderFilenameTemplate } from "./filenameTemplate";
import {
  type DownloadedImageFile,
  downloadImageFiles,
} from "./imageFileDownloader";
import {
  extractImageReferences,
  getUniqueImageUrls,
  getUniqueUploadUrls,
  rewriteImageReferences,
} from "./markdownImages";
import {
  type MarkdownAttachmentAsset,
  importMarkdownAttachment,
} from "./markdownAttachmentImporter";
import { MineruPdfClient } from "./mineruPdfClient";
import {
  hasMarkdownAttachment,
  resolvePdfAttachment,
} from "./pdfAttachmentResolver";
import { PicGoServerClient } from "./picgoServerClient";
import type { ConversionContext, ItemRunResult, PluginPrefs } from "./types";
import { ZhiyiPdfClient } from "./zhiyiPdfClient";

const DEFAULT_ZHIYI_POLL_INTERVAL_MS = 3000;
const DEFAULT_ZHIYI_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_MINERU_POLL_INTERVAL_MS = 3000;
const DEFAULT_MINERU_TIMEOUT_MS = 10 * 60 * 1000;
const LOCAL_IMAGE_ASSETS_DIR = "assets";

interface PdfToMarkdownClient {
  convert(pdfPath: string, context: ConversionContext): Promise<string>;
}

export async function runBatch(
  items: Zotero.Item[],
  prefs: PluginPrefs,
): Promise<ItemRunResult[]> {
  const results: ItemRunResult[] = [];

  for (const item of items) {
    let title = String(item.key);

    try {
      title = getItemTitle(item);

      if (hasMarkdownAttachment(item)) {
        results.push({
          status: "skipped",
          itemID: item.id,
          itemKey: item.key,
          title,
          reason: "Markdown attachment already exists",
        });
        continue;
      }

      const pdf = await resolvePdfAttachment(item);
      const markdown = await createPdfToMarkdownClient(prefs).convert(
        pdf.filePath,
        createConversionContext(item, title, pdf.attachment),
      );
      const filename = renderFilenameTemplate(
        prefs.markdownFilenameTemplate,
        item,
      );
      const preparedMarkdown = await prepareMarkdownForImport(
        markdown,
        prefs,
        item,
        filename,
      );
      const attachment = await importPreparedMarkdown(
        item,
        filename,
        preparedMarkdown,
      );

      results.push({
        status: "success",
        itemID: item.id,
        itemKey: item.key,
        title,
        attachmentID: attachment.id,
      });
    } catch (error) {
      results.push({
        status: "failed",
        itemID: item.id,
        itemKey: item.key,
        title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

async function importPreparedMarkdown(
  parentItem: Zotero.Item,
  filename: string,
  preparedMarkdown: PreparedMarkdown,
): Promise<Zotero.Item> {
  try {
    return await importMarkdownAttachment({
      parentItem,
      filename,
      markdown: preparedMarkdown.markdown,
      assets: preparedMarkdown.assets,
    });
  } finally {
    await cleanupPreparedMarkdown(preparedMarkdown);
  }
}

function getItemTitle(item: Zotero.Item): string {
  return String(item.getField("title") || item.key);
}

function createConversionContext(
  item: Zotero.Item,
  title: string,
  pdfAttachment: Zotero.Item,
): ConversionContext {
  return {
    itemID: item.id,
    itemKey: item.key,
    itemTitle: title,
    pdfAttachmentID: pdfAttachment.id,
    pdfAttachmentKey: pdfAttachment.key,
  };
}

function createPdfToMarkdownClient(prefs: PluginPrefs): PdfToMarkdownClient {
  if (prefs.pdfParserProvider === "mineru") {
    return new MineruPdfClient({
      apiUrl: prefs.mineruApiUrl,
      apiToken: prefs.mineruApiToken,
      modelVersion: prefs.mineruModelVersion,
      language: prefs.mineruLanguage,
      enableTable: prefs.mineruEnableTable,
      isOcr: prefs.mineruIsOcr,
      enableFormula: prefs.mineruEnableFormula,
      pageRanges: prefs.mineruPageRanges,
      pollIntervalMs: DEFAULT_MINERU_POLL_INTERVAL_MS,
      timeoutMs: DEFAULT_MINERU_TIMEOUT_MS,
    });
  }

  return createZhiyiClient(prefs);
}

function createZhiyiClient(prefs: PluginPrefs): PdfToMarkdownClient {
  return new ZhiyiPdfClient({
    apiUrl: prefs.zhiyiApiUrl,
    apiKey: prefs.zhiyiApiKey,
    tableMode: prefs.zhiyiTableMode,
    formulaFormat: prefs.zhiyiFormulaFormat,
    enableCrossPageMerge: prefs.zhiyiEnableCrossPageMerge,
    pollIntervalMs: DEFAULT_ZHIYI_POLL_INTERVAL_MS,
    timeoutMs: DEFAULT_ZHIYI_TIMEOUT_MS,
  });
}

function parseSkipUrlPrefixes(skipUrlPrefixes: string): string[] {
  return skipUrlPrefixes
    .split(/\r?\n/)
    .map((prefix) => prefix.trim())
    .filter((prefix) => prefix.length > 0);
}

async function prepareMarkdownForImport(
  markdown: string,
  prefs: PluginPrefs,
  item: Zotero.Item,
  filename: string,
): Promise<PreparedMarkdown> {
  const refs = extractImageReferences(markdown);

  if (!prefs.enablePicgoUpload) {
    return localizeImages(markdown, refs, item, filename);
  }

  const skipPrefixes = parseSkipUrlPrefixes(prefs.skipUrlPrefixes);
  const uploadUrls = getUniqueUploadUrls(refs, skipPrefixes);
  const replacements = await uploadImages(uploadUrls, prefs, item, filename);

  return {
    markdown: rewriteImageReferences(markdown, refs, replacements),
  };
}

async function localizeImages(
  markdown: string,
  refs: ReturnType<typeof extractImageReferences>,
  item: Zotero.Item,
  markdownFilename: string,
): Promise<PreparedMarkdown> {
  const imageUrls = getUniqueImageUrls(refs);

  if (imageUrls.length === 0) {
    return { markdown };
  }

  const tempDir = PathUtils.join(
    PathUtils.tempDir,
    `zotero-pdf-to-markdown-local-images-${item.key}`,
  );

  try {
    const downloadedImages = await downloadImageFiles({
      urls: imageUrls,
      directory: tempDir,
      markdownFilename,
      useMarkdownFilenamePrefix: false,
    });
    const replacements = createLocalImageReplacements(downloadedImages);

    return {
      markdown: rewriteImageReferences(markdown, refs, replacements),
      assets: downloadedImages.map((image) => ({
        filePath: image.filePath,
        relativePath: getLocalImageRelativePath(image.filename),
      })),
      cleanupDirectories: [tempDir],
    };
  } catch (error) {
    await IOUtils.remove(tempDir, { ignoreAbsent: true, recursive: true });
    throw error;
  }
}

async function uploadImages(
  uploadUrls: string[],
  prefs: PluginPrefs,
  item: Zotero.Item,
  markdownFilename: string,
): Promise<Map<string, string>> {
  if (uploadUrls.length === 0) {
    return new Map();
  }

  const client = new PicGoServerClient({
    uploadUrl: prefs.picgoUploadUrl,
    secret: prefs.picgoSecret,
  });
  const replacements = new Map<string, string>();
  const tempDir = PathUtils.join(
    PathUtils.tempDir,
    `zotero-pdf-to-markdown-images-${item.key}`,
  );

  try {
    const downloadedImages = await downloadImageFiles({
      urls: uploadUrls,
      directory: tempDir,
      markdownFilename,
    });
    const uploadedUrls = await client.uploadMany(
      downloadedImages.map((image) => image.filePath),
    );

    for (const [index, image] of downloadedImages.entries()) {
      replacements.set(image.sourceUrl, uploadedUrls[index]);
    }

    if (prefs.picgoUploadIntervalMs > 0) {
      await delay(prefs.picgoUploadIntervalMs);
    }

    return replacements;
  } finally {
    await IOUtils.remove(tempDir, { ignoreAbsent: true, recursive: true });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createLocalImageReplacements(
  downloadedImages: DownloadedImageFile[],
): Map<string, string> {
  return new Map(
    downloadedImages.map((image) => [
      image.sourceUrl,
      getLocalImageRelativePath(image.filename),
    ]),
  );
}

function getLocalImageRelativePath(filename: string): string {
  return `${LOCAL_IMAGE_ASSETS_DIR}/${filename}`;
}

interface PreparedMarkdown {
  markdown: string;
  assets?: MarkdownAttachmentAsset[];
  cleanupDirectories?: string[];
}

async function cleanupPreparedMarkdown(
  preparedMarkdown: PreparedMarkdown,
): Promise<void> {
  if (!preparedMarkdown.cleanupDirectories?.length) {
    return;
  }

  await Promise.all(
    preparedMarkdown.cleanupDirectories.map((directory) =>
      IOUtils.remove(directory, { ignoreAbsent: true, recursive: true }),
    ),
  );
}
