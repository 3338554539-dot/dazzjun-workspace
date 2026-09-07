import { useMemo } from "react";
import { useWorkspaceStore } from "../store/workspaceStore";
import { englishMinutesThisWeek, englishStreak, fitnessThisWeek, growthMetrics, habitStreak, latestMood, learningMinutesThisWeek, todoStats, yearOverview } from "../services/analytics";
import { todayISO, weekMeta } from "../services/date";
import { getTodayTasks } from "../services/todoSelectors";

export function useWorkspaceStats() {
  const todos = useWorkspaceStore((state) => state.todos);
  const moods = useWorkspaceStore((state) => state.moods);
  const learning = useWorkspaceStore((state) => state.learning);
  const english = useWorkspaceStore((state) => state.english);
  const fitness = useWorkspaceStore((state) => state.fitness);
  const weeklyReviews = useWorkspaceStore((state) => state.weeklyReviews);
  const inspirations = useWorkspaceStore((state) => state.inspirations);
  const inspirationNotes = useWorkspaceStore((state) => state.inspirationNotes);
  const habitCompletions = useWorkspaceStore((state) => state.habitCompletions);
  const goals = useWorkspaceStore((state) => state.goals);

  return useMemo(() => {
    const today = todayISO();
    const week = weekMeta();
    const review = weeklyReviews.find((item) => item.weekKey === week.weekKey);
    const habitData = { todos, learning, english, fitness, inspirationNotes, habitCompletions };
    const todayTasks = getTodayTasks(todos, today);
    return {
      todo: todoStats(todos),
      todayTodo: todoStats(todayTasks),
      todayTasks,
      moodToday: moods.find((item) => item.date === today),
      latestMood: latestMood(moods),
      learningMinutes: learningMinutesThisWeek(learning),
      englishMinutes: englishMinutesThisWeek(english),
      englishStreak: englishStreak(english),
      fitness: fitnessThisWeek(fitness),
      inspirationSaved: inspirations.filter((item) => item.saved).length + inspirationNotes.filter((note) => note.favorite).length,
      inspirationToday: inspirations.filter((item) => item.createdAt.slice(0, 10) === today).length + inspirationNotes.filter((note) => note.createdAt.slice(0, 10) === today).length,
      inspirationMonth: inspirations.filter((item) => item.createdAt.slice(0, 7) === today.slice(0, 7)).length + inspirationNotes.filter((note) => note.createdAt.slice(0, 7) === today.slice(0, 7)).length,
      growth: growthMetrics({ todos, learning, english, fitness, moods }),
      habitStreaks: {
        reading: habitStreak("reading", habitData),
        english: habitStreak("english", habitData),
        fitness: habitStreak("fitness", habitData),
        writing: habitStreak("writing", habitData),
        sleep: habitStreak("sleep", habitData),
      },
      year: yearOverview({ todos, learning, english, fitness, inspirationNotes, habitCompletions, inspirations }),
      currentWeek: week,
      reviewCompletion: review ? [review.completed, review.obstacles, review.improvements, review.highlights].filter(Boolean).length : 0,
      goals,
    };
  }, [todos, moods, learning, english, fitness, weeklyReviews, inspirations, inspirationNotes, habitCompletions, goals]);
}
