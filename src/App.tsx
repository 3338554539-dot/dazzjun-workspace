import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { AppShell, type PageKey } from "./components/Shell";
import { AIWorkspacePage, EnglishPage, FitnessPage, InspirationPage, LearningPage, MoodPage, OverviewPage, TodoPage, WeeklyPage } from "./pages";
import { useWorkspaceStore } from "./store/workspaceStore";

const pages: Record<PageKey, React.ComponentType> = {
  overview: OverviewPage,
  todo: TodoPage,
  mood: MoodPage,
  learning: LearningPage,
  english: EnglishPage,
  fitness: FitnessPage,
  weekly: WeeklyPage,
  inspiration: InspirationPage,
  ai: AIWorkspacePage,
};

const pageFromLocation = (): PageKey => {
  const page = window.location.pathname === "/ai-core" ? "ai" : "overview";
  console.info(`[ROUTER]\naction: resolve\npathname: ${window.location.pathname}\npage: ${page}\nloginRedirect: false\ntime: ${new Date().toISOString()}`);
  return page;
};
const pathForPage = (page: PageKey) => page === "ai" ? "/ai-core" : "/";

export function App() {
  const [active, setActive] = useState<PageKey>(pageFromLocation);
  const recordUsage = useWorkspaceStore((state) => state.recordUsage);
  const touchStart = useRef<number | null>(null);
  const Page = pages[active];
  const swipePages: PageKey[] = ["overview", "todo", "mood", "learning", "english", "fitness", "weekly", "inspiration"];
  useEffect(() => { recordUsage(active); }, [active, recordUsage]);
  useEffect(() => {
    const restorePage = () => {
      console.info(`[ROUTER]\naction: popstate\npathname: ${window.location.pathname}\nloginRedirect: false\ntime: ${new Date().toISOString()}`);
      setActive(pageFromLocation());
    };
    window.addEventListener("popstate", restorePage);
    return () => window.removeEventListener("popstate", restorePage);
  }, []);
  const navigate = (page: PageKey) => {
    setActive(page);
    const path = pathForPage(page);
    console.info(`[ROUTER]\naction: navigate\nfrom: ${window.location.pathname}\nto: ${path}\nloginRedirect: false\ntime: ${new Date().toISOString()}`);
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
  };
  const handleSwipe = (endX: number) => {
    if (touchStart.current === null) return;
    const delta = endX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) < 70) return;
    const index = swipePages.indexOf(active);
    const next = delta < 0 ? Math.min(swipePages.length - 1, index + 1) : Math.max(0, index - 1);
    navigate(swipePages[next]);
  };

  return (
    <AppShell active={active} onNavigate={navigate}>
      <AnimatePresence mode="wait">
        <motion.div key={active} className="page-transition" onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }} onTouchEnd={(event) => handleSwipe(event.changedTouches[0].clientX)} initial={{ opacity: 0, y: 12, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8, filter: "blur(6px)" }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
          <Page />
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
