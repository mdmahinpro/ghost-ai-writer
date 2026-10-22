import { createFileRoute } from "@tanstack/react-router";
import { ResearchPage } from "@/components/pages/research";

export const Route = createFileRoute("/research")({ component: ResearchPage });
