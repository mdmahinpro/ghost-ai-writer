import { createFileRoute } from "@tanstack/react-router";
import { KeysPage } from "@/components/pages/keys";

export const Route = createFileRoute("/ai-keys")({ component: KeysPage });
