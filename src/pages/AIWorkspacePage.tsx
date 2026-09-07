import { AnimatePresence, motion } from "framer-motion";
import { Activity, BrainCircuit, Check, Compass, Database, MessageCircle, RefreshCw, Send, ShieldCheck, Sparkles, UserRound, WandSparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { aiCoreClient, type AICoreStatus, type AIContextAuthorization, type AIConversationMessage } from "../ai/client";
import { AIMemoryPanel } from "../components/AIMemoryPanel";
import { Panel, PanelTitle } from "../components/ui";
import { shouldSubmitOnEnter } from "../services/ime";

interface WelcomeMessage {
  id: string;
  role: "assistant";
  content: string;
  createdAt: string;
}

interface DailyInsight {
  summary: string;
  statusAnalysis: string;
  growthAdvice: string;
}

const welcomeMessage: WelcomeMessage = {
  id: "welcome",
  role: "assistant",
  content: "我在这里。你可以和我梳理今天的节奏、一个迟迟没有推进的问题，或刚出现的创意。",
  createdAt: new Date().toISOString(),
};

const promptSuggestions = ["帮我梳理今天的优先级", "最近的状态有什么变化？", "给我一个可执行的成长建议"];

export function AIWorkspacePage() {
  const [activeView, setActiveView] = useState<"assistant" | "memory">("assistant");
  const [status, setStatus] = useState<AICoreStatus | null>(null);
  const [contextAuthorization, setContextAuthorization] = useState<AIContextAuthorization | null>(null);
  const [authorizationSaving, setAuthorizationSaving] = useState(false);
  const [messages, setMessages] = useState<(AIConversationMessage | WelcomeMessage)[]>([welcomeMessage]);
  const [draft, setDraft] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [insight, setInsight] = useState<DailyInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);
  const contextAuthorized = contextAuthorization?.authorized ?? true;

  useEffect(() => {
    let active = true;
    aiCoreClient.status()
      .then((result) => { if (active) setStatus(result); })
      .catch(() => { if (active) setStatus(null); });
    aiCoreClient.contextAuthorization()
      .then((result) => { if (active) setContextAuthorization(result); })
      .catch(() => { if (active) setContextAuthorization(null); });
    aiCoreClient.conversation()
      .then((result) => { if (active) setMessages(result.messages.length ? result.messages : [welcomeMessage]); })
      .catch((error) => { if (active) setChatError(error instanceof Error ? error.message : "历史对话暂时无法读取"); });
    aiCoreClient.todayInsight()
      .then((result) => { if (active) setInsight(result.insight); })
      .catch((error) => { if (active) setInsightError(error instanceof Error ? error.message : "今日洞察暂时无法读取"); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const updateContextConsent = async (authorized: boolean) => {
    if (authorizationSaving) return;
    const previous = contextAuthorization;
    setContextAuthorization({ authorized, authorizedAt: previous?.authorizedAt ?? null, updatedAt: previous?.updatedAt ?? null });
    setAuthorizationSaving(true);
    setChatError("");
    try {
      const result = await aiCoreClient.setContextAuthorization(authorized);
      setContextAuthorization(result);
    } catch (error) {
      setContextAuthorization(previous);
      setChatError(error instanceof Error ? error.message : "个人上下文设置保存失败");
    } finally {
      setAuthorizationSaving(false);
    }
  };

  const sendMessage = async (suggestion?: string) => {
    const message = (suggestion ?? draft).trim();
    if (!message || sending) return;
    setSending(true);
    setChatError("");
    setDraft("");
    try {
      const result = await aiCoreClient.sendConversation(message, "daily_assistant", contextAuthorized);
      setMessages((current) => [...current.filter((item) => item.id !== "welcome"), ...result.messages]);
    } catch (error) {
      setDraft(message);
      setChatError(error instanceof Error ? error.message : "AI Core 暂时无法回应");
    } finally {
      setSending(false);
    }
  };

  const generateDailyInsight = async () => {
    if (insightLoading || !contextAuthorized || !status?.configured) return;
    setInsightLoading(true);
    setInsightError("");
    try {
      const result = await aiCoreClient.generateTodayInsight();
      setInsight(result.insight);
    } catch (error) {
      setInsightError(error instanceof Error ? error.message : "今日洞察生成失败");
    } finally {
      setInsightLoading(false);
    }
  };

  return <div className="intelligence-space ai-core-product">
    <section className="intelligence-hero ai-core-hero">
      <div className="ai-core-welcome"><span>DAZZJUN AI · PERSONAL OS</span><h1>你的个人智能系统</h1><p>理解你的当下，记录每一次成长，在需要时给出清晰而克制的行动建议。</p><div className="ai-core-pillars"><span><Compass size={16}/>理解状态</span><span><Activity size={16}/>记录成长</span><span><WandSparkles size={16}/>辅助行动</span></div></div>
      <aside><i className={status?.configured ? "online" : ""}/><strong>Dazzjun AI Core</strong><small>{status ? status.configured ? `${status.provider} · ${status.model}` : "DeepSeek 尚未配置" : "正在确认服务状态"}</small></aside>
    </section>

    <section className="ai-core-awareness" aria-label="当前状态感知">
      <header><Activity size={20}/><span><strong>当前状态感知</strong><small>你的工作台正在以最小范围连接 AI Core</small></span></header>
      <div className="ai-awareness-signals">
        <span className="signal-normal"><i/><strong>账户空间</strong><small>当前账户独立读取</small></span>
        <span className="signal-growth"><i/><strong>成长记录</strong><small>短程状态与长期记忆已连接</small></span>
        <span className="signal-attention"><i/><strong>会话权限</strong><small>{contextAuthorized ? "个人上下文已开启" : "个人上下文已关闭"}</small></span>
      </div>
    </section>

    <nav className="ai-core-tabs" aria-label="AI Core 工作模式">
      <button className={activeView === "assistant" ? "active" : ""} onClick={() => setActiveView("assistant")}><MessageCircle size={18}/><span><strong>AI Assistant</strong><small>短程状态与当前任务</small></span></button>
      <button className={activeView === "memory" ? "active" : ""} onClick={() => setActiveView("memory")}><Database size={18}/><span><strong>Dazzjun Memory</strong><small>由你管理的长期记忆</small></span></button>
    </nav>

    {activeView === "assistant" ? <>
    <label className="ai-context-consent"><input type="checkbox" checked={contextAuthorized} disabled={authorizationSaving} onChange={(event) => updateContextConsent(event.target.checked)}/><span><strong>使用个人上下文</strong><small>{contextAuthorized ? "仅使用当前账户必要的成长记录与受控长期记忆。" : "个人上下文已关闭"}</small></span><b>{contextAuthorized ? "已开启" : "已关闭"}</b></label>

    <div className="ai-product-grid">
      <Panel className="ai-chat-workspace">
        <PanelTitle icon={MessageCircle} action={<span className="ai-live-state"><i/>{sending ? "正在思考..." : "已就绪"}</span>}>AI Assistant</PanelTitle>
        <p className="ai-section-intro">和 Dazzjun 一起梳理问题、理解状态，把复杂的想法整理成下一步。</p>
        <div className="ai-chat-feed" ref={feedRef} aria-live="polite">
          <AnimatePresence initial={false}>
            {messages.map((message) => <motion.article className={`ai-message ${message.role}`} key={message.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <span className="ai-message-avatar">{message.role === "assistant" ? <BrainCircuit size={16}/> : <UserRound size={15}/>}</span>
              <div><header><strong>{message.role === "assistant" ? "Dazzjun" : "你"}</strong><time>{new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))}</time></header><p>{message.content}</p></div>
            </motion.article>)}
          </AnimatePresence>
          {sending && <motion.div className="ai-thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><BrainCircuit size={15}/><span><i/><i/><i/></span><small>正在思考...</small></motion.div>}
        </div>
        <div className="ai-prompt-suggestions">{promptSuggestions.map((prompt) => <button key={prompt} disabled={sending} onClick={() => sendMessage(prompt)}><Sparkles size={12}/>{prompt}</button>)}</div>
        {chatError && <p className="ai-core-error">{chatError}</p>}
        <form className="ai-composer" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
          <textarea value={draft} disabled={sending} maxLength={4000} rows={2} onCompositionStart={() => setIsComposing(true)} onCompositionEnd={(event) => { setIsComposing(false); setDraft(event.currentTarget.value); }} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (shouldSubmitOnEnter(event.nativeEvent, isComposing)) { event.preventDefault(); sendMessage(); } }} placeholder="写下此刻想梳理的事..." aria-label="发送给 Dazzjun AI Assistant 的消息"/>
          <button type="submit" disabled={!draft.trim() || sending} aria-label="发送消息" title="发送"><Send size={17}/></button>
        </form>
      </Panel>

      <aside className="ai-insight-column">
        <Panel className="daily-ai-insight">
          <PanelTitle icon={WandSparkles} action={<time>{new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date())}</time>}>Intelligence Report</PanelTitle>
          {!insight && !insightLoading && <div className="daily-insight-empty"><span><Activity size={24}/></span><strong>从今天的记录中看见自己</strong><p>由当前账户的任务、心情、学习、英语、健身和灵感记录生成。</p><button disabled={!contextAuthorized || !status?.configured} onClick={generateDailyInsight}><Sparkles size={14}/>{contextAuthorized ? "生成今日洞察" : "需要开启个人上下文"}</button></div>}
          {insightLoading && <div className="daily-insight-loading"><span><BrainCircuit size={24}/></span><strong>正在连接今日轨迹</strong><small>整理六类近期记录...</small></div>}
          {insight && <motion.div className="daily-insight-result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <section><i/><div><strong>今日总结</strong><p>{insight.summary || "本次没有生成总结。"}</p></div></section>
            <section><i/><div><strong>状态分析</strong><p>{insight.statusAnalysis || "本次回复未单独提供状态分析。"}</p></div></section>
            <section><i/><div><strong>成长建议</strong><p>{insight.growthAdvice || "本次回复未单独提供成长建议。"}</p></div></section>
            <button className="insight-refresh" onClick={generateDailyInsight} disabled={insightLoading}><RefreshCw size={13}/>重新生成</button>
          </motion.div>}
          {insightError && <p className="ai-core-error">{insightError}</p>}
        </Panel>

        <Panel className="ai-privacy-panel">
          <PanelTitle icon={ShieldCheck}>隐私与边界</PanelTitle>
          <div><Check size={14}/><span><strong>当前账户隔离</strong><small>上下文由 Worker 按登录会话读取</small></span></div>
          <div><Check size={14}/><span><strong>最小数据范围</strong><small>仅发送六类近期记录的必要摘要</small></span></div>
          <div><Check size={14}/><span><strong>长期记忆受控</strong><small>只使用你主动保存且未删除的 Memory</small></span></div>
        </Panel>
      </aside>
    </div></> : <AIMemoryPanel/>}
  </div>;
}
