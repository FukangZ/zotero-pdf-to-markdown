import { GENERATED_MARKDOWN_TAG } from "./generatedMarkdownMarker";

export async function importMarkdownAttachment(params: {
  parentItem: Zotero.Item;
  filename: string;
  markdown: string;
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
    attachment.addTag(GENERATED_MARKDOWN_TAG);
    await attachment.saveTx();
    return attachment;
  } finally {
    await IOUtils.remove(tempDir, { ignoreAbsent: true, recursive: true });
  }
}
