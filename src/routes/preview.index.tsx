import { createFileRoute } from "@tanstack/react-router";
import { PreviewHome } from "@/components/pages/preview";

export const Route = createFileRoute("/preview/")({ component: PreviewHome });
