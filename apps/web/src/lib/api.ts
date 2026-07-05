import type {
  AuthResponse,
  DashboardResponse,
  Lesson,
  LessonDetail,
  LoginInput,
  MeResponse,
  PracticeSession,
  PracticeSubmitInput,
  PracticeSubmitResponse,
  RegisterInput,
  ReviewGrade,
  ReviewResponse,
  UpdateMeInput,
  VocabularyItem,
  VocabularyListResponse,
  VocabularyExamplesResponse,
  VocabularyPronunciationResponse
} from "@english-learning/shared";

const apiBase = import.meta.env.VITE_API_URL ?? "/api";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers
    }
  });

  const data = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const maybeError = data as { error?: { code?: string; message?: string } } | null;
    throw new ApiClientError(
      response.status,
      maybeError?.error?.code ?? "REQUEST_FAILED",
      maybeError?.error?.message ?? "Request failed."
    );
  }

  return data as T;
}

export const api = {
  register(input: RegisterInput) {
    return request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  login(input: LoginInput) {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  logout() {
    return request<{ ok: true }>("/auth/logout", { method: "POST" });
  },
  me() {
    return request<MeResponse>("/auth/me");
  },
  updateMe(input: UpdateMeInput) {
    return request<AuthResponse>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },
  dashboard() {
    return request<DashboardResponse>("/progress/dashboard");
  },
  vocabulary(params?: {
    level?: string;
    q?: string;
    topic?: string;
    status?: string;
    shuffle?: "daily";
    page?: number;
    pageSize?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.level) query.set("level", params.level);
    if (params?.q) query.set("q", params.q);
    if (params?.topic && params.topic !== "all") query.set("topic", params.topic);
    if (params?.status && params.status !== "all") query.set("status", params.status);
    if (params?.shuffle) query.set("shuffle", params.shuffle);
    if (params?.page) query.set("page", String(params.page));
    if (params?.pageSize) query.set("pageSize", String(params.pageSize));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<VocabularyListResponse>(`/vocabulary${suffix}`);
  },
  reviewDue() {
    return request<{ items: VocabularyItem[] }>("/vocabulary/review-due");
  },
  vocabularyPronunciation(id: string) {
    return request<VocabularyPronunciationResponse>(`/vocabulary/${id}/pronunciation`);
  },
  vocabularyExamples(id: string) {
    return request<VocabularyExamplesResponse>(`/vocabulary/${id}/examples`);
  },
  reviewVocabulary(id: string, grade: ReviewGrade) {
    return request<ReviewResponse>(`/vocabulary/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ grade })
    });
  },
  lessons(params?: { type?: string; level?: string }) {
    const query = new URLSearchParams();
    if (params?.type) query.set("type", params.type);
    if (params?.level) query.set("level", params.level);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<{ lessons: Lesson[] }>(`/lessons${suffix}`);
  },
  lesson(id: string) {
    return request<LessonDetail>(`/lessons/${id}`);
  },
  completeLesson(id: string) {
    return request<{ lesson: Lesson }>(`/lessons/${id}/complete`, { method: "POST" });
  },
  practiceSession() {
    return request<PracticeSession>("/practice/session");
  },
  submitPractice(input: PracticeSubmitInput) {
    return request<PracticeSubmitResponse>("/practice/submit", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }
};
