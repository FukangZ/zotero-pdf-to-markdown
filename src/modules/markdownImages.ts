import type { ImageReference } from "./types";

const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*]\(([^)\s]+)\)/g;
const HTML_IMAGE_PATTERN = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi;

export function extractImageReferences(markdown: string): ImageReference[] {
  const references: ImageReference[] = [];

  for (const match of markdown.matchAll(MARKDOWN_IMAGE_PATTERN)) {
    const url = match[1];
    const urlStart = match.index! + match[0].indexOf(url);
    references.push({
      url,
      start: urlStart,
      end: urlStart + url.length,
      kind: "markdown",
    });
  }

  for (const match of markdown.matchAll(HTML_IMAGE_PATTERN)) {
    const url = match[2];
    const urlStart = match.index! + match[0].indexOf(url);
    references.push({
      url,
      start: urlStart,
      end: urlStart + url.length,
      kind: "html",
    });
  }

  return references.sort((a, b) => a.start - b.start);
}

export function getUniqueImageUrls(
  references: ImageReference[],
  skipUrlPrefixes: string[] = [],
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const reference of references) {
    if (!isRemoteUrl(reference.url)) {
      continue;
    }
    if (skipUrlPrefixes.some((prefix) => reference.url.startsWith(prefix))) {
      continue;
    }
    if (!seen.has(reference.url)) {
      seen.add(reference.url);
      urls.push(reference.url);
    }
  }

  return urls;
}

export function isRemoteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function rewriteImageReferences(
  markdown: string,
  references: ImageReference[],
  replacements: Map<string, string>,
): string {
  let rewritten = markdown;

  for (const reference of [...references].sort((a, b) => b.start - a.start)) {
    const replacement = replacements.get(reference.url);
    if (!replacement) {
      continue;
    }
    rewritten =
      rewritten.slice(0, reference.start) +
      replacement +
      rewritten.slice(reference.end);
  }

  return rewritten;
}
