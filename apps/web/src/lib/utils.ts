import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clampPercent(value: number, goal: number) {
  if (goal <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((value / goal) * 100));
}

export function formatCourseType(type: string) {
  const labels: Record<string, string> = {
    reading: "阅读",
    listening: "听力",
    grammar: "语法"
  };
  return labels[type] ?? type;
}

export function formatLevel(level: string | null | undefined) {
  return level ?? "未选择";
}

export function formatExerciseType(type: string) {
  const labels: Record<string, string> = {
    multiple_choice: "选择题",
    cloze: "填空题",
    translation: "翻译题"
  };
  return labels[type] ?? type;
}
