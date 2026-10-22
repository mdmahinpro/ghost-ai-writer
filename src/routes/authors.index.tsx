import { createFileRoute } from "@tanstack/react-router";
import { AuthorsPage } from "@/components/pages/authors";

export const Route = createFileRoute("/authors/")({ component: AuthorsPage });
