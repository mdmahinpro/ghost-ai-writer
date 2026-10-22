import { createFileRoute } from "@tanstack/react-router";
import { CreatePage } from "@/components/pages/create";

export const Route = createFileRoute("/create")({ component: CreatePage });
