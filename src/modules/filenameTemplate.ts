const WINDOWS_INVALID_CHARS = /[<>:"/\\|?*]+/g;
const WHITESPACE = /\s+/g;

export function sanitizeFilename(
  filename: string,
  fallback = "attachment.md",
): string {
  const cleaned = filename
    .replace(WINDOWS_INVALID_CHARS, "-")
    .replace(WHITESPACE, " ")
    .trim();

  return cleaned.length > 0 ? cleaned.slice(0, 180) : fallback;
}

export function getYear(item: Zotero.Item): string {
  const date = item.getField("date", true, true);
  const match = String(date).match(/\d{4}/);
  return match ? match[0] : "no-year";
}

export function renderFilenameTemplate(
  template: string,
  item: Zotero.Item,
): string {
  const title = item.getField("title") || item.key;
  const rendered = template
    .replaceAll("{firstAuthor}", item.firstCreator || "no-author")
    .replaceAll("{year}", getYear(item))
    .replaceAll("{title}", title)
    .replaceAll("{itemKey}", item.key);

  const withExtension = rendered.toLowerCase().endsWith(".md")
    ? rendered
    : `${rendered}.md`;

  return sanitizeFilename(withExtension, `${item.key}.md`);
}
