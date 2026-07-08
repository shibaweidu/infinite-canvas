const ALLOWED_TAGS = new Set(["B", "BR", "DIV", "EM", "H1", "H2", "H3", "I", "LI", "OL", "P", "SPAN", "STRONG", "UL"]);

export function plainTextToCanvasRichTextHtml(text: string, format?: { textStyle?: "body" | "h1" | "h2" | "h3"; textBold?: boolean; textItalic?: boolean }) {
    if (!text) return "";
    const blockTag = format?.textStyle && format.textStyle !== "body" ? format.textStyle : "p";
    return text
        .split("\n")
        .map((line) => {
            let content = line ? escapeHtml(line) : "<br>";
            if (format?.textBold) content = `<strong>${content}</strong>`;
            if (format?.textItalic) content = `<em>${content}</em>`;
            return `<${blockTag}>${content}</${blockTag}>`;
        })
        .join("");
}

export function sanitizeCanvasRichTextHtml(html: string) {
    if (!html.trim()) return "";
    if (typeof document === "undefined") return escapeHtml(html);
    const template = document.createElement("template");
    template.innerHTML = html;
    return Array.from(template.content.childNodes)
        .map((node) => cleanRichTextNode(node))
        .join("");
}

function cleanRichTextNode(node: ChildNode): string {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const element = node as HTMLElement;
    const tagName = element.tagName.toUpperCase();
    const children = Array.from(element.childNodes)
        .map((child) => cleanRichTextNode(child))
        .join("");

    if (!ALLOWED_TAGS.has(tagName)) return children;
    if (tagName === "BR") return "<br>";

    const tag = tagName.toLowerCase();
    return `<${tag}>${children}</${tag}>`;
}

function escapeHtml(value: string) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
