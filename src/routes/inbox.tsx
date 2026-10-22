import { createFileRoute } from "@tanstack/react-router";
import { InboxPage } from "@/components/pages/inbox";

export const Route = createFileRoute("/inbox")({ component: InboxPage });
