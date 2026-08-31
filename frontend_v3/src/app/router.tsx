import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./AppShell";
import { LoginPage } from "./LoginPage";
import { RequireAuth } from "@/lib/auth";
import { V3_APPS } from "./registry";
import { DashboardApp } from "@/modules/dashboard/DashboardApp";
import { PipelineRunPage } from "@/modules/pipelines/PipelineRunPage";
import { RunDetailPage } from "@/modules/runs/RunDetailPage";
import { NewRunPage } from "@/modules/runs/NewRunPage";
import { EnvironmentsApp } from "@/modules/environments/EnvironmentsApp";

/**
 * V3 routes derived from the V3 app registry. Each app gets a route at
 * /{appId} plus sub-routes for its sections. Detail routes (run detail,
 * pipeline run, new run) are nested under their parent app.
 *
 * Home (/) renders the DashboardApp as the launcher body content.
 */

// Build child routes from the registry
const appRoutes = V3_APPS.flatMap((app) => {
  const children = [];

  // Index route renders the app's Component
  children.push({
    index: true as const,
    element: <app.Component />,
  });

  // Section routes (skip the first section — that's the index)
  app.sections.slice(1).forEach((sec) => {
    // Special case: lab/envs uses a different component
    if (app.id === "lab" && sec.id === "envs") {
      children.push({
        path: sec.id,
        element: <EnvironmentsApp />,
      });
    } else {
      children.push({
        path: sec.id,
        element: <app.Component />,
      });
    }
  });

  // Special detail routes nested under specific apps
  if (app.id === "runs") {
    children.push(
      { path: "new", element: <NewRunPage /> },
      { path: ":id", element: <RunDetailPage /> },
    );
  }
  if (app.id === "pipelines") {
    children.push({
      path: ":name",
      element: <PipelineRunPage />,
    });
  }

  return [{ path: app.id, children }];
});

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
      // Home route — DashboardApp content under the launcher
      { index: true, element: <DashboardApp /> },
      ...appRoutes,
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
