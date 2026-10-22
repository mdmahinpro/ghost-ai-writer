import { createFileRoute } from "@tanstack/react-router";
import { WorkspacesPage } from "@/components/pages/workspaces";

export const Route = createFileRoute("/workspaces")({ component: WorkspacesPage });
