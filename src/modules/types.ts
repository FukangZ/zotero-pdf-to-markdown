export interface PluginPrefs {
  zhiyiApiUrl: string;
  zhiyiApiKey: string;
  zhiyiTableMode: "markdown" | "image";
  zhiyiFormulaFormat: "dollar" | "bracket";
  zhiyiEnableCrossPageMerge: boolean;
  picgoUploadUrl: string;
  picgoSecret: string;
  picgoUploadIntervalMs: number;
  skipUrlPrefixes: string;
  markdownFilenameTemplate: string;
  existingMarkdownStrategy: "skip";
}

export interface ConversionContext {
  itemID: number;
  itemKey: string;
  itemTitle: string;
  pdfAttachmentID: number;
  pdfAttachmentKey: string;
}

export interface PdfAttachmentInfo {
  attachment: Zotero.Item;
  filePath: string;
}

export interface ImageReference {
  url: string;
  start: number;
  end: number;
  kind: "markdown" | "html";
}

export interface ItemRunSuccess {
  status: "success";
  itemID: number;
  itemKey: string;
  title: string;
  attachmentID: number;
}

export interface ItemRunSkipped {
  status: "skipped";
  itemID: number;
  itemKey: string;
  title: string;
  reason: string;
}

export interface ItemRunFailed {
  status: "failed";
  itemID: number;
  itemKey: string;
  title: string;
  error: string;
}

export type ItemRunResult =
  | ItemRunSuccess
  | ItemRunSkipped
  | ItemRunFailed;
