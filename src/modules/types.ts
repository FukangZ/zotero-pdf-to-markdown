import type { PdfParseResult, PdfParserPrefs } from "./pdfParsers/types";
export type {
  ConversionContext,
  ConversionProgress,
  ConversionProgressReporter,
  LocalImageAsset,
} from "./pdfParsers/types";

export interface PluginPrefs {
  pdfParser: PdfParserPrefs;
  images: ImagePipelinePrefs;
  output: OutputPrefs;
}

export interface ImagePipelinePrefs {
  enablePicgoUpload: boolean;
  picgoUploadUrl: string;
  picgoSecret: string;
  skipUrlPrefixes: string;
}

export interface OutputPrefs {
  markdownFilenameTemplate: string;
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

export type ConversionResult = PdfParseResult;

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

export type ItemRunResult = ItemRunSuccess | ItemRunSkipped | ItemRunFailed;
