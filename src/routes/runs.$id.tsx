import { createFileRoute } from "@tanstack/react-router";
import { RunDetail } from "@/components/pages/runs";

export const Route = createFileRoute("/runs/$id")({
  component: function RunRoute() {
    const { id } = Route.useParams();
    return <RunDetail id={id} />;
  },
});
