import { sanitizeFilename } from "./filenameTemplate";

export function createItemImageFilename(
  itemKey: string,
  index: number,
  extension: string,
): string {
  const paddedIndex = String(index).padStart(3, "0");
  const filename = `${itemKey}-fig-${paddedIndex}${extension}`;

  return sanitizeFilename(filename, `figure-${paddedIndex}${extension}`);
}
