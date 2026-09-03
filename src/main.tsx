import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/dm-sans";
import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { queryClient, router } from "./router";
import { applyStoredTheme } from "./lib/theme";

applyStoredTheme();

const rootEl = document.getElementById("root")!;

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
