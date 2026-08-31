import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import { AuthProvider } from "@/lib/auth";
import { RegistriesProvider } from "@/lib/registries";
import { WorkbenchProvider } from "@/lib/workbench";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <AuthProvider>
      <RegistriesProvider>
        <WorkbenchProvider>
          <RouterProvider router={router} />
        </WorkbenchProvider>
      </RegistriesProvider>
    </AuthProvider>
  </StrictMode>,
);
