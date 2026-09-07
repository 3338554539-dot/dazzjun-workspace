import { Brain, Fingerprint, Flag, HeartHandshake, Plus, Repeat2, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { aiCoreClient, type AIMemoryRecord, type AIMemoryType } from "../ai/client";
import { Panel, PanelTitle } from "./ui";

const memoryTypeMeta: Record<AIMemoryType, { label: string; description: string; icon: typeof Flag }> = {
  goal: { label: "长期目标", description: "持续追踪你真正想抵达的方向", icon: Flag },
  preference: { label: "用户偏好", description: "保留你的选择、风格与工作方式", icon: HeartHandshake },
  habit: { label: "行为习惯", description: "识别长期重复的节奏与模式", icon: Repeat2 },
  identity: { label: "个人信息", description: "由你明确保存的身份背景", icon: Fingerprint },
  insight: { label: "AI 洞察", description: "值得长期保留的总结与发现", icon: Sparkles },
};

const overviewTypes: AIMemoryType[] = ["goal", "preference", "habit", "insight"];
const memoryTypes: AIMemoryType[] = ["preference", "goal", "habit", "identity", "insight"];

export function AIMemoryPanel() {
  const [memories, setMemories] = useState<AIMemoryRecord[]>([]);
  const [memoryType, setMemoryType] = useState<AIMemoryType>("goal");
  const [content, setContent] = useState("");
  const [importance, setImportance] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    aiCoreClient.memories()
      .then((result) => { if (active) setMemories(result.memories); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "长期记忆暂时无法读取"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const counts = useMemo(() => Object.fromEntries(memoryTypes.map((type) => [type, memories.filter((memory) => memory.memoryType === type).length])) as Record<AIMemoryType, number>, [memories]);

  const addMemory = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = content.trim();
    if (!value || saving) return;
    setSaving(true); setError("");
    try {
      const result = await aiCoreClient.addMemory({ memoryType, content: value, importance });
      setMemories((current) => [result.memory, ...current]);
      setContent(""); setImportance(3);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "记忆保存失败");
    } finally {
      setSaving(false);
    }
  };

  const removeMemory = async (memory: AIMemoryRecord) => {
    if (!window.confirm(`删除这条${memoryTypeMeta[memory.memoryType].label}？此操作不会影响聊天记录。`)) return;
    setDeletingId(memory.id); setError("");
    try {
      await aiCoreClient.deleteMemory(memory.id);
      setMemories((current) => current.filter((item) => item.id !== memory.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "记忆删除失败");
    } finally {
      setDeletingId("");
    }
  };

  return <div className="ai-memory-workspace">
    <header className="ai-memory-heading">
      <span><Brain size={22}/></span>
      <div><small>MEMORY LAYER</small><h2>Dazzjun Memory</h2><p>只保存你明确选择留下的信息，让 AI 在长期使用中保持理解，而不是记录每一次对话。</p></div>
      <strong>{memories.length}<small>长期记忆</small></strong>
    </header>

    <section className="ai-memory-overview" aria-label="长期记忆分类概览">
      {overviewTypes.map((type) => { const meta = memoryTypeMeta[type]; const Icon = meta.icon; return <article key={type} className={`memory-type-${type}`}><Icon size={20}/><span><strong>{meta.label}</strong><small>{meta.description}</small></span><b>{counts[type]}</b></article>; })}
    </section>

    <div className="ai-memory-grid">
      <Panel className="ai-memory-create">
        <PanelTitle icon={Plus}>添加长期记忆</PanelTitle>
        <p className="ai-section-intro">Memory 只接受你主动保存的内容，不会自动收录任何聊天。</p>
        <form onSubmit={addMemory}>
          <label><span>记忆类型</span><select value={memoryType} onChange={(event) => setMemoryType(event.target.value as AIMemoryType)}>{memoryTypes.map((type) => <option key={type} value={type}>{memoryTypeMeta[type].label}</option>)}</select></label>
          <label><span>记忆内容</span><textarea value={content} maxLength={2000} rows={7} onChange={(event) => setContent(event.target.value)} placeholder="例如：我希望在今年完成一个可公开展示的个人作品集。"/></label>
          <label className="memory-importance"><span>重要程度 <b>{importance}</b></span><input type="range" min="1" max="5" step="1" value={importance} onChange={(event) => setImportance(Number(event.target.value))}/><small><i>日常参考</i><i>核心记忆</i></small></label>
          <footer><span><Fingerprint size={14}/>仅绑定当前账户</span><button type="submit" disabled={!content.trim() || saving}><Plus size={16}/>{saving ? "保存中" : "保存记忆"}</button></footer>
        </form>
      </Panel>

      <Panel className="ai-memory-archive">
        <PanelTitle icon={Brain} action={<span className="memory-count">{memories.length} 条</span>}>Memory Archive</PanelTitle>
        {error && <p className="ai-core-error" role="alert">{error}</p>}
        {loading ? <div className="ai-memory-empty"><Brain size={24}/><strong>正在读取 Memory Layer</strong><small>连接当前账户的长期记忆...</small></div> : memories.length === 0 ? <div className="ai-memory-empty"><Brain size={24}/><strong>Memory Layer 还是空的</strong><small>从一条长期目标或个人偏好开始。</small></div> : <div className="ai-memory-list">{memories.map((memory) => { const meta = memoryTypeMeta[memory.memoryType]; const Icon = meta.icon; return <article key={memory.id}><span className={`memory-kind memory-type-${memory.memoryType}`}><Icon size={14}/>{meta.label}</span><div><p>{memory.content}</p><footer><span>重要度 {memory.importance}/5</span><time dateTime={memory.updatedAt}>{new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(new Date(memory.updatedAt))}</time></footer></div><button type="button" disabled={deletingId === memory.id} onClick={() => removeMemory(memory)} aria-label={`删除${meta.label}`} title="删除记忆"><Trash2 size={16}/></button></article>; })}</div>}
      </Panel>
    </div>
  </div>;
}
