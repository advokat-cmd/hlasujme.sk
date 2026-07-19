const ALLOWED_TAGS = new Set(["p", "br", "strong", "em", "b", "i", "ul", "ol", "li", "a", "span", "div", "h1", "h2", "h3", "code", "table", "thead", "tbody", "tr", "td", "th"]);

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function sanitizeEmailPreview(html: string): string {
  if (typeof html !== "string") return "";
  const withoutActiveBlocks = html.replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  return withoutActiveBlocks.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (source, rawTag: string, rawAttributes: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    const closing = source.startsWith("</");
    if (closing) return tag === "br" ? "" : `</${tag}>`;
    if (tag === "br") return "<br>";
    if (tag !== "a") return `<${tag}>`;
    const hrefMatch = rawAttributes.match(/\bhref\s*=\s*(["'])(.*?)\1/i);
    const titleMatch = rawAttributes.match(/\btitle\s*=\s*(["'])(.*?)\1/i);
    const href = hrefMatch?.[2]?.trim() ?? "";
    const safeHref = /^(https:\/\/|mailto:)/i.test(href) ? href : "";
    const attributes = [
      safeHref ? `href="${escapeAttribute(safeHref)}"` : "",
      titleMatch?.[2] ? `title="${escapeAttribute(titleMatch[2])}"` : "",
      safeHref ? 'rel="noopener noreferrer"' : "",
    ].filter(Boolean).join(" ");
    return attributes ? `<a ${attributes}>` : "<a>";
  });
}
