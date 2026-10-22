import { createFileRoute } from "@tanstack/react-router";
import { CalendarPage } from "@/components/pages/calendar";

export const Route = createFileRoute("/calendar/")({ component: CalendarPage });
