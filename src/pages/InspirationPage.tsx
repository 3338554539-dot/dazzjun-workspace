import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowDown, ArrowUp, Bold, Bookmark, BookOpenText, Edit3, ExternalLink, FolderCog, Globe2, Italic, List, ListOrdered, Pin, Plus, Quote, RefreshCw, Search, Tags, Trash2 } from "lucide-react";
import { EmptyState, Panel } from "../components/ui";
import { inspirationApi, type InspirationCaptureResult } from "../api/client";
import type { InspirationItem, InspirationNote } from "../data/types";
import { filterUnifiedInspirations, inspirationCoverCandidates, inspirationSourceLabel, needsInspirationCoverRefresh } from "../services/inspirationLibrary";
import { shouldSubmitOnEnter } from "../services/ime";
import { richTextToPlainText, richTextWordCount, sanitizeRichText } from "../services/richText";
import { useWorkspaceStore } from "../store/workspaceStore";
import { useWorkspaceNavigation } from "../components/workspace/WorkspaceNavigation";
import { useAccountData } from "../auth/AccountDataProvider";

type LibrarySpace = "收藏灵感" | "我的笔记";
type NoteDraft = { title: string; content: string; tags: string[] };
type ExternalDraft = { sourceText: string; categoryId: string };
type CaptureState = "idle" | "loading" | "ready" | "error";

const spaces: Array<{ id: LibrarySpace; label: string; description: string; icon: typeof Bookmark }> = [
  { id: "收藏灵感", label: "收藏灵感", description: "抖音、小红书与网页收藏", icon: Bookmark },
  { id: "我的笔记", label: "我的笔记", description: "想法、文案与知识素材", icon: BookOpenText },
];

const formatDate = (value: string) => new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)).replaceAll("/", ".");
const canCapture = (value: string) => /(?:https?:\/\/|www\.|douyin\.com\/|xiaohongshu\.com\/|xhslink\.com\/|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/|$))/iu.test(value);

function normalizeExternalUrl(value: string) {
  const clean = value.trim();
  if (!clean || /\s/.test(clean)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`);
    const validProtocol = url.protocol === "http:" || url.protocol === "https:";
    const validHost = url.hostname === "localhost" || url.hostname.includes(".");
    return validProtocol && validHost && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

function linkHost(value: string) {
  try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return "链接待修复"; }
}

function advanceCover(event: SyntheticEvent<HTMLImageElement>, candidates: string[]) {
  const image = event.currentTarget;
  const nextIndex = Number(image.dataset.coverIndex || 0) + 1;
  if (nextIndex < candidates.length) {
    image.dataset.coverIndex = String(nextIndex);
    image.src = candidates[nextIndex];
    return;
  }
  image.style.visibility = "hidden";
}

function InspirationCoverImage({ item }: { item: InspirationItem }) {
  const candidates = inspirationCoverCandidates(item);
  return <img src={candidates[0]} data-cover-index="0" alt={item.title} onError={(event) => advanceCover(event, candidates)}/>;
}

export function InspirationPage() {
  const { params } = useWorkspaceNavigation();
  const items = useWorkspaceStore((state) => state.inspirations);
  const categories = useWorkspaceStore((state) => state.inspirationCategories);
  const notes = useWorkspaceStore((state) => state.inspirationNotes);
  const tags = useWorkspaceStore((state) => state.inspirationTags);
  const add = useWorkspaceStore((state) => state.addInspiration);
  const updateInspiration = useWorkspaceStore((state) => state.updateInspiration);
  const toggle = useWorkspaceStore((state) => state.toggleInspiration);
  const remove = useWorkspaceStore((state) => state.deleteInspiration);
  const addCategory = useWorkspaceStore((state) => state.addInspirationCategory);
  const renameCategory = useWorkspaceStore((state) => state.renameInspirationCategory);
  const deleteCategory = useWorkspaceStore((state) => state.deleteInspirationCategory);
  const moveCategory = useWorkspaceStore((state) => state.moveInspirationCategory);
  const addNote = useWorkspaceStore((state) => state.addInspirationNote);
  const updateNote = useWorkspaceStore((state) => state.updateInspirationNote);
  const toggleFavorite = useWorkspaceStore((state) => state.toggleInspirationNoteFavorite);
  const togglePinned = useWorkspaceStore((state) => state.toggleInspirationNotePinned);
  const deleteNote = useWorkspaceStore((state) => state.deleteInspirationNote);
  const addTag = useWorkspaceStore((state) => state.addInspirationTag);
  const renameTag = useWorkspaceStore((state) => state.renameInspirationTag);
  const { saveWorkspaceNow } = useAccountData();

  const [space, setSpace] = useState<LibrarySpace>("收藏灵感");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("全部");
  const [selectedTag, setSelectedTag] = useState("全部");
  const targetRecordId = params.get("recordId") ?? "";
  const [formOpen, setFormOpen] = useState(params.get("mode") === "capture");
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newTag, setNewTag] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [draft, setDraft] = useState<NoteDraft>({ title: "", content: "", tags: [] });
  const [form, setForm] = useState<ExternalDraft>({ sourceText: "", categoryId: "" });
  const [capture, setCapture] = useState<InspirationCaptureResult | null>(null);
  const [captureState, setCaptureState] = useState<CaptureState>("idle");
  const [captureError, setCaptureError] = useState("");
  const [reparsingId, setReparsingId] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const captureRequest = useRef(0);

  const categoryNames = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);
  const visibleItems = useMemo(() => filterUnifiedInspirations(items, categoryId, query, categoryNames), [items, categoryId, query, categoryNames]);
  const visibleNotes = useMemo(() => notes
    .filter((note) => selectedTag === "全部" || note.tags.includes(selectedTag))
    .filter((note) => `${note.title}${richTextToPlainText(note.content)}${note.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [notes, selectedTag, query]);

  useEffect(() => {
    if (formOpen && space === "我的笔记" && editorRef.current) editorRef.current.innerHTML = sanitizeRichText(draft.content);
  }, [formOpen, editingId, space]);

  useEffect(() => {
    if (!targetRecordId) return;
    const index = visibleItems.findIndex((item) => item.id === targetRecordId);
    window.requestAnimationFrame(() => {
      const target = document.querySelectorAll<HTMLElement>(".inspiration-cards.v61 > article")[index];
      target?.classList.add("targeted");
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [targetRecordId, visibleItems]);

  useEffect(() => {
    if (form.categoryId && !categories.some((item) => item.id === form.categoryId)) setForm((current) => ({ ...current, categoryId: "" }));
  }, [categories, form.categoryId]);

  useEffect(() => {
    const sourceText = form.sourceText.trim();
    const requestId = captureRequest.current + 1;
    captureRequest.current = requestId;
    if (!sourceText || !canCapture(sourceText)) {
      setCapture(null); setCaptureState("idle"); setCaptureError("");
      return;
    }
    setCaptureState("loading"); setCaptureError("");
    const timer = window.setTimeout(() => {
      inspirationApi.capture({ sourceText }).then((result) => {
        if (captureRequest.current === requestId) { setCapture(result); setCaptureState("ready"); }
      }).catch((error: unknown) => {
        if (captureRequest.current === requestId) { setCapture(null); setCaptureState("error"); setCaptureError(error instanceof Error ? error.message : "解析失败，请检查分享内容。"); }
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [form.sourceText]);

  const switchSpace = (next: LibrarySpace) => {
    setSpace(next); setQuery(""); setCategoryId("全部"); setSelectedTag("全部"); setFormOpen(false); setCategoryManagerOpen(false); setTagManagerOpen(false); setNotice(null); setCapture(null); setCaptureState("idle"); setCaptureError("");
  };

  const submitExternal = async () => {
    if (space === "我的笔记") return;
    let result = capture;
    if (!result) {
      if (!form.sourceText.trim()) { setNotice({ tone: "error", text: "请粘贴抖音、小红书分享内容或网页链接。" }); return; }
      setCaptureState("loading"); setCaptureError("");
      try { result = await inspirationApi.capture({ sourceText: form.sourceText }); setCapture(result); setCaptureState("ready"); }
      catch (error) { const message = error instanceof Error ? error.message : "解析失败，请检查分享内容。"; setCaptureState("error"); setCaptureError(message); setNotice({ tone: "error", text: message }); return; }
    }
    const categoryName = categoryNames.get(form.categoryId) ?? "";
    add({ platform: result.platform, title: result.title, cover: result.cover, coverSource: result.coverSource, coverType: result.coverType, author: result.author, sourceText: form.sourceText.trim(), categoryId: form.categoryId, categoryName, aiTags: result.tags, content: result.title, image: result.cover, url: result.url });
    setForm({ sourceText: "", categoryId: form.categoryId }); setCapture(null); setCaptureState("idle"); setCaptureError("");
    setFormOpen(false); setNotice({ tone: "success", text: "保存成功，已加入你的灵感资产库。" });
  };

  const refreshCover = async (item: InspirationItem) => {
    if (!needsInspirationCoverRefresh(item) || reparsingId) return;
    setReparsingId(item.id); setNotice(null);
    const previous = { cover: item.cover, image: item.image, coverSource: item.coverSource, coverType: item.coverType };
    try {
      const result = await inspirationApi.capture({ sourceText: item.sourceText || item.url, url: item.url });
      updateInspiration(item.id, { cover: result.cover, image: result.cover, coverSource: result.coverSource, coverType: result.coverType });
      await saveWorkspaceNow();
      setNotice(result.coverType === "fallback"
        ? { tone: "error", text: "暂未获得真实封面，已保留默认封面，稍后可以再次解析。" }
        : { tone: "success", text: "已重新解析并更新真实封面。" });
    } catch (error) {
      updateInspiration(item.id, previous);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "封面重新解析失败，请稍后再试。" });
    } finally { setReparsingId(""); }
  };

  const openNewNote = () => { setEditingId(null); setDraft({ title: "", content: "", tags: [] }); setFormOpen(true); };
  const openEditNote = (note: InspirationNote) => { setEditingId(note.id); setDraft({ title: note.title, content: note.content, tags: note.tags }); setFormOpen(true); };
  const saveNote = () => {
    const content = sanitizeRichText(editorRef.current?.innerHTML ?? draft.content);
    if (!draft.title.trim() || !richTextToPlainText(content).trim()) return;
    const cleanDraft = { title: draft.title.trim(), content, tags: Array.from(new Set(draft.tags)) };
    cleanDraft.tags.forEach(addTag);
    if (editingId) updateNote(editingId, cleanDraft); else addNote(cleanDraft);
    setFormOpen(false); setEditingId(null); setDraft({ title: "", content: "", tags: [] });
  };
  const format = (command: string, value?: string) => { editorRef.current?.focus(); document.execCommand(command, false, value); setDraft((current) => ({ ...current, content: editorRef.current?.innerHTML ?? current.content })); };
  const addNewTag = () => { const clean = newTag.trim(); if (!clean) return; addTag(clean); setNewTag(""); };
  const addNewCategory = () => { const clean = newCategory.trim(); if (!clean) return; addCategory(clean); setNewCategory(""); };
  const currentCount = space === "我的笔记" ? notes.length : items.length;

  return <div className="inspiration-v3">
    <div className="inspiration-portals" role="tablist" aria-label="灵感库空间" onTouchStart={(event) => event.stopPropagation()} onTouchEnd={(event) => event.stopPropagation()}>
      {spaces.map((item) => { const Icon = item.icon; const count = item.id === "我的笔记" ? notes.length : items.length; return <motion.button whileHover={{ y: -3 }} whileTap={{ scale: .985 }} role="tab" aria-selected={space === item.id} className={space === item.id ? "active" : ""} key={item.id} onClick={() => switchSpace(item.id)}><span><Icon size={20}/></span><i><strong>{item.label}</strong><small>{item.description}</small></i><b>{String(count).padStart(2, "0")}</b></motion.button>; })}
    </div>

    <div className="library-toolbar">
      <div className="inline-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={space === "我的笔记" ? "全文搜索标题、正文或标签" : "搜索标题、来源、链接或分类"}/></div>
      {space === "我的笔记" ? <div className="category-chips note-tag-filter"><button className={selectedTag === "全部" ? "active" : ""} onClick={() => setSelectedTag("全部")}>全部</button>{tags.map((tag) => <button className={selectedTag === tag ? "active" : ""} key={tag} onClick={() => setSelectedTag(tag)}>#{tag}</button>)}</div> : <div className="category-chips"><button className={categoryId === "全部" ? "active" : ""} onClick={() => setCategoryId("全部")}>全部 <b>{items.length}</b></button>{categories.map((item) => <button className={categoryId === item.id ? "active" : ""} key={item.id} onClick={() => setCategoryId(item.id)}>{item.name} <b>{items.filter((entry) => entry.categoryId === item.id).length}</b></button>)}</div>}
      <div className="library-actions">{space === "我的笔记" ? <button className="ghost-compact" onClick={() => setTagManagerOpen(!tagManagerOpen)}><Tags size={15}/>标签</button> : <button className="ghost-compact" onClick={() => setCategoryManagerOpen(!categoryManagerOpen)}><FolderCog size={15}/>分类</button>}<button className="primary-compact" onClick={() => space === "我的笔记" ? openNewNote() : setFormOpen(!formOpen)}><Plus size={15}/>{space === "我的笔记" ? "新建笔记" : "收藏灵感"}</button></div>
    </div>

    <AnimatePresence>{notice && <motion.div className={`inspiration-notice ${notice.tone}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><span>{notice.tone === "error" ? <AlertTriangle/> : <Bookmark/>}{notice.text}</span><button onClick={() => setNotice(null)}>知道了</button></motion.div>}</AnimatePresence>

    <AnimatePresence initial={false}>
      {categoryManagerOpen && space !== "我的笔记" && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="category-manager"><header><FolderCog/><span><strong>灵感分类</strong><small>分类由你创建、命名与排序，仅属于当前账户。</small></span></header><div className="category-manager-list">{categories.length ? categories.map((item, index) => { const count = items.filter((entry) => entry.categoryId === item.id).length; return <article key={item.id}><input value={item.name} aria-label={`修改分类 ${item.name}`} onChange={(event) => renameCategory(item.id, event.target.value)}/><b>{count}</b><button disabled={index === 0} onClick={() => moveCategory(item.id, "up")} aria-label={`上移分类 ${item.name}`} title="上移"><ArrowUp/></button><button disabled={index === categories.length - 1} onClick={() => moveCategory(item.id, "down")} aria-label={`下移分类 ${item.name}`} title="下移"><ArrowDown/></button><button onClick={() => { deleteCategory(item.id); if (categoryId === item.id) setCategoryId("全部"); }} aria-label={`删除分类 ${item.name}`} title="删除"><Trash2/></button></article>; }) : <p className="category-empty">还没有分类，从右侧创建第一个。</p>}</div><label><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} onKeyDown={(event) => { if (shouldSubmitOnEnter(event.nativeEvent)) addNewCategory(); }} placeholder="创建新的灵感分类"/><button onClick={addNewCategory}><Plus/>添加分类</button></label></motion.div>}
      {tagManagerOpen && space === "我的笔记" && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="tag-manager"><div><Tags size={17}/><strong>标签管理</strong><small>点击标签名称即可修改，相关记录会同步更新。</small></div><div className="tag-editor-list">{tags.map((tag) => <input key={tag} defaultValue={tag} aria-label={`修改标签 ${tag}`} onBlur={(event) => renameTag(tag, event.target.value)}/>)}</div><label><input value={newTag} onChange={(event) => setNewTag(event.target.value)} onKeyDown={(event) => { if (shouldSubmitOnEnter(event.nativeEvent)) addNewTag(); }} placeholder="创建新标签"/><button onClick={addNewTag}><Plus size={15}/>添加</button></label></motion.div>}

      {formOpen && space !== "我的笔记" && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}><form onSubmit={(event) => { event.preventDefault(); void submitExternal(); }}><Panel className="inspiration-form simplified"><header><span><Bookmark/><i><strong>收藏灵感</strong><small>粘贴分享内容，自动识别来源、标题与封面</small></i></span><em><Globe2/>支持抖音 · 小红书 · 普通网页</em></header><div className="simplified-fields capture-fields"><label>分享内容或链接<textarea value={form.sourceText} onChange={(event) => setForm({ ...form, sourceText: event.target.value })} placeholder="粘贴抖音、小红书或网页链接"/></label><label>分类<select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">未分类</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div><div className={`capture-status ${captureState}`}>{captureState === "loading" ? "正在解析封面…" : captureState === "ready" && capture ? <>{`已识别${inspirationSourceLabel(capture.platform)} · ${capture.coverType === "fallback" ? "暂未获取真实封面" : "已获取真实封面"}`}</> : captureState === "error" ? captureError : "粘贴后将自动解析"}</div>{captureState === "ready" && capture && <div className="capture-preview"><img src={capture.cover} alt="解析后的内容封面"/><span><strong>{capture.title}</strong><small>{capture.coverType === "fallback" ? "默认封面 · 保存后可重新解析" : "真实内容封面"}</small></span></div>}<button type="submit" className="primary-button" disabled={captureState === "loading"}><Bookmark size={16}/>{captureState === "loading" ? "正在解析封面…" : "保存到灵感库"}</button></Panel></form></motion.div>}

      {formOpen && space === "我的笔记" && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}><Panel className="note-composer"><header><div><span>THOUGHT COMPOSER</span><strong>{editingId ? "继续打磨这段思考" : "捕捉此刻正在发生的想法"}</strong></div><small>{richTextWordCount(draft.content)} 字</small></header><input className="note-title-input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="为这条思考写一个标题…"/><div className="rich-toolbar" aria-label="文字格式工具栏"><button onClick={() => format("bold")} title="加粗"><Bold size={16}/></button><button onClick={() => format("italic")} title="斜体"><Italic size={16}/></button><span/><button onClick={() => format("formatBlock", "p")} title="段落">¶</button><button onClick={() => format("formatBlock", "blockquote")} title="引用"><Quote size={16}/></button><button onClick={() => format("insertUnorderedList")} title="无序列表"><List size={16}/></button><button onClick={() => format("insertOrderedList")} title="有序列表"><ListOrdered size={16}/></button></div><div ref={editorRef} className="rich-editor" contentEditable suppressContentEditableWarning data-placeholder="写下灵感、摘录、金句或尚未成形的创作草稿…" onInput={(event) => { const content = event.currentTarget.innerHTML; setDraft((current) => ({ ...current, content })); }}/><div className="composer-tags"><span>标签</span><div>{tags.map((tag) => <button className={draft.tags.includes(tag) ? "active" : ""} key={tag} onClick={() => setDraft({ ...draft, tags: draft.tags.includes(tag) ? draft.tags.filter((item) => item !== tag) : [...draft.tags, tag] })}>#{tag}</button>)}</div></div><footer><button className="ghost-compact" onClick={() => setFormOpen(false)}>暂不保存</button><button className="primary-button" onClick={saveNote}><BookOpenText size={16}/>{editingId ? "保存修改" : "存入思想库"}</button></footer></Panel></motion.div>}
    </AnimatePresence>

    <AnimatePresence mode="wait">
      {space !== "我的笔记" ? <motion.div key={space} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}><Panel className="inspiration-group single-space"><div className="group-heading"><span><img src="/assets/inspiration-orbit.png" alt=""/><i><strong>收藏灵感</strong><small>{visibleItems.length} 条内容 · 来源自动识别，分类由你管理</small></i></span><b>{items.filter((item) => item.saved).length} SAVED</b></div>{visibleItems.length ? <div className="inspiration-cards v61">{visibleItems.map((item) => { const href = normalizeExternalUrl(item.url); const category = item.categoryName || categoryNames.get(item.categoryId) || "未分类"; const canRefreshCover = needsInspirationCoverRefresh(item); return <article key={item.id}><a className="inspiration-card-link" href={href ?? undefined} target={href ? "_blank" : undefined} rel={href ? "noopener noreferrer" : undefined} aria-label={`打开原始链接：${item.title}`} onClick={(event) => { if (!href) { event.preventDefault(); setNotice({ tone: "error", text: "这条收藏的链接已失效，请删除后重新收藏。" }); } }}/><div className="inspiration-cover"><InspirationCoverImage item={item}/><span>{href ? <><ExternalLink/>打开原始页面</> : <><AlertTriangle/>链接已失效</>}</span></div><div><strong>{item.title}</strong><small className="inspiration-card-meta"><span>来源：{inspirationSourceLabel(item.platform)}</span><span>{category}</span><span>{item.author || linkHost(item.url)}</span></small>{item.aiTags.length > 0 && <p className="inspiration-ai-tags">{item.aiTags.map((tag) => `#${tag}`).join(" · ")}</p>}<footer><time>{item.createdAt.slice(5)}</time>{canRefreshCover && <button className="cover-refresh" disabled={Boolean(reparsingId)} onClick={() => void refreshCover(item)} title="重新解析封面"><RefreshCw className={reparsingId === item.id ? "spinning" : ""} size={14}/>{reparsingId === item.id ? "解析中" : "重新解析封面"}</button>}<button className={item.saved ? "saved" : ""} onClick={() => toggle(item.id)}><Bookmark size={15}/>{item.saved ? "已收藏" : "收藏"}</button><button onClick={() => remove(item.id)} aria-label={`删除${item.title}`}><Trash2 size={14}/></button></footer></div></article>; })}</div> : <EmptyState>还没有匹配的收藏灵感。粘贴抖音、小红书分享文本或网页链接，开始建立你的灵感库。</EmptyState>}</Panel></motion.div> : <motion.div key="我的笔记" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}><div className="note-space-heading"><div><span>PRIVATE THOUGHT ARCHIVE</span><h2>我的笔记</h2><p>收藏自己的思想，比收藏世界更接近创造。</p></div><aside><strong>{String(currentCount).padStart(2, "0")}</strong><small>条思想资产</small></aside></div>{visibleNotes.length ? <div className="note-card-grid">{visibleNotes.map((note) => <motion.article layout whileHover={{ y: -4 }} className={note.pinned ? "pinned" : ""} key={note.id}><header><div>{note.pinned && <span><Pin size={12}/>置顶</span>}{note.favorite && <span><Bookmark size={12}/>收藏</span>}</div><time>{formatDate(note.createdAt)}</time></header><h3>{note.title}</h3><div className="note-preview" dangerouslySetInnerHTML={{ __html: sanitizeRichText(note.content) }}/><div className="note-card-tags">{note.tags.map((tag) => <button key={tag} onClick={() => setSelectedTag(tag)}>#{tag}</button>)}</div><footer><span>{richTextWordCount(note.content)} 字 · {note.updatedAt !== note.createdAt ? "已编辑" : "初稿"}</span><div><button className={note.pinned ? "active" : ""} onClick={() => togglePinned(note.id)} aria-label={note.pinned ? "取消置顶" : "置顶"}><Pin size={15}/></button><button className={note.favorite ? "active" : ""} onClick={() => toggleFavorite(note.id)} aria-label={note.favorite ? "取消收藏" : "收藏"}><Bookmark size={15}/></button><button onClick={() => openEditNote(note)} aria-label="编辑"><Edit3 size={15}/></button><button onClick={() => { if (window.confirm(`确定删除「${note.title}」吗？`)) deleteNote(note.id); }} aria-label="删除"><Trash2 size={15}/></button></div></footer></motion.article>)}</div> : <EmptyState>没有找到相关笔记。换个关键词，或写下第一条想法。</EmptyState>}</motion.div>}
    </AnimatePresence>
  </div>;
}
