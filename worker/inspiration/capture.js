const MAX_SOURCE_TEXT_LENGTH = 8_000;
const MAX_URL_LENGTH = 2_048;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const MAX_HTML_LENGTH = 2_000_000;
const DEFAULT_COVERS = {
  douyin: "/assets/inspiration-ribbons.png",
  xiaohongshu: "/assets/inspiration-sea.png",
  web: "/assets/inspiration-ribbons.png",
};

const trimUrlToken = (value) => value.replace(/[\]}>),，。！？；、]+$/u, "");
const cleanText = (value, limit = 220) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);

function candidateUrls(value) {
  const source = String(value || "");
  const matches = source.match(/(?:https?:\/\/|www\.|(?:v\.)?douyin\.com\/|(?:www\.)?xiaohongshu\.com\/|xhslink\.com\/|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"']*)?)[^\s<>"']*/giu) || [];
  const candidates = matches.map(trimUrlToken).filter(Boolean);
  const strong = /^(?:https?:\/\/|www\.|(?:v\.)?douyin\.com\/|(?:www\.)?xiaohongshu\.com\/|xhslink\.com\/)/iu;
  return [...candidates.filter((candidate) => strong.test(candidate)), ...candidates.filter((candidate) => !strong.test(candidate))];
}

export function normalizeCaptureUrl(value) {
  const candidate = candidateUrls(value)[0] || String(value || "").trim().split(/\s+/)[0] || "";
  if (!candidate || candidate.length > MAX_URL_LENGTH) return null;
  const withProtocol = /^https?:\/\//iu.test(candidate) ? candidate : `https://${candidate}`;
  try {
    const url = new URL(withProtocol);
    if (!/^https?:$/iu.test(url.protocol) || !url.hostname || url.username || url.password || isPrivateHost(url.hostname)) return null;
    return url.toString();
  } catch { return null; }
}

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (host === "::1" || host === "::" || host.startsWith("::ffff:") || /^(?:fc|fd|fe[89ab])[0-9a-f:]*$/iu.test(host)) return true;
  if (/^127\./u.test(host) || /^0\./u.test(host) || /^10\./u.test(host) || /^192\.168\./u.test(host) || /^169\.254\./u.test(host)) return true;
  const match = host.match(/^172\.(\d{1,3})\./u);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function isPlatformShortLink(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "v.douyin.com" || host === "xhslink.com" || host.endsWith(".xhslink.com");
  } catch { return false; }
}

export function detectCapturePlatform(value) {
  const host = (() => { try { return new URL(value).hostname.toLowerCase(); } catch { return String(value || "").toLowerCase(); } })();
  if (host === "douyin.com" || host.endsWith(".douyin.com") || host === "iesdouyin.com" || host.endsWith(".iesdouyin.com")) return "douyin";
  if (host === "xiaohongshu.com" || host.endsWith(".xiaohongshu.com") || host === "xhslink.com" || host.endsWith(".xhslink.com")) return "xiaohongshu";
  return "web";
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&#(\d+);/gu, (_, number) => String.fromCodePoint(Number(number)));
}

function attributeMap(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/giu)) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function decodeStructuredHtml(value) {
  return decodeEntities(value)
    .replace(/\\+u002f/giu, "/")
    .replace(/\\+u0026/giu, "&")
    .replace(/\\+u003d/giu, "=")
    .replace(/\\+u003a/giu, ":")
    .replace(/\\+\//gu, "/");
}

function decodedScriptPayloads(html) {
  const payloads = [];
  for (const match of String(html || "").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/giu)) {
    const content = decodeEntities(match[1] || "").trim();
    if (!content || !/%(?:7b|22|3a|2f)/iu.test(content)) continue;
    try { payloads.push(decodeURIComponent(content)); } catch {}
  }
  return payloads.join("\n");
}

function resolveImageUrl(value, baseUrl) {
  const clean = trimUrlToken(decodeStructuredHtml(value).replace(/\\+$/gu, "").trim());
  if (!clean) return "";
  try {
    const image = new URL(clean, baseUrl);
    if (!/^https?:$/iu.test(image.protocol) || isPrivateHost(image.hostname)) return "";
    if (/\.(?:css|js|mjs|html?|json|mp4|m3u8)(?:$|[?#])/iu.test(image.pathname)) return "";
    return image.toString();
  } catch { return ""; }
}

function isDecorativeImage(value, context = "") {
  const candidate = `${String(value || "")} ${String(context || "")}`.toLowerCase();
  return /(?:^|[\s/_.?&=-])(avatar|favicon|logo|site-logo|app-logo|icon|sprite|emoji|badge|qrcode|qr-code|advert|advertisement|placeholder|default|default-share|share-default)(?:[\s/_.?&=-]|$)/u.test(candidate);
}

function validContentImages(values, context = "") {
  return [...new Set(values)].filter((value) => value && !isDecorativeImage(value, context));
}

function structuredImageCandidates(html, baseUrl, keys) {
  const decoded = decodeStructuredHtml(`${String(html || "")}\n${decodedScriptPayloads(html)}`);
  const candidates = [];
  for (const key of keys) {
    const matcher = new RegExp(`(?:["']${key}["']|\\b${key}\\b)\\s*[:=]`, "giu");
    for (const match of decoded.matchAll(matcher)) {
      const window = decoded.slice((match.index || 0) + match[0].length, (match.index || 0) + match[0].length + 5_000);
      for (const urlMatch of window.matchAll(/https?:\/\/[^"'\s<>{}\\]+/giu)) {
        const candidate = resolveImageUrl(urlMatch[0], baseUrl);
        if (candidate) candidates.push(candidate);
        if (candidates.length >= 12) break;
      }
      if (candidates.length >= 12) break;
    }
    if (candidates.length) break;
  }
  return validContentImages(candidates);
}

function posterImageCandidates(html, baseUrl) {
  const candidates = [];
  for (const tag of String(html || "").match(/<video\b[^>]*>/giu) || []) {
    const poster = resolveImageUrl(attributeMap(tag).poster, baseUrl);
    if (poster) candidates.push(poster);
  }
  return validContentImages(candidates, "video poster");
}

function imageTagCandidates(html, baseUrl) {
  const candidates = [];
  for (const tag of String(html || "").match(/<img\b[^>]*>/giu) || []) {
    const attributes = attributeMap(tag);
    const context = `${attributes.class || ""} ${attributes.id || ""} ${attributes.alt || ""} ${attributes.role || ""}`;
    if (isDecorativeImage("", context)) continue;
    const width = Number.parseInt(attributes.width || "0", 10);
    const height = Number.parseInt(attributes.height || "0", 10);
    if ((width && width < 160) || (height && height < 120)) continue;
    const candidate = resolveImageUrl(attributes["data-original"] || attributes["data-src"] || attributes.src, baseUrl);
    if (candidate && !isDecorativeImage(candidate, context)) candidates.push(candidate);
  }
  return [...new Set(candidates)];
}

function mainContentImageCandidates(html, baseUrl) {
  const content = String(html || "");
  const scoped = [];
  for (const match of content.matchAll(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/giu)) scoped.push(...imageTagCandidates(match[1], baseUrl));
  return [...new Set([...scoped, ...imageTagCandidates(content, baseUrl)])];
}

function isVideoContent(html, platform, meta) {
  if (platform === "douyin") return true;
  const content = decodeStructuredHtml(String(html || ""));
  return /video/iu.test(meta.get("og:type") || "")
    || /<video\b/iu.test(content)
    || /["'](?:type|noteType|note_type)["']\s*:\s*["']video["']/iu.test(content)
    || /["']video["']\s*:\s*\{/iu.test(content);
}

export function selectInspirationCover({ platform, contentType, videoFirstFrame = "", videoPosters = [], firstImages = [], ogImages = [], mainImages = [] }) {
  const choose = (values) => validContentImages(values)[0] || "";
  const firstFrame = choose([videoFirstFrame]);
  if (contentType === "video" && firstFrame) return { cover: firstFrame, coverSource: firstFrame, coverType: "video_first_frame" };
  const poster = contentType === "video" ? choose(videoPosters) : "";
  if (poster) return { cover: poster, coverSource: poster, coverType: "video_poster" };
  const firstImage = contentType === "image" ? choose(firstImages) : "";
  if (firstImage) return { cover: firstImage, coverSource: firstImage, coverType: "first_image" };
  const ogImage = choose(ogImages);
  if (ogImage) return { cover: ogImage, coverSource: ogImage, coverType: "og_image" };
  const mainImage = choose(mainImages);
  if (mainImage) return { cover: mainImage, coverSource: mainImage, coverType: platform === "web" ? "main_image" : "first_image" };
  const fallback = DEFAULT_COVERS[platform] || DEFAULT_COVERS.web;
  return { cover: fallback, coverSource: fallback, coverType: "fallback" };
}

function metadataFromHtml(html, baseUrl) {
  const meta = new Map();
  for (const tag of String(html || "").match(/<meta\b[^>]*>/giu) || []) {
    const attributes = attributeMap(tag);
    const key = String(attributes.property || attributes.name || attributes.itemprop || "").toLowerCase();
    if (key && attributes.content && !meta.has(key)) meta.set(key, cleanText(attributes.content, 500));
  }
  const titleTag = String(html || "").match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu)?.[1] || "";
  const title = cleanText(meta.get("og:title") || meta.get("twitter:title") || decodeEntities(titleTag), 220);
  const platform = detectCapturePlatform(baseUrl);
  const contentType = isVideoContent(html, platform, meta) ? "video" : "image";
  const firstFrames = contentType === "video"
    ? structuredImageCandidates(html, baseUrl, ["firstFrame", "first_frame", "firstFrameUrl", "first_frame_url"])
    : [];
  const structuredPosters = platform === "douyin"
    ? structuredImageCandidates(html, baseUrl, ["originCover", "origin_cover", "cover", "dynamicCover", "dynamic_cover", "poster"])
    : platform === "xiaohongshu" && contentType === "video"
      ? structuredImageCandidates(html, baseUrl, ["videoPoster", "video_poster", "poster", "cover", "imageList", "image_list", "urlDefault", "url_default"])
      : [];
  const firstImages = platform === "xiaohongshu" && contentType === "image"
    ? structuredImageCandidates(html, baseUrl, ["imageList", "image_list", "urlDefault", "url_default"])
    : [];
  const posters = [...structuredPosters, ...posterImageCandidates(html, baseUrl)];
  const allowPageMetadata = !isPlatformShortLink(baseUrl);
  const ogImage = allowPageMetadata ? resolveImageUrl(meta.get("og:image") || meta.get("og:image:url"), baseUrl) : "";
  const twitterImage = allowPageMetadata ? resolveImageUrl(meta.get("twitter:image") || meta.get("twitter:image:src"), baseUrl) : "";
  const cover = selectInspirationCover({
    platform,
    contentType,
    videoFirstFrame: firstFrames[0],
    videoPosters: posters,
    firstImages,
    ogImages: [ogImage, twitterImage],
    mainImages: allowPageMetadata ? mainContentImageCandidates(html, baseUrl) : [],
  });
  return { title, ...cover, contentType, author: cleanText(meta.get("author") || meta.get("article:author") || meta.get("og:site_name"), 120) };
}

async function fetchMetadata(initialUrl, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let url = initialUrl;
    for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
      const response = await fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "zh-CN,zh;q=0.9,en;q=0.7",
          "cache-control": "no-cache",
          "user-agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
        },
      });
      if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
        const next = new URL(response.headers.get("location"), url).toString();
        const nextUrl = new URL(next);
        if (!/^https?:$/iu.test(nextUrl.protocol) || isPrivateHost(nextUrl.hostname)) break;
        url = next;
        continue;
      }
      const type = response.headers.get("content-type") || "";
      if (!response.ok || !/text\/html|application\/xhtml\+xml/iu.test(type)) return { url, metadata: {} };
      const length = Number(response.headers.get("content-length") || 0);
      if (length > MAX_HTML_LENGTH) return { url, metadata: {} };
      const html = (await response.text()).slice(0, MAX_HTML_LENGTH);
      return { url, metadata: metadataFromHtml(html, url) };
    }
  } catch {}
  finally { clearTimeout(timeout); }
  return { url: initialUrl, metadata: {} };
}

function hashtags(sourceText) {
  return [...new Set([...String(sourceText || "").matchAll(/#\s*([^\s#]+)/gu)].map((match) => cleanText(match[1], 40)).filter(Boolean))].slice(0, 12);
}

function parseDouyinShare(sourceText) {
  const lines = String(sourceText || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const candidate = lines.map((line) => candidateUrls(line).reduce((clean, url) => clean.replace(url, ""), line).trim()).find((line) => line && !/复制此链接|打开.+搜索|直接观看/iu.test(line)) || "";
  const withoutSharePrefix = candidate.replace(/^\S+\s+\S+\s+\d{1,2}\/\d{1,2}\s+.*?:\d{1,2}(?:am|pm)\s*/iu, "");
  const beforeTags = withoutSharePrefix.split(/\s*#\s*/u)[0].trim();
  const title = cleanText(beforeTags.includes("｜") ? beforeTags.split("｜").slice(1).join("｜") : beforeTags, 220);
  return { title, author: "", tags: hashtags(sourceText) };
}

function parseXiaohongshuShare(sourceText) {
  const match = String(sourceText || "").match(/【\s*(.*?)\s+-\s*([^|】]+?)(?:\s*\|\s*小红书[^】]*)?\s*】/u);
  return {
    title: cleanText(match?.[1] || "", 220),
    author: cleanText(match?.[2] || "", 120),
    tags: hashtags(sourceText),
  };
}

function parseShare(sourceText, platform) {
  if (platform === "douyin") return parseDouyinShare(sourceText);
  if (platform === "xiaohongshu") return parseXiaohongshuShare(sourceText);
  return { title: "", author: "", tags: hashtags(sourceText) };
}

export async function captureInspiration({ url, sourceText, fetchImpl = fetch }) {
  const rawText = String(sourceText || "").trim();
  if (rawText.length > MAX_SOURCE_TEXT_LENGTH) throw Object.assign(new Error("分享内容过长，请保留 8000 字以内"), { status: 422 });
  const normalizedUrl = normalizeCaptureUrl(url || rawText);
  if (!normalizedUrl) throw Object.assign(new Error("没有识别到可用链接，请粘贴抖音、小红书分享内容或网页链接"), { status: 422 });
  const initialPlatform = detectCapturePlatform(normalizedUrl);
  const shared = parseShare(rawText, initialPlatform);
  const fetched = await fetchMetadata(normalizedUrl, fetchImpl);
  const platform = detectCapturePlatform(fetched.url);
  const parsed = platform === initialPlatform ? shared : parseShare(rawText, platform);
  const title = cleanText(parsed.title || fetched.metadata.title || new URL(fetched.url).hostname, 220);
  const author = cleanText(parsed.author || fetched.metadata.author, 120);
  return {
    platform,
    title,
    cover: fetched.metadata.cover || DEFAULT_COVERS[platform] || DEFAULT_COVERS.web,
    coverSource: fetched.metadata.coverSource || DEFAULT_COVERS[platform] || DEFAULT_COVERS.web,
    coverType: fetched.metadata.coverType || "fallback",
    author,
    tags: parsed.tags,
    url: fetched.url,
  };
}
