import { GENERATED_MARKDOWN_TAG } from "./generatedMarkdownMarker";
import type { PdfAttachmentInfo } from "./types";

export async function resolvePdfAttachment(
  item: Zotero.Item,
): Promise<PdfAttachmentInfo> {
  const attachmentIDs = item.getAttachments(false);
  const attachments = await Zotero.Items.getAsync(attachmentIDs);
  const pdfAttachments = attachments.filter(
    (attachment) =>
      attachment.isAttachment() &&
      attachment.attachmentContentType === "application/pdf",
  );

  if (pdfAttachments.length === 0) {
    throw new Error("No PDF attachment found");
  }

  const attachment = pdfAttachments[0];
  const filePath = await attachment.getFilePathAsync();

  if (!filePath) {
    throw new Error("PDF attachment file does not exist on disk");
  }

  return { attachment, filePath };
}

export function hasMarkdownAttachment(item: Zotero.Item): boolean {
  const attachmentIDs = item.getAttachments(false);
  return attachmentIDs.some((id) => {
    const attachment = Zotero.Items.get(id);
    return (
      attachment?.isAttachment() && attachment.hasTag(GENERATED_MARKDOWN_TAG)
    );
  });
}
