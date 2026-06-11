import { renderFilenameTemplate } from "./filenameTemplate";
import { materializeMarkdownImages } from "./imageMaterializer";
import {
  extractImageReferences,
  getUniqueImageUrls,
  rewriteImageReferences,
} from "./markdownImages";
import {
  type MarkdownAttachmentAsset,
  importMarkdownAttachment,
} from "./markdownAttachmentImporter";
import {
  hasMarkdownAttachment,
  resolvePdfAttachment,
} from "./pdfAttachmentResolver";
import { createPdfParser as createDefaultPdfParser } from "./pdfParsers/createPdfParser";
import { PicGoServerClient } from "./picgoServerClient";
import type {
  ConversionContext,
  ConversionProgressReporter,
  ConversionResult,
  ItemRunResult,
  PluginPrefs,
} from "./types";

export async function runBatch(
  items: Zotero.Item[],
  prefs: PluginPrefs,
  onProgress?: ConversionProgressReporter,
  dependencies: RunBatchDependencies = {},
): Promise<ItemRunResult[]> {
  const results: ItemRunResult[] = [];
  const createPdfParser =
    dependencies.createPdfParser ?? createDefaultPdfParser;

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
      const conversionResult = await createPdfParser(prefs.pdfParser).convert({
        pdfPath: pdf.filePath,
        context: createConversionContext(item, title, pdf.attachment),
        onProgress,
      });
      const filename = renderFilenameTemplate(
        prefs.output.markdownFilenameTemplate,
        item,
      );
      const preparedMarkdown = await prepareMarkdownForImport(
        conversionResult,
        prefs,
        item,
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

function parseSkipUrlPrefixes(skipUrlPrefixes: string): string[] {
  return skipUrlPrefixes
    .split(/\r?\n/)
    .map((prefix) => prefix.trim())
    .filter((prefix) => prefix.length > 0);
}

async function prepareMarkdownForImport(
  conversionResult: ConversionResult,
  prefs: PluginPrefs,
  item: Zotero.Item,
): Promise<PreparedMarkdown> {
  const markdown = conversionResult.markdown;
  const refs = extractImageReferences(markdown);

  if (!prefs.images.enablePicgoUpload) {
    return materializeMarkdownImages({
      markdown,
      localAssets: conversionResult.assets ?? [],
      cleanupDirectories: conversionResult.cleanupDirectories ?? [],
      itemKey: item.key,
    });
  }

  const skipPrefixes = parseSkipUrlPrefixes(prefs.images.skipUrlPrefixes);
  const uploadUrls = getUniqueImageUrls(refs, skipPrefixes);
  const materializedMarkdown = await materializeMarkdownImages({
    markdown,
    localAssets: conversionResult.assets ?? [],
    cleanupDirectories: conversionResult.cleanupDirectories ?? [],
    itemKey: item.key,
    remoteUrls: uploadUrls,
  });
  try {
    const replacements = await uploadImages(
      materializedMarkdown.assets ?? [],
      prefs,
    );
    const materializedRefs = extractImageReferences(
      materializedMarkdown.markdown,
    );

    return {
      markdown: rewriteImageReferences(
        materializedMarkdown.markdown,
        materializedRefs,
        replacements,
      ),
      cleanupDirectories: materializedMarkdown.cleanupDirectories,
    };
  } catch (error) {
    await cleanupPreparedMarkdown(materializedMarkdown);
    throw error;
  }
}

async function uploadImages(
  localAssets: MarkdownAttachmentAsset[],
  prefs: PluginPrefs,
): Promise<Map<string, string>> {
  if (localAssets.length === 0) {
    return new Map();
  }

  const client = new PicGoServerClient({
    uploadUrl: prefs.images.picgoUploadUrl,
    secret: prefs.images.picgoSecret,
  });
  const replacements = new Map<string, string>();

  const uploadedUrls = await client.uploadMany(
    localAssets.map((asset) => asset.filePath),
  );

  for (const [index, asset] of localAssets.entries()) {
    replacements.set(asset.relativePath, uploadedUrls[index]);
  }

  return replacements;
}

interface PreparedMarkdown {
  markdown: string;
  assets?: MarkdownAttachmentAsset[];
  cleanupDirectories?: string[];
}

interface RunBatchDependencies {
  createPdfParser?: typeof createDefaultPdfParser;
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
