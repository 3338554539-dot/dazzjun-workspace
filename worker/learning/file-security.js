const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;

const MIME_BY_EXTENSION = new Map([
  ["png", new Set(["image/png"])],
  ["jpg", new Set(["image/jpeg"])],
  ["jpeg", new Set(["image/jpeg"])],
  ["webp", new Set(["image/webp"])],
  ["pdf", new Set(["application/pdf"])],
  ["docx", new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"])],
  ["xlsx", new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"])],
  ["pptx", new Set(["application/vnd.openxmlformats-officedocument.presentationml.presentation"])],
  ["zip", new Set(["application/zip", "application/x-zip-compressed"])],
]);

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
const OFFICE_EXTENSIONS = new Set(["docx", "xlsx", "pptx"]);
const OFFICE_ENTRY_PREFIX = { docx: "word/", xlsx: "xl/", pptx: "ppt/" };
const decoder = new TextDecoder();

const fail = (message, status = 422) => { throw Object.assign(new Error(message), { status }); };
const hasBytes = (bytes, offset, expected) => expected.every((value, index) => bytes[offset + index] === value);
const readUint16 = (bytes, offset) => bytes[offset] | (bytes[offset + 1] << 8);
const readUint32 = (bytes, offset) => (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;

export const learningExtension = (name) => String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/u)?.[1] || "";

function zipEntries(bytes) {
  if (bytes.length < 22) return null;
  const minimum = Math.max(0, bytes.length - 65_557);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (readUint32(bytes, offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0 || eocd + 22 > bytes.length) return null;
  const disk = readUint16(bytes, eocd + 4);
  const centralDisk = readUint16(bytes, eocd + 6);
  const entriesOnDisk = readUint16(bytes, eocd + 8);
  const totalEntries = readUint16(bytes, eocd + 10);
  const centralSize = readUint32(bytes, eocd + 12);
  const centralOffset = readUint32(bytes, eocd + 16);
  const commentLength = readUint16(bytes, eocd + 20);
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries || eocd + 22 + commentLength !== bytes.length) return null;
  if (centralOffset + centralSize > eocd || totalEntries === 0xffff) return null;

  const names = [];
  let offset = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > bytes.length || readUint32(bytes, offset) !== 0x02014b50) return null;
    const nameLength = readUint16(bytes, offset + 28);
    const extraLength = readUint16(bytes, offset + 30);
    const entryCommentLength = readUint16(bytes, offset + 32);
    const compressedSize = readUint32(bytes, offset + 20);
    const localOffset = readUint32(bytes, offset + 42);
    const end = offset + 46 + nameLength + extraLength + entryCommentLength;
    if (!nameLength || end > bytes.length) return null;
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (localOffset + 30 > centralOffset || readUint32(bytes, localOffset) !== 0x04034b50) return null;
    const localNameLength = readUint16(bytes, localOffset + 26);
    const localExtraLength = readUint16(bytes, localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + compressedSize > centralOffset) return null;
    if (decoder.decode(bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength)) !== name) return null;
    names.push(name);
    offset = end;
  }
  if (offset !== centralOffset + centralSize) return null;
  return names;
}

export function inspectLearningFile(bytesInput) {
  const bytes = bytesInput instanceof Uint8Array ? bytesInput : new Uint8Array(bytesInput);
  if (hasBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: "png" };
  if (hasBytes(bytes, 0, [0xff, 0xd8, 0xff])) return { kind: "jpeg" };
  if (hasBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && hasBytes(bytes, 8, [0x57, 0x45, 0x42, 0x50])) return { kind: "webp" };
  if (hasBytes(bytes, 0, [0x25, 0x50, 0x44, 0x46])) return { kind: "pdf" };
  if (hasBytes(bytes, 0, [0x50, 0x4b])) {
    const entries = zipEntries(bytes);
    return entries ? { kind: "zip", entries } : { kind: "invalid-zip" };
  }
  return { kind: "unknown" };
}

export function validateLearningFile({ name, mime, bytes: bytesInput, size }) {
  const bytes = bytesInput instanceof Uint8Array ? bytesInput : new Uint8Array(bytesInput);
  const actualSize = Number(size ?? bytes.byteLength);
  if (!actualSize || !bytes.byteLength) fail("文件不能为空");
  if (actualSize > MAX_FILE_BYTES || bytes.byteLength > MAX_FILE_BYTES) fail("附件超过 25MB 限制", 413);
  const ext = learningExtension(name);
  const declaredMime = String(mime || "application/octet-stream").toLowerCase().trim();
  const allowedMimes = MIME_BY_EXTENSION.get(ext);
  if (!allowedMimes || declaredMime === "application/octet-stream") fail("文件格式不支持");
  if (!allowedMimes.has(declaredMime)) fail("文件内容与类型不匹配");

  const inspection = inspectLearningFile(bytes);
  const expectedKind = ext === "jpg" || ext === "jpeg" ? "jpeg" : OFFICE_EXTENSIONS.has(ext) || ext === "zip" ? "zip" : ext;
  if (inspection.kind !== expectedKind) fail("文件内容与类型不匹配");
  if (OFFICE_EXTENSIONS.has(ext)) {
    const entries = inspection.entries || [];
    if (!entries.includes("[Content_Types].xml") || !entries.some((name) => name.startsWith(OFFICE_ENTRY_PREFIX[ext]))) fail("文件内容与类型不匹配");
  }
  return { extension: ext, mime: declaredMime, blockType: IMAGE_EXTENSIONS.has(ext) ? "image" : "file", inspection };
}

export function validateLearningThumbnail({ mime, bytes: bytesInput, size }) {
  const bytes = bytesInput instanceof Uint8Array ? bytesInput : new Uint8Array(bytesInput);
  const actualSize = Number(size ?? bytes.byteLength);
  if (!actualSize || actualSize > MAX_THUMBNAIL_BYTES || bytes.byteLength > MAX_THUMBNAIL_BYTES) fail("图片缩略图无效");
  if (String(mime || "").toLowerCase() !== "image/webp" || inspectLearningFile(bytes).kind !== "webp") fail("图片缩略图无效");
  return { mime: "image/webp" };
}

export const learningAssetLimits = { maxFileBytes: MAX_FILE_BYTES, maxThumbnailBytes: MAX_THUMBNAIL_BYTES };
