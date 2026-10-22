import { createFileRoute } from "@tanstack/react-router";
import { CalendarDetail } from "@/components/pages/calendar";

export const Route = createFileRoute("/calendar/$id")({
  component: function CalendarRoute() {
    const { id } = Route.useParams();
    return <CalendarDetail id={id} />;
  },
});
