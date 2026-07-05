import type { CourseType } from "@english-learning/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Headphones, Library, PenTool } from "lucide-react";
import { LoadingState } from "@/components/LoadingState";
import { ProtectedPage } from "@/components/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatCourseType } from "@/lib/utils";
import { PageHeader } from "./VocabularyPage";
import { useState } from "react";

const typeIcons = {
  reading: Library,
  listening: Headphones,
  grammar: PenTool
} satisfies Record<CourseType, typeof Library>;

export function LessonsPage() {
  const [type, setType] = useState<CourseType | "">("");
  const lessons = useQuery({
    queryKey: ["lessons", type],
    queryFn: () => api.lessons(type ? { type } : undefined)
  });

  return (
    <ProtectedPage>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <PageHeader
            eyebrow="短课程"
            title="短课程给单词和语法提供真实语境。"
            description="阅读、听力、语法都保持轻量，目标是每天完成一节，不让课程压过复习。"
          />
          <Select value={type} onChange={(event) => setType(event.target.value as CourseType | "")}>
            <option value="">全部类型</option>
            <option value="reading">阅读</option>
            <option value="listening">听力</option>
            <option value="grammar">语法</option>
          </Select>
        </div>

        {lessons.isLoading ? (
          <LoadingState label="正在加载课程" />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {lessons.data?.lessons.map((lesson) => {
              const Icon = typeIcons[lesson.type];
              return (
                <Card
                  key={lesson.id}
                  className="bg-white/82 transition-[box-shadow,transform,border-color] duration-300 ease-[var(--ease-soft)] hover:-translate-y-1 hover:border-[color:var(--hairline-strong)] hover:shadow-[var(--shadow-lift)]"
                >
                  <CardContent className="flex h-full flex-col gap-5 pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-12 w-12 place-items-center rounded-full border border-[color:var(--hairline)] bg-[var(--surface-1)] shadow-[var(--shadow-soft)]">
                        <Icon className="h-5 w-5 text-[var(--action-strong)]" />
                      </span>
                      {lesson.completed ? (
                        <Badge className="text-[var(--success)]">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          已完成
                        </Badge>
                      ) : (
                        <Badge>{lesson.estimatedMinutes} 分钟</Badge>
                      )}
                    </div>
                    <div>
                      <Badge>{formatCourseType(lesson.type)}</Badge>
                      <h2 className="mt-4 text-2xl font-extrabold leading-tight">{lesson.title}</h2>
                      <p className="mt-3 text-base leading-7 text-[var(--muted)]">{lesson.description}</p>
                    </div>
                    <Button asChild className="mt-auto" variant={lesson.completed ? "secondary" : "primary"}>
                      <Link to="/lessons/$lessonId" params={{ lessonId: lesson.id }}>
                        打开课程
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
