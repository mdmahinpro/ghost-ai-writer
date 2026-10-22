import { createFileRoute } from "@tanstack/react-router";
import { PlanDetail } from "@/components/pages/plans";

export const Route = createFileRoute("/topic-plans/$id")({
  component: function PlanRoute() {
    const { id } = Route.useParams();
    return <PlanDetail id={id} />;
  },
});
