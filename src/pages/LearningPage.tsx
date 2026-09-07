import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, BookOpen, Clock3, Download, ExternalLink, FileText, Image as ImageIcon, Link2, Paperclip, Plus, Save, Search, Trash2, X } from "lucide-react";
import { EmptyState, FadeNotice, Panel, PanelTitle } from "../components/ui";
import type { LearningBlock, LearningCategory, LearningEntry, LearningFileBlock, LearningImageBlock, LearningLinkBlock } from "../data/types";
import { learningApi } from "../api/client";
import { useAccountData } from "../auth/AccountDataProvider";
import { shortDate, todayISO } from "../services/date";
import { formatLearningFileSize, learningBlocksForEntry, learningSearchText } from "../services/learningBlocks";
import { canSaveLearning, saveLearningEntryConsistently } from "../services/learningSave";
import { useWorkspaceStore } from "../store/workspaceStore";

const categories: LearningCategory[] = ["书籍", "课程", "技能", "文章"];
const imageAccept = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";
const fileAccept = ".pdf,.docx,.xlsx,.pptx,.zip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,application/x-zip-compressed";
const newTextBlock = (): LearningBlock => ({ id: crypto.randomUUID(), type: "text", content: "" });
const isWebUrl = (value: string) => { try { return /^https?:$/u.test(new URL(value.trim()).protocol); } catch { return false; } };

async function createThumbnail(file: File) {
  if (!file.type.startsWith("image/")) return undefined;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 720 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob | undefined>((resolve) => canvas.toBlob((blob) => resolve(blob || undefined), "image/webp", 0.82));
  } catch { return undefined; }
}

function RichBlockView({ block, onPreview }: { block: LearningBlock; onPreview: (block: LearningImageBlock) => void }) {
  if (block.type === "text") return <p className="learning-rich-text">{block.content}</p>;
  if (block.type === "image") return <button className="learning-image-view" onClick={() => onPreview(block)} aria-label={`查看大图：${block.name}`}><img src={block.thumbnail || block.url} alt={block.name}/><span><ImageIcon size={14}/>{block.name}</span></button>;
  if (block.type === "file") return <a className="learning-file-card" href={`${block.url}?download=1`} target="_blank" rel="noreferrer"><FileText size={22}/><i><strong>{block.name}</strong><small>{formatLearningFileSize(block.size)} · {shortDate(block.createdAt)}</small></i><Download size={17}/></a>;
  return <a className="learning-link-card" href={block.url} target="_blank" rel="noreferrer">{block.favicon ? <img src={block.favicon} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }}/> : <Link2 size={20}/>}<i><small>{block.siteName}</small><strong>{block.title}</strong>{block.description && <span>{block.description}</span>}<em>{block.url}</em></i><ExternalLink size={16}/></a>;
}

function LearningDetail({ entry, onNew }: { entry: LearningEntry; onNew: () => void }) {
  const [preview, setPreview] = useState<LearningImageBlock | null>(null);
  const blocks = learningBlocksForEntry(entry);
  const legacy = !entry.learningBlocks?.length;
  return <>
    <article className="learning-detail">
      <span>{entry.date} · {entry.category} · {entry.duration} 分钟</span>
      <h2>{entry.title}</h2>
      {legacy ? <>
        <section><h3>学习内容</h3><p>{entry.content}</p></section>
        <section><h3>笔记</h3><p>{entry.notes || "暂无补充笔记"}</p></section>
        <section><h3>今日收获</h3><p>{entry.gain || "暂无收获总结"}</p></section>
      </> : <div className="learning-rich-detail">{blocks.map((block) => <RichBlockView key={block.id} block={block} onPreview={setPreview}/>)}</div>}
      <button className="secondary-button" onClick={onNew}><Plus size={15}/>继续记录新的学习</button>
    </article>
    {preview && <div className="learning-lightbox" role="dialog" aria-modal="true" aria-label={preview.name} onClick={() => setPreview(null)}><button onClick={() => setPreview(null)} aria-label="关闭"><X/></button><img src={preview.url} alt={preview.name}/></div>}
  </>;
}

export function LearningPage() {
  const entries = useWorkspaceStore((state) => state.learning);
  const addLearning = useWorkspaceStore((state) => state.addLearning);
  const { saveWorkspaceNow } = useAccountData();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(entries[0]?.id ?? "");
  const [saved, setSaved] = useState(false);
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState({ date: todayISO(), title: "", category: "书籍" as LearningCategory, duration: 60 });
  const [blocks, setBlocks] = useState<LearningBlock[]>([newTextBlock()]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0 });
  const [linkLoading, setLinkLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<LearningImageBlock | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => entries.filter((entry) => learningSearchText(entry).includes(query.toLowerCase())), [entries, query]);
  const selected = entries.find((entry) => entry.id === selectedId);

  const insertBlock = (block: LearningBlock) => setBlocks((current) => [...current, block, newTextBlock()]);
  const uploadFiles = async (files: File[]) => {
    if (!files.length || uploading) return;
    setUploading(true); setUploadSuccess(false); setUploadFailed(false); setUploadProgress({ completed: 0, total: files.length }); setError("");
    let completed = 0; let failed = 0;
    for (const file of files) {
      try {
        const thumbnail = file.type.startsWith("image/") ? await createThumbnail(file) : undefined;
        const result = await learningApi.upload({ learningId: draftId, file, thumbnail });
        insertBlock(result.block);
        completed += 1;
      } catch { failed += 1; }
      setUploadProgress({ completed, total: files.length });
    }
    setUploading(false); setUploadSuccess(failed === 0); setUploadFailed(failed > 0);
    if (failed > 0) setError("上传失败，请重试");
  };
  const addLink = async (value = linkUrl) => {
    if (!isWebUrl(value)) { setError("请输入完整的 http 或 https 链接"); return; }
    setLinkLoading(true); setError("");
    try {
      const result = await learningApi.previewLink(value.trim());
      insertBlock(result.block); setLinkUrl(""); setLinkOpen(false); setMenuOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "链接读取失败"); }
    finally { setLinkLoading(false); }
  };
  const removeBlock = async (index: number) => {
    const block = blocks[index];
    if ((block.type === "image" || block.type === "file") && block.assetId) {
      try { await learningApi.deleteAsset(block.assetId); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "附件删除失败"); return; }
    }
    setBlocks((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };
  const moveBlock = (index: number, direction: -1 | 1) => setBlocks((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next;
  });
  const changeText = (index: number, content: string) => setBlocks((current) => current.map((block, itemIndex) => itemIndex === index && block.type === "text" ? { ...block, content } : block));
  const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const images = [...event.clipboardData.items].filter((item) => item.kind === "file" && item.type.startsWith("image/")).map((item) => item.getAsFile()).filter(Boolean) as File[];
    if (images.length) { event.preventDefault(); await uploadFiles(images); return; }
    const text = event.clipboardData.getData("text/plain").trim();
    if (isWebUrl(text)) { event.preventDefault(); await addLink(text); }
  };
  const resetDraft = () => {
    setSelectedId(""); setDraftId(crypto.randomUUID()); setForm({ date: todayISO(), title: "", category: "书籍", duration: 60 }); setBlocks([newTextBlock()]); setError(""); setUploadProgress({ completed: 0, total: 0 }); setUploadSuccess(false); setUploadFailed(false);
  };
  const submit = async () => {
    const cleanBlocks = blocks.filter((block) => block.type !== "text" || block.content.trim());
    const text = cleanBlocks.filter((block): block is Extract<LearningBlock, { type: "text" }> => block.type === "text").map((block) => block.content.trim()).join("\n\n");
    if (!form.title.trim() || !cleanBlocks.length) { setError("请填写标题并添加学习内容"); return; }
    if (!canSaveLearning({ uploading: uploading || linkLoading, uploadFailed, saving })) { setError(uploadFailed ? "上传失败，请重试" : "请等待附件上传完成"); return; }
    const entryId = draftId;
    setSaving(true); setSaved(false); setError("");
    try {
      await saveLearningEntryConsistently({
        entry: { ...form, id: entryId, title: form.title.trim(), content: text, notes: "", gain: "", learningBlocks: cleanBlocks },
        addLearning,
        persistWorkspace: saveWorkspaceNow,
        confirmAssets: learningApi.confirmAssets,
      });
      setSelectedId(entryId); setDraftId(crypto.randomUUID()); setForm({ date: todayISO(), title: "", category: "书籍", duration: 60 }); setBlocks([newTextBlock()]); setUploadProgress({ completed: 0, total: 0 }); setUploadSuccess(false); setUploadFailed(false);
      setSaved(true); setTimeout(() => setSaved(false), 1600);
    } catch { setError("保存失败，请重试"); }
    finally { setSaving(false); }
  };

  return <div className="learning-layout page-grid">
    <Panel className="learning-history">
      <PanelTitle icon={BookOpen} action={<button className="primary-compact" disabled={uploading || saving} onClick={resetDraft}><Plus size={15}/>新日志</button>}>学习日志</PanelTitle>
      <div className="inline-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、分类或内容"/></div>
      <div className="history-list">{filtered.map((entry) => <button key={entry.id} disabled={uploading || saving} className={selectedId === entry.id ? "active" : ""} onClick={() => setSelectedId(entry.id)}><time>{shortDate(entry.date)}</time><i><strong>{entry.title}</strong><small>{entry.category} · {entry.duration} 分钟</small></i><span><Clock3 size={13}/>{entry.duration}m <ArrowRight size={14}/></span></button>)}</div>
      {!filtered.length && <EmptyState>没有找到匹配的学习记录。</EmptyState>}
    </Panel>
    <Panel className="learning-form">
      <PanelTitle icon={selected ? BookOpen : Plus} action={saved ? <FadeNotice>学习日志已保存</FadeNotice> : undefined}>{selected ? "学习记录详情" : "创建学习日志"}</PanelTitle>
      {selected ? <LearningDetail entry={selected} onNew={resetDraft}/> : <>
        <div className="form-grid four learning-meta-grid">
          <label>学习标题<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="例如：深度工作阅读笔记"/></label>
          <label>分类<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as LearningCategory })}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>日期<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })}/></label>
          <label>学习时间<input type="number" min="5" step="5" value={form.duration} onChange={(event) => setForm({ ...form, duration: Number(event.target.value) })}/></label>
        </div>
        <div className="learning-editor" onDragOver={(event) => { if ([...event.dataTransfer.types].includes("Files")) event.preventDefault(); }} onDrop={(event) => { if (event.dataTransfer.files.length) { event.preventDefault(); void uploadFiles([...event.dataTransfer.files]); } }}>
          <div className="learning-editor-head"><span>学习内容</span><small>支持粘贴图片、拖拽文件与网页链接</small></div>
          <div className="learning-blocks">{blocks.map((block, index) => <div className={`learning-edit-block ${block.type}`} key={block.id}>
            <div className="learning-block-actions"><button disabled={index === 0} onClick={() => moveBlock(index, -1)} aria-label="上移"><ArrowUp size={14}/></button><button disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)} aria-label="下移"><ArrowDown size={14}/></button><button onClick={() => void removeBlock(index)} aria-label="删除"><Trash2 size={14}/></button></div>
            {block.type === "text" && <textarea value={block.content} onChange={(event) => changeText(index, event.target.value)} onPaste={(event) => void handlePaste(event)} placeholder="输入文字，或直接粘贴图片与链接…"/>}
            {block.type === "image" && <button className="learning-image-view" onClick={() => setPreview(block)}><img src={block.thumbnail || block.url} alt={block.name}/><span><ImageIcon size={14}/>{block.name}</span></button>}
            {block.type === "file" && <div className="learning-file-card"><FileText size={22}/><i><strong>{block.name}</strong><small>{formatLearningFileSize(block.size)} · 已上传</small></i><Paperclip size={17}/></div>}
            {block.type === "link" && <a className="learning-link-card" href={block.url} target="_blank" rel="noreferrer">{block.favicon ? <img src={block.favicon} alt=""/> : <Link2 size={20}/>}<i><small>{block.siteName}</small><strong>{block.title}</strong>{block.description && <span>{block.description}</span>}<em>{block.url}</em></i><ExternalLink size={16}/></a>}
          </div>)}</div>
          <div className="learning-add-row">
            <button className="secondary-button" disabled={uploading || saving} onClick={() => setMenuOpen((open) => !open)}><Plus size={16}/>{uploading ? `正在上传 ${uploadProgress.completed}/${uploadProgress.total}` : "添加内容"}</button>
            {menuOpen && <div className="learning-add-menu"><button onClick={() => imageInput.current?.click()}><ImageIcon size={16}/>图片</button><button onClick={() => fileInput.current?.click()}><Paperclip size={16}/>附件</button><button onClick={() => { setLinkOpen(true); setMenuOpen(false); }}><Link2 size={16}/>链接</button></div>}
            <input ref={imageInput} hidden type="file" accept={imageAccept} multiple onChange={(event) => { void uploadFiles([...(event.target.files || [])]); event.currentTarget.value = ""; }}/>
            <input ref={fileInput} hidden type="file" accept={fileAccept} multiple onChange={(event) => { void uploadFiles([...(event.target.files || [])]); event.currentTarget.value = ""; }}/>
          </div>
          {uploading && <div className="learning-upload-status">正在上传 {uploadProgress.completed}/{uploadProgress.total}</div>}
          {!uploading && uploadSuccess && <div className="learning-upload-status success">附件上传完成，等待保存日志</div>}
          {!uploading && uploadFailed && <div className="learning-upload-status failed">部分附件上传失败，请重新选择后再保存</div>}
          {linkOpen && <div className="learning-link-entry"><Link2 size={17}/><input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); void addLink(); } }} placeholder="粘贴 https:// 开头的网页链接"/><button onClick={() => void addLink()}>生成卡片</button><button className="icon-button" onClick={() => setLinkOpen(false)} aria-label="取消"><X size={16}/></button></div>}
        </div>
        {error && <div className="learning-error" role="alert">{error}</div>}
        <button className="primary-button" onClick={() => void submit()} disabled={!canSaveLearning({ uploading: uploading || linkLoading, uploadFailed, saving })}><Save size={17}/>{saving ? "正在保存…" : "保存学习日志"}</button>
      </>}
    </Panel>
    {preview && <div className="learning-lightbox" role="dialog" aria-modal="true" aria-label={preview.name} onClick={() => setPreview(null)}><button onClick={() => setPreview(null)} aria-label="关闭"><X/></button><img src={preview.url} alt={preview.name}/></div>}
  </div>;
}
