import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { DashboardPage } from "@/pages/DashboardPage";
import { HomePage } from "@/pages/HomePage";
import { LessonDetailPage } from "@/pages/LessonDetailPage";
import { LessonsPage } from "@/pages/LessonsPage";
import { LoginPage, RegisterPage } from "@/pages/AuthPages";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { PracticePage } from "@/pages/PracticePage";
import { ReviewPage } from "@/pages/ReviewPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { VocabularyPage } from "@/pages/VocabularyPage";

const rootRoute = createRootRoute({
  component: () => <Outlet />
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: RegisterPage
});

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/onboarding/level",
  component: OnboardingPage
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: DashboardPage
});

const vocabularyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/vocabulary",
  component: VocabularyPage
});

const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/review",
  component: ReviewPage
});

const lessonsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lessons",
  component: LessonsPage
});

const lessonDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lessons/$lessonId",
  component: () => {
    const { lessonId } = lessonDetailRoute.useParams();
    return <LessonDetailPage lessonId={lessonId} />;
  }
});

const practiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/practice",
  component: PracticePage
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  onboardingRoute,
  dashboardRoute,
  vocabularyRoute,
  reviewRoute,
  lessonsRoute,
  lessonDetailRoute,
  practiceRoute,
  settingsRoute
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
