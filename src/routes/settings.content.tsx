import { createFileRoute } from "@tanstack/react-router";
import { ContentSettings } from "@/components/pages/settings";

export const Route = createFileRoute("/settings/content")({ component: ContentSettings });
