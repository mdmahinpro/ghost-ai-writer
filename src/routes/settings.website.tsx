import { createFileRoute } from "@tanstack/react-router";
import { WebsiteSettings } from "@/components/pages/settings";

export const Route = createFileRoute("/settings/website")({ component: WebsiteSettings });
