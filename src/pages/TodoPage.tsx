import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Check, CheckCircle2, Clock3, Filter, Flag, Plus, Tag, Trash2, X } from "lucide-react";
import type { Priority, TodoCategory } from "../data/types";
import { todoStats } from "../services/analytics";
import { isBetween, todayISO, weekMeta } from "../services/date";
import { shouldSubmitOnEnter } from "../services/ime";
import { getTodayTasks, todoTimingFromStart } from "../services/todoSelectors";
import { useWorkspaceStore } from "../store/workspaceStore";
import { useWorkspaceNavigation } from "../components/workspace/WorkspaceNavigation";

const categories: Array<"全部" | TodoCategory> = ["全部", "工作", "学习", "生活"];
const priorities: Priority[] = ["高", "中", "低"];
type Scope = "all" | "today" | "week" | "completed" | "date";

export function TodoPage() {
  const { params } = useWorkspaceNavigation();
  const todos = useWorkspaceStore((state) => state.todos);
  const addTodo = useWorkspaceStore((state) => state.addTodo);
  const toggleTodo = useWorkspaceStore((state) => state.toggleTodo);
  const deleteTodo = useWorkspaceStore((state) => state.deleteTodo);
  const clearCompleted = useWorkspaceStore((state) => state.clearCompletedTodos);
  const [categoryFilter, setCategoryFilter] = useState<(typeof categories)[number]>("全部");
  const initialFilter = params.get("filter");
  const selectedDate = params.get("date") ?? "";
  const targetTaskId = params.get("taskId") ?? "";
  const [scope, setScope] = useState<Scope>(selectedDate ? "date" : ["all", "today", "week", "completed"].includes(initialFilter ?? "") ? initialFilter as Scope : "today");
  const [composerOpen, setComposerOpen] = useState(params.get("mode") === "new");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TodoCategory>("工作");
  const [priority, setPriority] = useState<Priority>("中");
  const today = todayISO();
  const taskDate = selectedDate || today;
  const [startAt, setStartAt] = useState(`${taskDate}T09:00`);
  const [deadline, setDeadline] = useState(`${taskDate}T10:00`);
  const targetRef = useRef<HTMLElement>(null);
  const week = weekMeta();
  const stats = todoStats(todos);
  const todayTasks = getTodayTasks(todos, today);
  const todayStats = todoStats(todayTasks);
  const highPriority = todayTasks.filter((item) => item.priority === "高" && !item.done).length;

  const visible = useMemo(() => todos.filter((todo) => {
    if (categoryFilter !== "全部" && todo.category !== categoryFilter) return false;
    if (scope === "today") return todo.scheduleDate === today;
    if (scope === "week") return isBetween(todo.scheduleDate, week.start, week.end);
    if (scope === "completed") return todo.done;
    if (scope === "date") return todo.scheduleDate === selectedDate;
    return true;
  }).sort((a,b) => Number(a.done) - Number(b.done) || a.scheduleDate.localeCompare(b.scheduleDate) || a.startAt.localeCompare(b.startAt)), [todos, categoryFilter, scope, today, week.start, week.end, selectedDate]);

  useEffect(() => { targetRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [targetTaskId]);

  const submit = () => {
    if (!title.trim()) return;
    addTodo({ title: title.trim(), category, priority, ...todoTimingFromStart(startAt, deadline, taskDate) });
    setTitle("");
    setComposerOpen(false);
  };

  const scopeItems: Array<{ id: Scope; label: string; count: number }> = [
    { id: "all", label: "全部任务", count: todos.length },
    { id: "today", label: "今天", count: todayTasks.length },
    { id: "week", label: "本周", count: todos.filter((item) => isBetween(item.scheduleDate, week.start, week.end)).length },
    { id: "completed", label: "已完成", count: stats.done },
    ...(selectedDate ? [{ id: "date" as Scope, label: selectedDate === today ? "今天" : selectedDate.slice(5).replace("-", "月") + "日", count: todos.filter((item) => item.scheduleDate === selectedDate).length }] : []),
  ];

  return (
    <div className="os-todo-page">
      <section className="os-todo-context">
        <div><small>TODAY TASKS</small><strong>{todayTasks.length}</strong><span>今日安排</span></div>
        <div><small>PENDING</small><strong>{todayStats.pending}</strong><span>等待完成</span></div>
        <div><small>HIGH PRIORITY</small><strong>{highPriority}</strong><span>优先处理</span></div>
        <div className="os-todo-progress"><small>TODAY PROGRESS</small><strong>{todayStats.progress}<i>%</i></strong><p><span style={{ width: `${todayStats.progress}%` }}/></p></div>
      </section>

      <div className="os-todo-layout">
        <aside className="os-todo-filters">
          <header><Filter size={17}/><span>任务视图</span></header>
          <nav>{scopeItems.map((item) => <button key={item.id} className={scope === item.id ? "active" : ""} onClick={() => setScope(item.id)}><span>{item.label}</span><i>{item.count}</i></button>)}</nav>
          <header><Tag size={17}/><span>分类</span></header>
          <nav>{categories.map((item) => <button key={item} className={categoryFilter === item ? "active" : ""} onClick={() => setCategoryFilter(item)}><span>{item}</span><i>{item === "全部" ? todos.length : todos.filter((todo) => todo.category === item).length}</i></button>)}</nav>
        </aside>

        <section className="os-task-board">
          <header><div><small>{scope === "today" ? "TODAY" : scope === "week" ? "THIS WEEK" : scope === "completed" ? "ARCHIVE" : scope === "date" ? "SELECTED DATE" : "ALL TASKS"}</small><h2>{scopeItems.find((item) => item.id === scope)?.label}</h2></div><button className="os-new-task" onClick={() => setComposerOpen(true)}><Plus size={16}/>新任务</button></header>
          <div className="os-task-list">
            <AnimatePresence initial={false}>{visible.map((todo) => {
              const period = todo.scheduleDate < today ? "history" : todo.scheduleDate > today ? "future" : "today";
              return <motion.article ref={todo.id === targetTaskId ? targetRef : undefined} layout key={todo.id} data-task-id={todo.id} className={`os-task-row ${todo.done ? "done" : ""} ${period} ${todo.id === targetTaskId ? "targeted" : ""}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -10 }}>
                <button className="os-task-check" aria-label={todo.done ? `取消完成${todo.title}` : `完成${todo.title}`} onClick={() => toggleTodo(todo.id)}>{todo.done ? <Check size={13}/> : null}</button>
                <div className="os-task-copy"><strong>{todo.title}</strong><span><Clock3 size={12}/>{todo.startAt.slice(11,16)}<i>·</i><CalendarClock size={12}/>安排 {todo.scheduleDate.slice(5)}<i>·</i>截止 {todo.deadline.slice(5,10)}</span></div>
                <span className={`os-priority priority-${todo.priority}`}><Flag size={11}/>{todo.priority}</span><span className="os-task-category">{todo.category}</span>
                <button className="os-task-delete" aria-label={`删除${todo.title}`} onClick={() => deleteTodo(todo.id)}><Trash2 size={16}/></button>
              </motion.article>;
            })}</AnimatePresence>
            {!visible.length && <div className="os-task-empty"><CheckCircle2 size={24}/><strong>今天从什么开始？</strong><span>给今天安排一件真正值得完成的事。</span><button onClick={() => setComposerOpen(true)}><Plus size={14}/>创建今日任务</button></div>}
          </div>
          <footer><span>全部 {stats.total} · 已完成 {stats.done} · 待完成 {stats.pending}</span><button onClick={clearCompleted}><Trash2 size={14}/>清除已完成</button></footer>
        </section>
      </div>

      <AnimatePresence>{composerOpen && <motion.div className="os-drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setComposerOpen(false); }}>
        <motion.aside className="os-task-drawer" initial={{ x: 32, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }} transition={{ duration: .24, ease: [0.22,1,0.36,1] }}>
          <header><div><small>NEW TASK</small><h2>安排一项任务</h2></div><button onClick={() => setComposerOpen(false)}><X size={18}/></button></header>
          <div className="os-task-form"><label>任务名称<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (shouldSubmitOnEnter(event.nativeEvent)) submit(); }} placeholder="下一件值得完成的事"/></label><div><label>分类<select value={category} onChange={(event) => setCategory(event.target.value as TodoCategory)}><option>工作</option><option>学习</option><option>生活</option></select></label><label>优先级<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>{priorities.map((item) => <option key={item}>{item}</option>)}</select></label></div><label>计划执行时间<input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)}/><small>决定任务出现在“今日计划”的日期</small></label><label>最终截止时间<input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)}/><small>仅用于截止提醒与列表展示</small></label></div>
          <footer><button onClick={() => setComposerOpen(false)}>取消</button><button className="primary" onClick={submit} disabled={!title.trim()}>保存任务</button></footer>
        </motion.aside>
      </motion.div>}</AnimatePresence>
    </div>
  );
}
