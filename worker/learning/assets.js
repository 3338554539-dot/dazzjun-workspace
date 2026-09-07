import { learningAssetLimits, validateLearningFile, validateLearningThumbnail } from "./file-security.js";

const fail = (message, status = 422) => { throw Object.assign(new Error(message), { status }); };
const safeName = (name) => String(name || "学习附件").normalize("NFKC").replace(/[\\/\0<>:"|?*]+/gu, "-").replace(/\s+/gu, " ").trim().slice(0, 180) || "学习附件";
const safeLearningId = (value) => {
  const id = String(value || "").trim();
  if (!/^[a-zA-Z0-9_-]{8,120}$/u.test(id)) fail("学习日志标识无效");
  return id;
};

export function learningBlockFromRow(row) {
  const base = {
    id: row.id,
    assetId: row.id,
    type: row.blockType,
    url: `/api/learning/assets/${encodeURIComponent(row.id)}`,
    name: row.name,
    size: Number(row.size || 0),
    mime: row.mime,
    createdAt: row.createdAt,
  };
  return row.blockType === "image" ? { ...base, thumbnail: `${base.url}?variant=thumbnail` } : base;
}

export async function uploadLearningAsset({ request, db, bucket, userId }) {
  if (!bucket) fail("学习附件存储尚未配置", 503);
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > learningAssetLimits.maxFileBytes + learningAssetLimits.maxThumbnailBytes + 1024 * 1024) fail("附件超过 25MB 限制", 413);
  let form;
  try { form = await request.formData(); } catch { fail("无法读取上传内容", 400); }
  const file = form.get("file");
  if (!(file instanceof File)) fail("请选择需要上传的文件");
  if (!file.size) fail("文件不能为空");
  const name = safeName(file.name);
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const validated = validateLearningFile({ name, mime: file.type, bytes: fileBytes, size: file.size });
  const { mime, blockType } = validated;
  const learningId = safeLearningId(form.get("learning_id"));
  const id = crypto.randomUUID();
  const objectPrefix = `users/${userId}/learning/${learningId}/${id}`;
  const objectKey = `${objectPrefix}/original`;
  const thumbnail = form.get("thumbnail");
  const hasThumbnail = blockType === "image" && thumbnail instanceof File && thumbnail.size > 0;
  let thumbnailBytes;
  if (hasThumbnail) {
    thumbnailBytes = new Uint8Array(await thumbnail.arrayBuffer());
    validateLearningThumbnail({ mime: thumbnail.type, bytes: thumbnailBytes, size: thumbnail.size });
  }
  const thumbnailKey = hasThumbnail ? `${objectPrefix}/thumbnail.webp` : objectKey;
  const createdAt = new Date().toISOString();
  try {
    await bucket.put(objectKey, fileBytes, { httpMetadata: { contentType: mime }, customMetadata: { userId, learningId, assetId: id } });
    if (hasThumbnail) await bucket.put(thumbnailKey, thumbnailBytes, { httpMetadata: { contentType: "image/webp" }, customMetadata: { userId, learningId, assetId: id, variant: "thumbnail" } });
    await db.prepare("INSERT INTO learning_assets(id,user_id,learning_id,block_type,object_key,thumbnail_key,name,size,mime,status,attached_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,'pending',NULL,?)")
      .bind(id, userId, learningId, blockType, objectKey, thumbnailKey, name, file.size, mime, createdAt).run();
  } catch (error) {
    await bucket.delete(hasThumbnail ? [objectKey, thumbnailKey] : objectKey).catch(() => {});
    throw Object.assign(new Error("学习附件保存失败，请稍后重试"), { status: 503, cause: error });
  }
  return learningBlockFromRow({ id, blockType, name, size: file.size, mime, createdAt });
}

export async function confirmLearningAssets({ db, userId, learningId, assetIds }) {
  const safeId = safeLearningId(learningId);
  const ids = [...new Set((Array.isArray(assetIds) ? assetIds : []).map((value) => String(value || "").trim()).filter((value) => /^[a-zA-Z0-9_-]{8,120}$/u.test(value)))];
  if (!ids.length) return { success: true, learningId: safeId, assets: [] };
  const workspaceRow = await db.prepare("SELECT payload_json AS payload FROM user_workspaces WHERE user_id=?").bind(userId).first();
  let learning;
  try { learning = JSON.parse(workspaceRow?.payload || "{}").learning; } catch { learning = []; }
  const entry = Array.isArray(learning) ? learning.find((item) => String(item?.id || "") === safeId) : undefined;
  if (!entry) fail("学习日志尚未写入服务端，附件不能确认", 409);
  const referenced = new Set((Array.isArray(entry.learningBlocks) ? entry.learningBlocks : [])
    .filter((block) => block?.type === "image" || block?.type === "file")
    .map((block) => String(block.assetId || block.id || "")));
  if (ids.some((id) => !referenced.has(id))) fail("附件与学习日志内容不一致", 409);
  const attachedAt = new Date().toISOString();
  const results = await db.batch(ids.map((id) => db.prepare("UPDATE learning_assets SET status='attached',attached_at=COALESCE(attached_at,?) WHERE id=? AND user_id=? AND learning_id=?")
    .bind(attachedAt, id, userId, safeId)));
  if (results.some((result) => Number(result.meta?.changes || 0) !== 1)) fail("部分附件不存在或不属于当前学习日志", 409);
  return { success: true, learningId: safeId, assets: ids.map((id) => ({ id, status: "attached", attachedAt })) };
}

export async function getLearningAsset({ db, bucket, userId, assetId, thumbnail = false, download = false }) {
  if (!bucket) fail("学习附件存储尚未配置", 503);
  const row = await db.prepare("SELECT id,block_type AS blockType,object_key AS objectKey,thumbnail_key AS thumbnailKey,name,size,mime,created_at AS createdAt FROM learning_assets WHERE id=? AND user_id=?")
    .bind(assetId, userId).first();
  if (!row) fail("附件不存在", 404);
  const key = thumbnail && row.blockType === "image" ? row.thumbnailKey || row.objectKey : row.objectKey;
  const object = await bucket.get(key);
  if (!object) fail("附件文件不存在", 404);
  const contentType = thumbnail && row.blockType === "image" ? object.httpMetadata?.contentType || "image/webp" : row.mime || object.httpMetadata?.contentType || "application/octet-stream";
  const inline = !download && (row.blockType === "image" || contentType === "application/pdf" || contentType === "text/plain");
  const asciiName = safeName(row.name).replace(/[^\x20-\x7E]/gu, "_");
  return new Response(object.body, {
    headers: {
      "content-type": contentType,
      "content-length": String(object.size),
      "cache-control": "private, max-age=3600",
      "etag": object.httpEtag || "",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(row.name)}`,
      "x-content-type-options": "nosniff",
    },
  });
}

export async function deleteLearningAsset({ db, bucket, userId, assetId }) {
  if (!bucket) fail("学习附件存储尚未配置", 503);
  const row = await db.prepare("SELECT object_key AS objectKey,thumbnail_key AS thumbnailKey FROM learning_assets WHERE id=? AND user_id=?").bind(assetId, userId).first();
  if (!row) fail("附件不存在", 404);
  const keys = [...new Set([row.objectKey, row.thumbnailKey].filter(Boolean))];
  await bucket.delete(keys.length === 1 ? keys[0] : keys);
  await db.prepare("DELETE FROM learning_assets WHERE id=? AND user_id=?").bind(assetId, userId).run();
  return { success: true };
}

export { learningAssetLimits } from "./file-security.js";
