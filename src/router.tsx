import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { applyTheme, readStoredTheme } from "@/lib/themes";
import { routeTree } from "./routeTree.gen";

if (typeof document !== "undefined") {
  applyTheme(readStoredTheme());
}

export function getRouter() {
  return createRouter({ routeTree, defaultErrorComponent: AppErrorComponent });
}
