import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { AppShell, type PageKey } from "./components/Shell";
import type { WorkspaceNavigate, WorkspaceNavigationOptions } from "./components/workspace/WorkspaceNavigation";
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

const pagePaths: Record<PageKey, string> = {
  overview: "/",
  todo: "/todo",
  mood: "/mood",
  learning: "/learning",
  english: "/english",
  fitness: "/fitness",
  weekly: "/weekly",
  inspiration: "/inspiration",
  ai: "/ai-core",
};

const pageFromLocation = (): PageKey => {
  const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
  const page = (Object.entries(pagePaths).find(([, path]) => path === normalizedPath)?.[0] as PageKey | undefined) ?? "overview";
  console.info(`[ROUTER]\naction: resolve\npathname: ${window.location.pathname}\npage: ${page}\nloginRedirect: false\ntime: ${new Date().toISOString()}`);
  return page;
};
const pathForPage = (page: PageKey) => pagePaths[page];
const locationKey = () => `${window.location.pathname}${window.location.search}`;
const pathWithOptions = (page: PageKey, options?: WorkspaceNavigationOptions) => {
  const params = new URLSearchParams();
  Object.entries(options ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return `${pathForPage(page)}${query ? `?${query}` : ""}`;
};

export function App() {
  const [active, setActive] = useState<PageKey>(pageFromLocation);
  const [currentLocation, setCurrentLocation] = useState(locationKey);
  const recordUsage = useWorkspaceStore((state) => state.recordUsage);
  const touchStart = useRef<number | null>(null);
  const Page = pages[active];
  const swipePages: PageKey[] = ["overview", "todo", "mood", "learning", "english", "fitness", "weekly", "inspiration"];
  useEffect(() => { recordUsage(active); }, [active, recordUsage]);
  useEffect(() => {
    const restorePage = () => {
      console.info(`[ROUTER]\naction: popstate\npathname: ${window.location.pathname}\nloginRedirect: false\ntime: ${new Date().toISOString()}`);
      setActive(pageFromLocation());
      setCurrentLocation(locationKey());
    };
    window.addEventListener("popstate", restorePage);
    return () => window.removeEventListener("popstate", restorePage);
  }, []);
  const navigate: WorkspaceNavigate = (page, options) => {
    setActive(page);
    const path = pathWithOptions(page, options);
    console.info(`[ROUTER]\naction: navigate\nfrom: ${window.location.pathname}\nto: ${path}\nloginRedirect: false\ntime: ${new Date().toISOString()}`);
    if (locationKey() !== path) window.history.pushState({}, "", path);
    setCurrentLocation(path);
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
    <AppShell active={active} onNavigate={navigate} locationKey={currentLocation}>
      <AnimatePresence mode="wait">
        <motion.div key={currentLocation} className="page-transition" onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }} onTouchEnd={(event) => handleSwipe(event.changedTouches[0].clientX)} initial={{ opacity: 0, y: 8, filter: "blur(7px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -6, filter: "blur(5px)" }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
          <Page />
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
