import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CalendarClock, Check, CheckCircle2, ChevronDown, Filter, Plus, Tag, Target, Trash2 } from "lucide-react";
import { Panel, PanelTitle, ProgressRing } from "../components/ui";
import type { Priority, TodoCategory } from "../data/types";
import { todoStats } from "../services/analytics";
import { todayISO } from "../services/date";
import { shouldSubmitOnEnter } from "../services/ime";
import { getTodayTasks, todoTimingFromStart } from "../services/todoSelectors";
import { useWorkspaceStore } from "../store/workspaceStore";

const categories: Array<"全部" | TodoCategory> = ["全部", "工作", "学习", "生活"];
const priorities: Priority[] = ["高", "中", "低"];

export function TodoPage() {
  const todos = useWorkspaceStore((state) => state.todos);
  const addTodo = useWorkspaceStore((state) => state.addTodo);
  const toggleTodo = useWorkspaceStore((state) => state.toggleTodo);
  const deleteTodo = useWorkspaceStore((state) => state.deleteTodo);
  const clearCompleted = useWorkspaceStore((state) => state.clearCompletedTodos);
  const [filter, setFilter] = useState<(typeof categories)[number]>("全部");
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TodoCategory>("工作");
  const [priority, setPriority] = useState<Priority>("中");
  const [startAt, setStartAt] = useState(`${todayISO()}T09:00`);
  const [deadline, setDeadline] = useState(`${todayISO()}T10:00`);
  const stats = todoStats(todos);
  const todayTasks = getTodayTasks(todos, todayISO());
  const todayStats = todoStats(todayTasks);
  const visible = useMemo(() => todos.filter((todo) => filter === "全部" || todo.category === filter).sort((a,b) => Number(a.done) - Number(b.done) || a.deadline.localeCompare(b.deadline)), [todos, filter]);

  const submit = () => {
    if (!title.trim()) return;
    addTodo({ title: title.trim(), category, priority, ...todoTimingFromStart(startAt, deadline, todayISO()) });
    setTitle("");
    setComposerOpen(false);
  };

  return (
    <div className="todo-layout page-grid">
      <div className="todo-aside">
        <Panel><PanelTitle icon={Target}>任务进度</PanelTitle><div className="center-ring"><ProgressRing value={todayStats.progress} label="今日进度" /><p>{todayStats.done}/{todayStats.total} 已完成</p></div></Panel>
        <Panel><PanelTitle icon={CheckCircle2}>实时概览</PanelTitle><div className="metric-row"><span><b>{stats.done}</b>已完成</span><span><b>{stats.pending}</b>待完成</span><span><b>{todos.filter((item) => item.priority === "高" && !item.done).length}</b>高优先级</span><span><b>{todayTasks.length}</b>今日任务</span></div></Panel>
        <Panel><PanelTitle icon={Filter}>任务分类</PanelTitle><div className="filter-stack">{categories.map((item) => <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}><Tag size={15}/>{item}<span>{item === "全部" ? todos.length : todos.filter((todo) => todo.category === item).length}</span></button>)}</div></Panel>
      </div>
      <Panel className="task-panel">
        <PanelTitle icon={CalendarClock} action={<button className="primary-compact" onClick={() => setComposerOpen(!composerOpen)}><Plus size={15}/>新任务</button>}>任务时间线</PanelTitle>
        <AnimatePresence>{composerOpen && <motion.div className="advanced-composer" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}><label className="composer-title">任务名称<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (shouldSubmitOnEnter(event.nativeEvent)) submit(); }} placeholder="下一件值得完成的事" /></label><div className="composer-fields"><label>分类<select value={category} onChange={(event) => setCategory(event.target.value as TodoCategory)}><option>工作</option><option>学习</option><option>生活</option></select></label><label>优先级<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>{priorities.map((item) => <option key={item}>{item}</option>)}</select></label><label>开始时间<input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} /></label><label>截止时间<input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label></div><div className="composer-actions"><button className="text-action" onClick={() => setComposerOpen(false)}>取消</button><button className="primary-button" onClick={submit}>保存任务 <ArrowRight size={15}/></button></div></motion.div>}</AnimatePresence>
        <div className="task-list v2">{visible.map((todo) => <motion.div layout key={todo.id} className={`task-row v2 ${todo.done ? "done" : ""}`}><button className="task-check" aria-label={todo.done ? `取消完成${todo.title}` : `完成${todo.title}`} onClick={() => toggleTodo(todo.id)}>{todo.done ? <Check size={14}/> : null}</button><div className="task-main"><strong>{todo.title}</strong><small>{todo.startAt.slice(11,16)} → {todo.deadline.slice(11,16)}</small></div><span className={`priority priority-${todo.priority}`}>{todo.priority}</span><span className="task-tag">{todo.category}</span><time>{todo.deadline.slice(5,10)}</time><button className="delete-button" aria-label={`删除${todo.title}`} onClick={() => deleteTodo(todo.id)}><Trash2 size={17}/></button></motion.div>)}</div>
        {!visible.length && <div className="empty-state">这个分类还没有任务。</div>}
        <button className="quick-add" onClick={() => setComposerOpen(true)}><Plus size={17}/>添加带分类、优先级和时间的新任务<ChevronDown size={15}/></button>
        <div className="task-summary"><span>{stats.total} 个任务　|　已完成 {stats.done} 个　|　待完成 {stats.pending} 个</span><button onClick={clearCompleted}><Trash2 size={14}/>清除已完成</button></div>
      </Panel>
    </div>
  );
}
