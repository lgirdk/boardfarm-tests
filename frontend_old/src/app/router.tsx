import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./AppShell";
import { LoginPage } from "./LoginPage";
import { RequireAuth } from "@/lib/auth";
import { listPrimaryApps } from "./registry";
import { PipelineRunPage } from "@/modules/pipelines/PipelineRunPage";
import { RunDetailPage } from "@/modules/runs/RunDetailPage";

/**
 * Routes are derived from the application registry (one child route per
 * registered app), plus the two parameterized detail screens and the
 * unauthenticated /login. The shell is guarded by RequireAuth.
 */
const appRoutes = listPrimaryApps().map((app) =>
  app.path === ""
    ? { index: true as const, element: <app.Component /> }
    : { path: app.path, element: <app.Component /> },
);

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      ...appRoutes,
      { path: "pipelines/:name", element: <PipelineRunPage /> },
      { path: "runs/:id", element: <RunDetailPage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
