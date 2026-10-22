import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "@/components/pages/account";

export const Route = createFileRoute("/account")({ component: AccountPage });
