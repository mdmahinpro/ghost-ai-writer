import { createFileRoute } from "@tanstack/react-router";
import { PlansPage } from "@/components/pages/plans";

export const Route = createFileRoute("/topic-plans/")({ component: PlansPage });
