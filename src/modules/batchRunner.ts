import { renderFilenameTemplate } from "./filenameTemplate";
import {
  extractImageReferences,
  getUniqueUploadUrls,
  rewriteImageReferences,
} from "./markdownImages";
import { importMarkdownAttachment } from "./markdownAttachmentImporter";
import {
  hasMarkdownAttachment,
  resolvePdfAttachment,
} from "./pdfAttachmentResolver";
import { PicGoServerClient } from "./picgoServerClient";
import type { ConversionContext, ItemRunResult, PluginPrefs } from "./types";
import { ZhiyiPdfClient } from "./zhiyiPdfClient";

const DEFAULT_ZHIYI_POLL_INTERVAL_MS = 3000;
const DEFAULT_ZHIYI_TIMEOUT_MS = 10 * 60 * 1000;

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
      const markdown = await createZhiyiClient(prefs).convert(
        pdf.filePath,
        createConversionContext(item, title, pdf.attachment),
      );
      const refs = extractImageReferences(markdown);
      const skipPrefixes = parseSkipUrlPrefixes(prefs.skipUrlPrefixes);
      const uploadUrls = getUniqueUploadUrls(refs, skipPrefixes);
      const replacements = await uploadImages(uploadUrls, prefs);
      const rewrittenMarkdown = rewriteImageReferences(
        markdown,
        refs,
        replacements,
      );
      const filename = renderFilenameTemplate(
        prefs.markdownFilenameTemplate,
        item,
      );
      const attachment = await importMarkdownAttachment({
        parentItem: item,
        filename,
        markdown: rewrittenMarkdown,
      });

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

function createZhiyiClient(prefs: PluginPrefs): ZhiyiPdfClient {
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

async function uploadImages(
  uploadUrls: string[],
  prefs: PluginPrefs,
): Promise<Map<string, string>> {
  const client = new PicGoServerClient({
    uploadUrl: prefs.picgoUploadUrl,
    secret: prefs.picgoSecret,
  });
  const replacements = new Map<string, string>();

  for (const url of uploadUrls) {
    replacements.set(url, await client.uploadOne(url));

    if (prefs.picgoUploadIntervalMs > 0) {
      await delay(prefs.picgoUploadIntervalMs);
    }
  }

  return replacements;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
