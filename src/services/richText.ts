const allowedTags = new Set(["P", "BR", "STRONG", "B", "EM", "I", "BLOCKQUOTE", "UL", "OL", "LI", "DIV"]);

export function sanitizeRichText(html: string) {
  if (typeof document === "undefined") return html;
  const template = document.createElement("template");
  template.innerHTML = html;
  const clean = (node: Node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const element = child as HTMLElement;
      if (!allowedTags.has(element.tagName)) {
        if (element.tagName === "SCRIPT" || element.tagName === "STYLE") {
          element.remove();
          return;
        }
        clean(element);
        element.replaceWith(...Array.from(element.childNodes));
        return;
      }
      Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name));
      clean(element);
    });
  };
  clean(template.content);
  return template.innerHTML;
}

export function richTextToPlainText(html: string) {
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, " ");
  const element = document.createElement("div");
  element.innerHTML = sanitizeRichText(html);
  return element.textContent ?? "";
}

export function richTextWordCount(html: string) {
  return richTextToPlainText(html).replace(/\s/g, "").length;
}
