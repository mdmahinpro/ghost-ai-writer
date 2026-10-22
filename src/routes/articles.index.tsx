import { createFileRoute } from "@tanstack/react-router";
import { ArticlesPage } from "@/components/pages/articles";

export const Route = createFileRoute("/articles/")({ component: ArticlesPage });
