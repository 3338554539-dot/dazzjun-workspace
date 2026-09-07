const scopeKeys = {
  todos: "todos",
  moods: "moods",
  learning: "learning",
  english: "english",
  fitness: "fitness",
  weekly: "weeklyReviews",
  inspiration: "inspiration",
  memory: "memories",
};

const typeLabels = {
  daily: "今日洞察",
  weekly: "周成长报告",
  monthly: "月度趋势分析",
  annual: "年度成长档案",
  inspiration: "灵感内容分析",
  growth: "长期成长分析",
};

const recent = (value, limit = 80) => Array.isArray(value) ? value.slice(-limit) : [];

export function buildWorkspaceSnapshot(workspace, scopes) {
  const snapshot = {};
  for (const scope of scopes) {
    const key = scopeKeys[scope];
    if (!key) continue;
    if (scope === "inspiration") {
      snapshot.inspirations = recent(workspace.inspirations);
      snapshot.inspirationNotes = recent(workspace.inspirationNotes);
      snapshot.inspirationCategories = recent(workspace.inspirationCategories);
    } else snapshot[key] = recent(workspace[key]);
  }
  return snapshot;
}

export function buildDeepSeekMessages(type, workspace, scopes) {
  const snapshot = buildWorkspaceSnapshot(workspace, scopes);
  return [
    {
      role: "system",
      content: `你是 Dazzjun AI Core，一名克制、具体、尊重用户自主性的个人成长分析助手。请基于提供的数据生成${typeLabels[type] || "成长洞察"}。禁止虚构未提供的事实；数据不足时明确说明。只返回合法 JSON，不要 Markdown。JSON 格式必须为 {"title":"...","summary":"...","sections":[{"title":"...","content":"..."}]}，sections 为 3 到 6 项。`,
    },
    {
      role: "user",
      content: `分析日期：${new Date().toISOString()}\n已授权数据范围：${scopes.join(", ")}\n个人数据摘要：${JSON.stringify(snapshot)}`,
    },
  ];
}
