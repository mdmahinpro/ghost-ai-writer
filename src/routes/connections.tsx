import { createFileRoute } from "@tanstack/react-router";
import { ConnectionsPage } from "@/components/pages/connections";

export const Route = createFileRoute("/connections")({ component: ConnectionsPage });
