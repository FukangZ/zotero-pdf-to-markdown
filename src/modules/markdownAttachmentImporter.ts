import { GENERATED_MARKDOWN_TAG } from "./generatedMarkdownMarker";

export interface MarkdownAttachmentAsset {
  filePath: string;
  relativePath: string;
}

export async function importMarkdownAttachment(params: {
  parentItem: Zotero.Item;
  filename: string;
  markdown: string;
  assets?: MarkdownAttachmentAsset[];
}): Promise<Zotero.Item> {
  const tempDir = PathUtils.join(
    PathUtils.tempDir,
    `zotero-pdf-to-markdown-${params.parentItem.key}`,
  );
  const filePath = PathUtils.join(tempDir, params.filename);

  await IOUtils.makeDirectory(tempDir);
  await IOUtils.writeUTF8(filePath, params.markdown);

  try {
    const attachment = await Zotero.Attachments.importFromFile({
      file: filePath,
      parentItemID: params.parentItem.id,
      title: "MD",
      contentType: "text/markdown",
      charset: "utf-8",
    });

    if (params.assets?.length) {
      await copyAssetsToAttachmentStorage(attachment, params.assets);
      await markAttachmentForFileUpload(attachment);
    }

    attachment.addTag(GENERATED_MARKDOWN_TAG);
    await attachment.saveTx();
    return attachment;
  } finally {
    await IOUtils.remove(tempDir, { ignoreAbsent: true, recursive: true });
  }
}

async function copyAssetsToAttachmentStorage(
  attachment: Zotero.Item,
  assets: MarkdownAttachmentAsset[],
): Promise<void> {
  const storageDirectory = Zotero.Attachments.getStorageDirectory(attachment);
  const storagePath = storageDirectory.path;
  const createdDirectories = new Set<string>();

  for (const asset of assets) {
    const relativeParts = parseRelativeAssetPath(asset.relativePath);
    const filename = relativeParts.at(-1)!;
    const directoryParts = relativeParts.slice(0, -1);
    const targetDirectory = PathUtils.join(storagePath, ...directoryParts);
    const targetPath = PathUtils.join(targetDirectory, filename);

    if (!createdDirectories.has(targetDirectory)) {
      await IOUtils.makeDirectory(targetDirectory, {
        createAncestors: true,
        ignoreExisting: true,
      });
      createdDirectories.add(targetDirectory);
    }

    await IOUtils.copy(asset.filePath, targetPath);
  }
}

function parseRelativeAssetPath(relativePath: string): string[] {
  const parts = relativePath.split("/");

  if (
    parts.length < 2 ||
    parts.some((part) => part.length === 0 || part === "." || part === "..")
  ) {
    throw new Error(`Invalid local image path: ${relativePath}`);
  }

  return parts;
}

async function markAttachmentForFileUpload(
  attachment: Zotero.Item,
): Promise<void> {
  const storageLocal = (Zotero as unknown as ZoteroWithStorageSync).Sync
    ?.Storage?.Local;

  await storageLocal?.updateSyncStates?.([attachment], "to_upload");
}

interface ZoteroWithStorageSync {
  Sync?: {
    Storage?: {
      Local?: {
        updateSyncStates?: (
          attachments: Zotero.Item[],
          state: "to_upload",
        ) => Promise<void>;
      };
    };
  };
}
