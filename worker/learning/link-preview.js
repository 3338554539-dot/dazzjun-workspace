import { normalizeCaptureUrl } from "../inspiration/capture.js";

const decode = (value) => String(value || "").replace(/&amp;/giu, "&").replace(/&quot;/giu, '"').replace(/&#39;|&apos;/giu, "'").replace(/&lt;/giu, "<").replace(/&gt;/giu, ">");
const clean = (value, max) => decode(value).replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ").trim().slice(0, max);
const attr = (tag, name) => tag.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "iu"))?.slice(1).find((value) => value !== undefined) || "";
const resolve = (value, base) => { try { const url = new URL(decode(value), base); return /^https?:$/u.test(url.protocol) ? url.toString() : ""; } catch { return ""; } };

function metadata(html, finalUrl) {
  const meta = new Map();
  for (const tag of html.match(/<meta\b[^>]*>/giu) || []) {
    const key = (attr(tag, "property") || attr(tag, "name")).toLowerCase();
    const value = attr(tag, "content");
    if (key && value && !meta.has(key)) meta.set(key, value);
  }
  const iconTag = (html.match(/<link\b[^>]*rel\s*=\s*(?:"[^"]*icon[^"]*"|'[^']*icon[^']*')[^>]*>/iu) || [""])[0];
  const url = new URL(finalUrl);
  return {
    title: clean(meta.get("og:title") || meta.get("twitter:title") || html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu)?.[1] || url.hostname, 300),
    description: clean(meta.get("og:description") || meta.get("description") || meta.get("twitter:description") || "", 500),
    siteName: clean(meta.get("og:site_name") || url.hostname, 160),
    favicon: resolve(attr(iconTag, "href") || "/favicon.ico", finalUrl),
  };
}

export async function previewLearningLink(input, fetchImpl = fetch) {
  const normalized = normalizeCaptureUrl(input);
  if (!normalized) throw Object.assign(new Error("请输入有效的 http 或 https 链接"), { status: 422 });
  let current = normalized;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    for (let redirect = 0; redirect <= 3; redirect += 1) {
      const response = await fetchImpl(current, { redirect: "manual", signal: controller.signal, headers: { accept: "text/html,application/xhtml+xml", "user-agent": "Mozilla/5.0 DazzjunLearning/8.0" } });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        const next = normalizeCaptureUrl(new URL(location, current).toString());
        if (!next) break;
        current = next;
        continue;
      }
      const type = response.headers.get("content-type") || "";
      const size = Number(response.headers.get("content-length") || 0);
      if (!response.ok || !/text\/html|application\/xhtml\+xml/iu.test(type) || size > 1_000_000) break;
      const page = metadata((await response.text()).slice(0, 1_000_000), current);
      return { id: crypto.randomUUID(), type: "link", url: current, ...page };
    }
  } catch {}
  finally { clearTimeout(timeout); }
  const url = new URL(current);
  return { id: crypto.randomUUID(), type: "link", url: current, title: url.hostname, siteName: url.hostname, favicon: `${url.origin}/favicon.ico`, description: "" };
}
